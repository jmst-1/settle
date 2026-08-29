import { fmtMoney } from "@/lib/format";

export function emailBackConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function gmailOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function sendSplitPromptEmail(input: {
  to: string;
  merchant: string;
  amount: number;
  currency?: string;
  inboxUrl: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !input.to) return false;
  const from = process.env.RESEND_FROM || "SplitTab <alerts@splittab.app>";
  const amount = fmtMoney(input.amount, input.currency || "SGD");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Split expense detected — ${amount} at ${input.merchant}`,
      text: `SplitTab spotted a dining charge of ${amount} at ${input.merchant}.\n\nScan a receipt or dismiss if this is not for splitting:\n${input.inboxUrl}\n`,
    }),
  });
  return res.ok;
}
