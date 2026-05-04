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

export {
  openBlockDevice,
  openCharacterDevice
};
