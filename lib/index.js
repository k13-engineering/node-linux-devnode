import fs from "fs";

import { createRequire } from "module";
const require = createRequire(
  import.meta.url);

const opendev = require("../build/Release/opendev.node");

const S_IFCHR = 0x2000;
const S_IFBLK = 0x6000;

const O_RDONLY = 0x00;
const O_WRONLY = 0x01;
const O_RDWR = 0x02;

const fileDescriptorToHandle = async ({ fd, flags }) => {
  const fh = await fs.promises.open(`/proc/self/fd/${fd}`, flags);

  try {
    await new Promise((resolve, reject) => {
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
  }

  return fh;
};

const methodToNative = ({ method }) => {
  if (method === "METHOD_AUTO") {
    return 0;
  } else if (method === "METHOD_SEARCH_IN_DEV") {
    return 1;
  } else if (method === "METHOD_MOUNT_NAMESPACE_TMPFS") {
    return 2;
  } else {
    throw new Error(`unsupported method "${method}"`);
  }
};

const typeToNative = ({ type }) => {
  if (type === "character") {
    return S_IFCHR;
  } else if (type === "block") {
    return S_IFBLK;
  } else {
    throw new Error(`unsupported type "${type}"`);
  }
};

const flagsToNative = ({ flags }) => {
  if (flags === "r") {
    return O_RDONLY;
  } else if (flags === "w") {
    return O_WRONLY;
  } else if (flags === "r+") {
    return O_RDWR;
  } else {
    throw new Error(`invalid flags "${flags}", only "r", "w" and "r+" supported`);
  }
};

const open = async ({ method = "METHOD_AUTO", type, major, minor, flags }) => {
  const methodNative = methodToNative({ method });
  const typeNative = typeToNative({ type });
  const flagsNative = flagsToNative({ flags });

  const fd = await opendev(typeNative, major, minor, flagsNative, methodNative);

  return await fileDescriptorToHandle({ fd, flags });
};

export default {
  open
};
