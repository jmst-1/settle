import { gmailSearchQuery, isFinancialSender } from "@/lib/alerts/senders";
import { htmlToText, parseTransactionEmail } from "@/lib/alerts/parse";
import { ingestParsedAlert } from "@/lib/alerts/ingest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/token";
import * as repo from "@/lib/data/repo";
import { gmailOAuthConfigured } from "@/lib/alerts/email-back";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/gmail/callback`;
}

export function gmailAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: gmailRedirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenRes = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenRes> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  return (await res.json()) as TokenRes;
}

export async function exchangeCode(code: string, origin: string) {
  const data = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: gmailRedirectUri(origin),
    grant_type: "authorization_code",
  });
  if (!data.access_token) throw new Error(data.error || "Google token exchange failed");
  return data;
}

async function accessTokenFor(userId: string): Promise<string> {
  const conn = await repo.getGmailConnection(userId);
  if (!conn) throw new Error("Gmail is not connected");
  const refresh = decryptSecret(conn.refreshTokenEnc);
  const data = await tokenRequest({
    refresh_token: refresh,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
  });
  if (!data.access_token) throw new Error(data.error || "Could not refresh Gmail token");
  return data.access_token;
}

async function gmailGet<T>(access: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Gmail ${res.status}`);
  }
  return (await res.json()) as T;
}

async function gmailPost<T>(access: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Gmail ${res.status}`);
  }
  return (await res.json()) as T;
}

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
};

function header(msg: GmailMessage, name: string) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeB64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collectBody(part?: GmailMessage["payload"]): { text: string; html: string } {
  if (!part) return { text: "", html: "" };
  let text = "";
  let html = "";
  if (part.body?.data) {
    const decoded = decodeB64Url(part.body.data);
    if ((part.mimeType || "").includes("text/html")) html += decoded;
    else text += decoded;
  }
  for (const child of part.parts || []) {
    const nested = collectBody(child);
    text += nested.text;
    html += nested.html;
  }
  return { text, html };
}

async function profileEmail(access: string) {
  const me = await gmailGet<{ emailAddress?: string }>(access, "profile");
  return me.emailAddress || "";
}

export async function completeGmailConnect(userId: string, code: string, origin: string) {
  if (!gmailOAuthConfigured()) throw new Error("Gmail OAuth is not configured");
  const tokens = await exchangeCode(code, origin);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Disconnect in Google Account and retry.");
  const access = tokens.access_token!;
  const email = await profileEmail(access);
  const existing = await repo.getGmailConnection(userId);
  await repo.saveGmailConnection({
    userId,
    email,
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    historyId: existing?.historyId,
    watchExpiration: existing?.watchExpiration,
    lastSyncAt: existing?.lastSyncAt,
  });
  await syncGmailForUser(userId, { origin, access });
}

export async function disconnectGmail(userId: string) {
  const conn = await repo.getGmailConnection(userId);
  if (conn) {
    try {
      const token = decryptSecret(conn.refreshTokenEnc);
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      /* still delete locally */
    }
  }
  await repo.deleteGmailConnection(userId);
}

export async function syncGmailForUser(
  userId: string,
  opts?: { origin?: string; access?: string },
) {
  const access = opts?.access || (await accessTokenFor(userId));
  const listed = await gmailGet<{ messages?: { id: string }[]; historyId?: string }>(
    access,
    `messages?q=${encodeURIComponent(gmailSearchQuery(14))}&maxResults=40`,
  );
  let ingested = 0;
  for (const m of listed.messages ?? []) {
    const full = await gmailGet<GmailMessage>(access, `messages/${m.id}?format=full`);
    const from = header(full, "From");
    if (!isFinancialSender(from)) continue;
    const bodies = collectBody(full.payload);
    const text = [header(full, "Subject"), bodies.text, htmlToText(bodies.html)].filter(Boolean).join("\n");
    const fallback = full.internalDate
      ? new Date(Number(full.internalDate)).toISOString().slice(0, 10)
      : undefined;
    const parsed = await parseTransactionEmail(text, { dateFallback: fallback });
    if (!parsed) continue;
    const result = await ingestParsedAlert(userId, {
      parsed,
      gmailMessageId: full.id,
      sourceFrom: from,
      inboxUrl: opts?.origin ? `${opts.origin}/inbox` : undefined,
    });
    if (result.transaction && !result.duplicate) ingested += 1;
  }

  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  let watchExpiration: string | null = null;
  let historyId: string | null = listed.historyId ?? null;
  if (topic) {
    try {
      const watch = await gmailPost<{ historyId?: string; expiration?: string }>(access, "watch", {
        topicName: topic,
        labelIds: ["INBOX"],
      });
      historyId = watch.historyId || historyId;
      watchExpiration = watch.expiration
        ? new Date(Number(watch.expiration)).toISOString()
        : null;
    } catch {
      /* polling still works */
    }
  }

  const conn = await repo.getGmailConnection(userId);
  if (conn) {
    await repo.saveGmailConnection({
      ...conn,
      historyId,
      watchExpiration,
      lastSyncAt: new Date().toISOString(),
    });
  }
  return { ingested };
}

export async function syncAllGmail(origin?: string) {
  const conns = await repo.listGmailConnections();
  const results: { userId: string; ingested: number; error?: string }[] = [];
  for (const c of conns) {
    try {
      const r = await syncGmailForUser(c.userId, { origin });
      results.push({ userId: c.userId, ingested: r.ingested });
    } catch (e) {
      results.push({ userId: c.userId, ingested: 0, error: (e as Error).message });
    }
  }
  return results;
}

export function decodePubSubEmail(body: unknown): string | null {
  const msg = (body as { message?: { data?: string } })?.message?.data;
  if (!msg) return null;
  try {
    const json = JSON.parse(Buffer.from(msg, "base64").toString("utf8")) as { emailAddress?: string };
    return json.emailAddress || null;
  } catch {
    return null;
  }
}

export async function syncByGmailAddress(email: string, origin?: string) {
  const conns = await repo.listGmailConnections();
  const hit = conns.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (!hit) return null;
  return syncGmailForUser(hit.userId, { origin });
}
