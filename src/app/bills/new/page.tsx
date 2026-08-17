"use client";

import { Suspense } from "react";
import { NewBillWizard } from "@/components/bill/NewBillWizard";

export default function NewBillPage() {
  return (
    <Suspense>
      <NewBillWizard />
    </Suspense>
  );
}
