import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { makedev, devToMajorMinor } from "./dev-util.ts";

describe("dev-util", () => {

  describe("makedev", () => {

    it("should produce a known dev number for major=0, minor=0", () => {
      const dev = makedev({ major: 0, minor: 0 });
      assert.equal(dev, 0n);
    });

    it("should produce a known dev number for major=1, minor=3 (null device)", () => {
      const dev = makedev({ major: 1, minor: 3 });
      assert.equal(dev, 259n);
    });

    it("should produce a known dev number for major=8, minor=0 (sda)", () => {
      const dev = makedev({ major: 8, minor: 0 });
      assert.equal(dev, 2048n);
    });

  });

  describe("devToMajorMinor", () => {

    it("should return major=0, minor=0 for dev=0", () => {
      const result = devToMajorMinor({ dev: 0n });
      assert.deepEqual(result, { major: 0, minor: 0 });
    });

    it("should return major=1, minor=3 for dev=259", () => {
      const result = devToMajorMinor({ dev: 259n });
      assert.deepEqual(result, { major: 1, minor: 3 });
    });

    it("should return major=8, minor=0 for dev=2048", () => {
      const result = devToMajorMinor({ dev: 2048n });
      assert.deepEqual(result, { major: 8, minor: 0 });
    });

  });

  describe("reciprocity", () => {

    const testCases = [
      { major: 0, minor: 0 },
      { major: 1, minor: 3 },
      { major: 1, minor: 5 },
      { major: 8, minor: 0 },
      { major: 8, minor: 1 },
      { major: 136, minor: 0 },
      { major: 226, minor: 0 },
      { major: 226, minor: 128 },
      { major: 4095, minor: 255 },
      { major: 0, minor: 1048575 },
      { major: 4095, minor: 1048575 },
      { major: 256, minor: 256 },
      { major: 511, minor: 65535 },
    ];

    for (const { major, minor } of testCases) {
      it(`devToMajorMinor(makedev({ major: ${major}, minor: ${minor} })) should return the original values`, () => {
        const dev = makedev({ major, minor });
        const result = devToMajorMinor({ dev });
        assert.deepEqual(result, { major, minor });
      });
    }

    for (const { major, minor } of testCases) {
      it(`makedev(devToMajorMinor({ dev })) should return the original dev for major=${major}, minor=${minor}`, () => {
        const dev = makedev({ major, minor });
        const decomposed = devToMajorMinor({ dev });
        const recomposed = makedev(decomposed);
        assert.equal(recomposed, dev);
      });
    }

  });

});
