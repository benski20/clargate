import Link from "next/link";

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="group mx-auto mb-2 flex cursor-pointer items-center justify-center gap-3"
    >
      <span className="font-semibold text-xl tracking-tight text-foreground uppercase transition-opacity group-hover:opacity-80 md:text-2xl">
        ARBITER
      </span>
    </Link>
  );
}
