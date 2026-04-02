#include "../include/server.h"
#include "../include/handler.h"
#include <stdio.h>
#include <string.h>

static int server_fd = -1;

void init_server(int port) {
    printf("Listening on port %d\n", port);
    server_fd = port;
}

void handle_client(void) {
    char buf[1024];
    memset(buf, 0, sizeof(buf));
    if (server_fd > 0) {
        process_request(buf);
    }
}
