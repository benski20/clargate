"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#gap", label: "The Gap" },
  { href: "#workflow", label: "Workflow" },
  { href: "#capabilities", label: "Platform" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-[clamp(0.5rem,1vw,1rem)] right-[clamp(0.5rem,1vw,1rem)] left-[clamp(0.5rem,1vw,1rem)] z-40 border-b border-[#DCD8D0] bg-[#FDFBF7]/90 backdrop-blur-xl transition-all duration-500">
      <div className="flex h-[clamp(3.5rem,5vw,4.5rem)] items-center justify-between px-[clamp(1.5rem,5vw,4rem)]">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="group relative z-10 font-[family-name:var(--font-heading)] text-lg font-normal tracking-tight text-[#0A0A0A] uppercase md:text-xl"
          >
            ARIBTER
            <span className="absolute -bottom-[0.2rem] left-0 h-[1px] w-0 bg-[#0A0A0A] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-full" />
          </Link>
        </div>

        <div className="hidden items-center gap-[clamp(2.5rem,4vw,4rem)] font-mono text-xs tracking-[0.15em] text-[#0A0A0A] uppercase md:flex">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group relative overflow-hidden py-4"
            >
              <span className="relative z-10">{item.label}</span>
              <span className="absolute bottom-[0.8rem] left-0 h-[1px] w-0 bg-[#0A0A0A] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/signup"
            className="hidden items-center gap-3 rounded-full border border-[#DCD8D0] px-6 py-2 font-mono text-xs tracking-[0.15em] text-[#0A0A0A] uppercase transition-colors duration-500 hover:bg-[#0A0A0A] hover:text-[#FDFBF7] md:inline-flex"
          >
            Start Trial
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="md:hidden"
              render={
                <Button variant="ghost" size="icon" className="text-[#0A0A0A]" aria-label="Open menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="border-[#DCD8D0] bg-[#FDFBF7]">
              <SheetHeader>
                <SheetTitle className="font-[family-name:var(--font-heading)] text-left text-lg uppercase">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-6 px-6 pb-10 pt-2 font-mono text-xs tracking-[0.15em] uppercase sm:px-7">
                {navLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-[#0A0A0A] hover:text-[#D9381E]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  href="/signup"
                  className="text-[#D9381E]"
                  onClick={() => setOpen(false)}
                >
                  Start Trial
                </Link>
                <Link href="/login" className="text-[#555555]" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
