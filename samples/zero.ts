import { openCharacterDevice } from "../lib/index.ts";
import nodeFs from "node:fs";

const { error: openError, fd } = openCharacterDevice({
  major: 1,
  minor: 5,
  flags: 0n
});

if (openError !== undefined) {
  throw Error("failed to open /dev/zero character device", { cause: openError });
}

const buffer = new Uint8Array(32);
const bytesRead = nodeFs.readSync(fd, buffer, 0, buffer.length, 0);
const zero = buffer.slice(0, bytesRead);
console.log("zero =", zero);

nodeFs.closeSync(fd);
