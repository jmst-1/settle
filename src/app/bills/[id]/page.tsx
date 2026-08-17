"use client";

import { useParams, useRouter } from "next/navigation";
import { BillDetailScreen } from "@/components/bill/BillDetailScreen";
import { useMock } from "@/context/MockStore";
import { visibleBills } from "@/lib/me";

export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const { bills, currentUser } = useMock();
  const router = useRouter();
  const bill = visibleBills(bills, currentUser).find((b) => b.id === id);
  if (!bill) {
    return (
      <div className="px-6 py-20 text-center">
        <div className="font-bold">Bill not found</div>
        <button onClick={() => router.push("/")} className="mt-4 text-sm text-accent">
          Back to bills
        </button>
      </div>
    );
  }
  return <BillDetailScreen bill={bill} />;
}
