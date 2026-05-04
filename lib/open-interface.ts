type TDeviceNodeOpener = {
  openCharacterDevice: (args: {
    major: number;
    minor: number;
    flags: bigint;
  }) => { error: Error, fd: undefined } | { error: undefined, fd: number };
  openBlockDevice: (args: {
    major: number;
    minor: number;
    flags: bigint;
  }) => { error: Error, fd: undefined } | { error: undefined, fd: number };
  close: () => void;
};

export type {
  TDeviceNodeOpener
};
