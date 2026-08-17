"use client";

import { useParams, useRouter } from "next/navigation";
import { useMock } from "@/context/MockStore";
import { SectionHeader } from "@/components/ui/Typography";

export default function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const { bills } = useMock();
  const router = useRouter();
  const bill = bills.find((b) => b.id === id);

  if (!bill) return null;

  if (bill.lockedAt) {
    return (
      <div>
        <SectionHeader title="Locked" onBack={() => router.push(`/bills/${id}`)} />
        <p className="px-5 text-sm leading-relaxed text-muted">
          This bill has a settlement on it, so items and people are frozen. Undo the payment from
          Settle up if you need to change it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Edit bill" subtitle="Mockup — full editor in production" onBack={() => router.push(`/bills/${id}`)} />
      <p className="px-5 text-sm leading-relaxed text-muted">
        Unlocked bills will reopen the review wizard in the production app. This mockup keeps edit
        as a placeholder so the lock rule is visible.
      </p>
    </div>
  );
}
