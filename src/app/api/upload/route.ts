import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { putFile } from "@/lib/data/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMemoryBackend } from "@/lib/config";
import { toJpegBuffer } from "@/lib/heic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const jpeg = await toJpegBuffer(raw, file.name, file.type);
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  if (isMemoryBackend()) {
    putFile(path, jpeg, "image/jpeg");
    return NextResponse.json({ path });
  }

  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  const { error } = await sb.storage.from("receipts").upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ path });
}
