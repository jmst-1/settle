import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { saveBill } from "@/lib/data/repo";
import type { BillItem } from "@/lib/types";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    occasion: string;
    billDate: string;
    items: BillItem[];
    names: string[];
    discount: number;
    serviceCharge: number;
    tax: number;
    receiptTotal: number;
    paidBy: string;
    payNowNumber: string;
    inboxId?: string;
  };
  if (!body.names?.length || !body.paidBy) {
    return NextResponse.json({ error: "People and payer required" }, { status: 400 });
  }
  const bill = await saveBill(
    user.id,
    {
      occasion: body.occasion || "Untitled bill",
      billDate: body.billDate,
      currency: "SGD",
      items: body.items,
      names: body.names,
      discount: Number(body.discount) || 0,
      serviceCharge: Number(body.serviceCharge) || 0,
      tax: Number(body.tax) || 0,
      receiptTotal: Number(body.receiptTotal) || 0,
      paidBy: body.paidBy,
      payNowNumber: body.payNowNumber || "",
    },
    body.inboxId,
  );
  return NextResponse.json({ bill });
}
