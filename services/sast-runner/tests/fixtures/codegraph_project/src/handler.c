#include "../include/handler.h"
#include "../include/logger.h"
#include <stdlib.h>
#include <string.h>

void process_request(const char *input) {
    char *parsed = parse_input(input);
    if (parsed) {
        execute_action(parsed);
        free(parsed);
    }
}

void execute_action(const char *cmd) {
    log_message("Executing action");
    system(cmd);
}

char *parse_input(const char *raw) {
    size_t len = strlen(raw);
    if (len == 0) return NULL;
    char *buf = (char *)malloc(len + 1);
    strcpy(buf, raw);
    return buf;
}
