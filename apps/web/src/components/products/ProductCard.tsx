"use client";

import Image from "next/image";
import { ExternalLink, ImageOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@stylaiize/shared";

interface ProductCardProps {
  product: Product;
  demoMode?: boolean;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || value === "#") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function ProductCard({ product, demoMode = false }: ProductCardProps) {
  const imageUrl = safeHttpUrl(product.imageUrl);
  const buyUrl = safeHttpUrl(product.buyUrl);
  const priceVerified =
    !demoMode &&
    product.currency === "INR" &&
    Boolean(product.priceVerifiedAt) &&
    product.price > 0;
  const providerLabel = product.sourceLabel?.trim() || product.store;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="relative mb-3 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-950/60">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-[11px] text-slate-500">
            <ImageOff className="h-6 w-6" />
            Image not provided by provider
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
        {product.title}
      </h3>

      <p className="mt-1 truncate text-[11px] uppercase tracking-wider text-slate-400">
        {providerLabel}
      </p>

      <p className="mt-2 text-base font-semibold text-cyan-100">
        {priceVerified
          ? formatCurrency(product.price, product.currency)
          : product.currency === "INR"
            ? "Price not verified"
            : "Price unavailable in INR"}
      </p>

      <div className="mt-auto pt-4">
        {buyUrl ? (
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/20"
          >
            View Product
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="block rounded-xl border border-white/5 px-3 py-2 text-center text-xs text-slate-500">
            No purchase link provided
          </span>
        )}
      </div>
    </article>
  );
}
