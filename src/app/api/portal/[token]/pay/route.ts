import { NextResponse } from "next/server";
import { portalPay, portalPayload } from "@/lib/data/repo";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const payload = await portalPayload(params.token);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as { to?: string; billIds?: string[] };
  if (!body.to || !body.billIds?.length) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    const result = await portalPay(params.token, payload.name, body.to, body.billIds);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
