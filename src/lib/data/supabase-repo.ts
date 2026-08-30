/**
 * Supabase persistence. Used when NEXT_PUBLIC_SUPABASE_URL and the service role key are set.
 * Maps the normalized SQL schema onto the same app types the UI already uses.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDebts, isInternalPairDebt } from "@/lib/debts";
import { debtMatchesExpanded, expandPairNames, pairsForCreator } from "@/lib/me";
import type {
  AlertSettings,
  AppNotification,
  Bill,
  BillItem,
  CardTransaction,
  Contact,
  Group,
  InboxReceipt,
  Member,
  MerchantRule,
  OcrResult,
  PayeePair,
} from "@/lib/types";
import { DEFAULT_ALERT_SETTINGS } from "@/lib/types";
import type { ClientState, StoredGmailConnection } from "@/lib/data/memory";
import { emailBackConfigured, gmailOAuthConfigured } from "@/lib/alerts/email-back";
import { afterConfirm, afterDismiss, alwaysSkip } from "@/lib/alerts/learn";

function admin() {
  const c = createAdminClient();
  if (!c) throw new Error("Supabase is not configured");
  return c;
}

function paynowType(value: string | null | undefined): "mobile" | "uen" {
  return value === "uen" ? "uen" : "mobile";
}

function mapProfile(
  row: {
    id: string;
    display_name: string | null;
    default_paynow: string | null;
    email?: string | null;
  },
  shareToken: string,
  email?: string | null,
): Member {
  return {
    id: row.id,
    name: row.display_name || "You",
    shareToken,
    paynow: row.default_paynow || "",
    paynowType: "mobile",
    email: email ?? row.email ?? undefined,
  };
}

async function personalShareToken(userId: string): Promise<string> {
  const sb = admin();
  const { data: group } = await sb
    .from("groups")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (!group) return crypto.randomUUID();
  const { data: self } = await sb
    .from("members")
    .select("share_token")
    .eq("group_id", group.id)
    .eq("linked_user_id", userId)
    .maybeSingle();
  return self?.share_token ?? crypto.randomUUID();
}

export async function getUser(id: string): Promise<Member | null> {
  const sb = admin();
  const { data } = await sb.from("user_profiles").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const token = await personalShareToken(id);
  let email: string | undefined;
  try {
    const auth = await sb.auth.admin.getUserById(id);
    email = auth.data.user?.email ?? undefined;
  } catch {
    /* demo / missing auth user */
  }
  return mapProfile(data, token, email);
}

export async function findUserByEmail(_email: string): Promise<Member | null> {
  void _email;
  return null;
}

export async function ensureUser(input: {
  id: string;
  email?: string;
  name: string;
  paynow?: string;
}): Promise<Member> {
  const sb = admin();
  const existing = await getUser(input.id);
  if (existing) return existing;

  await sb.from("user_profiles").upsert({
    id: input.id,
    display_name: input.name,
    default_paynow: input.paynow ?? "",
    default_currency: "SGD",
  });

  const { data: existingGroup } = await sb
    .from("groups")
    .select("id")
    .eq("owner_id", input.id)
    .eq("is_personal", true)
    .maybeSingle();

  let groupId = existingGroup?.id as string | undefined;
  if (!groupId) {
    const { data: group } = await sb
      .from("groups")
      .insert({
        owner_id: input.id,
        name: "Personal",
        is_personal: true,
        default_currency: "SGD",
      })
      .select()
      .maybeSingle();
    groupId = group?.id;
  }
  if (groupId) {
    const { data: member } = await sb
      .from("members")
      .select("id")
      .eq("group_id", groupId)
      .eq("linked_user_id", input.id)
      .maybeSingle();
    if (!member) {
      await sb.from("members").insert({
        group_id: groupId,
        linked_user_id: input.id,
        name: input.name,
        paynow: input.paynow ?? "",
      });
    }
  }
  const user = await getUser(input.id);
  if (!user) throw new Error("Failed to create profile");
  return user;
}

async function loadContacts(): Promise<Contact[]> {
  const sb = admin();
  const { data: members } = await sb.from("members").select("*, groups!inner(owner_id)");
  return (members ?? []).map((m: Record<string, unknown>) => {
    const groups = m.groups as { owner_id: string };
    return {
      id: m.id as string,
      creatorId: groups.owner_id,
      groupId: m.group_id as string,
      name: m.name as string,
      paynow: (m.paynow as string) || "",
      shareToken: m.share_token as string,
      linkedUserId: (m.linked_user_id as string) || undefined,
    };
  });
}

async function loadGroups(): Promise<Group[]> {
  const sb = admin();
  const { data } = await sb.from("groups").select("*");
  return (data ?? []).map((g) => ({
    id: g.id,
    ownerId: g.owner_id,
    name: g.name,
    isPersonal: Boolean(g.is_personal),
  }));
}

async function loadUsers(): Promise<Member[]> {
  const sb = admin();
  const { data: profiles } = await sb.from("user_profiles").select("*");
  const contacts = await loadContacts();
  return (profiles ?? []).map((p) => {
    const self = contacts.find((c) => c.linkedUserId === p.id && c.creatorId === p.id);
    return mapProfile(p, self?.shareToken ?? crypto.randomUUID());
  });
}

function itemFromRow(
  item: {
    name: string;
    unit_price: number;
    quantity: number;
    assignments: { name: string; share: number }[];
    receiptId?: string;
  },
): BillItem[] {
  const qty = item.quantity || 1;
  const assignees = item.assignments.map((a) => a.name);
  const split = assignees.length > 1;
  const base = {
    price: Number(item.unit_price),
    assignee: split ? null : assignees[0] ?? null,
    split,
    splitWith: split ? assignees : [],
    receiptId: item.receiptId,
  };
  if (qty <= 1) return [{ name: item.name, ...base }];
  return Array.from({ length: qty }, (_, i) => ({
    name: `${item.name} #${i + 1}`,
    ...base,
  }));
}

async function mapBill(row: Record<string, unknown>): Promise<Bill> {
  const members = (row.bill_members as Array<Record<string, unknown>>) ?? [];
  const itemsRaw = (row.bill_items as Array<Record<string, unknown>>) ?? [];
  const debtsRaw = (row.bill_debts as Array<Record<string, unknown>>) ?? [];
  const nameByBm: Record<string, string> = {};
  members.forEach((m) => {
    nameByBm[m.id as string] = m.name as string;
  });
  const names = members.map((m) => m.name as string);
  const payer = members.find((m) => m.is_payer);
  const items: BillItem[] = itemsRaw.flatMap((it) => {
    const assigns = ((it.bill_item_assignments as Array<Record<string, unknown>>) ?? []).map((a) => ({
      name: nameByBm[a.bill_member_id as string],
      share: Number(a.share),
    }));
    return itemFromRow({
      name: it.name as string,
      unit_price: Number(it.unit_price),
      quantity: Number(it.quantity ?? 1),
      assignments: assigns.filter((a) => a.name),
      receiptId: (it.receipt_id as string) || undefined,
    });
  });
  const paidBy = (payer?.name as string) || names[0] || "";
  const debts = debtsRaw.map((d) => ({
    from: nameByBm[d.debtor_bill_member_id as string],
    to: nameByBm[d.creditor_bill_member_id as string],
    amount: Number(d.total_amount),
    settled: Boolean(d.settled),
  }));
  return {
    id: row.id as string,
    occasion: (row.occasion as string) || "Untitled bill",
    billDate: String(row.bill_date ?? "").slice(0, 10),
    currency: (row.currency as string) || "SGD",
    items,
    names,
    discount: Number(row.discount ?? 0),
    serviceCharge: Number(row.service_charge ?? 0),
    tax: Number(row.tax ?? 0),
    receiptTotal: Number(row.total ?? 0),
    paidBy,
    payNowNumber: (payer?.paynow as string) || "",
    createdBy: row.owner_id as string,
    debts,
    createdAt: row.created_at as string,
    lockedAt: (row.locked_at as string) || null,
    receipts: (row.receipts as Bill["receipts"]) || undefined,
  };
}

async function loadBills(): Promise<Bill[]> {
  const sb = admin();
  const { data } = await sb
    .from("bills")
    .select(
      `*, bill_members(*), bill_items(*, bill_item_assignments(*)), bill_debts(*)`,
    )
    .order("created_at", { ascending: false });
  return Promise.all((data ?? []).map((row) => mapBill(row as Record<string, unknown>)));
}

async function loadPairs(): Promise<PayeePair[]> {
  const sb = admin();
  const { data } = await sb.from("payee_pairs").select("*");
  return (data ?? []).map((p) => ({
    id: p.id,
    creatorId: p.owner_id,
    memberNames: [p.member_a, p.member_b] as [string, string],
    settler: p.settler,
  }));
}

export async function clientState(userId: string): Promise<ClientState | null> {
  const currentUser = await getUser(userId);
  if (!currentUser) return null;
  const [users, contacts, groups, pairs, bills] = await Promise.all([
    loadUsers(),
    loadContacts(),
    loadGroups(),
    loadPairs(),
    loadBills(),
  ]);
  const sb = admin();
  const { data: inboxRows } = await sb
    .from("receipt_inbox")
    .select("*")
    .eq("owner_id", userId)
    .order("captured_at", { ascending: false });
  const { data: notifRows } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false });

  const inbox: InboxReceipt[] = (inboxRows ?? []).map((r) => ({
    id: r.id,
    label: r.label || "Receipt",
    capturedAt: r.captured_at,
    processed: Boolean(r.processed),
    ownerId: r.owner_id,
    imagePath: r.image_url || undefined,
    ocr: (r.ocr_raw as OcrResult) || undefined,
  }));
  const notifications: AppNotification[] = (notifRows ?? []).map((n) => ({
    id: n.id,
    text: (n.payload as { text?: string })?.text || n.type || "Update",
    createdAt: n.created_at,
    read: Boolean(n.read_at),
    forName: currentUser.name,
    recipientUserId: n.recipient_user_id,
    type: n.type === "suggested_split" ? "suggested_split" : n.type === "paid" ? "paid" : undefined,
  }));

  const { data: txnRows } = await sb
    .from("card_transactions")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);
  const { data: settingsRow } = await sb.from("alert_settings").select("*").eq("user_id", userId).maybeSingle();
  const { data: gmailRow } = await sb
    .from("gmail_connections")
    .select("email, last_sync_at")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: ruleRows } = await sb.from("merchant_rules").select("*").eq("owner_id", userId);

  return {
    users,
    contacts,
    groups,
    pairs,
    bills,
    inbox,
    notifications,
    currentUser,
    transactions: (txnRows ?? []).map(mapTxn),
    alertSettings: mapSettings(settingsRow),
    gmail: {
      configured: gmailOAuthConfigured(),
      connected: Boolean(gmailRow),
      email: gmailRow?.email,
      lastSyncAt: gmailRow?.last_sync_at ?? null,
    },
    merchantRules: (ruleRows ?? []).map(mapRule),
    emailBackConfigured: emailBackConfigured(),
  };
}

function mapSettings(row: Record<string, unknown> | null | undefined): AlertSettings {
  if (!row) return { ...DEFAULT_ALERT_SETTINGS };
  return {
    amountThreshold: Number(row.amount_threshold ?? DEFAULT_ALERT_SETTINGS.amountThreshold),
    diningOnly: row.dining_only !== false,
    emailBack: Boolean(row.email_back),
    enabled: row.enabled !== false,
  };
}

function mapTxn(row: Record<string, unknown>): CardTransaction {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    gmailMessageId: row.gmail_message_id as string,
    merchant: row.merchant as string,
    merchantNorm: row.merchant_norm as string,
    amount: Number(row.amount),
    currency: (row.currency as string) || "SGD",
    txnDate: String(row.txn_date ?? "").slice(0, 10),
    category: row.category === "dining" ? "dining" : "other",
    confidence: Number(row.confidence ?? 0),
    sourceFrom: (row.source_from as string) || undefined,
    status: row.status as CardTransaction["status"],
    matchedBillId: (row.matched_bill_id as string) || undefined,
    createdAt: row.created_at as string,
  };
}

function mapRule(row: Record<string, unknown>): MerchantRule {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    merchantNorm: row.merchant_norm as string,
    rule: row.rule === "never_split" ? "never_split" : "always_prompt",
    dismissCount: Number(row.dismiss_count ?? 0),
    confirmCount: Number(row.confirm_count ?? 0),
  };
}

export async function setProfile(userId: string, name: string, paynow: string) {
  const sb = admin();
  const existing = await getUser(userId);
  const prev = existing?.name;
  await sb
    .from("user_profiles")
    .update({ display_name: name, default_paynow: paynow, updated_at: new Date().toISOString() })
    .eq("id", userId);
  await sb.from("members").update({ name, paynow }).eq("linked_user_id", userId);
  if (prev && prev !== name) {
    await sb.from("payee_pairs").update({ member_a: name }).eq("member_a", prev);
    await sb.from("payee_pairs").update({ member_b: name }).eq("member_b", prev);
    await sb.from("payee_pairs").update({ settler: name }).eq("settler", prev);
  }
  return clientState(userId);
}

export async function addContact(userId: string, raw: string, paynow = "", groupId?: string) {
  const sb = admin();
  const name = raw.trim();
  let gid = groupId;
  if (!gid) {
    const { data } = await sb
      .from("groups")
      .select("id")
      .eq("owner_id", userId)
      .eq("is_personal", true)
      .maybeSingle();
    gid = data?.id;
  }
  if (!gid) throw new Error("No group");
  const { data: existing } = await sb
    .from("members")
    .select("*")
    .eq("group_id", gid)
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      creatorId: userId,
      groupId: gid,
      name: existing.name,
      paynow: existing.paynow || "",
      shareToken: existing.share_token,
      linkedUserId: existing.linked_user_id || undefined,
    } satisfies Contact;
  }
  const { data, error } = await sb
    .from("members")
    .insert({ group_id: gid, name, paynow: paynow || "" })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Could not add person");
  return {
    id: data.id,
    creatorId: userId,
    groupId: gid,
    name: data.name,
    paynow: data.paynow || "",
    shareToken: data.share_token,
    linkedUserId: data.linked_user_id || undefined,
  } satisfies Contact;
}

async function persistBill(
  userId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">,
  existingId?: string,
) {
  const sb = admin();
  const { data: group } = await sb
    .from("groups")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();
  if (!group) throw new Error("Personal group missing");

  const memberIds: Record<string, string> = {};
  for (const name of input.names) {
    const contact = await addContact(
      userId,
      name,
      name === input.paidBy ? input.payNowNumber : "",
      group.id,
    );
    memberIds[name] = contact.id;
  }

  const subtotal = input.items.reduce((s, it) => s + it.price, 0);
  const total = input.receiptTotal || subtotal - input.discount + input.serviceCharge + input.tax;
  const debts = computeDebts(
    input.items,
    input.names,
    input.paidBy,
    input.discount,
    input.serviceCharge,
    input.tax,
    input.receipts,
  );
  const creatorPairs = pairsForCreator(await loadPairs(), userId);

  const billFields = {
    owner_id: userId,
    group_id: group.id,
    occasion: input.occasion,
    bill_date: input.billDate,
    currency: input.currency || "SGD",
    subtotal,
    discount: input.discount,
    service_charge: input.serviceCharge,
    tax: input.tax,
    total,
    receipt_url: null as string | null,
    status: "open",
    receipts: input.receipts ?? null,
  };

  let billId = existingId;
  if (existingId) {
    await sb.from("bill_item_assignments").delete().in(
      "bill_item_id",
      (
        await sb.from("bill_items").select("id").eq("bill_id", existingId)
      ).data?.map((r) => r.id) ?? [],
    );
    await sb.from("bill_items").delete().eq("bill_id", existingId);
    await sb.from("bill_debts").delete().eq("bill_id", existingId);
    await sb.from("bill_members").delete().eq("bill_id", existingId);
    await sb.from("bills").update(billFields).eq("id", existingId).eq("owner_id", userId);
  } else {
    const { data, error } = await sb.from("bills").insert(billFields).select("id").single();
    if (error || !data) throw new Error(error?.message || "Could not save bill");
    billId = data.id;
  }
  if (!billId) throw new Error("Could not save bill");

  const bmIds: Record<string, string> = {};
  for (const name of input.names) {
    const { data, error } = await sb
      .from("bill_members")
      .insert({
        bill_id: billId,
        member_id: memberIds[name],
        name,
        paynow: name === input.paidBy ? input.payNowNumber : "",
        is_payer: name === input.paidBy,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not save people");
    bmIds[name] = data.id;
  }

  await sb.from("bills").update({ paid_by_member_id: memberIds[input.paidBy] }).eq("id", billId);

  for (let i = 0; i < input.items.length; i += 1) {
    const it = input.items[i];
    const { data: item, error } = await sb
      .from("bill_items")
      .insert({
        bill_id: billId,
        name: it.name,
        unit_price: it.price,
        quantity: 1,
        sort_order: i,
        receipt_id: it.receiptId ?? null,
      })
      .select("id")
      .single();
    if (error || !item) throw new Error(error?.message || "Could not save items");
    const shareNames = it.split && it.splitWith.length ? it.splitWith : it.assignee ? [it.assignee] : [];
    const share = shareNames.length ? 1 / shareNames.length : 1;
    for (const n of shareNames) {
      if (!bmIds[n]) continue;
      await sb.from("bill_item_assignments").insert({
        bill_item_id: item.id,
        bill_member_id: bmIds[n],
        share,
      });
    }
  }

  for (const d of debts) {
    if (!bmIds[d.from] || !bmIds[d.to]) continue;
    const internal = isInternalPairDebt(d.from, d.to, creatorPairs);
    await sb.from("bill_debts").insert({
      bill_id: billId,
      debtor_bill_member_id: bmIds[d.from],
      creditor_bill_member_id: bmIds[d.to],
      total_amount: d.amount,
      settled: internal,
      settled_at: internal ? new Date().toISOString() : null,
    });
  }

  const bill = await getBill(billId);
  if (!bill) throw new Error("Bill saved but could not reload");
  return bill;
}

export async function saveBill(
  userId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id"> & {
    id?: string;
    createdAt?: string;
  },
  inboxIds?: string | string[],
  transactionId?: string,
) {
  const bill = await persistBill(userId, input);
  const ids = (Array.isArray(inboxIds) ? inboxIds : inboxIds ? [inboxIds] : []).filter(Boolean);
  if (ids.length) {
    const sb = admin();
    await sb
      .from("receipt_inbox")
      .update({ processed: true, bill_id: bill.id })
      .in("id", ids)
      .eq("owner_id", userId);
  }
  if (transactionId) await convertTransaction(userId, transactionId, bill.id);
  return bill;
}

export async function updateBill(
  userId: string,
  billId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">,
) {
  const existing = await getBill(billId);
  if (!existing) throw new Error("Bill not found");
  if (existing.createdBy !== userId) throw new Error("Only the tab creator can edit");
  if (existing.lockedAt) throw new Error("Bill is locked");
  return persistBill(userId, input, billId);
}

export async function getBill(billId: string): Promise<Bill | null> {
  const sb = admin();
  const { data } = await sb
    .from("bills")
    .select(`*, bill_members(*), bill_items(*, bill_item_assignments(*)), bill_debts(*)`)
    .eq("id", billId)
    .maybeSingle();
  if (!data) return null;
  return mapBill(data as Record<string, unknown>);
}

export async function settlePair(userId: string, from: string, to: string, creatorId: string) {
  const user = await getUser(userId);
  if (!user) throw new Error("Not signed in");
  const pairs = await loadPairs();
  const allowed =
    user.id === creatorId ||
    expandPairNames(pairs, creatorId, from).includes(user.name) ||
    expandPairNames(pairs, creatorId, to).includes(user.name);
  if (!allowed) throw new Error("You can only tag a debt you’re on, or your own tab");
  const bills = (await loadBills()).filter((b) => b.createdBy === creatorId);
  const sb = admin();
  const now = new Date().toISOString();
  for (const bill of bills) {
    const hit = bill.debts.some((d) => debtMatchesExpanded(d, from, to, pairs, creatorId));
    if (!hit) continue;
    const { data } = await sb
      .from("bills")
      .select("bill_members(id, name), bill_debts(id, debtor_bill_member_id, creditor_bill_member_id)")
      .eq("id", bill.id)
      .single();
    const names: Record<string, string> = {};
    (data?.bill_members ?? []).forEach((m: { id: string; name: string }) => {
      names[m.id] = m.name;
    });
    for (const d of data?.bill_debts ?? []) {
      const df = names[d.debtor_bill_member_id];
      const dt = names[d.creditor_bill_member_id];
      if (debtMatchesExpanded({ from: df, to: dt }, from, to, pairs, creatorId)) {
        await sb.from("bill_debts").update({ settled: true, settled_at: now }).eq("id", d.id);
      }
    }
    if (!bill.lockedAt) await sb.from("bills").update({ locked_at: now }).eq("id", bill.id);
  }
  return clientState(userId);
}

export async function undoPair(userId: string, from: string, to: string, creatorId: string) {
  if (userId !== creatorId) throw new Error("Only the tab creator can undo");
  const pairs = await loadPairs();
  const creatorPairs = pairsForCreator(pairs, creatorId);
  const bills = (await loadBills()).filter((b) => b.createdBy === creatorId);
  const sb = admin();
  for (const bill of bills) {
    const { data } = await sb
      .from("bills")
      .select("bill_members(id, name), bill_debts(id, debtor_bill_member_id, creditor_bill_member_id, settled)")
      .eq("id", bill.id)
      .single();
    const names: Record<string, string> = {};
    (data?.bill_members ?? []).forEach((m: { id: string; name: string }) => {
      names[m.id] = m.name;
    });
    for (const d of data?.bill_debts ?? []) {
      const df = names[d.debtor_bill_member_id];
      const dt = names[d.creditor_bill_member_id];
      if (isInternalPairDebt(df, dt, creatorPairs)) continue;
      if (debtMatchesExpanded({ from: df, to: dt }, from, to, pairs, creatorId)) {
        await sb.from("bill_debts").update({ settled: false, settled_at: null }).eq("id", d.id);
      }
    }
    const still = (data?.bill_debts ?? []).some((d) => {
      const df = names[d.debtor_bill_member_id];
      const dt = names[d.creditor_bill_member_id];
      if (isInternalPairDebt(df, dt, creatorPairs)) return false;
      const match = debtMatchesExpanded({ from: df, to: dt }, from, to, pairs, creatorId);
      return d.settled && !match;
    });
    if (!still) await sb.from("bills").update({ locked_at: null }).eq("id", bill.id);
  }
  return clientState(userId);
}

export async function portalPayload(token: string) {
  const sb = admin();
  const { data: member } = await sb
    .from("members")
    .select("*, groups!inner(owner_id)")
    .eq("share_token", token)
    .maybeSingle();
  if (!member) return null;
  const contacts = await loadContacts();
  const users = await loadUsers();
  const bills = await loadBills();
  const pairs = await loadPairs();
  const creatorId = (member.groups as { owner_id: string }).owner_id;
  const name = member.name as string;
  return {
    token,
    name,
    linkedUserId: (member.linked_user_id as string) || null,
    creatorId,
    bills: bills.filter((b) => {
      if (b.createdBy !== creatorId) return false;
      const aliases = expandPairNames(pairs, b.createdBy, name);
      return aliases.some((n) => b.names.includes(n));
    }),
    users,
    contacts,
    pairs,
  };
}

export async function portalPay(token: string, from: string, to: string, billIds: string[]) {
  const payload = await portalPayload(token);
  if (!payload || payload.name !== from) throw new Error("Invalid token");
  const idSet = new Set(billIds);
  const pairs = payload.pairs;
  const amount = payload.bills
    .filter((b) => idSet.has(b.id))
    .flatMap((b) =>
      b.debts.filter((d) => !d.settled && debtMatchesExpanded(d, from, to, pairs, b.createdBy)),
    )
    .reduce((s, d) => s + d.amount, 0);
  if (amount <= 0) return { amount: 0, alreadySettled: true };

  const sb = admin();
  const now = new Date().toISOString();
  for (const bill of payload.bills.filter((b) => idSet.has(b.id))) {
    const { data } = await sb
      .from("bills")
      .select("owner_id, bill_members(id, name, member_id), bill_debts(id, debtor_bill_member_id, creditor_bill_member_id, settled)")
      .eq("id", bill.id)
      .single();
    const names: Record<string, string> = {};
    (data?.bill_members ?? []).forEach((m: { id: string; name: string }) => {
      names[m.id] = m.name;
    });
    const covered: string[] = [];
    for (const d of data?.bill_debts ?? []) {
      if (
        !d.settled &&
        debtMatchesExpanded(
          { from: names[d.debtor_bill_member_id], to: names[d.creditor_bill_member_id] },
          from,
          to,
          pairs,
          bill.createdBy,
        )
      ) {
        await sb.from("bill_debts").update({ settled: true, settled_at: now }).eq("id", d.id);
        covered.push(d.id);
      }
    }
    if (covered.length) {
      await sb.from("bills").update({ locked_at: bill.lockedAt || now }).eq("id", bill.id);
    }
  }
  const pair = pairs.find((p) =>
    payload.bills.some(
      (b) => idSet.has(b.id) && p.creatorId === b.createdBy && p.memberNames.includes(from),
    ),
  );
  const actor = pair ? pair.memberNames.join(" & ") : from;
  const creditor = payload.users.find((u) => u.name === to);
  await sb.from("notifications").insert({
    recipient_user_id: creditor?.id ?? null,
    type: "paid",
    payload: { text: `${actor} paid ${to} · SGD ${amount.toFixed(2)}` },
    channel: "in_app",
  });
  return { amount, alreadySettled: false };
}

export async function captureInbox(
  userId: string,
  input: { label: string; imagePath?: string; ocr?: OcrResult },
) {
  const sb = admin();
  const { data, error } = await sb
    .from("receipt_inbox")
    .insert({
      owner_id: userId,
      label: input.label.trim() || "Receipt",
      image_url: input.imagePath ?? null,
      ocr_raw: input.ocr ?? null,
      processed: false,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save inbox");
  return {
    id: data.id,
    label: data.label || "Receipt",
    capturedAt: data.captured_at,
    processed: false,
    ownerId: userId,
    imagePath: data.image_url || undefined,
    ocr: (data.ocr_raw as OcrResult) || undefined,
  } satisfies InboxReceipt;
}

export async function getInboxItem(userId: string, id: string) {
  const sb = admin();
  const { data } = await sb
    .from("receipt_inbox")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    label: data.label || "Receipt",
    capturedAt: data.captured_at,
    processed: Boolean(data.processed),
    ownerId: userId,
    imagePath: data.image_url || undefined,
    ocr: (data.ocr_raw as OcrResult) || undefined,
  } satisfies InboxReceipt;
}

export async function markNotificationsRead(userId: string) {
  const sb = admin();
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .is("read_at", null)
    .neq("type", "suggested_split");
}

export async function claimToken(userId: string, token: string) {
  const sb = admin();
  await sb.from("members").update({ linked_user_id: userId }).eq("share_token", token);
  return clientState(userId);
}

export async function createGroup(userId: string, name: string) {
  const sb = admin();
  const { data, error } = await sb
    .from("groups")
    .insert({ owner_id: userId, name: name.trim() || "Group", is_personal: false })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create group");
  const user = await getUser(userId);
  if (user) {
    await sb.from("members").insert({
      group_id: data.id,
      linked_user_id: userId,
      name: user.name,
      paynow: user.paynow,
    });
  }
  return {
    id: data.id,
    ownerId: userId,
    name: data.name,
    isPersonal: false,
  } satisfies Group;
}

export async function addGroupMember(userId: string, groupId: string, name: string, paynow = "") {
  const sb = admin();
  const { data: group } = await sb
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!group) throw new Error("Group not found");
  return addContact(userId, name, paynow, groupId);
}

export async function combinePayees(userId: string, a: string, b: string, settler: string) {
  const sb = admin();
  const names: [string, string] = [a.trim(), b.trim()];
  if (!names[0] || !names[1] || names[0] === names[1]) throw new Error("Pick two different people");
  if (settler !== names[0] && settler !== names[1]) throw new Error("Settler must be one of the pair");
  const existing = await loadPairs();
  const already = existing.some(
    (p) =>
      p.creatorId === userId &&
      (p.memberNames.includes(names[0]) || p.memberNames.includes(names[1])),
  );
  if (already) throw new Error("One of them is already combined");
  const { error } = await sb.from("payee_pairs").insert({
    owner_id: userId,
    member_a: names[0],
    member_b: names[1],
    settler,
  });
  if (error) throw new Error(error.message || "Could not combine");

  const pairs = await loadPairs();
  const creatorPairs = pairsForCreator(pairs, userId);
  const bills = (await loadBills()).filter((b) => b.createdBy === userId);
  const now = new Date().toISOString();
  for (const bill of bills) {
    const { data } = await sb
      .from("bills")
      .select("bill_members(id, name), bill_debts(id, debtor_bill_member_id, creditor_bill_member_id, settled)")
      .eq("id", bill.id)
      .single();
    const memberNames: Record<string, string> = {};
    (data?.bill_members ?? []).forEach((m: { id: string; name: string }) => {
      memberNames[m.id] = m.name;
    });
    for (const d of data?.bill_debts ?? []) {
      if (d.settled) continue;
      const df = memberNames[d.debtor_bill_member_id];
      const dt = memberNames[d.creditor_bill_member_id];
      if (isInternalPairDebt(df, dt, creatorPairs)) {
        await sb.from("bill_debts").update({ settled: true, settled_at: now }).eq("id", d.id);
      }
    }
  }
  return clientState(userId);
}

export async function uncombinePayees(userId: string, pairId: string) {
  const sb = admin();
  const { data, error } = await sb
    .from("payee_pairs")
    .delete()
    .eq("id", pairId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message || "Could not uncombine");
  if (!data) throw new Error("Pair not found");
  return clientState(userId);
}

export async function listBillsForUser(userId: string) {
  const bills = await loadBills();
  return bills.filter((b) => b.createdBy === userId);
}

export async function getAlertSettings(userId: string): Promise<AlertSettings> {
  const sb = admin();
  const { data } = await sb.from("alert_settings").select("*").eq("user_id", userId).maybeSingle();
  return mapSettings(data);
}

export async function updateAlertSettings(userId: string, patch: Partial<AlertSettings>) {
  const current = await getAlertSettings(userId);
  const next: AlertSettings = { ...current, ...patch };
  const sb = admin();
  await sb.from("alert_settings").upsert({
    user_id: userId,
    amount_threshold: next.amountThreshold,
    dining_only: next.diningOnly,
    email_back: next.emailBack,
    enabled: next.enabled,
    updated_at: new Date().toISOString(),
  });
  return next;
}

export async function getGmailConnection(userId: string): Promise<StoredGmailConnection | null> {
  const sb = admin();
  const { data } = await sb.from("gmail_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id,
    email: data.email,
    refreshTokenEnc: data.refresh_token_enc,
    historyId: data.history_id,
    watchExpiration: data.watch_expiration,
    lastSyncAt: data.last_sync_at,
  };
}

export async function listGmailConnections(): Promise<StoredGmailConnection[]> {
  const sb = admin();
  const { data } = await sb.from("gmail_connections").select("*");
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    refreshTokenEnc: row.refresh_token_enc,
    historyId: row.history_id,
    watchExpiration: row.watch_expiration,
    lastSyncAt: row.last_sync_at,
  }));
}

export async function saveGmailConnection(row: StoredGmailConnection) {
  const sb = admin();
  await sb.from("gmail_connections").upsert({
    user_id: row.userId,
    email: row.email,
    refresh_token_enc: row.refreshTokenEnc,
    history_id: row.historyId ?? null,
    watch_expiration: row.watchExpiration ?? null,
    last_sync_at: row.lastSyncAt ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteGmailConnection(userId: string) {
  const sb = admin();
  await sb.from("gmail_connections").delete().eq("user_id", userId);
}

export async function getTransaction(userId: string, id: string) {
  const sb = admin();
  const { data } = await sb
    .from("card_transactions")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  return data ? mapTxn(data) : null;
}

export async function findTransactionByMessage(userId: string, gmailMessageId: string) {
  const sb = admin();
  const { data } = await sb
    .from("card_transactions")
    .select("*")
    .eq("owner_id", userId)
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();
  return data ? mapTxn(data) : null;
}

export async function insertTransaction(row: CardTransaction) {
  const sb = admin();
  const { data, error } = await sb
    .from("card_transactions")
    .insert({
      id: row.id,
      owner_id: row.ownerId,
      gmail_message_id: row.gmailMessageId,
      merchant: row.merchant,
      merchant_norm: row.merchantNorm,
      amount: row.amount,
      currency: row.currency,
      txn_date: row.txnDate,
      category: row.category,
      confidence: row.confidence,
      source_from: row.sourceFrom ?? null,
      status: row.status,
      matched_bill_id: row.matchedBillId ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save transaction");
  return mapTxn(data);
}

export async function updateTransaction(userId: string, id: string, patch: Partial<CardTransaction>) {
  const sb = admin();
  const fields: Record<string, unknown> = {};
  if (patch.status) fields.status = patch.status;
  if (patch.matchedBillId !== undefined) fields.matched_bill_id = patch.matchedBillId ?? null;
  if (patch.merchant) fields.merchant = patch.merchant;
  const { data, error } = await sb
    .from("card_transactions")
    .update(fields)
    .eq("id", id)
    .eq("owner_id", userId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Transaction not found");
  return mapTxn(data);
}

export async function getMerchantRule(userId: string, merchantNorm: string) {
  const sb = admin();
  const { data } = await sb
    .from("merchant_rules")
    .select("*")
    .eq("owner_id", userId)
    .eq("merchant_norm", merchantNorm)
    .maybeSingle();
  return data ? mapRule(data) : null;
}

export async function listMerchantRules(userId: string) {
  const sb = admin();
  const { data } = await sb.from("merchant_rules").select("*").eq("owner_id", userId);
  return (data ?? []).map(mapRule);
}

export async function upsertMerchantRule(rule: MerchantRule) {
  const sb = admin();
  const { data, error } = await sb
    .from("merchant_rules")
    .upsert(
      {
        owner_id: rule.ownerId,
        merchant_norm: rule.merchantNorm,
        rule: rule.rule,
        dismiss_count: rule.dismissCount,
        confirm_count: rule.confirmCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,merchant_norm" },
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save merchant rule");
  return mapRule(data);
}

export async function insertNotification(n: AppNotification) {
  const sb = admin();
  await sb.from("notifications").insert({
    id: n.id,
    recipient_user_id: n.recipientUserId ?? null,
    type: n.type || "in_app",
    payload: { text: n.text },
    channel: n.type === "suggested_split" ? "in_app" : "in_app",
  });
}

export async function markSuggestedRead(userId: string) {
  const sb = admin();
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .eq("type", "suggested_split")
    .is("read_at", null);
}

export async function convertTransaction(userId: string, id: string, billId: string) {
  const txn = await getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = await updateTransaction(userId, id, { status: "converted", matchedBillId: billId });
  const existing = await getMerchantRule(userId, txn.merchantNorm);
  await upsertMerchantRule(afterConfirm(existing, txn.merchantNorm, userId));
  return next;
}

export async function dismissTransaction(userId: string, id: string) {
  const txn = await getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = await updateTransaction(userId, id, { status: "dismissed" });
  const existing = await getMerchantRule(userId, txn.merchantNorm);
  await upsertMerchantRule(afterDismiss(existing, txn.merchantNorm, userId));
  return next;
}

export async function undoTransaction(userId: string, id: string) {
  const txn = await getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  return updateTransaction(userId, id, { status: "pending", matchedBillId: undefined });
}

export async function neverSplitTransaction(userId: string, id: string) {
  const txn = await getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const next = await updateTransaction(userId, id, { status: "dismissed" });
  const existing = await getMerchantRule(userId, txn.merchantNorm);
  await upsertMerchantRule(alwaysSkip(existing, txn.merchantNorm, userId));
  return next;
}

export async function matchTransaction(userId: string, id: string, billId: string) {
  const txn = await getTransaction(userId, id);
  if (!txn) throw new Error("Transaction not found");
  const bill = await getBill(billId);
  if (!bill) throw new Error("Bill not found");
  const next = await updateTransaction(userId, id, { status: "matched", matchedBillId: billId });
  const existing = await getMerchantRule(userId, txn.merchantNorm);
  await upsertMerchantRule(afterConfirm(existing, txn.merchantNorm, userId));
  return next;
}

export { paynowType };
