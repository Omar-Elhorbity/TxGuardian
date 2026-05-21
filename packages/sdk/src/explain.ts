import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import type { DecodedInstruction, RiskLevel, TxRiskFlag } from "./types";

/**
 * AI Explainer — TRANSLATOR ONLY. The LLM receives the deterministic flags
 * and decoded instructions, then produces plain-English prose. It cannot:
 *   - invent or remove risks (flags come from the rule engine)
 *   - choose the recommendation (locked to riskLevel by the scorer)
 *   - see raw transaction bytes (only pre-formatted summaries)
 *
 * SECURITY (W011): instruction summaries are produced by decode.ts, which
 * already strips attacker-controlled text (memo content, etc.). The LLM
 * never sees raw on-chain strings. The system prompt also instructs the
 * model not to quote any user-controlled text verbatim.
 */

const ExplanationSchema = z.object({
  headline: z.string().max(100),
  explanation: z.string().max(500),
  whatThisDoes: z.array(z.string().max(140)).max(6),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

const SYSTEM_PROMPT = `You are a security translator for retail Solana users. You explain a transaction that has ALREADY been analyzed by a deterministic rule engine.

RULES:
1. The rule engine's flags are the SOURCE OF TRUTH. Do NOT invent additional risks. Do NOT downplay flagged risks.
2. Do NOT mention any program, account, or risk that is not in the input.
3. Translate technical terms into plain English a non-developer can understand. Avoid jargon.
4. If the flags list is empty, say the transaction looks routine — do not invent reassurance.
5. Keep "explanation" to 2-3 sentences. No marketing language. No emojis. No exclamation points.
6. Avoid hedging phrases ("could potentially", "might be", "appears to be"). State what the flags say.
7. The "whatThisDoes" array is a short bullet summary of what the transaction does, max 6 items, each under 140 chars.
8. GENERALIZE ONLY account addresses — refer to them as "an unknown account", "your wallet", "another address", etc. Never quote raw 32-byte pubkeys. Memo text is user-controlled; never quote it verbatim.
9. PRESERVE every concrete numeric value from the instruction summaries: SOL amounts ("0.00005 SOL"), token amounts ("100 USDC"), compute unit limits ("400,000"), priority fees, byte sizes, instruction counts. Users need magnitude to assess risk. "Transfer SOL to an unknown account" is uselessly vague — "Transfer 0.00005 SOL to an unknown account" tells them what's actually happening. The decoder already produces these values; never drop them.
10. If an instruction line is marked [×N] where N > 1, the same instruction repeats N times. Mention it ONCE in whatThisDoes with the count (e.g. "Interact with an unknown program 5 times"). Never list the same bullet N separate times.
11. Output JSON only, matching the schema. No prose outside the structured object.`;

const DEFAULT_MODEL = "gemini-2.5-flash";

export interface ExplainInput {
  riskLevel: RiskLevel;
  score: number;
  flags: TxRiskFlag[];
  decoded: DecodedInstruction[];
  model?: string;
}

/**
 * Collapse identical (programName, summary) instruction lines into single
 * entries with a count suffix. A transaction calling the same program N
 * times — common for batch ops, account creation loops, unknown programs
 * with repeated discriminators — would otherwise become N redundant lines
 * in the LLM prompt, and the model would faithfully echo them as N
 * separate bullets in whatThisDoes. Counting lets the model say "5 times"
 * once instead of listing the same bullet five times.
 *
 * Order is preserved by first occurrence so the narrative stays correct.
 */
function collapseInstructions(
  decoded: DecodedInstruction[],
): Array<{ programName: string; summary: string; count: number }> {
  const map = new Map<
    string,
    { programName: string; summary: string; count: number }
  >();
  const order: string[] = [];
  for (const d of decoded) {
    const key = `${d.programName}::${d.summary}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      const entry = {
        programName: d.programName,
        summary: d.summary,
        count: 1,
      };
      map.set(key, entry);
      order.push(key);
    }
  }
  return order.map((k) => map.get(k)!);
}

function buildUserPrompt(input: ExplainInput): string {
  const flagsBlock =
    input.flags.length === 0
      ? "(no flags raised)"
      : input.flags
          .map(
            (f) =>
              `- [${f.severity.toUpperCase()}] ${f.label}: ${f.description}`,
          )
          .join("\n");

  const collapsed = collapseInstructions(input.decoded);
  const ixBlock =
    collapsed.length === 0
      ? "(no instructions)"
      : collapsed
          .map((d, i) => {
            const suffix = d.count > 1 ? ` [×${d.count}]` : "";
            return `${i + 1}. (${d.programName}) ${d.summary}${suffix}`;
          })
          .join("\n");

  return [
    `Deterministic verdict: ${input.riskLevel} (score ${input.score}/100)`,
    "",
    "Flags raised:",
    flagsBlock,
    "",
    "Instructions in this transaction:",
    ixBlock,
    "",
    "Produce the JSON explanation object.",
  ].join("\n");
}

/**
 * One-shot LLM call. Throws on misconfiguration (missing API key) or
 * model errors. Caller should catch and degrade gracefully — the
 * deterministic verdict is always valid even without explanation.
 */
export async function explain(input: ExplainInput): Promise<Explanation> {
  const modelId =
    input.model ?? process.env.TXGUARDIAN_MODEL ?? DEFAULT_MODEL;

  const { object } = await generateObject({
    model: google(modelId),
    schema: ExplanationSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
    temperature: 0.2,
  });
  return object;
}

/**
 * In-memory cache keyed by the deterministic inputs. Same flags + same
 * decoded instructions → same explanation. Survives the warm-window of
 * a serverless function. Cold starts regenerate, which is fine.
 */
const cache = new Map<string, Explanation>();

function cacheKey(input: ExplainInput): string {
  const flagIds = input.flags
    .map((f) => f.id)
    .sort()
    .join("|");
  const ixSummaries = input.decoded.map((d) => d.summary).join("||");
  return `${input.riskLevel}:${input.score}:${flagIds}:${ixSummaries}:${input.model ?? "default"}`;
}

export async function explainCached(
  input: ExplainInput,
): Promise<Explanation> {
  const key = cacheKey(input);
  const hit = cache.get(key);
  if (hit) return hit;
  const fresh = await explain(input);
  cache.set(key, fresh);
  // Bound cache to last 200 entries to avoid unbounded growth.
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  return fresh;
}
