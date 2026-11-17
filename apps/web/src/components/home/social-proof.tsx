"use client";

import { Eyebrow, Reveal } from "./ui";

const STATS = [
  { value: "12k+", label: "looks styled" },
  { value: "40+", label: "stores compared" },
  { value: "4.9", label: "average rating" },
];

export function SocialProof() {
  return (
    <section className="relative bg-[#fbfbfd] px-5 py-20 sm:px-8 lg:px-16 lg:py-28">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <Eyebrow index="06" label="Loved by dressers" />
        </Reveal>

        <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:items-end">
          <Reveal delay={0.08} className="lg:col-span-7">
            <blockquote className="font-editorial max-w-3xl text-3xl leading-snug text-neutral-900 italic sm:text-4xl lg:text-[2.75rem]">
              &ldquo;I stopped opening five apps before getting dressed.
              StylAIze just knows.&rdquo;
            </blockquote>
            <p className="mt-6 text-[13px] uppercase tracking-[0.25em] text-neutral-500">
              Priya S. &middot; Mumbai
            </p>
          </Reveal>

          <Reveal delay={0.16} className="lg:col-span-5">
            <dl className="flex flex-wrap gap-x-12 gap-y-8 lg:justify-end">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-editorial text-4xl text-neutral-900">
                    {s.value}
                  </dd>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                    {s.label}
                  </p>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
