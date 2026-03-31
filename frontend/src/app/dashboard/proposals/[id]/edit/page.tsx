"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AiIntakeWorkspace } from "@/components/proposals/AiIntakeWorkspace";
import { db } from "@/lib/database";

export default function EditProposalPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await db.getCurrentAppUser();
      if (cancelled) return;
      if (u?.role === "pi") {
        setAccess("allowed");
      } else {
        setAccess("denied");
        router.replace("/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (access === "loading" || access === "denied") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <AiIntakeWorkspace
      existingProposalId={proposalId}
      onBack={() => router.push(`/dashboard/proposals/${proposalId}`)}
      variant="chat"
    />
  );
}
