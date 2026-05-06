/**
 * Shared LLM generation-control vocabulary for S2-owned callers.
 *
 * Keep the downstream shapes distinct:
 * - S7 task constraints require the full tuple.
 * - S3 task constraints expose optional caller overrides.
 */

export interface GenerationControlFields {
  enableThinking: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  presencePenalty: number;
  repetitionPenalty: number;
}

export type S7TaskGenerationConstraints = GenerationControlFields;

export type PartialS7TaskGenerationConstraints =
  Partial<S7TaskGenerationConstraints>;

export type S3GenerationOverrides = Partial<GenerationControlFields>;

export const DEFAULT_S7_TASK_GENERATION_CONSTRAINTS = {
  enableThinking: true,
  maxTokens: 16384,
  temperature: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0.0,
  presencePenalty: 0.0,
  repetitionPenalty: 1.0,
} as const satisfies S7TaskGenerationConstraints;
