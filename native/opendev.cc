#include <node_api.h>

#include <dirent.h>
#include <errno.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include <fcntl.h>
#include <pthread.h>
#include <unistd.h>

#include <sys/mount.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <sys/types.h>

namespace devnode {

struct worker_data_in {
  mode_t mode;
  int major;
  int minor;
  int flags;
};

struct worker_data_out {
  int fd;
  int ret;
};

struct worker_data {
  struct worker_data_in data_in;
  struct worker_data_out data_out;
};

struct opendev_ctx {
  int method;

  struct worker_data_in data_in;
  struct worker_data_out data_out;

  napi_deferred deferred;
  napi_async_work async_work;
};

enum {
  // Tries METHOD_SEARCH_IN_DEV first, then falls back to METHOD_MOUNT_NAMESPACE_TMPFS.
  // This is the default and recommended method.
  METHOD_AUTO = 0,

  // Search for an already existing device node in /dev directory.
  // Normally this should work, but can lead to problems when running under
  // e.g. Docker where /dev is only updated on container restarts.
  // When using hotplug or specially /dev/loop-control it can happen that certain devices
  // are not in /dev in Docker environments.
  METHOD_SEARCH_IN_DEV = 1,

  // Create a new mount namespace, mount a tmpfs and create a device node
  // there and open it. This strategy should always work but requires
  // CAP_SYS_ADMIN (i.e. root rights)
  METHOD_MOUNT_NAMESPACE_TMPFS = 2
};

static napi_status create_error_from_errno(napi_env env, int error_code, napi_value* error) {
  napi_value code;
  napi_value message;
  napi_status status;

  status = napi_create_string_utf8(env, "", -1, &code);
  if (status != napi_ok) return status;

  status = napi_create_string_utf8(env, strerror(error_code), -1, &message);
  if (status != napi_ok) return status;

  return napi_create_error(env, code, message, error);
};

typedef int (*find_callback_t)(struct stat* st, void* arg);

static int find_entry_in(const char* folder, find_callback_t callback, void* callback_arg, char* result, ssize_t max) {
  DIR* d;
  ssize_t res;
  int done = 0;
  struct stat stbuf;
  struct dirent* entry;

  d = opendir(folder);
  if(d == NULL) {
    return errno;
  }

  errno = 0;

  while(!done) {
    entry = readdir(d);
    if(entry == NULL) {
      if(errno == 0) {
        closedir(d);
        return ENOENT;
      } else {
        return errno;
      }
    }

    res = snprintf(result, max, "%s/%s", folder, entry->d_name);
    if(res >= max) {
      closedir(d);
      return ENOMEM;
    }

    res = stat(result, &stbuf);
    if(res != 0) {
      res = errno;
      closedir(d);
      return res;
    }

    done = callback(&stbuf, callback_arg);
  }

  res = closedir(d);
  if(res != 0) {
    return errno;
  }

  return 0;
}

static int find_dir(struct stat* st, void* arg) {
  return S_ISDIR(st->st_mode);
}

static int mount_tmpfs_somewhere(char* folder, size_t max) {
  int res;

  // we need to find any entry in the root filesystem that is a folder
  // normally this should not be a problem as an empty root filesystem is unlikely
  res = find_entry_in("/", find_dir, NULL, folder, max);
  if(res != 0) {
    return res;
  }

  res = mount("none", folder, "tmpfs", 0, NULL);
  if(res != 0) {
    return errno;
  }

  return 0;
}

static int do_open_via_tmpfs(mode_t mode, int major, int minor, int flags, int* fd) {
  int res;
  char work_folder[PATH_MAX];

  // first we need to unshare the mount namespace
  res = unshare(CLONE_NEWNS | CLONE_FS);
  if(res != 0) {
    return errno;
  }

  // then we make our root mount private so other processes will not
  // get disturbed by us
  res = mount("none", "/", NULL, MS_REC | MS_PRIVATE, NULL);
  if(res != 0) {
    return errno;
  }

  // in order to create a device node, we need to mount a tmpfs somewhere
  // this is to avoid to create a file somewhere visible to other processes
  // also, some distributions use 'nodev' mount flags on /tmp so to
  // be save we mount a tmpfs in our own mount namespace
  res = mount_tmpfs_somewhere(work_folder, sizeof(work_folder));
  if(res != 0) {
    return res;
  }

  // change to working directory to the newly mounted tmpfs
  // this is for simplicity reasons that we don't need to prepend
  // the dynamic mount folder name to mknod and open operations
  res = chdir(work_folder);
  if(res != 0) {
    return errno;
  }

  res = mknod("./devnode", mode | 0660, makedev(major, minor));
  if(res < 0) {
    return errno;
  }

  *fd = open("./devnode", flags);
  if(*fd < 0) {
    return errno;
  }

  return 0;
}

static void* open_via_tmpfs_worker(void* arg) {
  struct worker_data* data = (struct worker_data*) arg;

  mode_t mode = data->data_in.mode;
  int major = data->data_in.major;
  int minor = data->data_in.minor;
  int flags = data->data_in.flags;

  data->data_out.ret = do_open_via_tmpfs(mode, major, minor, flags, &data->data_out.fd);

  return NULL;
}

static int find_devnode(struct stat* st, void* arg) {
  struct worker_data_in* data_in = (struct worker_data_in*) arg;
  return ((data_in->mode & st->st_mode) == data_in->mode)
      && makedev(data_in->major, data_in->minor) == st->st_rdev;
}

static int open_via_dev(mode_t mode, int major, int minor, int flags, int* fd) {
  int res;
  char device_path[PATH_MAX];

  struct worker_data_in data_in;
  data_in.mode = mode;
  data_in.major = major;
  data_in.minor = minor;

  res = find_entry_in("/dev", find_devnode, &data_in, device_path, sizeof(device_path));
  if(res != 0) {
    return res;
  }

  *fd = open(device_path, flags);
  if(*fd < 0) {
    return errno;
  }

  return 0;
}

static int open_via_tmpfs(mode_t mode, int major, int minor, int flags, int* fd) {
  struct worker_data data;
  pthread_t worker_thread;
  void* worker_ret;

  data.data_in.mode = mode;
  data.data_in.major = major;
  data.data_in.minor = minor;
  data.data_in.flags = flags;

  data.data_out.fd = -1;
  data.data_out.ret = ENOSYS;

  // for creating a new mount namespace we must create a new thread so
  // the the JavaScript context stays sane
  pthread_create(&worker_thread, NULL, open_via_tmpfs_worker, &data);
  pthread_join(worker_thread, &worker_ret);

  if(worker_ret == PTHREAD_CANCELED) {
    return ECHILD;
  }

  *fd = data.data_out.fd;
  return data.data_out.ret;
}

static int do_opendev(int method, mode_t mode, int major, int minor, int flags, int* fd) {
  int res;

  if(method == METHOD_AUTO || method == METHOD_SEARCH_IN_DEV) {
    res = open_via_dev(mode, major, minor, flags, fd);
    if(res == 0) {
      return 0;
    } else if(res != ENOENT) {
      return res;
    }
  }

  if(method == METHOD_AUTO || method == METHOD_MOUNT_NAMESPACE_TMPFS) {
    return open_via_tmpfs(mode, major, minor, flags, fd);
  }

  return ENOSYS;
}

static void opendev_async_work(napi_env env, void* data) {
  struct opendev_ctx* ctx = (struct opendev_ctx*) data;

  mode_t mode = ctx->data_in.mode;
  int major = ctx->data_in.major;
  int minor = ctx->data_in.minor;
  int flags = ctx->data_in.flags;

  ctx->data_out.ret = do_opendev(ctx->method, mode, major, minor, flags, &ctx->data_out.fd);
}

static void opendev_async_work_done(napi_env env, napi_status status, void* data) {
  struct opendev_ctx* ctx = (struct opendev_ctx*) data;
  napi_value result;
  napi_value error;

  int ret = ctx->data_out.ret;
  int fd = ctx->data_out.fd;

  if (ret == 0) {
      status = napi_create_int32(env, fd, &result);
      if (status != napi_ok) return;

      status = napi_resolve_deferred(env, ctx->deferred, result);
      if (status != napi_ok) return;
  }
  else {
      status = create_error_from_errno(env, ret, &error);
      if (status != napi_ok) return;

      status = napi_reject_deferred(env, ctx->deferred, error);
      if (status != napi_ok) return;
  }

  napi_delete_async_work(env, ctx->async_work);
  free(ctx);
}

static napi_value opendev_native(napi_env env, napi_callback_info info) {
  napi_status status;
  napi_value resource_name;
  napi_value promise;

  napi_value args[5];
  size_t argc = sizeof(args) / sizeof(args[0]);

  uint32_t mode;
  uint32_t major;
  uint32_t minor;
  uint32_t flags;
  uint32_t method;

  struct opendev_ctx* ctx;

  status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (status != napi_ok) return NULL;

  status = napi_get_value_uint32(env, args[0], &mode);
  if (status != napi_ok) return NULL;

  status = napi_get_value_uint32(env, args[1], &major);
  if (status != napi_ok) return NULL;

  status = napi_get_value_uint32(env, args[2], &minor);
  if (status != napi_ok) return NULL;

  status = napi_get_value_uint32(env, args[3], &flags);
  if (status != napi_ok) return NULL;

  status = napi_get_value_uint32(env, args[4], &method);
  if (status != napi_ok) return NULL;

  ctx = (struct opendev_ctx*) malloc(sizeof(*ctx));
  ctx->method = method;
  ctx->data_in.mode = mode;
  ctx->data_in.major = major;
  ctx->data_in.minor = minor;
  ctx->data_in.flags = flags;

  status = napi_create_promise(env, &ctx->deferred, &promise);
  if (status != napi_ok) return NULL;

  status = napi_create_string_utf8(env, "opendev", -1, &resource_name);
  if (status != napi_ok) return NULL;

  status = napi_create_async_work(env, NULL, resource_name, opendev_async_work, opendev_async_work_done, ctx, &ctx->async_work);
  if (status != napi_ok) return NULL;

  napi_queue_async_work(env, ctx->async_work);
  if (status != napi_ok) return NULL;

  return promise;
}

napi_value init(napi_env env, napi_value exports) {
  napi_status status;

  status = napi_create_function(env, NULL, 0, opendev_native, NULL, &exports);
  if (status != napi_ok) return NULL;

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)

}
