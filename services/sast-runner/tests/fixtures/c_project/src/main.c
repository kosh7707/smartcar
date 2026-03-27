#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../include/header.h"

int main(int argc, char *argv[]) {
    char buf[64];
    gets(buf);  /* CWE-120: Buffer Overflow */

    printf(buf);  /* CWE-134: Format String */

    char *p = malloc(100);
    free(p);
    printf("%s\n", p);  /* CWE-416: Use After Free */

    char *q = NULL;
    printf("%d\n", *q);  /* CWE-476: NULL Pointer Dereference */

    int val = atoi(argv[1]);
    int result = 100 / val;  /* CWE-369: Divide by Zero */

    system(argv[2]);  /* CWE-78: Command Injection */

    int big = 2147483647;
    int overflow = big + val;  /* CWE-190: Integer Overflow */

    strcpy(buf, argv[1]);  /* CWE-787: Buffer Overflow Write */

    return result + overflow;
}
