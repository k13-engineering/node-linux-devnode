import nodeFs from "node:fs";
import type { TDeviceNodeOpener } from "./open-interface.ts";
import { devToMajorMinor } from "./dev-util.ts";

const createDevFolderDeviceNodeOpener = ({
  fs,
  deviceFolderPath
}: {
  fs: {
    openSync: typeof nodeFs.openSync;
    readdirSync: typeof nodeFs.readdirSync;
    statSync: typeof nodeFs.statSync;
  }
  deviceFolderPath: string
}): TDeviceNodeOpener => {

  const openDevice = ({
    devicePath,
    flags
  }: {
    devicePath: string;
    flags: bigint
  }): { error: Error, fd: undefined } | { error: undefined, fd: number } => {

    try {
      const fd = fs.openSync(devicePath, Number(flags));
      return {
        error: undefined,
        fd
      };
    } catch (ex) {

      const err = ex as Error;

      return {
        error: Error(`failed to open device node "${devicePath}": ${err.message}`),
        fd: undefined
      };
    }
  };

  const openCharacterDevice: TDeviceNodeOpener["openCharacterDevice"] = ({
    major,
    minor,
    flags
  }) => {
    const entries = fs.readdirSync(deviceFolderPath, { withFileTypes: true });

    const deviceNodeEntries = entries.filter((entry) => {
      return entry.isCharacterDevice();
    });


    const matchingEntry = deviceNodeEntries.find((entry) => {
      const st = fs.statSync(`${deviceFolderPath}/${entry.name}`);

      const deviceAddress = devToMajorMinor({ dev: BigInt(st.rdev) });

      return deviceAddress.major === major && deviceAddress.minor === minor;
    });

    if (matchingEntry === undefined) {
      return {
        error: Error(`no character device with major ${major} and minor ${minor} found in "${deviceFolderPath}"`),
        fd: undefined
      };
    }

    const devicePath = `${deviceFolderPath}/${matchingEntry.name}`;

    return openDevice({
      devicePath,
      flags
    });
  };

  const openBlockDevice: TDeviceNodeOpener["openBlockDevice"] = ({
    major,
    minor,
    flags
  }) => {
    const entries = fs.readdirSync(deviceFolderPath, { withFileTypes: true });

    const deviceNodeEntries = entries.filter((entry) => {
      return entry.isBlockDevice();
    });

    const matchingEntry = deviceNodeEntries.find((entry) => {
      const st = fs.statSync(`${deviceFolderPath}/${entry.name}`);

      const deviceAddress = devToMajorMinor({ dev: BigInt(st.rdev) });

      return deviceAddress.major === major && deviceAddress.minor === minor;
    });

    if (matchingEntry === undefined) {
      return {
        error: Error(`no block device with major ${major} and minor ${minor} found in "${deviceFolderPath}"`),
        fd: undefined
      };
    }

    const devicePath = `${deviceFolderPath}/${matchingEntry.name}`;

    return openDevice({
      devicePath,
      flags
    });
  };

  const close: TDeviceNodeOpener["close"] = () => {
    // noop[]
  };

  return {
    openCharacterDevice,
    openBlockDevice,
    close
  };
};

export {
  createDevFolderDeviceNodeOpener
};
