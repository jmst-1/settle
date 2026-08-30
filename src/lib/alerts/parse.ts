import type { ParsedTransaction } from "@/lib/types";
import { looksLikeDining } from "@/lib/alerts/dining";

export const PARSE_PROMPT = `Extract the card/bank transaction from this email. Return ONLY valid JSON:
{
  "merchant": "merchant or payee name",
  "amount": 0.00,
  "currency": "SGD",
  "date": "YYYY-MM-DD",
  "isDining": false
}
Use SGD if the currency is unclear. isDining is true for restaurants, cafes, bars, hawker, or other F&B.`;

const AMOUNT_RE =
  /(?:SGD|S\$|SGD\s*|USD|US\$|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)|(?:amount|spent|charged|purchase of|txn amt|transaction amount)[:\s]+(?:SGD|S\$|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/i;

const MERCHANT_RE = [
  /(?:at|to|merchant|payee|establishment)[:\s]+([A-Za-z0-9][A-Za-z0-9 .,&'@/-]{1,60})/i,
  /(?:you (?:spent|paid)|charged at)\s+(?:SGD|S\$|\$)?[\d,.]+\s+(?:at|to)\s+([A-Za-z0-9][A-Za-z0-9 .,&'@/-]{1,60})/i,
];

function parseAmount(text: string): { amount: number; currency: string } | null {
  const m = text.match(AMOUNT_RE);
  const raw = m?.[1] || m?.[2];
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = /USD|US\$/i.test(text.slice(Math.max(0, (m?.index ?? 0) - 8), (m?.index ?? 0) + 12))
    ? "USD"
    : "SGD";
  return { amount, currency };
}

function parseMerchant(text: string): string {
  for (const re of MERCHANT_RE) {
    const m = text.match(re);
    if (m?.[1]) {
      return m[1].replace(/\s+/g, " ").replace(/[\r\n].*$/, "").trim();
    }
  }
  return "";
}

function parseDate(text: string, fallback = ""): string {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = monthNum(dmy[2]);
    if (mon) return `${dmy[3]}-${mon}-${day}`;
  }
  const mdy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (mdy) {
    const a = Number(mdy[1]);
    const b = Number(mdy[2]);
    // Prefer D/M/Y for SG emails when first number > 12
    if (a > 12) return `${mdy[3]}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    return `${mdy[3]}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }
  return fallback;
}

function monthNum(name: string): string | null {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const i = months.findIndex((m) => name.toLowerCase().startsWith(m));
  return i >= 0 ? String(i + 1).padStart(2, "0") : null;
}

export function parseEmailHeuristic(
  text: string,
  opts?: { dateFallback?: string },
): ParsedTransaction | null {
  const amount = parseAmount(text);
  const merchant = parseMerchant(text);
  if (!amount || !merchant) return null;
  const date = parseDate(text, opts?.dateFallback || new Date().toISOString().slice(0, 10));
  const isDining = looksLikeDining(merchant);
  return {
    merchant,
    amount: amount.amount,
    currency: amount.currency,
    date,
    isDining,
    confidence: isDining ? 0.72 : 0.6,
  };
}

function parseClaudeJson(text: string): ParsedTransaction | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const json = JSON.parse(cleaned) as Partial<ParsedTransaction> & { isDining?: boolean };
    const amount = Number(json.amount);
    if (!json.merchant || !Number.isFinite(amount) || amount <= 0) return null;
    return {
      merchant: String(json.merchant).trim(),
      amount,
      currency: json.currency || "SGD",
      date: json.date || new Date().toISOString().slice(0, 10),
      isDining: Boolean(json.isDining) || looksLikeDining(String(json.merchant)),
      confidence: 0.88,
    };
  } catch {
    return null;
  }
}

export async function parseTransactionEmail(
  text: string,
  opts?: { dateFallback?: string },
): Promise<ParsedTransaction | null> {
  const heuristic = parseEmailHeuristic(text, opts);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return heuristic;
  if (heuristic && heuristic.confidence >= 0.7 && heuristic.merchant.length > 2) return heuristic;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: `${PARSE_PROMPT}\n\nEMAIL:\n${text.slice(0, 8000)}` }],
    });
    const body = res.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
    return parseClaudeJson(body) ?? heuristic;
  } catch {
    return heuristic;
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
