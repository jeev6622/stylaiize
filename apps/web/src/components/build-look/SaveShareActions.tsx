"use client";

import { Bookmark, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SaveShareActionsProps {
  isSaving: boolean;
  onSave: () => void;
}

export function SaveShareActions({ isSaving, onSave }: SaveShareActionsProps) {
  const handleShare = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "StylAIze outfit", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Outfit link copied.");
    } catch {
      toast.error("Could not share this outfit.");
    }
  };

  return (
    <section className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
      <Button className="gap-2" disabled={isSaving} onClick={onSave}>
        <Bookmark className="h-4 w-4" />
        {isSaving ? "Saving..." : "Save outfit"}
      </Button>
      <Button variant="secondary" className="gap-2" onClick={() => void handleShare()}>
        <Share2 className="h-4 w-4" />
        Share outfit
      </Button>
    </section>
  );
}
