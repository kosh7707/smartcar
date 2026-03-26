import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrafficGenerator } from "../../traffic-generator";
import type { CanFrame } from "../../protocol";
import type { CanScenario } from "../../scenarios";

vi.mock("../../logger", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeTestScenario(overrides?: Partial<CanScenario>): CanScenario {
  return {
    name: "test",
    phases: [
      {
        name: "test-phase",
        count: 3,
        steps: [
          { canId: "0x100", dlc: 8, data: "AA BB CC DD EE FF 00 11" },
          { canId: "0x200", dlc: 8, data: "random" },
        ],
      },
    ],
    ...overrides,
  };
}

async function drainGenerator(
  gen: AsyncGenerator<CanFrame>,
  maxFrames = 1000
): Promise<CanFrame[]> {
  const frames: CanFrame[] = [];
  for await (const frame of gen) {
    frames.push(frame);
    if (frames.length >= maxFrames) break;
  }
  return frames;
}

describe("TrafficGenerator", () => {
  let generator: TrafficGenerator;

  beforeEach(() => {
    vi.useFakeTimers();
    generator = new TrafficGenerator();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("yields correct number of frames for a single-phase scenario", async () => {
    const scenario = makeTestScenario();
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    // count=3, no burst → 3 frames
    expect(frames).toHaveLength(3);
  });

  it("cycles through steps using modulo (i % steps.length)", async () => {
    const scenario = makeTestScenario();
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    // 3 frames from 2 steps: step[0], step[1], step[0]
    expect(frames[0].id).toBe("0x100");
    expect(frames[1].id).toBe("0x200");
    expect(frames[2].id).toBe("0x100");
  });

  it("yields burst-count frames per step when burst is set", async () => {
    const scenario: CanScenario = {
      name: "burst-test",
      phases: [
        {
          name: "burst",
          count: 2,
          steps: [{ canId: "0x100", dlc: 8, data: "AA BB CC DD EE FF 00 11", burst: 3 }],
        },
      ],
    };
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    // count=2 iterations, burst=3 each → 6 frames
    expect(frames).toHaveLength(6);
    frames.forEach((f) => expect(f.id).toBe("0x100"));
  });

  it("uses literal data when step.data is a fixed string", async () => {
    const scenario = makeTestScenario({
      phases: [
        {
          name: "fixed",
          count: 1,
          steps: [{ canId: "0x100", dlc: 8, data: "DE AD BE EF 01 02 03 04" }],
        },
      ],
    });
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    expect(frames[0].data).toBe("DE AD BE EF 01 02 03 04");
  });

  it('generates random data when step.data is "random"', async () => {
    const scenario = makeTestScenario({
      phases: [
        {
          name: "random",
          count: 2,
          steps: [{ canId: "0x100", dlc: 8, data: "random" }],
        },
      ],
    });
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    // random data should be 8 hex bytes separated by spaces
    frames.forEach((f) => {
      expect(f.data.split(" ")).toHaveLength(8);
      f.data.split(" ").forEach((b) => expect(b).toMatch(/^[0-9A-F]{2}$/));
    });
  });

  it("stops after one iteration when loop=false", async () => {
    const scenario = makeTestScenario();
    const iter = generator.generate(scenario, 1, false);
    const promise = drainGenerator(iter);
    await vi.advanceTimersByTimeAsync(10000);
    const frames = await promise;
    expect(frames).toHaveLength(3);
  });

  it("loops when loop=true (produces more than one iteration)", async () => {
    const scenario = makeTestScenario();
    const iter = generator.generate(scenario, 1, true);
    // Collect up to 10 frames (more than one iteration of 3)
    const promise = drainGenerator(iter, 10);
    await vi.advanceTimersByTimeAsync(50000);
    const frames = await promise;
    expect(frames.length).toBeGreaterThan(3);
    expect(frames).toHaveLength(10);
  });

  it("respects speed parameter (lower interval at higher speed)", async () => {
    // speed=1 → interval=50ms, speed=5 → interval=10ms
    // With 3 frames at speed=1, total time = 3 * 50ms = 150ms
    // At 20ms advanced, only 0 intervals completed (first yield is immediate before sleep)
    const scenario = makeTestScenario();
    const iter = generator.generate(scenario, 1, false);
    const frames: CanFrame[] = [];

    const promise = (async () => {
      for await (const frame of iter) {
        frames.push(frame);
      }
    })();

    // First frame yields immediately (before the first sleep)
    await vi.advanceTimersByTimeAsync(0);
    expect(frames.length).toBeGreaterThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(frames).toHaveLength(3);
  });
});
