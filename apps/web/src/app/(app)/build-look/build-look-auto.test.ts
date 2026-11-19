import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS, type BuildYourLookData } from "@stylaiize/shared";
import BuildLookPage from "./page";

const api = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiClient: { post: api.post },
  ApiError: class ApiError extends Error {
    code?: string;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/build-look/FashionScene", () => ({
  FashionScene: () => null,
}));

const look: BuildYourLookData = {
  eventName: "Friends Wedding",
  audience: "men",
  styleName: "Modern",
  styleMatch: 90,
  eventMatch: 92,
  estimatedBudgetInr: { min: 2000, max: 5000, currency: "INR" },
  colorCombination: "Jet Black with Cream",
  footwear: "Dark brown formal shoes",
  accessories: ["Minimal watch"],
  explanation: "Relaxed tailoring for a friends wedding.",
  recommendedColors: ["Jet Black", "Tobacco Brown", "Deep Tan", "Cream"],
  fitGuidance: "Relaxed tailoring",
  shoppingQueries: ["shirt", "trousers"],
  originalTotal: 0,
  optimizedTotal: 0,
  savings: 0,
  items: [
    {
      id: "item-1",
      name: "Formal shirt",
      subtitle: "Cream formal shirt",
      description: "A relaxed tailored cream shirt.",
      brand: null,
      material: "Cotton",
      color: "Cream",
      size: "M",
      price: 0,
      originalPrice: 0,
      rating: 0,
      store: "",
      category: "upperwear",
      imageUrl: null,
    },
  ],
};

describe("BuildLookPage automatic workflow", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    api.post.mockReset();
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({
          matches: false,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
        }),
      });
    }
  });

  it("requires an audience before building a look", () => {
    render(createElement(BuildLookPage));

    const buildButton = screen.getByRole("button", { name: /Build My Look/i }) as HTMLButtonElement;
    expect(buildButton.disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("runs shopping and image generation immediately after a successful look", async () => {
    api.post.mockImplementation(async (url: string) => {
      if (url === API_ENDPOINTS.buildYourLook.generate) return { look };
      if (url === API_ENDPOINTS.buildYourLook.shop) {
        return {
          matches: [],
          source: "api",
          sourceLabel: "Test",
          fx: null,
          budget: null,
          pinCode: null,
          providers: { active: "real", activeProviderId: null, demoMode: false, configured: true, providers: [] },
          checkedAt: "2026-01-01T00:00:00.000Z",
        };
      }
      if (url === API_ENDPOINTS.buildYourLook.completeOutfitImage) {
        return {
          status: "not_configured",
          completeOutfitImage: null,
          image: null,
          audience: "men",
          needsConfig: true,
          message: "Image provider not configured.",
        };
      }
      return {};
    });

    render(createElement(BuildLookPage));

    fireEvent.click(screen.getByRole("button", { name: "men" }));
    fireEvent.change(screen.getByLabelText(/Event name/i), {
      target: { value: "Friends Wedding" },
    });
    fireEvent.change(screen.getByLabelText(/Preferred colours/i), {
      target: { value: "Jet Black, Tobacco Brown, Deep Tan, Cream" },
    });
    fireEvent.change(screen.getByLabelText(/Fit preference/i), {
      target: { value: "Relaxed tailoring" },
    });
    fireEvent.click(screen.getByRole("button", { name: "₹5,000" }));
    fireEvent.click(screen.getByRole("button", { name: /Build My Look/i }));

    await waitFor(() => {
      const urls = api.post.mock.calls.map((call) => call[0]);
      expect(urls).toContain(API_ENDPOINTS.buildYourLook.generate);
      expect(urls).toContain(API_ENDPOINTS.buildYourLook.shop);
      expect(urls).toContain(API_ENDPOINTS.buildYourLook.completeOutfitImage);
    });

    const shopCall = api.post.mock.calls.find(
      (call) => call[0] === API_ENDPOINTS.buildYourLook.shop,
    );
    expect(shopCall?.[1]).toMatchObject({
      audience: "men",
      occasion: "Friends Wedding",
      style: "modern",
      budget: "5000",
    });
    expect(shopCall?.[1].items[0].query).toContain("men's");
    expect(shopCall?.[1].items[0].query).toContain("cream");

    expect(await screen.findByText("Provider configuration required")).toBeTruthy();
    expect(
      await screen.findByText(
        "Verified men's products are currently unavailable.",
      ),
    ).toBeTruthy();

    const searchLink = screen.getByRole("link", { name: /Search products/i }) as HTMLAnchorElement;
    expect(new URL(searchLink.href).searchParams.get("audience")).toBe("men");
  });
});
