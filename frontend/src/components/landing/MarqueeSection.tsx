const items = [
  { t: "SOC 2 Ready", serif: false },
  { t: "hipaa aligned", serif: true },
  { t: "US Data Residency", serif: false },
  { t: "encryption at rest", serif: true },
] as const;

function Row() {
  return (
    <div className="flex items-center gap-[clamp(2rem,4vw,4rem)] px-[clamp(1rem,2vw,2rem)] whitespace-nowrap opacity-90">
      {items.map((item, i) => (
        <span key={`${item.t}-${i}`} className="contents">
          {item.serif ? (
            <span className="font-[family-name:var(--font-heading)] text-lg italic tracking-tight lowercase text-white/70 md:text-xl">
              {item.t}
            </span>
          ) : (
            <span className="font-sans text-xs tracking-[0.15em] text-[#FDFBF7] uppercase md:text-sm">
              {item.t}
            </span>
          )}
          <span className="size-1 rounded-full bg-[#D9381E]" />
        </span>
      ))}
    </div>
  );
}

export function MarqueeSection() {
  return (
    <section className="relative z-10 flex flex-col justify-center overflow-hidden border-b border-[#DCD8D0] bg-[#0A0A0A] py-[clamp(1rem,1.5vw,1.5rem)] text-[#FDFBF7]">
      <div className="flex w-max animate-[marquee_40s_linear_infinite] items-center">
        <Row />
        <Row />
      </div>
    </section>
  );
}
