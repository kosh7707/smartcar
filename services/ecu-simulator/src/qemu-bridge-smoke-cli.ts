import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import type { AdapterToEcuMessage, EcuToAdapterMessage } from "./protocol";
import { asciiToHexPayload, hexPayloadToAscii } from "./qemu-bridge";
import { getSmokeConfig, readQemuBenchManifest } from "./qemu-bench";

type CapturedMessage = EcuToAdapterMessage;

const args = process.argv.slice(2);

function getArg(name: string, defaultVal: string): string {
  const found = args.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : defaultVal;
}

async function main(): Promise<void> {
  const manifestPath = getArg("manifest", "qemu/manifests/sample-armhf-user.json");
  const timeoutMs = Number(getArg("timeout-ms", "15000"));
  const smoke = getSmokeConfig(readQemuBenchManifest(manifestPath));
  const ecuName = getArg("ecu-name", smoke.ecuName);

  const wss = new WebSocketServer({ port: 0, path: "/ws/ecu" });
  await once(wss, "listening");
  const address = wss.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to obtain smoke server port");
  }

  const port = address.port;
  const received: CapturedMessage[] = [];
  const child = spawn(
    "npx",
    [
      "tsx",
      "src/qemu-adapter-bridge-cli.ts",
      `--manifest=${manifestPath}`,
      `--adapter=ws://127.0.0.1:${port}/ws/ecu`,
      `--ecu-name=${ecuName}`,
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  const summary = await new Promise<{
    port: number;
    messageCount: number;
    types: string[];
    ecuInfo: CapturedMessage | undefined;
    firstResponse: CapturedMessage | undefined;
    secondResponse: CapturedMessage | undefined;
    decodedFirstResponse?: string;
    decodedSecondResponse?: string;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("qemu smoke timeout"));
    }, timeoutMs);

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`bridge process exited with code ${code}`));
      }
    });

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as CapturedMessage;
        received.push(msg);

        if (msg.type === "ecu-info") {
          sendInject(ws, smoke.cases[0]);
          return;
        }

        if (msg.type === "inject-response" && msg.requestId === smoke.cases[0]?.requestId) {
          if (smoke.cases[1]) {
            sendInject(ws, smoke.cases[1]);
          }
          return;
        }

        if (msg.type === "inject-response" && msg.requestId === smoke.cases[1]?.requestId) {
          setTimeout(() => ws.close(), 100);
        }
      });

      ws.on("close", () => {
        clearTimeout(timeout);

        const firstResponse = received.find(
          (msg): msg is Extract<CapturedMessage, { type: "inject-response" }> =>
            msg.type === "inject-response" && msg.requestId === smoke.cases[0]?.requestId
        );
        const secondResponse = received.find(
          (msg): msg is Extract<CapturedMessage, { type: "inject-response" }> =>
            msg.type === "inject-response" && msg.requestId === smoke.cases[1]?.requestId
        );

        resolve({
          port,
          messageCount: received.length,
          types: received.map((msg) => msg.type),
          ecuInfo: received.find((msg) => msg.type === "ecu-info"),
          firstResponse,
          secondResponse,
          decodedFirstResponse: firstResponse?.response.data
            ? hexPayloadToAscii(firstResponse.response.data)
            : undefined,
          decodedSecondResponse: secondResponse?.response.data
            ? hexPayloadToAscii(secondResponse.response.data)
            : undefined,
        });
      });
    });
  });

  console.log(JSON.stringify(summary, null, 2));

  child.kill("SIGTERM");
  wss.close();
}

function sendInject(
  ws: import("ws").WebSocket,
  testCase: { requestId: string; canId: string; text: string }
): void {
  const message: AdapterToEcuMessage = {
    type: "inject-request",
    requestId: testCase.requestId,
    frame: {
      timestamp: new Date().toISOString(),
      id: testCase.canId,
      dlc: Math.min(8, testCase.text.length),
      data: asciiToHexPayload(testCase.text, 8),
    },
  };
  ws.send(JSON.stringify(message));
}

function once(
  emitter: NodeJS.EventEmitter,
  eventName: string
): Promise<void> {
  return new Promise((resolve) => {
    emitter.once(eventName, () => resolve());
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
