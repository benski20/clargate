"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-5 left-4 right-4 z-50 md:top-6 md:left-8 md:right-8"
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border/70 bg-card/75 px-4 py-2.5 shadow-sm backdrop-blur-xl md:px-6 md:py-3">
        <Link
          href="/"
          className="group flex cursor-pointer items-center gap-2.5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors duration-200 group-hover:bg-primary/90">
            C
          </span>
          <span className="font-[var(--font-heading)] text-lg font-semibold tracking-tight text-foreground">
            Clargate
          </span>
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer rounded-full text-muted-foreground"
            render={<Link href="/login" />}
          >
            Sign in
          </Button>
          <Button
            size="sm"
            className="cursor-pointer rounded-full px-5 shadow-md shadow-primary/10"
            render={<Link href="/signup" />}
          >
            Get started
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" />} className="md:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-l-border/80">
            <div className="mt-10 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="cursor-pointer rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {link.label}
                </a>
              ))}
              <hr className="my-3 border-border" />
              <Button
                variant="ghost"
                className="cursor-pointer justify-start"
                render={<Link href="/login" />}
              >
                Sign in
              </Button>
              <Button className="cursor-pointer" render={<Link href="/signup" />}>
                Get started
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </motion.header>
  );
}
