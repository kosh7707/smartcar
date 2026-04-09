typedef unsigned long usize;

static inline long sys_read(int fd, void *buf, usize len) {
  register long r0 __asm__("r0") = fd;
  register void *r1 __asm__("r1") = buf;
  register long r2 __asm__("r2") = (long) len;
  register long r7 __asm__("r7") = 3;
  __asm__ volatile("svc 0" : "+r"(r0) : "r"(r1), "r"(r2), "r"(r7) : "memory");
  return r0;
}

static inline long sys_write(int fd, const void *buf, usize len) {
  register long r0 __asm__("r0") = fd;
  register const void *r1 __asm__("r1") = buf;
  register long r2 __asm__("r2") = (long) len;
  register long r7 __asm__("r7") = 4;
  __asm__ volatile("svc 0" : "+r"(r0) : "r"(r1), "r"(r2), "r"(r7) : "memory");
  return r0;
}

__attribute__((noreturn)) static inline void sys_exit(int code) {
  register long r0 __asm__("r0") = code;
  register long r7 __asm__("r7") = 1;
  __asm__ volatile("svc 0" : : "r"(r0), "r"(r7) : "memory");
  __builtin_unreachable();
}

static usize str_len(const char *s) {
  usize len = 0;
  while (s[len] != '\0') {
    len++;
  }
  return len;
}

static int contains_exit(const char *buf, long len) {
  if (len < 4) {
    return 0;
  }

  for (long i = 0; i <= len - 4; i++) {
    if (
      buf[i] == 'e' &&
      buf[i + 1] == 'x' &&
      buf[i + 2] == 'i' &&
      buf[i + 3] == 't'
    ) {
      return 1;
    }
  }

  return 0;
}

void _start(void) {
  char buf[64];
  const char boot[] = "[boot] qemu-sample ready\n";
  const char ack[] = "[ack] qemu-sample\n";
  const char bye[] = "[shutdown] qemu-sample bye\n";
  const char eof[] = "[eof] qemu-sample stdin closed\n";

  sys_write(1, boot, str_len(boot));

  for (;;) {
    long n = sys_read(0, buf, sizeof(buf));
    if (n <= 0) {
      sys_write(1, eof, str_len(eof));
      sys_exit(0);
    }

    if (contains_exit(buf, n)) {
      sys_write(1, bye, str_len(bye));
      sys_exit(0);
    }

    sys_write(1, ack, str_len(ack));
  }
}
