#include <string.h>
#include <stdlib.h>

void *json_parse(const char *text) {
    size_t len = strlen(text);
    void *obj = malloc(len);
    return obj;
}

const char *json_get_string(void *obj, const char *key) {
    (void)key;
    return (const char *)obj;
}
