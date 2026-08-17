"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generatePayNowQR } from "@/lib/paynow";

export function PayNowQR({
  proxy,
  amount,
  size = 200,
  type = "mobile",
}: {
  proxy: string;
  amount: number;
  size?: number;
  type?: "mobile" | "uen";
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const payload = generatePayNowQR(proxy, amount, type);
    QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    }).then(setSrc);
  }, [proxy, amount, size, type]);

  if (!src) {
    return (
      <div
        className="animate-pulse rounded-xl bg-black/[0.06]"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // Data URL from qrcode — not a remote image
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt="PayNow QR"
      className="rounded-xl bg-white p-2"
    />
  );
}
