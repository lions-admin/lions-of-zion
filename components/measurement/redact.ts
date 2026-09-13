/** Client-side redaction before any free text enters a measurement payload. */
export function redactQuery(raw: string | null | undefined, max = 120): string | null {
  if (!raw) return null;
  let text = raw.trim().slice(0, max);
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
  return text || null;
}
