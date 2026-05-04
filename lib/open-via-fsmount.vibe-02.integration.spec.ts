import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { createDefaultLinuxInterface } from "./linux-interface.ts";
import { createFsmountDeviceNodeOpener } from "./open-via-fsmount.ts";

describe("createFsmountDeviceNodeOpener", () => {
  // eslint-disable-next-line no-restricted-syntax
  it("can open /dev/zero through fsmount when the process has permission", function () {
    const linuxInterface = createDefaultLinuxInterface();
    const factoryResult = createFsmountDeviceNodeOpener({ linuxInterface });

    if (factoryResult.error !== undefined) {
      if (factoryResult.error.message === "missing permissions for fsmount") {
        // eslint-disable-next-line fp/no-this
        this.skip();
      }

      throw factoryResult.error;
    }

    const openResult = factoryResult.opener.openCharacterDevice({
      major: 1,
      minor: 5,
      flags: 0n,
    });

    try {
      if (openResult.error !== undefined) {
        throw openResult.error;
      }

      assert.equal(linuxInterface.close({ fd: openResult.fd }).errno, undefined);
    } finally {
      factoryResult.opener.close();
    }
  });
});
