import type { AlertSettings, MerchantRule, ParsedTransaction } from "@/lib/types";
import type { Bill } from "@/lib/types";
import { looksLikeDining } from "@/lib/alerts/dining";
import { matchBills, type BillMatch } from "@/lib/alerts/match-bill";
import { normalizeMerchant } from "@/lib/alerts/normalize";

export type DetectResult =
  | { action: "skip"; reason: "disabled" | "below_threshold" | "not_dining" | "never_split" }
  | { action: "matched"; match: BillMatch }
  | { action: "prompt"; match?: BillMatch };

export function detectSplit(input: {
  parsed: ParsedTransaction;
  settings: AlertSettings;
  rules: MerchantRule[];
  bills: Pick<Bill, "id" | "occasion" | "billDate" | "receiptTotal" | "createdBy">[];
  ownerId: string;
}): DetectResult {
  if (!input.settings.enabled) return { action: "skip", reason: "disabled" };
  if (input.parsed.amount < input.settings.amountThreshold) {
    return { action: "skip", reason: "below_threshold" };
  }
  const dining = looksLikeDining(input.parsed.merchant, input.parsed.isDining);
  if (input.settings.diningOnly && !dining) {
    return { action: "skip", reason: "not_dining" };
  }
  const norm = normalizeMerchant(input.parsed.merchant);
  const rule = input.rules.find((r) => r.merchantNorm === norm);
  if (rule?.rule === "never_split") {
    return { action: "skip", reason: "never_split" };
  }

  const match = matchBills(input.bills, {
    merchant: input.parsed.merchant,
    amount: input.parsed.amount,
    date: input.parsed.date,
    ownerId: input.ownerId,
  });
  if (match?.confidence === "high") {
    return { action: "matched", match };
  }
  return { action: "prompt", match: match ?? undefined };
}
