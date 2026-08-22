/**
 * Supabase persistence. Used when NEXT_PUBLIC_SUPABASE_URL and the service role key are set.
 * Maps the normalized SQL schema onto the same app types the UI already uses.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDebts } from "@/lib/debts";
import type {
  AppNotification,
  Bill,
  BillItem,
  Contact,
  Group,
  InboxReceipt,
  Member,
  OcrResult,
} from "@/lib/types";
import type { ClientState } from "@/lib/data/memory";

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
    onboarded_at?: string | null;
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
    onboardedAt: row.onboarded_at ?? null,
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
  return mapProfile(data, token);
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

export async function clientState(userId: string): Promise<ClientState | null> {
  const currentUser = await getUser(userId);
  if (!currentUser) return null;
  const [users, contacts, groups, bills] = await Promise.all([
    loadUsers(),
    loadContacts(),
    loadGroups(),
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
  }));

  return { users, contacts, groups, bills, inbox, notifications, currentUser };
}

export async function setProfile(userId: string, name: string, paynow: string) {
  const sb = admin();
  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from("user_profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  await sb
    .from("user_profiles")
    .update({
      display_name: name,
      default_paynow: paynow,
      onboarded_at: existing?.onboarded_at ?? now,
      updated_at: now,
    })
    .eq("id", userId);
  await sb.from("members").update({ name, paynow }).eq("linked_user_id", userId);
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
  );

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
    await sb.from("bill_debts").insert({
      bill_id: billId,
      debtor_bill_member_id: bmIds[d.from],
      creditor_bill_member_id: bmIds[d.to],
      total_amount: d.amount,
      settled: false,
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
  inboxId?: string,
) {
  const bill = await persistBill(userId, input);
  if (inboxId) {
    const sb = admin();
    await sb
      .from("receipt_inbox")
      .update({ processed: true, bill_id: bill.id })
      .eq("id", inboxId)
      .eq("owner_id", userId);
  }
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
  const allowed = user.id === creatorId || user.name === from || user.name === to;
  if (!allowed) throw new Error("You can only tag a debt you’re on, or your own tab");
  const bills = (await loadBills()).filter((b) => b.createdBy === creatorId);
  const sb = admin();
  const now = new Date().toISOString();
  for (const bill of bills) {
    const hit = bill.debts.some(
      (d) => (d.from === from && d.to === to) || (d.from === to && d.to === from),
    );
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
      const match = (df === from && dt === to) || (df === to && dt === from);
      if (match) {
        await sb.from("bill_debts").update({ settled: true, settled_at: now }).eq("id", d.id);
      }
    }
    if (!bill.lockedAt) await sb.from("bills").update({ locked_at: now }).eq("id", bill.id);
  }
  return clientState(userId);
}

export async function undoPair(userId: string, from: string, to: string, creatorId: string) {
  if (userId !== creatorId) throw new Error("Only the tab creator can undo");
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
      const match = (df === from && dt === to) || (df === to && dt === from);
      if (match) await sb.from("bill_debts").update({ settled: false, settled_at: null }).eq("id", d.id);
    }
    const still = (data?.bill_debts ?? []).some((d) => {
      const df = names[d.debtor_bill_member_id];
      const dt = names[d.creditor_bill_member_id];
      const match = (df === from && dt === to) || (df === to && dt === from);
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
  const creatorId = (member.groups as { owner_id: string }).owner_id;
  const name = member.name as string;
  return {
    token,
    name,
    linkedUserId: (member.linked_user_id as string) || null,
    creatorId,
    bills: bills.filter((b) => b.createdBy === creatorId && b.names.includes(name)),
    users,
    contacts,
  };
}

export async function portalPay(token: string, from: string, to: string, billIds: string[]) {
  const payload = await portalPayload(token);
  if (!payload || payload.name !== from) throw new Error("Invalid token");
  const idSet = new Set(billIds);
  const amount = payload.bills
    .filter((b) => idSet.has(b.id))
    .flatMap((b) => b.debts)
    .filter((d) => d.from === from && d.to === to && !d.settled)
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
      if (names[d.debtor_bill_member_id] === from && names[d.creditor_bill_member_id] === to && !d.settled) {
        await sb.from("bill_debts").update({ settled: true, settled_at: now }).eq("id", d.id);
        covered.push(d.id);
      }
    }
    if (covered.length) {
      await sb.from("bills").update({ locked_at: bill.lockedAt || now }).eq("id", bill.id);
    }
  }
  const creditor = payload.users.find((u) => u.name === to);
  await sb.from("notifications").insert({
    recipient_user_id: creditor?.id ?? null,
    type: "paid",
    payload: { text: `${from} paid ${to} · SGD ${amount.toFixed(2)}` },
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
    .is("read_at", null);
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

export { paynowType };
