import { openCharacterDeviceBySysfsDevPath } from "../lib/index.ts";
import nodeFs from "node:fs";

const { error: openError, fd } = openCharacterDeviceBySysfsDevPath({
  sysfsDevPath: "/sys/class/misc/udmabuf/dev",
  flags: BigInt(nodeFs.constants.O_RDWR)
});

if (openError !== undefined) {
  throw openError;
}

console.log(`opened udmabuf device with fd ${fd}`);
nodeFs.closeSync(fd);
