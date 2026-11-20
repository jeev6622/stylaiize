"use client";

import { useCallback, useEffect, useState } from "react";
import { Leaf, Coins, RefreshCw, Recycle, Layers, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { API_ENDPOINTS, type SustainabilityReport } from "@stylaiize/shared";

export default function SustainabilityPage() {
  const [report, setReport] = useState<SustainabilityReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ report: SustainabilityReport }>(API_ENDPOINTS.sustainability);
      setReport(res.report);
    } catch {
      toast.error("Failed to load your sustainability report.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 p-2">
              <Leaf className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Sustainability Insights</h1>
              <p className="text-sm text-muted-foreground">
                How your wardrobe is helping you save money and the planet.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Figures are computed from your actual wardrobe and saved outfits. Cost per wear is derived
          from purchase price and times worn, and items reused come from outfits you have saved.
        </p>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {isLoading || !report ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Leaf className="h-4 w-4 text-green-500" />
                  Eco Score
                </CardTitle>
                <CardDescription>Composite score from measured wardrobe habits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">{report.ecoScore}</span>
                  <span className="text-muted-foreground">/ 100</span>
                </div>
                <Progress value={report.ecoScore} className="mt-3" />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                icon={<Coins className="h-4 w-4 text-emerald-500" />}
                label="Money Saved by Reusing"
                value={`₹${report.moneySaved.toLocaleString("en-IN")}`}
                hint="Value of owned items worn more than once"
              />
              <MetricCard
                icon={<Recycle className="h-4 w-4 text-teal-500" />}
                label="Items Reused"
                value={String(report.itemsReused)}
                hint="Worn items + items reused inside saved outfits"
              />
              <MetricCard
                icon={<Layers className="h-4 w-4 text-sky-500" />}
                label="Mix & Match Outfits"
                value={String(report.mixAndMatchOutfits)}
                hint="Possible combinations from your categories"
              />
              <MetricCard
                icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
                label="Average Cost Per Wear"
                value={`₹${report.costPerWearAverage}`}
                hint="Purchase price divided by times worn"
              />
              <MetricCard
                icon={<Leaf className="h-4 w-4 text-green-500" />}
                label="Est. Carbon Saved"
                value={`${report.carbonSavedKg} kg`}
                hint="Rough estimate: ~6.4 kg CO₂-eq per reused garment"
              />
            </div>

            <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to improve your score</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Add brands and prices to your wardrobe items so cost-per-wear is accurate.</li>
                <li>Wear owned pieces more before buying new, since reusing raises your reuse score.</li>
                <li>Save outfits you love; each saved outfit increases your mix-and-match count.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <p className="mt-3 text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}