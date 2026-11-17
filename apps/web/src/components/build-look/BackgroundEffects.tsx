"use client";

interface BackgroundEffectsProps {
  activeStage: number;
}

const STAGE_GLOW_OPACITY: Record<number, number> = {
  0: 0.08,
  1: 0.12,
  2: 0.10,
  3: 0.14,
  4: 0.09,
};

export function BackgroundEffects({ activeStage }: BackgroundEffectsProps) {
  const glowOpacity = STAGE_GLOW_OPACITY[activeStage] ?? 0.1;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base depth layer */}
      <div className="absolute inset-0 bg-[#050816]" />

      {/* Radial purple glow */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: glowOpacity,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(139,92,246,0.6), transparent 70%)",
        }}
      />

      {/* Secondary cyan glow (shifted) */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: glowOpacity * 0.6,
          background:
            "radial-gradient(ellipse 40% 35% at 65% 55%, rgba(6,182,212,0.4), transparent 65%)",
        }}
      />

      {/* Faint grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)",
        }}
      />

      {/* Atmospheric glow orb 1 */}
      <div
        className="absolute -left-20 top-1/4 h-72 w-72 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float 18s ease-in-out infinite",
        }}
      />

      {/* Atmospheric glow orb 2 */}
      <div
        className="absolute -right-16 bottom-1/3 h-64 w-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "float-delayed 22s ease-in-out infinite",
        }}
      />

      {/* Atmospheric glow orb 3 */}
      <div
        className="absolute left-1/3 top-10 h-48 w-48 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(217,70,239,0.07) 0%, transparent 70%)",
          filter: "blur(45px)",
          animation: "blob-drift 20s ease-in-out infinite alternate",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Top vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,7,14,0.5) 0%, transparent 20%, transparent 80%, rgba(5,7,14,0.5) 100%)",
        }}
      />
    </div>
  );
}
