import { z } from "zod";
import { ShoppingUnavailableError } from "./errors";

const FX_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const fxSchema = z.object({
  date: z.string().trim().min(1),
  rates: z.object({
    INR: z.coerce.number().finite().positive(),
  }),
});

export type Rate = {
  base: string;
  quote: string;
  rate: number;
  date: string;
};

let cached: { value: Rate; expiresAt: number } | null = null;
let inFlight: Promise<Rate> | null = null;

async function loadRate(): Promise<Rate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(FX_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FX API returned ${response.status}`);
    const parsed = fxSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("FX API returned an invalid rate");
    return {
      base: "USD",
      quote: "INR",
      rate: parsed.data.rates.INR,
      date: parsed.data.date,
    };
  } catch {
    throw new ShoppingUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getUsdToInrRate(): Promise<Rate> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight) return inFlight;

  inFlight = loadRate()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function resetUsdToInrRateCache(): void {
  cached = null;
  inFlight = null;
}
