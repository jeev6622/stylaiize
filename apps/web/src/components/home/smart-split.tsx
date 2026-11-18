"use client";

import Image from "next/image";
import { EditorialLink, Eyebrow, Reveal } from "./ui";

const PRODUCTS = [
  { src: "/product-blazer.jpg", alt: "Blazer" },
  { src: "/product-shirt.jpg", alt: "Shirt" },
  { src: "/product-trousers.jpg", alt: "Trousers" },
  { src: "/product-shoes.jpg", alt: "Shoes" },
];

export function SmartSplit() {
  return (
    <section id="smart-shopping" className="relative grid md:grid-cols-2">
      <div className="relative min-h-[520px] overflow-hidden bg-[#f2efe9] px-5 py-16 sm:px-10 lg:px-14 lg:py-24">
        <Reveal>
          <Eyebrow index="04" label="Smart shopping" />
          <h2 className="font-editorial mt-7 max-w-md text-4xl leading-[1.06] text-neutral-900 sm:text-5xl">
            Same look.
            <span className="block italic text-amber-700">Lowest price.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-600">
            Every piece is compared across stores — price, rating and delivery
            — so the complete outfit lands at the best total, not just the
            first listing you see.
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-10 grid max-w-md grid-cols-4 gap-3">
            {PRODUCTS.map((p) => (
              <Image
                key={p.src}
                src={p.src}
                alt={p.alt}
                width={500}
                height={600}
                sizes="(max-width: 767px) 22vw, 100px"
                loading="lazy"
                className="aspect-[5/6] w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10">
            <EditorialLink href="/products">Shop Smarter</EditorialLink>
          </div>
        </Reveal>
      </div>

      <div className="relative min-h-[520px] overflow-hidden bg-[#230706]">
        <Image
          src="/fashion-model-01.jpg"
          alt="StylAIze virtual try-on on a fashion model"
          fill
          sizes="(max-width: 767px) 100vw, 50vw"
          quality={90}
          loading="lazy"
          className="object-cover object-[50%_20%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#230706] via-[#230706]/75 to-[#230706]/20" />

        <div className="relative flex h-full flex-col justify-end px-5 py-16 sm:px-10 lg:px-14 lg:py-24">
          <Reveal>
            <Eyebrow index="05" label="Virtual try-on" tone="light" />
            <h2 className="font-editorial mt-7 max-w-md text-4xl leading-[1.06] text-white sm:text-5xl">
              See it on you
              <span className="block italic text-amber-200">before you buy.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
              Drop in one photo and the full outfit is rendered on you — face,
              fit and fabric preserved. Compare, keep, or download the result.
            </p>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="mt-10">
              <EditorialLink href="/try-on" tone="light">
                Try It On
              </EditorialLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
