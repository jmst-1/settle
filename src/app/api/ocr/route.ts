import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser } from "@/lib/session";
import { getFile } from "@/lib/data/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMemoryBackend } from "@/lib/config";
import { OCR_PROMPT } from "@/lib/ocr";
import type { OcrResult } from "@/lib/types";

async function loadImage(path: string): Promise<{ buf: Buffer; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  if (isMemoryBackend()) {
    const file = getFile(path);
    if (!file) throw new Error("File not found");
    return { buf: file.buf, mediaType: "image/jpeg" };
  }
  const sb = createAdminClient();
  if (!sb) throw new Error("Storage not configured");
  const { data, error } = await sb.storage.from("receipts").download(path);
  if (error || !data) throw new Error(error?.message || "File not found");
  const buf = Buffer.from(await data.arrayBuffer());
  return { buf, mediaType: "image/jpeg" };
}

function parseOcr(text: string): OcrResult {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const json = JSON.parse(cleaned) as OcrResult;
  return {
    occasion: json.occasion || "",
    bill_date: json.bill_date || "",
    currency: json.currency || "SGD",
    items: Array.isArray(json.items) ? json.items : [],
    discount: Number(json.discount) || 0,
    serviceCharge: Number(json.serviceCharge) || 0,
    tax: Number(json.tax) || 0,
    total: Number(json.total) || 0,
  };
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { path } = (await req.json()) as { path?: string };
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (path.includes("..") || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "OCR is not configured. Add ANTHROPIC_API_KEY or enter the bill manually." },
      { status: 501 },
    );
  }

  try {
    const { buf, mediaType } = await loadImage(path);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: buf.toString("base64"),
              },
            },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
    const ocr = parseOcr(text);
    return NextResponse.json({ ocr, path });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
