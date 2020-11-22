# node-linux-devnode
Linux device node library for Node.js

## API

### `devnode.open(options)` => Promise(`FileHandle`)

Opens a device node as Node.js `FileHandle`.

- `options.type` type of device node, either `"character"` or `"block"`
- `options.major` major number of device node
- `options.minor` minor number of device node
- `options.flags` open flags, either `"r"`, `"w"` or `"r+"`, see Node.js fs.open() documentation

For a description of the `FileHandle` API, visit [Node.js's documentation](https://nodejs.org/api/fs.html#fs_class_filehandle)

## Minimal example

```javascript
import devnode from "linux-devnode";

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
```
