import type { Metadata } from "next";
import { PortalScreen } from "@/components/portal/PortalScreen";

export const metadata: Metadata = {
  title: "SplitTab",
  description: "Someone split a bill with you. Open to pay via PayNow.",
  openGraph: {
    title: "SplitTab",
    description: "Someone split a bill with you. Open to pay via PayNow.",
  },
  twitter: {
    card: "summary",
    title: "SplitTab",
    description: "Someone split a bill with you. Open to pay via PayNow.",
  },
};

export default function PortalPage({ params }: { params: { token: string } }) {
  return <PortalScreen token={params.token} />;
}
