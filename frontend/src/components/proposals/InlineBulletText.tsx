import { splitInlineBulletItems } from "@/lib/format-ai-review-text";
import { cn } from "@/lib/utils";

export function InlineBulletText({
  text,
  className,
  introClassName,
  listClassName,
}: {
  text: string;
  className?: string;
  introClassName?: string;
  listClassName?: string;
}) {
  const { intro, items } = splitInlineBulletItems(text);

  if (items.length === 0) {
    return (
      <p className={cn("text-sm leading-relaxed text-foreground", introClassName, className)}>{intro}</p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {intro ? (
        <p className={cn("text-sm leading-relaxed text-foreground", introClassName)}>{intro}</p>
      ) : null}
      <ul className={cn("list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground", listClassName)}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
