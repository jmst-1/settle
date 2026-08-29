import { describe, expect, it } from "vitest";
import { detectSplit } from "@/lib/alerts/detect";
import { afterConfirm, afterDismiss } from "@/lib/alerts/learn";
import { matchBills } from "@/lib/alerts/match-bill";
import { merchantSimilarity, normalizeMerchant } from "@/lib/alerts/normalize";
import { parseEmailHeuristic } from "@/lib/alerts/parse";
import { gmailSearchQuery, isFinancialSender } from "@/lib/alerts/senders";
import type { AlertSettings, MerchantRule, ParsedTransaction } from "@/lib/types";

const settings: AlertSettings = {
  amountThreshold: 30,
  diningOnly: true,
  emailBack: false,
  enabled: true,
};

const dining: ParsedTransaction = {
  merchant: "Burnt Ends",
  amount: 48.2,
  currency: "SGD",
  date: "2026-08-28",
  isDining: true,
  confidence: 0.8,
};

const handlebarBill = {
  id: "bill-1",
  occasion: "Handlebar @ Gillman",
  billDate: "2026-05-20",
  receiptTotal: 376.37,
  createdBy: "usr_alice",
};

describe("normalizeMerchant", () => {
  it("strips PTE LTD and punctuation", () => {
    expect(normalizeMerchant("BURNT ENDS PTE. LTD.")).toBe("burnt ends");
    expect(normalizeMerchant("Handlebar @ Gillman")).toBe("handlebar gillman");
  });

  it("scores similar venue names highly", () => {
    expect(merchantSimilarity("Handlebar @ Gillman", "HANDLEBAR GILLMAN SG")).toBeGreaterThan(0.8);
  });
});

describe("detectSplit", () => {
  it("skips amounts below the threshold", () => {
    const r = detectSplit({
      parsed: { ...dining, amount: 12 },
      settings,
      rules: [],
      bills: [],
      ownerId: "usr_alice",
    });
    expect(r).toEqual({ action: "skip", reason: "below_threshold" });
  });

  it("skips non-dining when dining-only is on", () => {
    const r = detectSplit({
      parsed: { ...dining, merchant: "Cold Storage", isDining: false },
      settings,
      rules: [],
      bills: [],
      ownerId: "usr_alice",
    });
    expect(r).toEqual({ action: "skip", reason: "not_dining" });
  });

  it("prompts for dining over the threshold", () => {
    const r = detectSplit({
      parsed: dining,
      settings,
      rules: [],
      bills: [],
      ownerId: "usr_alice",
    });
    expect(r.action).toBe("prompt");
  });

  it("skips merchants marked never_split", () => {
    const rules: MerchantRule[] = [
      {
        id: "r1",
        ownerId: "usr_alice",
        merchantNorm: "burnt ends",
        rule: "never_split",
        dismissCount: 2,
        confirmCount: 0,
      },
    ];
    const r = detectSplit({
      parsed: dining,
      settings,
      rules,
      bills: [],
      ownerId: "usr_alice",
    });
    expect(r).toEqual({ action: "skip", reason: "never_split" });
  });

  it("matches an existing bill at high confidence and does not nag", () => {
    const r = detectSplit({
      parsed: {
        merchant: "Handlebar Gillman",
        amount: 376.37,
        currency: "SGD",
        date: "2026-05-20",
        isDining: true,
        confidence: 0.9,
      },
      settings,
      rules: [],
      bills: [handlebarBill],
      ownerId: "usr_alice",
    });
    expect(r.action).toBe("matched");
    if (r.action === "matched") expect(r.match.billId).toBe("bill-1");
  });
});

describe("matchBills", () => {
  it("returns high confidence for same day, amount, and venue", () => {
    const m = matchBills([handlebarBill], {
      merchant: "Handlebar @ Gillman",
      amount: 376.4,
      date: "2026-05-20",
      ownerId: "usr_alice",
    });
    expect(m?.confidence).toBe("high");
    expect(m?.billId).toBe("bill-1");
  });

  it("ignores bills for another user", () => {
    const m = matchBills([handlebarBill], {
      merchant: "Handlebar",
      amount: 376.37,
      date: "2026-05-20",
      ownerId: "usr_bob",
    });
    expect(m).toBeNull();
  });
});

describe("learn", () => {
  it("sets never_split after two dismissals", () => {
    const once = afterDismiss(null, "burnt ends", "usr_alice");
    expect(once.rule).toBe("always_prompt");
    expect(once.dismissCount).toBe(1);
    const twice = afterDismiss(once, "burnt ends", "usr_alice");
    expect(twice.rule).toBe("never_split");
    expect(twice.dismissCount).toBe(2);
  });

  it("clears never_split on confirm", () => {
    const skipped = afterDismiss(afterDismiss(null, "burnt ends", "usr_alice"), "burnt ends", "usr_alice");
    const confirmed = afterConfirm(skipped, "burnt ends", "usr_alice");
    expect(confirmed.rule).toBe("always_prompt");
    expect(confirmed.confirmCount).toBe(1);
    expect(confirmed.dismissCount).toBe(0);
  });
});

describe("parseEmailHeuristic", () => {
  it("parses a DBS-style dining alert", () => {
    const parsed = parseEmailHeuristic(
      `Dear Customer, you spent SGD 48.20 at Burnt Ends on 28 Aug 2026. Card ending 1234.`,
    );
    expect(parsed?.merchant).toMatch(/Burnt Ends/i);
    expect(parsed?.amount).toBe(48.2);
    expect(parsed?.date).toBe("2026-08-28");
    expect(parsed?.isDining).toBe(true);
  });

  it("parses an OCBC-style merchant line", () => {
    const parsed = parseEmailHeuristic(
      `Transaction Alert\nAmount: SGD 62.50\nMerchant: PS.Cafe Harding Road\nDate: 2026-06-14`,
    );
    expect(parsed?.merchant).toMatch(/PS\.Cafe/i);
    expect(parsed?.amount).toBe(62.5);
    expect(parsed?.date).toBe("2026-06-14");
  });

  it("parses an AMEX-style charge", () => {
    const parsed = parseEmailHeuristic(
      `American Express: A charge of $355.91 to ATLAS BAR PTE LTD was made on 05 Jul 2026.`,
    );
    expect(parsed?.merchant).toMatch(/ATLAS BAR/i);
    expect(parsed?.amount).toBe(355.91);
    expect(parsed?.date).toBe("2026-07-05");
  });
});

describe("senders", () => {
  it("accepts known bank From headers", () => {
    expect(isFinancialSender("DBS Bank <alert@dbs.com>")).toBe(true);
    expect(isFinancialSender("mom@gmail.com")).toBe(false);
  });

  it("builds a from-restricted Gmail query", () => {
    const q = gmailSearchQuery(14);
    expect(q).toContain("from:dbs.com");
    expect(q).toContain("newer_than:14d");
    expect(q).not.toContain("in:anywhere");
  });
});
