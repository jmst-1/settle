/** Singapore-first bank / card / wallet senders. Never scan the whole mailbox. */
export const FINANCIAL_SENDER_DOMAINS = [
  "dbs.com",
  "dbs.com.sg",
  "posb.com.sg",
  "ocbc.com",
  "ocbc.com.sg",
  "uob.com.sg",
  "uobgroup.com",
  "citibank.com",
  "citibank.com.sg",
  "citi.com",
  "americanexpress.com",
  "amex.com",
  "hsbc.com.sg",
  "hsbc.com",
  "standardchartered.com",
  "sc.com",
  "grab.com",
  "grabtaxi.com",
  "youtrip.com",
  "revolut.com",
  "wise.com",
  "transferwise.com",
  "paylah.dbs.com",
  "notifications.google.com",
];

export function gmailSearchQuery(newerThanDays = 14): string {
  const from = FINANCIAL_SENDER_DOMAINS.map((d) => `from:${d}`).join(" OR ");
  return `(${from}) newer_than:${newerThanDays}d`;
}

export function isFinancialSender(fromHeader: string | undefined | null): boolean {
  if (!fromHeader) return false;
  const lower = fromHeader.toLowerCase();
  return FINANCIAL_SENDER_DOMAINS.some((d) => lower.includes(d));
}

export function extractEmailAddress(fromHeader: string): string {
  const m = fromHeader.match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}
