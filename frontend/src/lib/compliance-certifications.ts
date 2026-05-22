import type { ComplianceCertificationType } from "@/lib/types";

export const COMPLIANCE_CERTIFICATION_TYPES: {
  value: ComplianceCertificationType;
  label: string;
  description: string;
}[] = [
  {
    value: "citi_human_subjects",
    label: "CITI — Human subjects research",
    description: "CITI Program or equivalent human subjects protection training.",
  },
  {
    value: "hipaa",
    label: "HIPAA / Privacy",
    description: "Health information privacy or data protection training.",
  },
  {
    value: "biosafety",
    label: "Biosafety",
    description: "Laboratory biosafety or IBC-required training.",
  },
  {
    value: "conflict_of_interest",
    label: "Conflict of interest",
    description: "Financial conflict of interest or responsible conduct disclosure.",
  },
  {
    value: "other",
    label: "Other compliance certificate",
    description: "Any other training certificate required by your institution.",
  },
];

export const COMPLIANCE_CERTIFICATION_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

export const COMPLIANCE_CERTIFICATION_MAX_BYTES = 16 * 1024 * 1024;

export function complianceCertificationTypeLabel(type: ComplianceCertificationType): string {
  return COMPLIANCE_CERTIFICATION_TYPES.find((t) => t.value === type)?.label ?? type;
}
