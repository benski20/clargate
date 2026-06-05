"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REVIEW_TYPE_GROUPS,
  formatReviewTypeLabel,
  getReviewTypeOption,
  type ReviewType,
} from "@/lib/review-types";
import { cn } from "@/lib/utils";

type ReviewTypeSelectProps = {
  id?: string;
  value: ReviewType | null;
  onValueChange: (value: ReviewType) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function ReviewTypeSelect({
  id,
  value,
  onValueChange,
  disabled,
  className,
  placeholder = "Select review type",
}: ReviewTypeSelectProps) {
  const selected = getReviewTypeOption(value);

  return (
    <div className="space-y-2">
      <Select
        value={value ?? undefined}
        onValueChange={(v) => onValueChange(v as ReviewType)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("h-auto min-h-10 w-full cursor-pointer py-2", className)}>
          <SelectValue placeholder={placeholder}>
            {value ? formatReviewTypeLabel(value) : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)]">
          {REVIEW_TYPE_GROUPS.map((group) => (
            <SelectGroup key={group.pathway}>
              <SelectLabel className="text-xs font-semibold tracking-wide text-muted-foreground">
                {group.title}
              </SelectLabel>
              {group.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="items-start py-2">
                  <span className="flex flex-col gap-0.5 text-left">
                    <span className="font-medium leading-snug">{opt.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{opt.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {selected?.cfrRef ? (
        <p className="text-xs text-muted-foreground">
          Reference: <span className="font-medium text-foreground/90">{selected.cfrRef}</span>
        </p>
      ) : null}
    </div>
  );
}
