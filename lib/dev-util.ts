const makedev = ({ major, minor }: { major: number, minor: number }): bigint => {
  const maj = BigInt(major);
  const min = BigInt(minor);
  return ((maj & 0xfffff000n) << 32n) |
         ((maj & 0x00000fffn) << 8n) |
         ((min & 0xffffff00n) << 12n) |
         (min & 0x000000ffn);
};

const devToMajorMinor = ({ dev }: { dev: bigint }): { major: number, minor: number } => {
  const major = Number((dev >> 8n) & 0xfffn);
  const minor = Number((dev & 0xffn) | ((dev >> 12n) & 0xffffff00n));
  return { major, minor };
};

export {
  makedev,
  devToMajorMinor,
};
