/**
 * Recursively convert a value into something JSON.stringify can handle.
 * BigInts become decimal strings, Uint8Arrays become base64 strings, Maps
 * and Sets are unrolled. Used by API routes returning SDK results which
 * may contain BigInts in evidence fields.
 */
export function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      obj[String(k)] = jsonSafe(v);
    }
    return obj;
  }
  if (value instanceof Set) {
    return Array.from(value).map(jsonSafe);
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafe);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}
