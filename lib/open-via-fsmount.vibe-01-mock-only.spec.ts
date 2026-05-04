import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { type TLinuxInterface } from "./linux-interface.ts";
import type { TDeviceNodeOpener } from "./open-interface.ts";
import { createFsmountDeviceNodeOpener } from "./open-via-fsmount.ts";

type TFsopenArgs = Parameters<TLinuxInterface["fsopen"]>[0];
type TFsconfigArgs = Parameters<TLinuxInterface["fsconfig"]>[0];
type TFsmountArgs = Parameters<TLinuxInterface["fsmount"]>[0];
type TMknodatArgs = Parameters<TLinuxInterface["mknodat"]>[0];
type TOpenatArgs = Parameters<TLinuxInterface["openat"]>[0];
type TUnlinkatArgs = Parameters<TLinuxInterface["unlinkat"]>[0];
type TCloseArgs = Parameters<TLinuxInterface["close"]>[0];

type TLinuxCall =
  | { name: "fsopen"; args: TFsopenArgs }
  | { name: "fsconfig"; args: TFsconfigArgs }
  | { name: "fsmount"; args: TFsmountArgs }
  | { name: "mknodat"; args: TMknodatArgs }
  | { name: "openat"; args: TOpenatArgs }
  | { name: "unlinkat"; args: TUnlinkatArgs }
  | { name: "close"; args: TCloseArgs };

type TFakeLinuxBehaviors = {
  fsopen?: TLinuxInterface["fsopen"];
  fsconfig?: TLinuxInterface["fsconfig"];
  fsmount?: TLinuxInterface["fsmount"];
  mknodat?: TLinuxInterface["mknodat"];
  openat?: TLinuxInterface["openat"];
  unlinkat?: TLinuxInterface["unlinkat"];
  close?: TLinuxInterface["close"];
};

const fakeDescriptors = {
  fsfd: 101,
  mountFd: 202,
  firstOpenedFd: 303,
};

const createFakeLinuxInterface = ({
  behaviors = {},
}: {
  behaviors?: TFakeLinuxBehaviors;
} = {}) => {
  let calls: TLinuxCall[] = [];
  let nextOpenedFd = fakeDescriptors.firstOpenedFd;

  const recordCall = ({ call }: { call: TLinuxCall }) => {
    calls = [
      ...calls,
      call,
    ];
  };

  const linuxInterface: TLinuxInterface = {
    fsopen: (args) => {
      recordCall({ call: { name: "fsopen", args } });

      if (behaviors.fsopen !== undefined) {
        return behaviors.fsopen(args);
      }

      return {
        errno: undefined,
        fsfd: fakeDescriptors.fsfd,
      };
    },
    fsconfig: (args) => {
      recordCall({ call: { name: "fsconfig", args } });

      if (behaviors.fsconfig !== undefined) {
        return behaviors.fsconfig(args);
      }

      return {
        errno: undefined,
      };
    },
    fsmount: (args) => {
      recordCall({ call: { name: "fsmount", args } });

      if (behaviors.fsmount !== undefined) {
        return behaviors.fsmount(args);
      }

      return {
        errno: undefined,
        mountFd: fakeDescriptors.mountFd,
      };
    },
    mknodat: (args) => {
      recordCall({ call: { name: "mknodat", args } });

      if (behaviors.mknodat !== undefined) {
        return behaviors.mknodat(args);
      }

      return {
        errno: undefined,
      };
    },
    openat: (args) => {
      recordCall({ call: { name: "openat", args } });

      if (behaviors.openat !== undefined) {
        return behaviors.openat(args);
      }

      const fd = nextOpenedFd;
      nextOpenedFd += 1;

      return {
        errno: undefined,
        fd,
      };
    },
    unlinkat: (args) => {
      recordCall({ call: { name: "unlinkat", args } });

      if (behaviors.unlinkat !== undefined) {
        return behaviors.unlinkat(args);
      }

      return {
        errno: undefined,
      };
    },
    close: (args) => {
      recordCall({ call: { name: "close", args } });

      if (behaviors.close !== undefined) {
        return behaviors.close(args);
      }

      return {
        errno: undefined,
      };
    },
  };

  return {
    calls: () => {
      return calls;
    },
    linuxInterface,
  };
};

const createOpenerOrThrow = ({
  linuxInterface,
}: {
  linuxInterface: TLinuxInterface;
}): TDeviceNodeOpener => {
  const result = createFsmountDeviceNodeOpener({ linuxInterface });

  if (result.error !== undefined) {
    throw result.error;
  }

  return result.opener;
};

const openCharacterDeviceOrThrow = ({
  opener,
}: {
  opener: TDeviceNodeOpener;
}) => {
  const result = opener.openCharacterDevice({
    major: 1,
    minor: 5,
    flags: 0n,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  return result.fd;
};

const listCallNames = ({ calls }: { calls: TLinuxCall[] }) => {
  return calls.map((call) => {
    return call.name;
  });
};

const listCallsByName = <TName extends TLinuxCall["name"]>({
  calls,
  name,
}: {
  calls: TLinuxCall[];
  name: TName;
}) => {
  return calls.filter((call): call is Extract<TLinuxCall, { name: TName }> => {
    return call.name === name;
  });
};

const assertThrowsExactError = ({
  expectedError,
  run,
}: {
  expectedError: Error;
  run: () => void;
}) => {
  assert.throws(run, (thrown: Error) => {
    return thrown === expectedError;
  });
};

describe("createFsmountDeviceNodeOpener", () => {
  // eslint-disable-next-line max-statements
  it("creates a mounted opener and opens character and block device nodes", () => {
    const fakeLinux = createFakeLinuxInterface();
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    const characterResult = opener.openCharacterDevice({
      major: 1,
      minor: 5,
      flags: 0n,
    });
    const blockResult = opener.openBlockDevice({
      major: 8,
      minor: 0,
      flags: 2n,
    });

    assert.deepEqual(characterResult, {
      error: undefined,
      fd: fakeDescriptors.firstOpenedFd,
    });
    assert.deepEqual(blockResult, {
      error: undefined,
      fd: fakeDescriptors.firstOpenedFd + 1,
    });

    const mknodatCalls = listCallsByName({ calls: fakeLinux.calls(), name: "mknodat" });
    const openatCalls = listCallsByName({ calls: fakeLinux.calls(), name: "openat" });

    assert.equal(mknodatCalls.length, 2);
    assert.equal(openatCalls.length, 2);
    assert.notEqual(mknodatCalls[0].args.mode, mknodatCalls[1].args.mode);
    assert.equal(openatCalls[0].args.flags, 0n);
    assert.equal(openatCalls[1].args.flags, 2n);
    assert.equal(openatCalls[0].args.dirfd, fakeDescriptors.mountFd);
    assert.equal(openatCalls[1].args.dirfd, fakeDescriptors.mountFd);

    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }), [
      "fsopen",
      "fsconfig",
      "fsmount",
      "close",
      "mknodat",
      "openat",
      "unlinkat",
      "mknodat",
      "openat",
      "unlinkat",
    ]);
  });

  it("returns a missing-permissions error when fsopen is not permitted", () => {
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsopen: () => {
          return {
            errno: 1,
            fsfd: undefined,
          };
        },
      },
    });

    const result = createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });

    assert.equal(result.opener, undefined);
    assert.equal(result.error?.message, "missing permissions for fsmount");
    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }), ["fsopen"]);
  });

  it("returns an error when mounting setup returns errno and closes the setup descriptor", () => {
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsconfig: () => {
          return {
            errno: 22,
          };
        },
      },
    });

    const result = createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });

    assert.equal(result.opener, undefined);
    assert.notEqual(result.error, undefined);
    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }), [
      "fsopen",
      "fsconfig",
      "close",
    ]);
    assert.deepEqual(listCallsByName({ calls: fakeLinux.calls(), name: "close" }).map((call) => {
      return call.args.fd;
    }), [fakeDescriptors.fsfd]);
  });

  it("returns an error when fsmount returns errno and closes the setup descriptor", () => {
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsmount: () => {
          return {
            errno: 1,
            mountFd: undefined,
          };
        },
      },
    });

    const result = createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });

    assert.equal(result.opener, undefined);
    assert.notEqual(result.error, undefined);
    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }), [
      "fsopen",
      "fsconfig",
      "fsmount",
      "close",
    ]);
    assert.deepEqual(listCallsByName({ calls: fakeLinux.calls(), name: "close" }).map((call) => {
      return call.args.fd;
    }), [fakeDescriptors.fsfd]);
  });

  it("propagates fsopen exceptions without converting them to result objects", () => {
    const expectedError = Error("fsopen exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsopen: () => {
          throw expectedError;
        },
      },
    });

    assertThrowsExactError({
      expectedError,
      run: () => {
        createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });
      },
    });
    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }), ["fsopen"]);
  });

  it("propagates setup exceptions", () => {
    const expectedError = Error("fsconfig exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsconfig: () => {
          throw expectedError;
        },
      },
    });

    assertThrowsExactError({
      expectedError,
      run: () => {
        createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });
      },
    });
  });

  it("propagates fsmount exceptions", () => {
    const expectedError = Error("fsmount exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        fsmount: () => {
          throw expectedError;
        },
      },
    });

    assertThrowsExactError({
      expectedError,
      run: () => {
        createFsmountDeviceNodeOpener({ linuxInterface: fakeLinux.linuxInterface });
      },
    });
  });

  it("returns an open error when mknodat returns errno and keeps the opener usable", () => {
    let mknodatCalls = 0;
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        mknodat: () => {
          mknodatCalls += 1;

          if (mknodatCalls === 1) {
            return {
              errno: 17,
            };
          }

          return {
            errno: undefined,
          };
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    const failedResult = opener.openCharacterDevice({
      major: 1,
      minor: 5,
      flags: 0n,
    });
    const recoveredResult = opener.openCharacterDevice({
      major: 1,
      minor: 5,
      flags: 0n,
    });

    assert.equal(failedResult.fd, undefined);
    assert.notEqual(failedResult.error, undefined);
    assert.deepEqual(recoveredResult, {
      error: undefined,
      fd: fakeDescriptors.firstOpenedFd,
    });
  });

  it("returns an open error when openat returns errno and removes the temporary node", () => {
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        openat: () => {
          return {
            errno: 13,
            fd: undefined,
          };
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    const result = opener.openCharacterDevice({
      major: 1,
      minor: 5,
      flags: 0n,
    });

    assert.equal(result.fd, undefined);
    assert.notEqual(result.error, undefined);
    assert.deepEqual(listCallNames({ calls: fakeLinux.calls() }).slice(-3), [
      "mknodat",
      "openat",
      "unlinkat",
    ]);
  });

  it("propagates mknodat exceptions and poisons the opener", () => {
    const expectedError = Error("mknodat exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        mknodat: () => {
          throw expectedError;
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    assertThrowsExactError({
      expectedError,
      run: () => {
        openCharacterDeviceOrThrow({ opener });
      },
    });
    assert.throws(() => {
      opener.openBlockDevice({
        major: 8,
        minor: 0,
        flags: 0n,
      });
    });
  });

  it("propagates openat exceptions and poisons the opener", () => {
    const expectedError = Error("openat exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        openat: () => {
          throw expectedError;
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    assertThrowsExactError({
      expectedError,
      run: () => {
        openCharacterDeviceOrThrow({ opener });
      },
    });
    assert.throws(() => {
      openCharacterDeviceOrThrow({ opener });
    });
  });

  it("propagates unlinkat exceptions and poisons the opener", () => {
    const expectedError = Error("unlinkat exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        unlinkat: () => {
          throw expectedError;
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    assertThrowsExactError({
      expectedError,
      run: () => {
        openCharacterDeviceOrThrow({ opener });
      },
    });
    assert.throws(() => {
      openCharacterDeviceOrThrow({ opener });
    });
  });

  it("closes the mounted descriptor and rejects later use", () => {
    const fakeLinux = createFakeLinuxInterface();
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    opener.close();

    assert.equal(listCallsByName({ calls: fakeLinux.calls(), name: "close" }).at(-1)?.args.fd, fakeDescriptors.mountFd);
    assert.throws(() => {
      openCharacterDeviceOrThrow({ opener });
    });
    assert.throws(() => {
      opener.openBlockDevice({
        major: 8,
        minor: 0,
        flags: 0n,
      });
    });
  });

  // not working yet
  it.skip("propagates close exceptions and rejects later use", () => {
    const expectedError = Error("close exploded");
    const fakeLinux = createFakeLinuxInterface({
      behaviors: {
        close: ({ fd }) => {
          if (fd === fakeDescriptors.mountFd) {
            throw expectedError;
          }

          return {
            errno: undefined,
          };
        },
      },
    });
    const opener = createOpenerOrThrow({ linuxInterface: fakeLinux.linuxInterface });

    assertThrowsExactError({
      expectedError,
      run: () => {
        opener.close();
      },
    });
    assert.throws(() => {
      openCharacterDeviceOrThrow({ opener });
    });
  });
});
