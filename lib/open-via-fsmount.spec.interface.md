```typescript
import type { TLinuxInterface } from "./linux-interface.ts";
import type { TDeviceNodeOpener } from "./open-interface.ts";

const createFsmountDeviceNodeOpener = ({
  linuxInterface
}: {
  linuxInterface: TLinuxInterface
}): { error: Error, opener: undefined } | { error: undefined, opener: TDeviceNodeOpener } => {
  // TODO: implement
};

// in case of missing permissions an error message of "missing permissions for fsmount" is returned

// if any method yields an exception, the device node opener is not usable anymore (i.e. it yields an exception when trying to make further calls)
// in such cases the underlying mountFd will not neccessarily be closed (undefined behavior)
// keep this in mind for tests

export {
  createFsmountDeviceNodeOpener
};
```
