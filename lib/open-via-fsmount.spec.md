Tests:

Following MUST be verified by tests:
 - exceptions of syscalls may not be implicitly caught and always propagated to the external caller
 - file descriptors may not leak (only on exceptions, not normal runtime errors)
 - if instance is closed, it should not be possible to use it again (guard via exception)
 - if a syscall yields an exception and the external caller catches it, the instance
   must yield an exception if it is used again (exception cannot be recovered!)
