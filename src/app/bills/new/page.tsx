"use client";

import { Suspense } from "react";
import { NewBillWizard } from "@/components/bill/NewBillWizard";
import { useApp } from "@/context/AppStore";

function Wizard() {
  const { currentUser } = useApp();
  return <NewBillWizard key={currentUser.id} />;
}

export default function NewBillPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
