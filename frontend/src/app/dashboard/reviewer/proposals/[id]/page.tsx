"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Reviewers use the same proposal workspace as admins (AI summary, flags, files, messages).
 * Legacy /dashboard/reviewer/proposals/[id] URLs redirect to /dashboard/admin/proposals/[id].
 */
function RedirectInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(`/dashboard/admin/proposals/${proposalId}${q ? `?${q}` : ""}`);
  }, [proposalId, router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Redirecting" />
    </div>
  );
}

export default function ReviewerProposalRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      }
    >
      <RedirectInner />
    </Suspense>
  );
}
