import Link from "next/link";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Workflow", href: "#how-it-works" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/80 py-16 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <Link href="/" className="group flex cursor-pointer items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
                C
              </span>
              <span className="font-[var(--font-heading)] text-lg font-semibold tracking-tight">
                Clargate
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A focused IRB workspace for research institutions — built for clarity, auditability, and
              calm operations.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="cursor-pointer text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-border/60 pt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Clargate. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
