"use client";

import { useParams, useRouter } from "next/navigation";
import { NewBillWizard } from "@/components/bill/NewBillWizard";
import { useApp } from "@/context/AppStore";
import { SectionHeader } from "@/components/ui/Typography";

export default function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const { bills, currentUser } = useApp();
  const router = useRouter();
  const bill = bills.find((b) => b.id === id);

  if (!bill) return null;

  const canEdit = currentUser.id === bill.createdBy;

  if (!canEdit) {
    return (
      <div>
        <SectionHeader title="Can’t edit" onBack={() => router.push(`/bills/${id}`)} />
        <p className="px-5 text-sm leading-relaxed text-muted">
          Only the creator of this tab can edit an unlocked bill.
        </p>
      </div>
    );
  }

  if (bill.lockedAt) {
    return (
      <div>
        <SectionHeader title="Locked" onBack={() => router.push(`/bills/${id}`)} />
        <p className="px-5 text-sm leading-relaxed text-muted">
          This bill has a settlement on it, so items and people are frozen. The tab creator can undo
          the payment from Settle up if you need to change it.
        </p>
      </div>
    );
  }

  return <NewBillWizard key={bill.id} editBill={bill} />;
}
