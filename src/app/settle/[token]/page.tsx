"use client";

import { PortalScreen } from "@/components/portal/PortalScreen";

export default function PortalPage({ params }: { params: { token: string } }) {
  return <PortalScreen token={params.token} />;
}
