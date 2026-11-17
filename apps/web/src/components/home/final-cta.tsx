"use client";

import { EditorialLink, Reveal, useStartStylingHref } from "./ui";

export function FinalCta() {
  const startHref = useStartStylingHref();

  return (
    <section
      id="cta"
      className="cinema-bg relative overflow-hidden px-5 py-24 text-center sm:px-8 lg:px-16 lg:py-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(217,119,66,0.22),transparent)]"
      />

      <div className="relative mx-auto max-w-3xl">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-amber-600">
            Ready when you are
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="font-editorial mt-7 text-4xl leading-[1.05] text-neutral-900 sm:text-6xl">
            Your next look{" "}
            <span className="italic text-amber-700">starts here.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-11 flex justify-center">
            <EditorialLink href={startHref}>Start Styling</EditorialLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
