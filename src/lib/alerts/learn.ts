import type { MerchantRule } from "@/lib/types";

const DISMISS_TO_SKIP = 2;

export function afterDismiss(
  rule: MerchantRule | null,
  merchantNorm: string,
  ownerId: string,
): MerchantRule {
  const dismissCount = (rule?.dismissCount ?? 0) + 1;
  return {
    id: rule?.id ?? "",
    ownerId,
    merchantNorm,
    rule: dismissCount >= DISMISS_TO_SKIP ? "never_split" : (rule?.rule ?? "always_prompt"),
    dismissCount,
    confirmCount: rule?.confirmCount ?? 0,
  };
}

export function afterConfirm(
  rule: MerchantRule | null,
  merchantNorm: string,
  ownerId: string,
): MerchantRule {
  return {
    id: rule?.id ?? "",
    ownerId,
    merchantNorm,
    rule: "always_prompt",
    dismissCount: 0,
    confirmCount: (rule?.confirmCount ?? 0) + 1,
  };
}

export function alwaysSkip(
  rule: MerchantRule | null,
  merchantNorm: string,
  ownerId: string,
): MerchantRule {
  return {
    id: rule?.id ?? "",
    ownerId,
    merchantNorm,
    rule: "never_split",
    dismissCount: Math.max(rule?.dismissCount ?? 0, DISMISS_TO_SKIP),
    confirmCount: rule?.confirmCount ?? 0,
  };
}
