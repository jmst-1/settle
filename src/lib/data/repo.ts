/**
 * Data access. Memory store is used when Supabase keys are missing (local / CI).
 * With keys present, the same functions persist through Supabase.
 */
import { isMemoryBackend } from "@/lib/config";
import * as memory from "@/lib/data/memory";
import * as supabaseRepo from "@/lib/data/supabase-repo";
import type { Bill, OcrResult } from "@/lib/types";

function mem() {
  return isMemoryBackend();
}

export async function getUser(id: string) {
  if (mem()) return memory.getUser(id);
  return supabaseRepo.getUser(id);
}

export async function findUserByEmail(email: string) {
  if (mem()) return memory.findUserByEmail(email);
  return supabaseRepo.findUserByEmail(email);
}

export async function ensureUser(input: { id: string; email?: string; name: string; paynow?: string }) {
  if (mem()) return memory.ensureUser(input);
  return supabaseRepo.ensureUser(input);
}

export async function clientState(userId: string) {
  if (mem()) return memory.clientState(userId);
  return supabaseRepo.clientState(userId);
}

export async function setProfile(userId: string, name: string, paynow: string) {
  if (mem()) return memory.setProfile(userId, name, paynow);
  return supabaseRepo.setProfile(userId, name, paynow);
}

export async function addContact(userId: string, name: string, paynow?: string, groupId?: string) {
  if (mem()) return memory.addContact(userId, name, paynow, groupId);
  return supabaseRepo.addContact(userId, name, paynow, groupId);
}

export async function saveBill(
  userId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id"> & {
    id?: string;
    createdAt?: string;
  },
  inboxId?: string,
) {
  if (mem()) return memory.saveBill(userId, input, inboxId);
  return supabaseRepo.saveBill(userId, input, inboxId);
}

export async function updateBill(
  userId: string,
  billId: string,
  input: Omit<Bill, "debts" | "lockedAt" | "createdBy" | "createdAt" | "id">,
) {
  if (mem()) return memory.updateBill(userId, billId, input);
  return supabaseRepo.updateBill(userId, billId, input);
}

export async function getBill(billId: string) {
  if (mem()) return memory.getBill(billId);
  return supabaseRepo.getBill(billId);
}

export async function settlePair(userId: string, from: string, to: string, creatorId: string) {
  if (mem()) return memory.settlePair(userId, from, to, creatorId);
  return supabaseRepo.settlePair(userId, from, to, creatorId);
}

export async function undoPair(userId: string, from: string, to: string, creatorId: string) {
  if (mem()) return memory.undoPair(userId, from, to, creatorId);
  return supabaseRepo.undoPair(userId, from, to, creatorId);
}

export async function portalPayload(token: string) {
  if (mem()) return memory.portalPayload(token);
  return supabaseRepo.portalPayload(token);
}

export async function portalPay(token: string, from: string, to: string, billIds: string[]) {
  if (mem()) return memory.portalPay(token, from, to, billIds);
  return supabaseRepo.portalPay(token, from, to, billIds);
}

export async function captureInbox(
  userId: string,
  input: { label: string; imagePath?: string; ocr?: OcrResult },
) {
  if (mem()) return memory.captureInbox(userId, input);
  return supabaseRepo.captureInbox(userId, input);
}

export async function getInboxItem(userId: string, id: string) {
  if (mem()) return memory.getInboxItem(userId, id);
  return supabaseRepo.getInboxItem(userId, id);
}

export async function markNotificationsRead(userId: string) {
  if (mem()) return memory.markNotificationsRead(userId);
  return supabaseRepo.markNotificationsRead(userId);
}

export async function claimToken(userId: string, token: string) {
  if (mem()) return memory.claimToken(userId, token);
  return supabaseRepo.claimToken(userId, token);
}

export async function createGroup(userId: string, name: string) {
  if (mem()) return memory.createGroup(userId, name);
  return supabaseRepo.createGroup(userId, name);
}

export async function addGroupMember(userId: string, groupId: string, name: string, paynow?: string) {
  if (mem()) return memory.addGroupMember(userId, groupId, name, paynow);
  return supabaseRepo.addGroupMember(userId, groupId, name, paynow);
}
