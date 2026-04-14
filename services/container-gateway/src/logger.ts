import pino from "pino";
import path from "path";
import { config } from "./config";

const transport = pino.transport({
  targets: [
    { target: "pino/file", options: { destination: 1 } },
    { target: "pino/file", options: { destination: path.join(config.logDir, "container-gateway.jsonl"), mkdir: true } },
  ],
});

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", base: { service: "s8-container-gateway" } }, transport);
export default logger;
