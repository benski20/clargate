"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { platformTourUrl, PLATFORM_TOUR_QUERY } from "@/lib/platform-guide";

function TourDemoRedirectInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scene = typeof params.scene === "string" ? params.scene : "";
  const tourStep = searchParams.get(PLATFORM_TOUR_QUERY);

  useEffect(() => {
    const step = tourStep !== null ? Number.parseInt(tourStep, 10) : null;
    const withTour = (path: string) => platformTourUrl(path, Number.isFinite(step) ? step : null);

    switch (scene) {
      case "pi-intake-upload":
        router.replace(withTour("/dashboard/proposals/new?demo=upload&demoStep=1"));
        break;
      case "pi-intake-chat":
        router.replace(withTour("/dashboard/proposals/new?demo=chat&demoStep=1"));
        break;
      case "pi-proposal-detail":
        router.replace(withTour("/dashboard/proposals/platform-tour-demo"));
        break;
      case "pi-revisions":
        router.replace(withTour("/dashboard/proposals/platform-tour-demo?variant=revisions&tab=letters"));
        break;
      case "admin-proposal": {
        const focus = searchParams.get("focus");
        const tab = focus === "reviewers" ? "reviewers" : focus === "letter" ? "letter" : focus === "messages" ? "messages" : "summary";
        router.replace(withTour(`/dashboard/admin/proposals/platform-tour-demo?tab=${tab}`));
        break;
      }
      case "reviewer-proposal": {
        const focus = searchParams.get("focus");
        const tab = focus === "submit_review" ? "submit_review" : focus === "details" ? "details" : "summary";
        router.replace(withTour(`/dashboard/admin/proposals/platform-tour-demo?tab=${tab}`));
        break;
      }
      default:
        router.replace("/dashboard");
    }
  }, [router, scene, searchParams, tourStep]);

  return null;
}

export default function TourDemoRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Redirecting" />
        </div>
      }
    >
      <TourDemoRedirectInner />
    </Suspense>
  );
}
