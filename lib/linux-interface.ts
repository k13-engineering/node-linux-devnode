import { syscall, syscallNumbers } from "syscall-napi";

type TLinuxInterface = {
  fsopen: (args: { fsname: string, flags: bigint }) => { errno: number, fsfd: undefined } | { errno: undefined, fsfd: number };
  fsconfig: (args: {
    fd: number;
    cmd: bigint;
    key: string | undefined;
    value: string | Uint8Array | undefined;
    aux: bigint;
  }) => { errno: number } | { errno: undefined };
  fsmount: (args: {
    fsfd: number;
    flags: bigint;
    attr_flags: bigint;
  }) => { errno: number, mountFd: undefined } | { errno: undefined, mountFd: number };
  mknodat: (args: {
    dirfd: number;
    path: string;
    mode: bigint;
    dev: bigint;
  }) => { errno: number } | { errno: undefined };
  openat: (args: {
    dirfd: number;
    path: string;
    flags: bigint;
    mode: bigint;
  }) => { errno: number, fd: undefined } | { errno: undefined, fd: number };
  unlinkat: (args: {
    dirfd: number;
    path: string;
    flags: bigint;
  }) => { errno: number } | { errno: undefined };
  close: (args: { fd: number }) => { errno: number } | { errno: undefined };
};

const textEncoder = new TextEncoder();

const toCString = (value: string) => {
  const encoded = textEncoder.encode(value);
  const result = new Uint8Array(encoded.length + 1);
  result.set(encoded, 0);
  return result;
};

const toOptionalCStringArg = ({ value }: { value: string | undefined }) => {
  if (value === undefined) {
    return 0n;
  }

  return toCString(value);
};

const toOptionalPointerArg = ({ value }: { value: string | Uint8Array | undefined }) => {
  if (value === undefined) {
    return 0n;
  }

  if (typeof value === "string") {
    return toCString(value);
  }

  return value;
};

const createDefaultLinuxInterface = (): TLinuxInterface => {

  const fsopen: TLinuxInterface["fsopen"] = ({
    fsname,
    flags,
  }) => {
    const { errno, ret } = syscall({
      syscallNumber: syscallNumbers.fsopen,
      args: [
        toCString(fsname),
        flags,
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
        fsfd: undefined,
      };
    }

    return {
      errno: undefined,
      fsfd: Number(ret),
    };
  };

  type TFsConfigResult = {
    errno: number;
  } | {
    errno: undefined;
  };

  const fsconfig: TLinuxInterface["fsconfig"] = ({
    fd,
    cmd,
    key,
    value,
    aux,
  }): TFsConfigResult => {
    const { errno } = syscall({
      syscallNumber: syscallNumbers.fsconfig,
      args: [
        BigInt(fd),
        cmd,
        toOptionalCStringArg({ value: key }),
        toOptionalPointerArg({ value }),
        BigInt(aux),
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
      };
    }

    return {
      errno: undefined,
    };
  };

  const fsmount: TLinuxInterface["fsmount"] = ({
    fsfd,
    flags,
    attr_flags,
  }) => {
    const { errno, ret } = syscall({
      syscallNumber: syscallNumbers.fsmount,
      args: [
        BigInt(fsfd),
        flags,
        attr_flags,
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
        mountFd: undefined,
      };
    }

    return {
      errno: undefined,
      mountFd: Number(ret),
    };
  };

  const mknodat: TLinuxInterface["mknodat"] = ({
    dirfd,
    path,
    mode,
    dev,
  }) => {
    const { errno } = syscall({
      syscallNumber: syscallNumbers.mknodat,
      args: [
        BigInt(dirfd),
        toCString(path),
        mode,
        dev,
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
      };
    }

    return {
      errno: undefined,
    };
  };

  const openat: TLinuxInterface["openat"] = ({
    dirfd,
    path,
    flags,
    mode,
  }) => {
    const { errno, ret } = syscall({
      syscallNumber: syscallNumbers.openat,
      args: [
        BigInt(dirfd),
        toCString(path),
        flags,
        mode,
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
        fd: undefined,
      };
    }

    return {
      errno: undefined,
      fd: Number(ret),
    };
  };

  const unlinkat: TLinuxInterface["unlinkat"] = ({
    dirfd,
    path,
    flags,
  }) => {
    const { errno } = syscall({
      syscallNumber: syscallNumbers.unlinkat,
      args: [
        BigInt(dirfd),
        toCString(path),
        flags,
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
      };
    }

    return {
      errno: undefined,
    };
  };

  const close: TLinuxInterface["close"] = ({
    fd,
  }) => {
    const { errno } = syscall({
      syscallNumber: syscallNumbers.close,
      args: [
        BigInt(fd),
      ],
    });

    if (errno !== undefined) {
      return {
        errno,
      };
    }

    return {
      errno: undefined,
    };
  };

  return {
    fsopen,
    fsconfig,
    fsmount,
    mknodat,
    openat,
    unlinkat,
    close
  };
};

export {
  createDefaultLinuxInterface
};

export type {
  TLinuxInterface
};
