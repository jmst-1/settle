import type { OcrResult } from "@/lib/types";
import type { BillItem } from "@/lib/types";

export function expandOcr(ocr: OcrResult, receiptId?: string): BillItem[] {
  return (ocr.items || []).flatMap((it) => {
    const qty = it.qty || 1;
    const base = {
      price: parseFloat(String(it.unitPrice)) || 0,
      assignee: null,
      split: false,
      splitWith: [] as string[],
      receiptId,
    };
    if (qty <= 1) {
      return [{ name: it.name, ...base }];
    }
    return Array.from({ length: qty }, (_, k) => ({
      name: `${it.name} #${k + 1}`,
      ...base,
    }));
  });
}

export const OCR_PROMPT = `Extract all line items and totals from this receipt. Return ONLY valid JSON, no markdown, no explanation. Format:
{
  "occasion": "venue name or description",
  "bill_date": "YYYY-MM-DD or empty string",
  "currency": "SGD",
  "items": [{"name":"item name","qty":1,"unitPrice":0.00}],
  "discount": 0.00,
  "serviceCharge": 0.00,
  "tax": 0.00,
  "total": 0.00
}
If a field is not on the receipt, use 0 or empty string. Extract every line item individually.`;
