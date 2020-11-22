import devnode from "../lib/index.js";

// /dev/zero is 1:5
const fh = await devnode.open({
  "type": "character",
  "major": 1,
  "minor": 5,
  "flags": "r"
});

const zero = await fh.read(Buffer.alloc(32), 0, 32, 0);
console.log("zero =", zero);

await fh.close();
