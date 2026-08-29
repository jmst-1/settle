import { beforeEach, describe, expect, it } from "vitest";
import { ingestParsedAlert } from "@/lib/alerts/ingest";
import { resetSnapshot } from "@/lib/data/memory";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { dismissTransaction, getTransaction, listMerchantRules } from "@/lib/data/repo";

describe("ingestParsedAlert", () => {
  beforeEach(() => {
    resetSnapshot(true);
  });

  it("creates a pending dining suggestion and is idempotent on message id", async () => {
    const first = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Lavo",
        amount: 88,
        currency: "SGD",
        date: "2026-08-29",
        isDining: true,
        confidence: 0.9,
      },
      gmailMessageId: "msg-lavo-1",
    });
    expect(first.transaction?.status).toBe("pending");
    const again = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Lavo",
        amount: 88,
        currency: "SGD",
        date: "2026-08-29",
        isDining: true,
        confidence: 0.9,
      },
      gmailMessageId: "msg-lavo-1",
    });
    expect(again.duplicate).toBe(true);
    expect(again.transaction?.id).toBe(first.transaction?.id);
  });

  it("marks a Handlebar duplicate as matched without prompting", async () => {
    const result = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Handlebar Gillman",
        amount: 376.37,
        currency: "SGD",
        date: "2026-05-20",
        isDining: true,
        confidence: 0.9,
      },
      gmailMessageId: "msg-handlebar",
    });
    expect(result.transaction?.status).toBe("matched");
    expect(result.transaction?.matchedBillId).toBe("bill-1");
  });

  it("learns never_split after two dismissals", async () => {
    const a = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Atlas Bar",
        amount: 90,
        currency: "SGD",
        date: "2026-08-20",
        isDining: true,
        confidence: 0.8,
      },
      gmailMessageId: "msg-atlas-1",
    });
    await dismissTransaction(DEMO_USER_ID, a.transaction!.id);
    const b = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Atlas Bar",
        amount: 91,
        currency: "SGD",
        date: "2026-08-21",
        isDining: true,
        confidence: 0.8,
      },
      gmailMessageId: "msg-atlas-2",
    });
    await dismissTransaction(DEMO_USER_ID, b.transaction!.id);
    const skipped = await ingestParsedAlert(DEMO_USER_ID, {
      parsed: {
        merchant: "Atlas Bar",
        amount: 95,
        currency: "SGD",
        date: "2026-08-22",
        isDining: true,
        confidence: 0.8,
      },
      gmailMessageId: "msg-atlas-3",
    });
    expect(skipped.skipped).toBe("never_split");
    expect(await getTransaction(DEMO_USER_ID, "nope")).toBeNull();
    const rules = await listMerchantRules(DEMO_USER_ID);
    expect(rules.some((r) => r.merchantNorm === "atlas bar" && r.rule === "never_split")).toBe(true);
  });
});
