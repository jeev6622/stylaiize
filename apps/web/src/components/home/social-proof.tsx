"use client";

import { Eyebrow, Reveal } from "./ui";

const PRINCIPLES = [
  "Style guidance tailored to your occasion and preferences",
  "Clear suggestions you can review, refine, and make your own",
  "Shopping tools that help you explore real options when available",
];

export function SocialProof() {
  return (
    <section className="relative bg-[#fbfbfd] px-5 py-20 sm:px-8 lg:px-16 lg:py-28">
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <Eyebrow index="06" label="Designed with care" />
        </Reveal>

        <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:items-start">
          <Reveal delay={0.08} className="lg:col-span-7">
            <h2 className="font-editorial max-w-3xl text-3xl leading-snug text-neutral-900 sm:text-4xl lg:text-[2.75rem]">
              Styling support that stays transparent and personal.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600">
              StylAIze helps you explore outfits, grooming ideas, and product options without
              inflated claims, so every recommendation is something you can evaluate with confidence.
            </p>
          </Reveal>

          <Reveal delay={0.16} className="lg:col-span-5">
            <ul className="space-y-4">
              {PRINCIPLES.map((item) => (
                <li
                  key={item}
                  className="border-l border-neutral-200 pl-4 text-sm leading-relaxed text-neutral-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
