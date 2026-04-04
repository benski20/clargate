import type { InstitutionAiGuidanceCategory } from "@/lib/types";

/** Shared labels for admin configure + PI “learn about your institution” views. */
export const INSTITUTION_GUIDANCE_SECTIONS: {
  category: InstitutionAiGuidanceCategory;
  title: string;
  description: string;
}[] = [
  {
    category: "example_proposal",
    title: "Example proposals",
    description:
      "Templates or de-identified samples that show the tone and structure your IRB expects.",
  },
  {
    category: "rules",
    title: "Proposal rules",
    description: "Non-negotiable requirements (sections, risk language, policy references).",
  },
  {
    category: "guidelines",
    title: "Guidelines",
    description: "Best practices, checklists, and interpretation notes.",
  },
  {
    category: "institutional",
    title: "Institutional specifics",
    description: "Local policies, ancillary boards, COI norms, and campus context.",
  },
];

export const INSTITUTION_GUIDANCE_CATEGORY_SHORT: Record<InstitutionAiGuidanceCategory, string> = {
  example_proposal: "Examples",
  rules: "Rules",
  guidelines: "Guidelines",
  institutional: "Institution",
};
