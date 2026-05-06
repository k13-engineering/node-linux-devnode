import { createDefaultLinuxInterface } from "./linux-interface.ts";
import type { TDeviceNodeOpener } from "./open-interface.ts";
import { createDevFolderDeviceNodeOpener } from "./open-via-dev-folder.ts";
import { createFsmountDeviceNodeOpener } from "./open-via-fsmount.ts";
import nodeFs from "node:fs";

const createDefaultDevFolderDeviceNodeOpener = (): TDeviceNodeOpener => {
  return createDevFolderDeviceNodeOpener({
    fs: {
      openSync: nodeFs.openSync,
      readdirSync: nodeFs.readdirSync,
      statSync: nodeFs.statSync
    },
    deviceFolderPath: "/dev",
  });
};

const createDefaultFsmountDeviceNodeOpener = (): { error: Error, opener: undefined } | { error: undefined, opener: TDeviceNodeOpener } => {
  const linuxInterface = createDefaultLinuxInterface();

  return createFsmountDeviceNodeOpener({
    linuxInterface
  });
};

const createDefaultDevnodeOpener = (): TDeviceNodeOpener => {
  const { error: fsmountError, opener: fsmountOpener } = createDefaultFsmountDeviceNodeOpener();
  if (fsmountError === undefined) {
    return fsmountOpener;
  }

  return createDefaultDevFolderDeviceNodeOpener();
};

let defaultOpener: TDeviceNodeOpener | undefined = undefined;

const openCharacterDevice = ({
  major,
  minor,
  flags
}: {
  major: number;
  minor: number;
  flags: bigint;
}): { error: Error, fd: undefined } | { error: undefined, fd: number } => {
  if (defaultOpener === undefined) {
    defaultOpener = createDefaultDevnodeOpener();
  }

  return defaultOpener.openCharacterDevice({
    major,
    minor,
    flags
  });
};

const openBlockDevice = ({
  major,
  minor,
  flags
}: {
  major: number;
  minor: number;
  flags: bigint;
}): { error: Error, fd: undefined } | { error: undefined, fd: number } => {
  if (defaultOpener === undefined) {
    defaultOpener = createDefaultDevnodeOpener();
  }

  return defaultOpener.openBlockDevice({
    major,
    minor,
    flags
  });
};

type TDetermineDeviceAddressFromSysfsDevPathResult = {
  error: Error;
  deviceAddress: undefined;
} | {
  error: undefined;
  deviceAddress: {
    major: number;
    minor: number;
  };
};

const determineMajorAndMinorFromSysfsDevPath = ({
  sysfsDevPath
}: {
  sysfsDevPath: string;
// eslint-disable-next-line complexity
}): TDetermineDeviceAddressFromSysfsDevPathResult => {
  let content: string;
  try {
    content = nodeFs.readFileSync(sysfsDevPath, "utf-8");
  } catch (ex) {
    return {
      error: ex as Error,
      deviceAddress: undefined
    };
  }

  const parts = content.trim().split(":");
  if (parts.length !== 2) {
    return {
      error: Error(`unexpected format of content "${content}" in sysfs dev path "${sysfsDevPath}"`),
      deviceAddress: undefined
    };
  }

  const [majorString, minorString] = parts;
  const major = parseInt(majorString, 10);
  const minor = parseInt(minorString, 10);

  if (isNaN(major) || isNaN(minor)) {
    return {
      error: Error(`failed to parse major or minor number from content "${content}"`),
      deviceAddress: undefined
    };
  }

  return {
    error: undefined,
    deviceAddress: {
      major,
      minor
    }
  };
};

type TOpenBySysfsDevPathResult = {
  error: Error;
  fd: undefined;
} | {
  error: undefined;
  fd: number;
};

const openBlockDeviceBySysfsDevPath = ({
  sysfsDevPath,
  flags
}: {
  sysfsDevPath: string;
  flags: bigint;
}): TOpenBySysfsDevPathResult => {
  const { error: determineAddressError, deviceAddress } = determineMajorAndMinorFromSysfsDevPath({ sysfsDevPath });

  if (determineAddressError !== undefined) {
    return {
      error: determineAddressError,
      fd: undefined
    };
  }

  return openBlockDevice({
    major: deviceAddress.major,
    minor: deviceAddress.minor,
    flags
  });
};

const openCharacterDeviceBySysfsDevPath = ({
  sysfsDevPath,
  flags
}: {
  sysfsDevPath: string;
  flags: bigint;
}): TOpenBySysfsDevPathResult => {
  const { error: determineAddressError, deviceAddress } = determineMajorAndMinorFromSysfsDevPath({ sysfsDevPath });

  if (determineAddressError !== undefined) {
    return {
      error: determineAddressError,
      fd: undefined
    };
  }

  return openCharacterDevice({
    major: deviceAddress.major,
    minor: deviceAddress.minor,
    flags
  });
};

export {
  openBlockDevice,
  openCharacterDevice,

  openBlockDeviceBySysfsDevPath,
  openCharacterDeviceBySysfsDevPath,
};
