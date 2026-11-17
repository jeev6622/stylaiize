import { CinematicNav } from "@/components/cinematic/cinematic-nav";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { AiStylist } from "@/components/home/ai-stylist";
import { BuildLook } from "@/components/home/build-look";
import { SmartSplit } from "@/components/home/smart-split";
import { SocialProof } from "@/components/home/social-proof";
import { FinalCta } from "@/components/home/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <CinematicNav />
      <CinematicHero />
      <main>
        <HowItWorks />
        <AiStylist />
        <BuildLook />
        <SmartSplit />
        <SocialProof />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
