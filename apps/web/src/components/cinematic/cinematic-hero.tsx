"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* AI hotspot pins — white/cream circles, amber ring, no purple        */
/* ------------------------------------------------------------------ */

interface Hotspot {
  id: string;
  category: string;
  item: string;
  material: string;
  price: string;
  x: number;
  y: number;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "face",
    category: "Face analysis",
    item: "Sculpted Finish",
    material: "Skin-tone matched",
    price: "AI · Free",
    x: 50,
    y: 15,
  },
  {
    id: "collar",
    category: "Collar · Shirt",
    item: "Italian Poplin",
    material: "Extra-fine cotton",
    price: "₹1,299",
    x: 58,
    y: 26,
  },
  {
    id: "chest",
    category: "Chest · Knit",
    item: "Slim Rib Layer",
    material: "Merino wool blend",
    price: "₹2,499",
    x: 45,
    y: 40,
  },
  {
    id: "sleeve",
    category: "Sleeve · Jacket",
    item: "Edits Blazer",
    material: "Textured wool",
    price: "₹3,499",
    x: 52,
    y: 58,
  },
  {
    id: "trousers",
    category: "Trousers",
    item: "Tailored Chino",
    material: "Cotton stretch twill",
    price: "₹1,799",
    x: 49,
    y: 78,
  },
];

function HotspotPin({
  spot,
  index,
  active,
  floatDelay,
  onHover,
  onLeave,
}: {
  spot: Hotspot;
  index: number;
  active: boolean;
  floatDelay: number;
  onHover: (s: Hotspot) => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="hero-pin-in absolute z-20"
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, animationDelay: `${1.2 + index * 0.15}s` }}
    >
      <div className="group -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          aria-label={`${spot.category} · ${spot.item}`}
          onPointerEnter={() => onHover(spot)}
          onPointerLeave={onLeave}
          onFocus={() => onHover(spot)}
          onBlur={onLeave}
          className="animate-float-delayed relative block"
          style={{ animationDelay: `${floatDelay}s` }}
        >
          {/* soft pool of light around the garment */}
          <span className="animate-breathe pointer-events-none absolute -left-6 -top-6 h-12 w-12 rounded-full bg-[radial-gradient(circle,rgba(232,120,50,0.3),transparent_65%)] blur-lg" />
          {/* warm halo blooms when active */}
          <span
            className={`pointer-events-none absolute -left-6 -top-6 h-12 w-12 rounded-full bg-[radial-gradient(circle,rgba(255,190,110,0.45),transparent_62%)] blur-md transition-all duration-500 ease-out ${
              active ? "scale-125 opacity-100" : "scale-75 opacity-0"
            }`}
          />
          {/* slowly expanding outer ring — scale 1 -> 1.4, opacity 0.35 -> 0 */}
          <span
            className={`hero-ring pointer-events-none absolute -inset-3 rounded-full border transition-colors duration-500 ${
              active ? "border-amber-300/70" : "border-amber-200/40"
            }`}
          />
          {active && (
            <span
              className="animate-light-sweep absolute -inset-x-5 top-1/2 mt-[-1.5px] h-[3px] rounded-full bg-gradient-to-r from-transparent via-amber-200/90 to-transparent"
              style={{ animationDuration: "3.4s" }}
            />
          )}
          <span
            className={`relative grid h-4 w-4 place-items-center rounded-full border bg-white/95 shadow-sm backdrop-blur-sm transition-all duration-500 ease-out ${
              active
                ? "scale-[1.2] border-amber-300"
                : "scale-100 border-amber-200/60 group-hover:scale-[1.15] group-hover:border-amber-300"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 transition-colors group-hover:bg-amber-600" />
          </span>
        </button>
      </div>
    </div>
  );
}

function HotspotCard({ spot, onClose }: { spot: Hotspot; onClose: () => void }) {
  if (!spot) return null;
  return (
    <motion.div
      key={spot.id}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.24, ease: EASE }}
      onPointerLeave={onClose}
      className="w-60 rounded-2xl border border-amber-200/25 bg-[#2b0e0a]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl"
    >
      <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-amber-200/90">
        {spot.category}
      </p>
      <p className="font-display mt-1.5 text-2xl leading-tight text-white">{spot.item}</p>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        <p className="flex items-center justify-between gap-4 text-[11px]">
          <span className="shrink-0 uppercase tracking-[0.18em] text-white/45">Material</span>
          <span className="text-right text-white/85">{spot.material}</span>
        </p>
        <p className="flex items-center justify-between gap-4 text-[11px]">
          <span className="shrink-0 uppercase tracking-[0.18em] text-white/45">Price</span>
          <span className="text-right font-medium text-amber-100">{spot.price}</span>
        </p>
      </div>
      <Link
        href="/build-look"
        className="group/inline mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90 transition-colors hover:text-amber-100"
      >
        View item
        <span className="inline-block transition-transform group-hover/inline:translate-x-1">→</span>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Warm cinematic fashion-editorial hero                               */
/* Existing 2D photo -> layered depth + parallax + light + float.      */
/* All mount entrances are pure CSS keyframes: identical server/client.*/
/* Browser checks (reduced motion, touch) run only after mount, so the */
/* first render is deterministic and honours the hydration contract.   */
/* ------------------------------------------------------------------ */

const EMBERS = [
  { left: 58, top: 24, dur: "11s", dly: "0s" },
  { left: 70, top: 40, dur: "9s", dly: "1.6s" },
  { left: 66, top: 58, dur: "13s", dly: "0.8s" },
  { left: 82, top: 68, dur: "10s", dly: "2.4s" },
  { left: 74, top: 78, dur: "12s", dly: "0.3s" },
  { left: 63, top: 72, dur: "9s", dly: "2.9s" },
  { left: 85, top: 48, dur: "14s", dly: "1.1s" },
];

const DOTS = [
  { left: 56, top: 18, dur: "5.5s", dly: "0.2s" },
  { left: 66, top: 32, dur: "6.5s", dly: "1.1s" },
  { left: 74, top: 22, dur: "7s", dly: "0.6s" },
  { left: 81, top: 44, dur: "5s", dly: "1.8s" },
  { left: 62, top: 68, dur: "6s", dly: "0.9s" },
  { left: 78, top: 74, dur: "7.5s", dly: "2.3s" },
  { left: 54, top: 48, dur: "6.2s", dly: "1.4s" },
];

export function CinematicHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [modelHovered, setModelHovered] = useState(false);
  const { status } = useAuth();
  const startHref = status === "authenticated" ? "/build-look" : "/register";

  /* --- Browser-only capability flags. Defaults keep SSR === first     --- */
  /* --- client render identical; the real values are read post-mount.  --- */
  const [reducedMotion, setReducedMotion] = useState(false);
  const [finePointer, setFinePointer] = useState(true);

  /* Capability + amplitude flags read ONLY after mount so SSR and the
     first client paint stay identical. Touch / narrow viewports disable
     or clamp the parallax; reduced motion keeps the hero fully static. */
  useEffect(() => {
    setReducedMotion(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const coarse = window.matchMedia("(pointer: coarse)");
    const compute = () => {
      const w = window.innerWidth;
      const blocked = coarse.matches || w < 768;
      setFinePointer(!blocked);
      parallaxFactor.current = blocked ? 0 : w < 1024 ? 0.5 : 1;
    };
    compute();
    window.addEventListener("resize", compute, { passive: true });
    return () => window.removeEventListener("resize", compute);
  }, []);

  /* --- ONE rAF loop drives every layer via lerp (cleanup on unmount)  --- */
  const pointer = useRef({ x: 0, y: 0 });
  const smooth = useRef({ x: 0, y: 0 });
  const parallaxFactor = useRef(1);
  const bgRig = useRef<HTMLDivElement>(null);
  const glowRig = useRef<HTMLDivElement>(null);
  const lightRig = useRef<HTMLDivElement>(null);
  const shadowRig = useRef<HTMLDivElement>(null);
  const modelRig = useRef<HTMLDivElement>(null);
  const highlightRig = useRef<HTMLDivElement>(null);
  const fgRig = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const modelScale = useTransform(scrollYProgress, [0, 0.6], [1, 1.05]);
  const modelY = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.55]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.5], [0, -40]);

  /* Content follows the cursor a beat (very slight counter-move). */
  const mx = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const contentX = useTransform(springX, (v) => v * -6);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!finePointer) return;
      const rect = sectionRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointer.current.x = (e.clientX - rect.left) / rect.width - 0.5;
      pointer.current.y = (e.clientY - rect.top) / rect.height - 0.5;
      mx.set(pointer.current.x);
    },
    [mx, finePointer],
  );

  const releasePointer = useCallback(() => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  }, []);

  useEffect(() => {
    if (reducedMotion || !finePointer) return;
    let raf = 0;
    const loop = (ts: number) => {
      const t = ts / 1000;
      const p = pointer.current;
      const s = smooth.current;
      /* Buttery lerp — low factor so motion drifts, never snaps. */
      const k = 0.07;
      s.x += (p.x - s.x) * k;
      s.y += (p.y - s.y) * k;
      const f = parallaxFactor.current;
      /* translate scaled by viewport factor; tilt uses raw smoothed cursor
         (-0.5..0.5) mapped to fixed degrees for a consistent camera feel. */
      const px = s.x * f;
      const py = s.y * f;
      const ry = s.x * 12; /* cursor right -> model right side revealed: -6..6 deg */
      const rx = s.y * 8; /* cursor down -> tips top away: -4..4 deg */
      const bx = Math.sin(t * 0.24) * f;
      const by = Math.cos(t * 0.16) * f;
      const b2 = Math.sin(t * 0.17 + 1.7) * f;
      /* depth layers: background barely moves, model + highlight tilt hardest */
      if (bgRig.current) {
        bgRig.current.style.transform = `translate3d(${-px * 6 + bx * 0.8}px, ${-py * 4 + by * 0.6}px, 0)`;
      }
      if (glowRig.current) {
        glowRig.current.style.transform = `translate3d(${px * 8 + b2 * 0.8}px, ${py * 6}px, 0)`;
      }
      /* cinematic light layer drifts more but barely tilts (subtle depth) */
      if (lightRig.current) {
        lightRig.current.style.transform = `translate3d(${px * 34}px, ${py * 22}px, 0) rotateX(${rx * 0.35}deg) rotateY(${ry * 0.35}deg)`;
      }
      if (shadowRig.current) {
        shadowRig.current.style.transform = `translate3d(${px * -9}px, ${py * 5}px, 0)`;
      }
      /* THE model: ~16-18px translate + full 3D tilt (cinematic turntable) */
      if (modelRig.current) {
        modelRig.current.style.transform = `translate3d(${px * 36}px, ${py * 32}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
      /* foreground highlight moves the most, tilt slightly MORE than model */
      if (highlightRig.current) {
        highlightRig.current.style.transform = `translate3d(${px * 44}px, ${py * 34}px, 0) rotateX(${rx * 1.15}deg) rotateY(${ry * 1.15}deg)`;
      }
      if (fgRig.current) {
        fgRig.current.style.transform = `translate3d(${px * 18 + b2 * 1.2}px, ${py * 10}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, finePointer]);

  const onHover = useCallback((s: Hotspot) => setActiveHotspot(s), []);
  const onLeave = useCallback(() => setActiveHotspot(null), []);

  const textIn = (d: string) => ({ animationDelay: d }) as React.CSSProperties;

  return (
    <section
      id="build-look"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={releasePointer}
      className="film-grain relative min-h-[100svh] overflow-hidden bg-[#230706]"
    >
      {/* ===== LAYER 1 · backdrop — slowest, opposite the cursor ===== */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ scale: bgScale }}>
        <div ref={bgRig} className="will-change-transform absolute inset-0">
          {/* deep burgundy / dark wine on the left, warm burnt orange centre-right */}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,#350a08_0%,#2a0806_38%,#1d0504_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#3d0e0b_0%,rgba(122,24,15,0.55)_38%,rgba(196,66,28,0.28)_62%,rgba(86,20,9,0.75)_100%)]" />
          {/* extremely subtle moving warm light gradient (16s) */}
          <div className="animate-bg-sway absolute left-1/2 top-[16%] h-[70%] w-[58%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(196,66,28,0.3),rgba(230,120,45,0.09)_48%,transparent_70%)] blur-3xl" />
          {/* fine cinematic vignette — edge falloff only */}
          <div className="letterbox-top absolute inset-x-0 top-0 h-40" />
          <div className="letterbox-bottom absolute inset-x-0 bottom-0 h-44" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.4)_100%)]" />
          <div className="absolute bottom-0 left-1/2 h-24 w-[46%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(255,150,70,0.13),transparent_70%)] blur-2xl" />
        </div>
      </motion.div>

      {/* ===== LAYER 2 · atmosphere — subtle glow + haze + fine embers ===== */}
      <motion.div
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute inset-0 z-[5]"
      >
        <div ref={glowRig} className="will-change-transform absolute inset-0">
          {/* warm burnt-orange radial lighting toward centre/right */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,rgba(196,72,30,0.4),transparent_56%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(222,126,54,0.2),transparent_46%),radial-gradient(circle_at_28%_32%,rgba(122,24,15,0.34),transparent_58%)]" />
          <div className="animate-haze absolute right-[18%] top-[12%] h-[38%] w-[42%] bg-[radial-gradient(ellipse,rgba(255,150,70,0.08),transparent_70%)] blur-2xl" />
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="animate-ember absolute h-[3px] w-[3px] rounded-full bg-amber-200/60 blur-[1px]"
              style={{
                left: `${e.left}%`,
                top: `${e.top}%`,
                animationDuration: e.dur,
                animationDelay: e.dly,
              }}
            />
          ))}
          {DOTS.map((d, i) => (
            <span
              key={`dot-${i}`}
              className="animate-dot absolute h-[3px] w-[3px] rounded-full bg-white/70 blur-[0.5px]"
              style={{
                left: `${d.left}%`,
                top: `${d.top}%`,
                ["--dot-dur" as string]: d.dur,
                animationDelay: d.dly,
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* ===== CINEMATIC LIGHT — soft radial following the cursor ===== */}
      <div
        ref={lightRig}
        className="pointer-events-none absolute inset-0 z-[7] will-change-transform"
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle 320px at 46% 40%, rgba(255,214,140,0.14), rgba(255,150,70,0.05) 45%, transparent 72%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* ===== Content grid: editorial copy left, model right ===== */}
      <motion.div
        style={{ opacity: contentOpacity, y: contentY, x: contentX }}
        className="relative z-10 mx-auto grid min-h-[100svh] max-w-[1440px] grid-cols-1 items-center gap-0 px-5 pb-14 pt-28 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:px-10 xl:px-14"
      >
        {/* --- Copy (left ~50%) --- */}
        <div className="relative z-20 order-1 min-w-0 lg:pr-8">
          <div style={textIn("0.15s")} className="hero-text-in mb-7 flex items-center gap-4">
            <span className="h-px w-14 bg-amber-300/60" />
            <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/70">
              StylAIze AI Personal Stylist
            </span>
          </div>

          <h1 className="font-display uppercase leading-[1.02] tracking-[0.01em] text-white">
            {[
              { t: "See it.", d: "0.3s", gold: false },
              { t: "Style it.", d: "0.38s", gold: false },
              { t: "Buy it for", d: "0.46s", gold: true },
              { t: "Less.", d: "0.54s", gold: true },
            ].map((line) => (
              <span
                key={line.t}
                style={textIn(line.d)}
                className="hero-text-in block text-[13vw] font-light tracking-tight sm:text-6xl lg:text-[clamp(2.9rem,5.5vw,4.9rem)]"
              >
                {line.gold ? (
                  <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                    {line.t}
                  </span>
                ) : (
                  line.t
                )}
              </span>
            ))}
          </h1>

          <p style={textIn("0.5s")} className="hero-text-in mt-7 max-w-md text-lg leading-relaxed text-white/75">
            Your AI personal stylist for every occasion. Discover your style,
            visualize the look, and shop smarter.
          </p>

          <div style={textIn("0.7s")} className="hero-text-in mt-9 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="group bg-gradient-to-r from-amber-500 to-orange-600 px-8 text-sm uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(217,119,66,0.35)] transition-all duration-300 hover:brightness-110"
            >
              <Link href={startHref}>
                Start styling
                <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/5 px-8 text-sm uppercase tracking-[0.18em] text-white backdrop-blur-sm hover:border-white/40 hover:bg-white/15 hover:text-white"
            >
              <Link href="#how-it-works">Explore styles</Link>
            </Button>
          </div>

          {/* Trust / stat strip */}
          <div style={textIn("1.2s")} className="hero-fade-in mt-12 flex flex-wrap items-center gap-8 text-white/55">
            <div>
              <p className="font-display text-2xl font-medium text-white">5</p>
              <p className="text-[10px] uppercase tracking-[0.2em]">Complete outfits</p>
            </div>
            <div className="h-9 w-px bg-white/20" />
            <div>
              <p className="font-display text-2xl font-medium text-white">AI</p>
              <p className="text-[10px] uppercase tracking-[0.2em]">Curated for you</p>
            </div>
            <div className="h-9 w-px bg-white/20" />
            <div>
              <p className="font-display text-2xl font-medium text-white">₹</p>
              <p className="text-[10px] uppercase tracking-[0.2em]">Smartest price</p>
            </div>
          </div>
        </div>

        {/* --- Model (right) — THE HERO, 2D photo made to feel 3D --- */}
        <motion.div
          style={{ scale: modelScale, y: modelY }}
          className="relative order-2 flex w-full items-end justify-center lg:h-[100svh] lg:justify-end"
        >
          <div className="relative flex h-full w-full items-end justify-center sm:max-w-[34rem] lg:h-full lg:max-w-none lg:self-end lg:justify-end">
            {/* camera push on load — SSR-safe: initial identical on server & client */}
            <motion.div
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reducedMotion ? 0 : 1.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full w-full items-end justify-center"
              style={{ perspective: 1200, transformStyle: "preserve-3d" }}
            >
              {/* LAYER 5 · ground shadow — slides opposite the cursor, stays grounded */}
              <div
                ref={shadowRig}
                className="pointer-events-none absolute bottom-2 left-1/2 z-[2] h-14 w-[38%] -translate-x-1/2 rounded-[100%] bg-black/40 blur-2xl will-change-transform"
              />

              {/* LAYER 3 · MAIN MODEL — complete, intact, photoreal */}
              <div
                ref={modelRig}
                style={{ transformStyle: "preserve-3d", transformOrigin: "50% 70%" }}
                className="will-change-transform relative flex h-full w-full items-end justify-center"
              >
                  {/* whisper-float layer: model + hotspots share one slow 8s float */}
                  <motion.div
                    animate={reducedMotion ? {} : { y: [0, -6, 0], rotate: [-0.25, 0.25, -0.25] }}
                    transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
                    className="relative flex h-full w-full items-end justify-center"
                    style={{ transformOrigin: "50% 88%" }}
                  >
                  {/* 7 · HIGHLIGHT duplicate — 0.075x, light passing over the subject */}
                  <div
                    ref={highlightRig}
                    className="pointer-events-none absolute inset-0 z-[13] will-change-transform"
                  >
                    <div className="animate-breathe h-full w-full">
                      <Image
                        src="/model-hero-cutout.webp"
                        alt=""
                        aria-hidden
                        width={1200}
                        height={1800}
                        sizes="(max-width: 639px) 92vw, (max-width: 1023px) 47vh, 34vw"
                        quality={90}
                        className="mx-auto block h-[62vh] w-auto max-w-[92vw] object-contain object-bottom [mask-image:linear-gradient(180deg,black_82%,rgba(0,0,0,0.35)_90%,transparent_100%)] sm:h-[70vh] lg:h-[94svh] lg:max-w-[34vw]"
                        style={{ opacity: 0.11, mixBlendMode: "screen", filter: "brightness(1.3)" }}
                      />
                    </div>
                  </div>

                  {/* hover warmth + gentle scale + pointer state */}
                  <div
                    onPointerEnter={() => setModelHovered(true)}
                    onPointerLeave={() => setModelHovered(false)}
                    className="group/hero relative cursor-pointer transition-transform duration-700 ease-out will-change-transform hover:scale-[1.02]"
                  >
                    <Image
                      src="/model-hero-cutout.webp"
                      alt="StylAIze fashion model in a complete stylish outfit"
                      width={1200}
                      height={1800}
                      sizes="(max-width: 639px) 92vw, (max-width: 1023px) 47vh, 34vw"
                      quality={90}
                      priority
                      className="hero-soft-edge block h-[62vh] w-auto max-w-[92vw] object-contain object-bottom sm:h-[70vh] lg:h-[94svh] lg:max-w-[34vw]"
                      style={{
                        filter:
                          "saturate(1.08) contrast(1.05) drop-shadow(0 24px 50px rgba(0,0,0,0.4))",
                      }}
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,190,120,0.14),transparent_65%)] mix-blend-screen blur-xl transition-opacity duration-700 ${
                        modelHovered ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>

                  {/* soft floor reflection — flipped, faded, blended into the ground */}
                  <Image
                    src="/model-hero-cutout.webp"
                    alt=""
                    aria-hidden
                    width={1200}
                    height={1800}
                    sizes="(max-width: 639px) 92vw, (max-width: 1023px) 47vh, 34vw"
                    quality={90}
                    loading="lazy"
                    className="pointer-events-none absolute left-0 top-full block h-[62vh] w-auto max-w-[92vw] -scale-y-100 select-none [mask-image:linear-gradient(180deg,black_8%,transparent_60%)] sm:h-[70vh] lg:h-[94svh] lg:max-w-[34vw]"
                    style={{
                      mixBlendMode: "screen",
                      opacity: 0.12,
                      filter: "saturate(1.1) contrast(1.05) brightness(0.75) blur(2px)",
                    }}
                  />

                  {/* 8 · HOTSPOTS — attached to the model, float and parallax with it */}
                  <div
                    className={`absolute inset-0 z-20 transition-opacity duration-500 ${
                      modelHovered ? "opacity-100" : "opacity-80"
                    }`}
                  >
                    {HOTSPOTS.map((spot, i) => (
                      <HotspotPin
                        key={spot.id}
                        spot={spot}
                        index={i}
                        active={activeHotspot?.id === spot.id}
                        floatDelay={i * 1.4}
                        onHover={onHover}
                        onLeave={onLeave}
                      />
                    ))}
                  </div>

                  {/* label chip */}
                  <div style={textIn("1.35s")} className="hero-fade-in absolute left-2 top-6 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-1.5 backdrop-blur-md sm:left-4">
                    <span className="h-2 w-2 rounded-full bg-amber-300" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/85">
                      AI styling · hover the look
                    </span>
                  </div>
                  </motion.div>
                </div>

              {/* Floating hotspot detail card (desktop) */}
              <div className="pointer-events-none absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 lg:block xl:right-12">
                {activeHotspot && <HotspotCard spot={activeHotspot} onClose={onLeave} />}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* ===== FOREGROUND — nearest, fastest; very slow light sweep ===== */}
      <div ref={fgRig} className="pointer-events-none absolute inset-0 z-20 will-change-transform">
        <div className="animate-light-sweep absolute -top-1/4 left-1/4 h-[140%] w-[42%] rotate-[18deg] bg-gradient-to-r from-transparent via-amber-200/10 to-transparent blur-3xl" />
      </div>

      {/* Mobile scroll cue */}
      <div style={textIn("1.6s")} className="hero-fade-in absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 lg:hidden">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Scroll</span>
        <span className="flex h-8 w-4 items-start justify-center rounded-full border border-white/40 pt-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300/90" />
        </span>
      </div>
    </section>
  );
}