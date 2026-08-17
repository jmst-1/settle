"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/bill/HomeScreen";
import { useApp } from "@/context/AppStore";

export default function HomeClaim() {
  const params = useSearchParams();
  const claim = params.get("claim");
  const { claimToken, currentUser } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!claim || !currentUser.id) return;
    void claimToken(claim).then(() => router.replace("/"));
  }, [claim, claimToken, currentUser.id, router]);

  return <HomeScreen />;
}
