#include "../include/server.h"
#include "../include/handler.h"
#include "../include/logger.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    log_message("Starting server");
    int port = atoi(argv[1]);
    init_server(port);
    handle_client();
    return 0;
}
