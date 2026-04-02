#include "../include/logger.h"
#include <stdio.h>
#include <string.h>

void log_message(const char *msg) {
    fprintf(stderr, "[INFO] %s\n", msg);
}

void log_error(const char *fmt, const char *detail) {
    char buf[256];
    snprintf(buf, sizeof(buf), fmt, detail);
    log_message(buf);
}
