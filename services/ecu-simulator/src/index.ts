import WebSocket from "ws";
import { SCENARIOS } from "./scenarios";
import { EcuEngine } from "./ecu-engine";
import { TrafficGenerator } from "./traffic-generator";
import type { AdapterToEcuMessage, EcuToAdapterMessage } from "./protocol";
import type { CanScenario } from "./scenarios";

// CLI args
const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : defaultVal;
}

const adapterUrl = getArg("adapter", "ws://localhost:4000/ws/ecu");
const scenarioName = getArg("scenario", "mixed");
const ecuName = getArg("ecu-name", "ECU_SIM");
const speed = Number(getArg("speed", "1"));
const loop = args.includes("--loop");

const scenario = SCENARIOS[scenarioName];
if (!scenario) {
  console.error(
    `Unknown scenario: ${scenarioName}. Available: ${Object.keys(SCENARIOS).join(", ")}`
  );
  process.exit(1);
}

console.log(`[ECU Sim] Connecting to ${adapterUrl}`);
console.log(`[ECU Sim] Scenario: ${scenario.name}, Speed: ${speed}x, Loop: ${loop}`);

const ecuEngine = new EcuEngine();
const trafficGenerator = new TrafficGenerator();
let ws: WebSocket;
let running = false;

function connect(): void {
  ws = new WebSocket(adapterUrl);

  ws.on("open", () => {
    console.log("[ECU Sim] Connected to Adapter");
    running = true;

    // 시나리오에서 사용하는 CAN ID 추출 후 ecu-info 전송
    const canIds = [...new Set(
      scenario.phases.flatMap((p) => p.steps.map((s) => s.canId))
    )];
    const info: EcuToAdapterMessage = {
      type: "ecu-info",
      ecu: { name: ecuName, canIds },
    };
    ws.send(JSON.stringify(info));

    startTraffic();
  });

  ws.on("message", async (raw) => {
    try {
      const msg: AdapterToEcuMessage = JSON.parse(raw.toString());
      if (msg.type === "inject-request") {
        console.log(`[ECU Sim] Inject request: ${msg.requestId} → ${msg.frame.id} [${msg.frame.dlc}] ${msg.frame.data}`);
        const response = await ecuEngine.processInjection(msg.frame);
        const reply: EcuToAdapterMessage = {
          type: "inject-response",
          requestId: msg.requestId,
          response,
        };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(reply));
        }
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    console.log("[ECU Sim] Disconnected from Adapter");
    running = false;
    // auto-reconnect after 3s
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error(`[ECU Sim] Connection error: ${err.message}`);
  });
}

async function startTraffic(): Promise<void> {
  let totalSent = 0;

  for await (const frame of trafficGenerator.generate(scenario, speed, loop)) {
    if (!running || ws.readyState !== WebSocket.OPEN) break;

    const msg: EcuToAdapterMessage = { type: "can-frame", frame };
    ws.send(JSON.stringify(msg));
    totalSent++;

    if (totalSent % 100 === 0) {
      console.log(`[ECU Sim] Sent ${totalSent} frames`);
    }
  }

  if (running) {
    console.log(`[ECU Sim] Traffic generation complete. Total: ${totalSent}`);
  }
}

connect();
