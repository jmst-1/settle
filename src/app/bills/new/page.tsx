"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NewBillWizard } from "@/components/bill/NewBillWizard";
import { useApp } from "@/context/AppStore";

function Wizard() {
  const { currentUser } = useApp();
  const params = useSearchParams();
  const key = `${currentUser.id}-${params.get("mode")}-${params.get("txn")}-${params.get("rx")}`;
  return <NewBillWizard key={key} />;
}

export default function NewBillPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
