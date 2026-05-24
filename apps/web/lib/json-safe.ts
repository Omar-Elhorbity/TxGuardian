/**
 * Recursively convert a value into something JSON.stringify can handle.
 * BigInts become decimal strings, Uint8Arrays become base64 strings, Maps
 * and Sets are unrolled. Used by API routes returning SDK results which
 * may contain BigInts in evidence fields.
 *
 * SECURITY: although the input is always SDK output (controlled, not user
 * input), defensive guards exist for two pathological shapes that the SDK
 * could theoretically produce or that a malicious dependency could
 * inject — circular references, and extreme nesting. Both would otherwise
 * stack-overflow the serverless function.
 */
const MAX_DEPTH = 32;

export function jsonSafe(value: unknown): unknown {
  return walk(value, 0, new WeakSet());
}

function walk(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (depth > MAX_DEPTH) return "[truncated: max depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");

  // Cycle detection — applies to anything that can hold another object.
  if (typeof value === "object") {
    if (seen.has(value)) return "[truncated: circular]";
    seen.add(value);
  }

  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      obj[String(k)] = walk(v, depth + 1, seen);
    }
    return obj;
  }
  if (value instanceof Set) {
    return Array.from(value).map((v) => walk(v, depth + 1, seen));
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, depth + 1, seen));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, depth + 1, seen);
    }
    return out;
  }
  return value;
}
