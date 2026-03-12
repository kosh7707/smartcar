import pino from "pino";
import path from "path";

const LOG_DIR = process.env.LOG_DIR ?? path.resolve(__dirname, "../../../logs");

const transport = pino.transport({
  targets: [
    { target: "pino/file", options: { destination: 1 } },
    { target: "pino/file", options: { destination: path.join(LOG_DIR, "ecu-simulator.jsonl"), mkdir: true } },
  ],
});

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  name: "ecu-simulator",
}, transport);

export default logger;
