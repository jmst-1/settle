"use client";

import { Suspense } from "react";
import { NewBillWizard } from "@/components/bill/NewBillWizard";
import { useMock } from "@/context/MockStore";

function Wizard() {
  const { currentUser } = useMock();
  return <NewBillWizard key={currentUser.id} />;
}

export default function NewBillPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
