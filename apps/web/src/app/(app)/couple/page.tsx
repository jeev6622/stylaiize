"use client";

import { useState } from "react";
import { Heart, Loader2, ShoppingBag, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { API_ENDPOINTS, OCCASION_PRESETS, type CoupleStyle, type OutfitItem } from "@stylaiize/shared";
import { cn, formatCurrency, itemBuyLink } from "@/lib/utils";

export default function CouplePage() {
  const [memberAName, setMemberAName] = useState("");
  const [memberAColors, setMemberAColors] = useState("");
  const [memberBName, setMemberBName] = useState("");
  const [memberBColors, setMemberBColors] = useState("");
  const [eventName, setEventName] = useState("Wedding");
  const [category, setCategory] = useState<string>("wedding");
  const [dressCode, setDressCode] = useState("");
  const [budget, setBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CoupleStyle | null>(null);

  function colorsFromString(raw: string): string[] {
    return raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function generate() {
    if (!memberAName.trim() || !memberBName.trim()) {
      toast.error("Please enter a name for both members.");
      return;
    }
    if (!eventName.trim()) {
      toast.error("Please describe the event.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ result: CoupleStyle }>(API_ENDPOINTS.couple + "/style", {
        memberA: { name: memberAName.trim(), preferredColors: colorsFromString(memberAColors) },
        memberB: { name: memberBName.trim(), preferredColors: colorsFromString(memberBColors) },
        event: {
          name: eventName.trim(),
          category,
          dressCode: dressCode.trim() || null,
        },
        budget: budget.trim() || undefined,
      });
      setResult(res.result);
    } catch {
      toast.error("Failed to generate the couple look.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/10 p-2">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Couple Mode</h1>
            <p className="text-sm text-muted-foreground">
              Generate coordinated looks for you and your partner.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Form */}
        <div className="grid gap-4 rounded-2xl border border-border bg-card/40 p-5 md:grid-cols-2">
          <div className="space-y-3">
            <Label>Partner 1 name</Label>
            <Input value={memberAName} onChange={(e) => setMemberAName(e.target.value)} placeholder="e.g. Aarav" />
            <Label className="pt-1">Preferred colors (comma separated)</Label>
            <Input value={memberAColors} onChange={(e) => setMemberAColors(e.target.value)} placeholder="Navy, White" />
          </div>
          <div className="space-y-3">
            <Label>Partner 2 name</Label>
            <Input value={memberBName} onChange={(e) => setMemberBName(e.target.value)} placeholder="e.g. Meera" />
            <Label className="pt-1">Preferred colors (comma separated)</Label>
            <Input value={memberBColors} onChange={(e) => setMemberBColors(e.target.value)} placeholder="Maroon, Beige" />
          </div>
          <div className="space-y-3">
            <Label>Event</Label>
            <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Evening Wedding" />
            <Label className="pt-1">Event type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {OCCASION_PRESETS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Dress code</Label>
            <Input value={dressCode} onChange={(e) => setDressCode(e.target.value)} placeholder="e.g. Formal" />
            <Label className="pt-1">Combined budget</Label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. ₹10,000" />
          </div>
        </div>

        <Button className="w-full gap-2" size="lg" onClick={() => void generate()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
          {isLoading ? "Styling..." : "Generate Coordinated Looks"}
        </Button>

        {result && (
          <div className="space-y-6">
            {/* Palette */}
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{result.colorPalette.name}</h2>
                  <p className="text-xs text-muted-foreground">Shared palette</p>
                </div>
                <div className="flex gap-2">
                  {result.colorPalette.colors.map((c, i) => (
                    <button
                      key={i}
                      className="h-8 w-8 rounded-full border border-border"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Matching outfits */}
            <div className="grid gap-4 md:grid-cols-2">
              {result.matchingOutfits.map((entry) => {
                const profile = entry.person === "A" ? result.memberA : result.memberB;
                const isA = entry.person === "A";
                return (
                  <div
                    key={entry.person}
                    className={cn(
                      "rounded-2xl border bg-card/40 p-5",
                      isA ? "border-sky-500/30" : "border-rose-500/30",
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Partner {entry.person} · {profile.name}
                        </p>
                        <h3 className="text-base font-bold">{entry.outfit.name}</h3>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {entry.outfit.totalCost ? formatCurrency(entry.outfit.totalCost) : ""}
                      </span>
                    </div>
                    <ul className="mb-3 space-y-1.5">
                      {entry.outfit.items.map((item, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">
                            {item.name}
                            {item.brand ? <span className="text-muted-foreground"> · {item.brand}</span> : null}
                          </span>
                          {item.price ? (
                            <span className="text-muted-foreground">{formatCurrency(item.price)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <Score label="Fashion" value={entry.outfit.scores.fashion} />
                      <Score label="Event" value={entry.outfit.scores.eventMatch} />
                      <Score label="Comfort" value={entry.outfit.scores.comfort} />
                      <Score label="Budget" value={entry.outfit.scores.budget} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{entry.outfit.explanation}</p>
                  </div>
                );
              })}
            </div>

            {/* Shopping list */}
            {result.sharedShoppingList.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <h2 className="mb-3 text-sm font-semibold">Shared Shopping List</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.sharedShoppingList.map((item, i) => (
                    <ShopRow key={i} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-secondary/50 px-2 py-1">
      <Star className="h-3 w-3 text-amber-400" />
      {label} {value}
    </span>
  );
}

function ShopRow({ item }: { item: OutfitItem }) {
  const url = itemBuyLink(item);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.brand ?? "Brand not specified"}
          {item.price ? ` · ${formatCurrency(item.price)}` : ""}
        </p>
      </div>
      {url ? (
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ShoppingBag className="h-3.5 w-3.5" />
            Shop
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">No shop link</span>
      )}
    </div>
  );
}