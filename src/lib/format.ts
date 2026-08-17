export function fmtMoney(value: number, currency = "SGD") {
  return `${currency} ${Number(value).toFixed(2)}`;
}

export function fmtDate(iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-SG", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })
  );
}

export function origin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}
