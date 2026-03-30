import Link from "next/link";

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="group mx-auto mb-2 flex cursor-pointer items-center justify-center gap-2.5"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
        C
      </span>
      <span className="font-[var(--font-heading)] text-xl font-semibold tracking-tight">Clargate</span>
    </Link>
  );
}
