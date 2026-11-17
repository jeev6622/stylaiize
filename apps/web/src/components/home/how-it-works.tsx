"use client";

import { Fragment } from "react";
import { Eyebrow, Reveal } from "./ui";

const STEPS = [
  {
    index: "01",
    title: "Tell us the occasion",
    description:
      "Type where you\u2019re going \u2014 or drop an invitation. StylAIze reads the date, venue, dress code and weather.",
  },
  {
    index: "02",
    title: "AI creates your look",
    description:
      "Your stylist composes complete outfits around you \u2014 fit, palette, budget \u2014 and explains every choice.",
  },
  {
    index: "03",
    title: "Try, compare & shop",
    description:
      "Try the looks on virtually, compare prices across stores, and take the whole outfit for less.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="cinema-bg relative px-5 py-24 sm:px-8 lg:px-16 lg:py-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <Reveal>
          <Eyebrow index="01" label="How it works" />
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="font-editorial mt-8 max-w-4xl text-4xl leading-[1.05] text-neutral-900 sm:text-5xl lg:text-6xl">
            From occasion to{" "}
            <span className="italic text-amber-700">outfit</span>.
          </h2>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-500 sm:text-lg">
            No forms, no styling jargon. Just tell StylAIze where you&apos;re
            going.
          </p>
        </Reveal>

        <div className="mt-16 flex flex-col gap-12 md:mt-20 md:flex-row md:items-start md:gap-8">
          {STEPS.map((step, i) => (
            <Fragment key={step.index}>
              <Reveal delay={i * 0.1} className="md:flex-1">
                <div>
                  <p className="font-editorial text-sm tracking-[0.35em] text-amber-700">
                    {step.index}
                  </p>
                  <h3 className="font-editorial mt-4 text-2xl leading-snug text-neutral-900 sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-neutral-500">
                    {step.description}
                  </p>
                </div>
              </Reveal>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="hidden shrink-0 pt-16 text-xl text-neutral-300 md:block"
                >
                  &rarr;
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
