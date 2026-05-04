# node-linux-devnode
Linux device node library for Node.js

## API

### `openCharacterDevice(options)` => `{ error, fd }`

Opens a character device node and returns a file descriptor.

- `options.major` major number of device node
- `options.minor` minor number of device node
- `options.flags` open flags as `bigint`

Returns `{ error: undefined, fd: number }` on success, or `{ error: Error, fd: undefined }` on failure.

### `openBlockDevice(options)` => `{ error, fd }`

Opens a block device node and returns a file descriptor.

- `options.major` major number of device node
- `options.minor` minor number of device node
- `options.flags` open flags as `bigint`

Returns `{ error: undefined, fd: number }` on success, or `{ error: Error, fd: undefined }` on failure.

## Minimal example

```typescript
import { openCharacterDevice } from "linux-devnode";
import nodeFs from "node:fs";

const { error: openError, fd } = openCharacterDevice({
  major: 1,
  minor: 5,
  flags: 0n
});

if (openError !== undefined) {
  throw Error("failed to open /dev/zero character device", { cause: openError });
}

const buffer = new Uint8Array(32);
const bytesRead = nodeFs.readSync(fd, buffer, 0, buffer.length, 0);
const zero = buffer.slice(0, bytesRead);
console.log("zero =", zero);

nodeFs.closeSync(fd);
```
