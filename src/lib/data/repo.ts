/**
 * Data access. Memory store is used when Supabase keys are missing (local / CI).
 * With keys present, the same functions persist through Supabase.
 */
import { isMemoryBackend } from "@/lib/config";
import * as memory from "@/lib/data/memory";
import * as supabaseRepo from "@/lib/data/supabase-repo";
import type { AlertSettings, AppNotification, Bill, CardTransaction, MerchantRule, OcrResult } from "@/lib/types";
import type { StoredGmailConnection } from "@/lib/data/memory";

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
  inboxIds?: string | string[],
  transactionId?: string,
) {
  if (mem()) return memory.saveBill(userId, input, inboxIds, transactionId);
  return supabaseRepo.saveBill(userId, input, inboxIds, transactionId);
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

export async function combinePayees(userId: string, a: string, b: string, settler: string) {
  if (mem()) return memory.combinePayees(userId, a, b, settler);
  return supabaseRepo.combinePayees(userId, a, b, settler);
}

export async function uncombinePayees(userId: string, pairId: string) {
  if (mem()) return memory.uncombinePayees(userId, pairId);
  return supabaseRepo.uncombinePayees(userId, pairId);
}

export async function listBillsForUser(userId: string) {
  if (mem()) return memory.listBillsForUser(userId);
  return supabaseRepo.listBillsForUser(userId);
}

export async function getAlertSettings(userId: string) {
  if (mem()) return memory.getAlertSettings(userId);
  return supabaseRepo.getAlertSettings(userId);
}

export async function updateAlertSettings(userId: string, patch: Partial<AlertSettings>) {
  if (mem()) return memory.updateAlertSettings(userId, patch);
  return supabaseRepo.updateAlertSettings(userId, patch);
}

export async function getGmailConnection(userId: string) {
  if (mem()) return memory.getGmailConnection(userId);
  return supabaseRepo.getGmailConnection(userId);
}

export async function listGmailConnections(): Promise<StoredGmailConnection[]> {
  if (mem()) return memory.listGmailConnections();
  return supabaseRepo.listGmailConnections();
}

export async function saveGmailConnection(row: StoredGmailConnection) {
  if (mem()) return memory.saveGmailConnection(row);
  return supabaseRepo.saveGmailConnection(row);
}

export async function deleteGmailConnection(userId: string) {
  if (mem()) return memory.deleteGmailConnection(userId);
  return supabaseRepo.deleteGmailConnection(userId);
}

export async function getTransaction(userId: string, id: string) {
  if (mem()) return memory.getTransaction(userId, id);
  return supabaseRepo.getTransaction(userId, id);
}

export async function findTransactionByMessage(userId: string, gmailMessageId: string) {
  if (mem()) return memory.findTransactionByMessage(userId, gmailMessageId);
  return supabaseRepo.findTransactionByMessage(userId, gmailMessageId);
}

export async function insertTransaction(row: CardTransaction) {
  if (mem()) return memory.insertTransaction(row);
  return supabaseRepo.insertTransaction(row);
}

export async function updateTransaction(userId: string, id: string, patch: Partial<CardTransaction>) {
  if (mem()) return memory.updateTransaction(userId, id, patch);
  return supabaseRepo.updateTransaction(userId, id, patch);
}

export async function getMerchantRule(userId: string, merchantNorm: string) {
  if (mem()) return memory.getMerchantRule(userId, merchantNorm);
  return supabaseRepo.getMerchantRule(userId, merchantNorm);
}

export async function listMerchantRules(userId: string) {
  if (mem()) return memory.listMerchantRules(userId);
  return supabaseRepo.listMerchantRules(userId);
}

export async function upsertMerchantRule(rule: MerchantRule) {
  if (mem()) return memory.upsertMerchantRule(rule);
  return supabaseRepo.upsertMerchantRule(rule);
}

export async function insertNotification(n: AppNotification) {
  if (mem()) return memory.insertNotification(n);
  return supabaseRepo.insertNotification(n);
}

export async function markSuggestedRead(userId: string) {
  if (mem()) return memory.markSuggestedRead(userId);
  return supabaseRepo.markSuggestedRead(userId);
}

export async function convertTransaction(userId: string, id: string, billId: string) {
  if (mem()) return memory.convertTransaction(userId, id, billId);
  return supabaseRepo.convertTransaction(userId, id, billId);
}

export async function dismissTransaction(userId: string, id: string) {
  if (mem()) return memory.dismissTransaction(userId, id);
  return supabaseRepo.dismissTransaction(userId, id);
}

export async function undoTransaction(userId: string, id: string) {
  if (mem()) return memory.undoTransaction(userId, id);
  return supabaseRepo.undoTransaction(userId, id);
}

export async function neverSplitTransaction(userId: string, id: string) {
  if (mem()) return memory.neverSplitTransaction(userId, id);
  return supabaseRepo.neverSplitTransaction(userId, id);
}

export async function matchTransaction(userId: string, id: string, billId: string) {
  if (mem()) return memory.matchTransaction(userId, id, billId);
  return supabaseRepo.matchTransaction(userId, id, billId);
}
