import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getBill, updateBill } from "@/lib/data/repo";
import { visibleBills } from "@/lib/me";
import type { BillItem } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bill = await getBill(params.id);
  if (!bill || !visibleBills([bill], user).length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ bill });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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
  };
  try {
    const bill = await updateBill(user.id, params.id, {
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
    });
    return NextResponse.json({ bill });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
