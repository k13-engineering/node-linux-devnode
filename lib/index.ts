import fs from "fs";

import { createRequire } from "module";
const require = createRequire(
  import.meta.url);

// eslint-disable-next-line max-params
type TNativeOpendev = (type: number, major: number, minor: number, flags: number, method: number) => Promise<number>;
const opendev = require("../build/Release/opendev.node") as TNativeOpendev;

const S_IFCHR = 0x2000;
const S_IFBLK = 0x6000;

const O_RDONLY = 0x00;
const O_WRONLY = 0x01;
const O_RDWR = 0x02;

type TMethod = "METHOD_AUTO" | "METHOD_SEARCH_IN_DEV" | "METHOD_MOUNT_NAMESPACE_TMPFS";
type TDeviceType = "character" | "block";
type TFlags = "r" | "w" | "r+";

const fileDescriptorToHandle = async ({ fd, flags }: { fd: number; flags: TFlags }): Promise<fs.promises.FileHandle> => {
  const fh = await fs.promises.open(`/proc/self/fd/${fd}`, flags);

  try {
    await new Promise<void>((resolve, reject) => {
      fs.close(fd, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (ex) {
    await fh.close();
    throw ex;
  }

  return fh;
};

const methodToNative = ({ method }: { method: TMethod }): number => {
  if (method === "METHOD_AUTO") {
    return 0;
  } else if (method === "METHOD_SEARCH_IN_DEV") {
    return 1;
  } else if (method === "METHOD_MOUNT_NAMESPACE_TMPFS") {
    return 2;
  } else {
    throw Error(`unsupported method "${method}"`);
  }
};

const typeToNative = ({ type }: { type: TDeviceType }): number => {
  if (type === "character") {
    return S_IFCHR;
  } else if (type === "block") {
    return S_IFBLK;
  } else {
    throw Error(`unsupported type "${type}"`);
  }
};

const flagsToNative = ({ flags }: { flags: TFlags }): number => {
  if (flags === "r") {
    return O_RDONLY;
  } else if (flags === "w") {
    return O_WRONLY;
  } else if (flags === "r+") {
    return O_RDWR;
  } else {
    throw Error(`invalid flags "${flags}", only "r", "w" and "r+" supported`);
  }
};

const open = async ({
  method = "METHOD_AUTO",
  type,
  major,
  minor,
  flags
}: {
  method?: TMethod;
  type: TDeviceType;
  major: number;
  minor: number;
  flags: TFlags
}): Promise<fs.promises.FileHandle> => {
  const methodNative = methodToNative({ method });
  const typeNative = typeToNative({ type });
  const flagsNative = flagsToNative({ flags });

  const fd = await opendev(typeNative, major, minor, flagsNative, methodNative);

  return await fileDescriptorToHandle({ fd, flags });
};

// eslint-disable-next-line k13-engineering/no-default-export
export default {
  open
};

export type {
  TMethod,
  TDeviceType,
  TFlags
};
