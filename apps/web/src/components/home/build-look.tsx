"use client";

import { Eyebrow, EditorialLink, Reveal } from "./ui";

const INGREDIENTS = ["Occasion", "Style", "Budget", "Color"];

export function BuildLook() {
  return (
    <section
      id="build-your-look"
      className="cinema-bg relative px-5 py-24 sm:px-8 lg:px-16 lg:py-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-end gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow index="03" label="Build your look" />
            </Reveal>

            <Reveal delay={0.08}>
              <h2 className="font-editorial mt-8 text-4xl leading-[1.06] text-neutral-900 sm:text-5xl lg:text-[3.4rem]">
                Four choices.
                <span className="block italic text-amber-700">
                  One complete outfit.
                </span>
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="mt-7 max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg">
                Set the occasion, pick a style, name your budget, choose your
                palette, StylAIze assembles every piece into one complete look
                you can try, share or shop.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10">
                <EditorialLink href="/build-look">Build Your Look</EditorialLink>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="lg:col-span-7">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3 lg:justify-end">
              {INGREDIENTS.map((item, i) => (
                <span key={item} className="flex items-baseline gap-5">
                  <span className="font-editorial text-3xl text-neutral-400 sm:text-4xl lg:text-5xl">
                    {item}
                  </span>
                  {i < INGREDIENTS.length - 1 && (
                    <span aria-hidden className="text-2xl text-neutral-200">
                      &rarr;
                    </span>
                  )}
                </span>
              ))}
              <span aria-hidden className="text-2xl text-neutral-300">
                &rarr;
              </span>
              <span className="font-editorial text-4xl italic text-neutral-900 sm:text-5xl lg:text-6xl">
                Complete outfit
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
