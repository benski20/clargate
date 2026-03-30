import { ShieldCheck, Lock, MapPin, Server } from "lucide-react";

const badges = [
  { icon: ShieldCheck, label: "SOC 2 Ready" },
  { icon: Lock, label: "HIPAA Aligned" },
  { icon: MapPin, label: "US Data Residency" },
  { icon: Server, label: "End-to-End Encryption" },
];

export function TrustSection() {
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Built for compliance
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {badges.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 text-muted-foreground"
            >
              <item.icon className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
