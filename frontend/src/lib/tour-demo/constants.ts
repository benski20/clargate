/** Synthetic proposal id — never persisted; tour-only. */
export const TOUR_DEMO_PROPOSAL_ID = "platform-tour-demo";

export function isTourDemoProposalId(id: string | undefined | null): boolean {
  return id === TOUR_DEMO_PROPOSAL_ID;
}
