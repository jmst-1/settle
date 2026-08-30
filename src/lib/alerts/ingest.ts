import { detectSplit } from "@/lib/alerts/detect";
import { sendSplitPromptEmail } from "@/lib/alerts/email-back";
import { looksLikeDining } from "@/lib/alerts/dining";
import { normalizeMerchant } from "@/lib/alerts/normalize";
import { fmtMoney } from "@/lib/format";
import * as repo from "@/lib/data/repo";
import type { CardTransaction, ParsedTransaction } from "@/lib/types";

export async function ingestParsedAlert(
  userId: string,
  input: {
    parsed: ParsedTransaction;
    gmailMessageId: string;
    sourceFrom?: string;
    inboxUrl?: string;
  },
): Promise<{ transaction: CardTransaction | null; skipped?: string; duplicate?: boolean }> {
  const existing = await repo.findTransactionByMessage(userId, input.gmailMessageId);
  if (existing) return { transaction: existing, duplicate: true };

  const user = await repo.getUser(userId);
  if (!user) throw new Error("User not found");
  const [settings, rules, bills] = await Promise.all([
    repo.getAlertSettings(userId),
    repo.listMerchantRules(userId),
    repo.listBillsForUser(userId),
  ]);

  const decision = detectSplit({
    parsed: input.parsed,
    settings,
    rules,
    bills,
    ownerId: userId,
  });
  if (decision.action === "skip") {
    return { transaction: null, skipped: decision.reason };
  }

  const dining = looksLikeDining(input.parsed.merchant, input.parsed.isDining);
  const row: CardTransaction = {
    id: crypto.randomUUID(),
    ownerId: userId,
    gmailMessageId: input.gmailMessageId,
    merchant: input.parsed.merchant,
    merchantNorm: normalizeMerchant(input.parsed.merchant),
    amount: input.parsed.amount,
    currency: input.parsed.currency || "SGD",
    txnDate: input.parsed.date,
    category: dining ? "dining" : "other",
    confidence: input.parsed.confidence,
    sourceFrom: input.sourceFrom,
    status: decision.action === "matched" ? "matched" : "pending",
    matchedBillId: decision.action === "matched" ? decision.match.billId : decision.match?.billId,
    createdAt: new Date().toISOString(),
  };
  const saved = await repo.insertTransaction(row);

  if (saved.status === "pending") {
    const amount = fmtMoney(saved.amount, saved.currency);
    const text = decision.match
      ? `Looks like your ${bills.find((b) => b.id === decision.match?.billId)?.occasion || saved.merchant} bill — ${amount}. Link it?`
      : `Split expense detected — ${amount} at ${saved.merchant}. Scan a receipt?`;
    await repo.insertNotification({
      id: crypto.randomUUID(),
      text,
      createdAt: saved.createdAt,
      read: false,
      forName: user.name,
      recipientUserId: userId,
      type: "suggested_split",
    });
    if (settings.emailBack && user.email && input.inboxUrl) {
      await sendSplitPromptEmail({
        to: user.email,
        merchant: saved.merchant,
        amount: saved.amount,
        currency: saved.currency,
        inboxUrl: input.inboxUrl,
      });
    }
  }
  return { transaction: saved };
}
