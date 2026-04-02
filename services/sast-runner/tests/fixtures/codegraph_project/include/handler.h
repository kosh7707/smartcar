#ifndef HANDLER_H
#define HANDLER_H

void process_request(const char *input);
void execute_action(const char *cmd);
char *parse_input(const char *raw);

#endif
