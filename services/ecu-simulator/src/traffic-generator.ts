import type { CanFrame } from "./protocol";
import type { CanScenario, CanScenarioStep } from "./scenarios";
import { randomPayload } from "./scenarios";
import logger from "./logger";

function generateFrame(step: CanScenarioStep): CanFrame {
  return {
    timestamp: new Date().toISOString(),
    id: step.canId,
    dlc: step.dlc,
    data: step.data === "random" ? randomPayload(step.dlc) : step.data,
  };
}

export class TrafficGenerator {
  async *generate(
    scenario: CanScenario,
    speed: number,
    loop: boolean
  ): AsyncGenerator<CanFrame> {
    const interval = Math.max(10, Math.round(50 / speed));

    do {
      for (const phase of scenario.phases) {
        logger.info({ phase: phase.name, count: phase.count }, "Phase started");

        for (let i = 0; i < phase.count; i++) {
          const step = phase.steps[i % phase.steps.length];
          const burstCount = step.burst ?? 1;

          for (let b = 0; b < burstCount; b++) {
            yield generateFrame(step);
          }

          await sleep(interval);
        }
      }

      if (loop) {
        logger.info("Scenario complete — looping");
      }
    } while (loop);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
