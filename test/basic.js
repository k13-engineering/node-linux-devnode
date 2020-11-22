/* global describe */
/* global it */

import devnode from "../lib/index.js";
import assert from "assert";

const isBufferZero = (buffer) => {
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer.readUInt8(i);
    if (value !== 0) {
      return false;
    }
  }

  return true;
};

describe("devnode", () => {
  [
    "METHOD_AUTO",
    "METHOD_SEARCH_IN_DEV",
    "METHOD_MOUNT_NAMESPACE_TMPFS"
  ].forEach((method) => {
    describe(`method ${method}`, () => {
      it("should read from /dev/zero (1:5) correctly", async () => {
        const fh = await devnode.open({
          method,
          "type": "character",
          "major": 1,
          "minor": 5,
          "flags": "r"
        });

        try {
          const result = await fh.read(Buffer.alloc(32), 0, 32, 0);
          assert(isBufferZero(result));
        } finally {
          await fh.close();
        }
      });
    });
  });
});
