import type { TLinuxInterface } from "./linux-interface.ts";
import type { TDeviceNodeOpener } from "./open-interface.ts";

const makedev = ({ major, minor }: { major: number, minor: number }): bigint => {
  const maj = BigInt(major);
  const min = BigInt(minor);
  return ((maj & 0xfffff000n) << 32n) |
         ((maj & 0x00000fffn) << 8n) |
         ((min & 0xffffff00n) << 12n) |
         (min & 0x000000ffn);
};

const S_IFCHR = 0x2000n;
const S_IFBLK = 0x6000n;

const createDeviceNodeOpenerViaFsmount = ({
  linuxInterface,
  mountFd
}: {
  linuxInterface: TLinuxInterface;
  mountFd: number;
}): TDeviceNodeOpener => {

  let closed = false;

  const mknodAndOpen = ({
    mode,
    dev,
    openFlags
  }: {
    mode: bigint;
    dev: bigint;
    openFlags: bigint;
  // eslint-disable-next-line complexity
  }) => {

    if (closed) {
      throw Error("aready closed");
    }

    const path = "dev";

    const { errno: mknodatErrno } = linuxInterface.mknodat({
      dirfd: mountFd,
      path,
      dev,
      mode
    });

    if (mknodatErrno !== undefined) {
      return {
        error: Error(`mknodat syscall failed with errno ${mknodatErrno}`),
        fd: undefined
      };
    }

    const { errno: openatErrno, fd } = linuxInterface.openat({
      dirfd: mountFd,
      path,
      flags: openFlags,
      mode: 0n
    });

    // unlink in any case
    const { errno: unlinkAtErrno } = linuxInterface.unlinkat({
      dirfd: mountFd,
      path,
      flags: 0n
    });

    if (unlinkAtErrno !== undefined) {
      // this should not fail, if it does, abort
      throw Error([
        `unlinkat syscall failed with errno ${unlinkAtErrno}`,
        `while trying to unlink device node at path "${path}" in mount with fd ${mountFd}`
      ].join(" "));
    }

    if (openatErrno !== undefined) {
      return {
        error: Error(`openat syscall failed with errno ${openatErrno}`),
        fd: undefined
      };
    }

    return {
      error: undefined,
      fd
    };
  };

  const openCharacterDevice: TDeviceNodeOpener["openCharacterDevice"] = ({
    major,
    minor,
    flags
  }) => {
    return mknodAndOpen({
      mode: S_IFCHR | 0o666n,
      openFlags: flags,
      dev: makedev({ major, minor })
    });
  };

  const openBlockDevice: TDeviceNodeOpener["openBlockDevice"] = ({
    major,
    minor,
    flags
  }) => {
    return mknodAndOpen({
      mode: S_IFBLK | 0o666n,
      openFlags: flags,
      dev: makedev({ major, minor })
    });
  };

  const close: TDeviceNodeOpener["close"] = () => {
    if (closed) {
      throw Error("aready closed");
    }

    closed = true;

    const { errno: closeErrno } = linuxInterface.close({ fd: mountFd });
    if (closeErrno !== undefined) {
      throw Error(`close syscall failed with errno ${closeErrno} while trying to close mount fd ${mountFd}`);
    }
  };

  return {
    openCharacterDevice,
    openBlockDevice,
    close
  };
};

const FSCONFIG_CMD_CREATE = 6n;

const EPERM = 1;

const createFsmountDeviceNodeOpener = ({
  linuxInterface
}: {
  linuxInterface: TLinuxInterface
// eslint-disable-next-line complexity
}): { error: Error, opener: undefined } | { error: undefined, opener: TDeviceNodeOpener } => {

  const configureAndMount = ({ fsfd }: { fsfd: number }): { error: Error, mountFd: undefined } | { error: undefined, mountFd: number } => {
    const { errno: fsconfigErrno } = linuxInterface.fsconfig({
      fd: fsfd,
      cmd: FSCONFIG_CMD_CREATE,
      aux: 0n,
      key: undefined,
      value: undefined
    });

    if (fsconfigErrno !== undefined) {
      return {
        error: Error(`fsconfig syscall failed with errno ${fsconfigErrno}`),
        mountFd: undefined
      };
    }

    const { errno: mountErrno, mountFd } = linuxInterface.fsmount({
      fsfd,
      flags: 0n,
      attr_flags: 0n
    });

    if (mountErrno !== undefined) {
      return {
        error: Error(`fsmount syscall failed with errno ${mountErrno}`),
        mountFd: undefined
      };
    }

    return {
      error: undefined,
      mountFd
    };
  };

  const { errno: fsopenErrno, fsfd } = linuxInterface.fsopen({
    fsname: "tmpfs",
    flags: 0n
  });

  if (fsopenErrno !== undefined) {

    if (fsopenErrno === EPERM) {
      return {
        error: Error(`missing permissions for fsmount`),
        opener: undefined
      };
    }

    return {
      error: Error(`fsopen syscall failed with errno ${fsopenErrno}`),
      opener: undefined
    };
  }

  const { error: configureAndMountError, mountFd } = configureAndMount({ fsfd });

  // close the fsfd in any case
  const { errno: closeErrno } = linuxInterface.close({ fd: fsfd });
  if (closeErrno !== undefined) {
    // this should not fail, if it does, abort
    throw Error(`close syscall failed with errno ${closeErrno} while trying to close fsfd ${fsfd}`);
  }

  if (configureAndMountError !== undefined) {
    return {
      error: configureAndMountError,
      opener: undefined
    };
  }

  const opener = createDeviceNodeOpenerViaFsmount({
    linuxInterface,
    mountFd
  });

  return {
    error: undefined,
    opener
  };
};

export {
  createFsmountDeviceNodeOpener
};
