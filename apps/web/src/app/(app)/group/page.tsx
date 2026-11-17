"use client";

import { useState } from "react";
import { Users, Loader2, Plus, Trash2, ShoppingBag, ExternalLink, Star } from "lucide-react";
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
import { API_ENDPOINTS, OCCASION_PRESETS, type GroupStyle, type OutfitItem } from "@stylaiize/shared";
import { formatCurrency, itemBuyLink } from "@/lib/utils";

interface MemberRow {
  key: number;
  name: string;
  colors: string;
}

let nextKey = 1;

export default function GroupPage() {
  const [members, setMembers] = useState<MemberRow[]>([
    { key: 0, name: "", colors: "" },
    { key: 1, name: "", colors: "" },
  ]);
  const [eventName, setEventName] = useState("Wedding");
  const [category, setCategory] = useState<string>("wedding");
  const [dressCode, setDressCode] = useState("");
  const [budget, setBudget] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GroupStyle | null>(null);

  function updateMember(key: number, patch: Partial<MemberRow>) {
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  function addMember() {
    if (members.length >= 10) return;
    setMembers((prev) => [...prev, { key: nextKey++, name: "", colors: "" }]);
  }

  function removeMember(key: number) {
    if (members.length <= 2) return;
    setMembers((prev) => prev.filter((m) => m.key !== key));
  }

  function colorsFromString(raw: string): string[] {
    return raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function generate() {
    const valid = members.map((m) => m.name.trim()).filter(Boolean);
    if (valid.length < 2) {
      toast.error("Enter names for at least two members.");
      return;
    }
    if (!eventName.trim()) {
      toast.error("Please describe the event.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ result: GroupStyle }>(API_ENDPOINTS.group + "/style", {
        members: members
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), preferredColors: colorsFromString(m.colors) })),
        event: {
          name: eventName.trim(),
          category,
          dressCode: dressCode.trim() || null,
        },
        budget: budget.trim() || undefined,
      });
      setResult(res.result);
    } catch {
      toast.error("Failed to generate the group look.");
    } finally {
      setIsLoading(false);
    }
  }

  function memberName(id: string): string {
    return result?.members.find((m) => m.id === id)?.name ?? "Member";
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2">
            <Users className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Group Styling</h1>
            <p className="text-sm text-muted-foreground">
              One shared palette, distinct looks, and a combined shopping list for your crew.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Form */}
        <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5">
          <div className="space-y-3">
            <Label>Members</Label>
            <div className="space-y-2">
              {members.map((m, index) => (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-muted-foreground">{index + 1}</span>
                  <Input
                    value={m.name}
                    onChange={(e) => updateMember(m.key, { name: e.target.value })}
                    placeholder="Member name"
                    className="flex-1"
                  />
                  <Input
                    value={m.colors}
                    onChange={(e) => updateMember(m.key, { colors: e.target.value })}
                    placeholder="Colors (optional)"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeMember(m.key)}
                    disabled={members.length <= 2}
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={addMember} disabled={members.length >= 10}>
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Event</Label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Family Wedding" />
            </div>
            <div className="space-y-1.5">
              <Label>Event type</Label>
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
            <div className="space-y-1.5">
              <Label>Dress code</Label>
              <Input value={dressCode} onChange={(e) => setDressCode(e.target.value)} placeholder="e.g. Ethnic formal" />
            </div>
            <div className="space-y-1.5">
              <Label>Combined budget</Label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. ₹15,000" />
            </div>
          </div>
        </div>

        <Button className="w-full gap-2" size="lg" onClick={() => void generate()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {isLoading ? "Styling the group..." : "Generate Group Looks"}
        </Button>

        {result && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{result.colorPalette.name}</h2>
                  <p className="text-xs text-muted-foreground">{result.theme}</p>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.outfits.map((entry) => (
                <div key={entry.memberId} className="rounded-2xl border border-border bg-card/40 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-bold">{memberName(entry.memberId)}</h3>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {entry.outfit.totalCost ? formatCurrency(entry.outfit.totalCost) : ""}
                    </span>
                  </div>
                  <p className="mb-2 text-sm font-medium text-foreground">{entry.outfit.name}</p>
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Score label="Fashion" value={entry.outfit.scores.fashion} />
                    <Score label="Event" value={entry.outfit.scores.eventMatch} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{entry.outfit.explanation}</p>
                </div>
              ))}
            </div>

            {result.shoppingList.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <h2 className="mb-3 text-sm font-semibold">Combined Shopping List</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.shoppingList.map((item, i) => (
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