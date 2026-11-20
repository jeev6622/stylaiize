"use client";

import Image from "next/image";
import { Eyebrow, EditorialLink, Reveal } from "./ui";

export function AiStylist() {
  return (
    <section
      id="ai-stylist"
      className="relative bg-[#fbfbfd] px-5 py-24 sm:px-8 lg:px-16 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5">
          <Reveal>
            <Eyebrow index="02" label="AI personal stylist" />
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="font-editorial mt-8 text-4xl leading-[1.06] text-neutral-900 sm:text-5xl lg:text-[3.4rem]">
              Tell StylAIze where you&apos;re going.
              <span className="block italic text-amber-700">
                We&apos;ll help decide what to wear.
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg">
              Ask for a rooftop dinner, a first interview, or something that
              survives a long flight, and get complete looks with the
              reasoning behind every piece, in plain language.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-10">
              <EditorialLink href="/chat">Try AI Stylist</EditorialLink>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.12} className="lg:col-span-7">
          <figure className="relative overflow-hidden rounded-[1.75rem] shadow-[0_40px_90px_-40px_rgba(35,7,6,0.45)]">
            <Image
              src="/model-hero.jpg"
              alt="StylAIze stylist recommendation shown on a fashion editorial portrait"
              width={1200}
              height={1800}
              sizes="(max-width: 1023px) 100vw, 58vw"
              quality={90}
              loading="lazy"
              className="h-[58vh] w-full object-cover object-[50%_18%] sm:h-[64vh] lg:h-[72vh]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#230706]/70 via-transparent to-transparent" />

            <figcaption className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              <div className="max-w-md rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-neutral-500">
                    StylAIze stylist
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-[13px] leading-relaxed text-white">
                    Rooftop dinner tonight, smart but not stiff.
                  </p>
                  <p className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-neutral-100 px-4 py-2.5 text-[13px] leading-relaxed text-neutral-800">
                    Navy blazer, open collar, white leather sneakers. Three
                    looks, all under ₹6,000.
                  </p>
                </div>
              </div>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
