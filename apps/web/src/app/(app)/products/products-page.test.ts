import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, ShoppingProviderStatus } from "@stylaiize/shared";
import ProductsPage from "./page";

const mocks = vi.hoisted(() => {
  const state = { params: new URLSearchParams() };
  const replace = vi.fn((href: string) => {
    state.params = new URL(href, "http://localhost").searchParams;
  });
  return { state, replace };
});

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  useSearchParams: () => mocks.state.params,
}));

vi.mock("@/lib/api", () => ({ apiClient: api }));

function product(title: string): Product {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    brand: "Test Brand",
    imageUrl: "https://example.com/product.jpg",
    price: 1999,
    originalPrice: 2499,
    currency: "INR",
    discountPercent: 20,
    rating: 4.5,
    reviewCount: 20,
    store: "Test Store",
    deliveryEstimateDays: { min: 2, max: 5 },
    buyUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
    category: "upperwear",
    audience: "men",
    styleTags: ["western"],
    colors: ["black"],
    sizes: ["M"],
    inStock: true,
    priceVerifiedAt: "2026-01-01T00:00:00.000Z",
  };
}

function providerStatus(): ShoppingProviderStatus {
  return {
    active: "real",
    activeProviderId: "livostyle",
    demoMode: false,
    configured: true,
    providers: [
      {
        id: "livostyle",
        label: "Livostyle",
        connected: true,
        requiresCredentials: false,
        supported: true,
        state: "connected",
        reason: null,
        lastSuccessAt: "2026-01-01T00:00:00.000Z",
        lastErrorAt: null,
        lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
        rateLimitEvents: 0,
        lastRateLimitedAt: null,
        supportedAudiences: ["women", "all"],
      },
    ],
  };
}

function response(products: Product[], notice: string | null = null) {
  return {
    products,
    total: products.length,
    page: 1,
    totalPages: 1,
    demoMode: false,
    notice,
    providers: providerStatus(),
  };
}

describe("ProductsPage", () => {
  beforeEach(() => {
    api.get.mockReset();
    mocks.replace.mockClear();
    mocks.state.params = new URLSearchParams();
  });

  it("auto-searches carried context, renders products and verified links", async () => {
    mocks.state.params = new URLSearchParams(
      "q=linen+shirt&audience=men&category=upperwear&budget=5000&occasion=wedding&style=modern&queries=%5B%22linen+shirt%22%5D",
    );
    api.get.mockResolvedValueOnce(response([product("Linen Shirt")]));

    render(createElement(ProductsPage));

    expect(await screen.findByText("Linen Shirt")).toBeTruthy();
    expect((screen.getByLabelText("Audience") as HTMLSelectElement).value).toBe("men");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("upperwear");
    const link = screen.getByRole("link", { name: /View Product/i }) as HTMLAnchorElement;
    expect(link.href).toBe("https://example.com/linen-shirt");

    expect(api.get).toHaveBeenCalledTimes(1);
    const url = api.get.mock.calls[0]?.[0] as string;
    expect(url).toContain("query=linen+shirt");
    expect(url).toContain("audience=men");
    expect(url).toContain("category=upperwear");
    expect(url).toContain("maxPrice=5000");
  });

  it("runs a manual search from the same page and preserves audience", async () => {
    mocks.state.params = new URLSearchParams("audience=women");
    api.get.mockResolvedValue(response([product("Black Shirt")]));
    const { rerender } = render(createElement(ProductsPage));

    fireEvent.change(screen.getByLabelText("Product search query"), {
      target: { value: "black shirt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("q=black+shirt"),
      { scroll: false },
    );
    const href = mocks.replace.mock.calls[0]?.[0] as string;
    expect(href).toContain("audience=women");

    mocks.state.params = new URL(href, "http://localhost").searchParams;
    rerender(createElement(ProductsPage));

    expect(await screen.findByText("Black Shirt")).toBeTruthy();
  });

  it("shows an empty state and provider notice when no capable provider exists", async () => {
    mocks.state.params = new URLSearchParams("q=kurta&audience=men");
    api.get.mockResolvedValueOnce(
      response(
        [],
        "No connected provider supports men products. The Livostyle open catalog is women-only.",
      ),
    );

    render(createElement(ProductsPage));

    expect(
      await screen.findByText(/No connected provider supports men products/i),
    ).toBeTruthy();
    expect(screen.getByText("No products found")).toBeTruthy();
  });

  it("clears stale results when the query changes", async () => {
    mocks.state.params = new URLSearchParams("q=old+shirt");
    let resolveSecond: (value: ReturnType<typeof response>) => void = () => undefined;
    const secondRequest = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveSecond = resolve;
    });
    api.get
      .mockResolvedValueOnce(response([product("Old Shirt")]))
      .mockReturnValueOnce(secondRequest);

    const { rerender } = render(createElement(ProductsPage));
    expect(await screen.findByText("Old Shirt")).toBeTruthy();

    mocks.state.params = new URLSearchParams("q=new+shirt");
    rerender(createElement(ProductsPage));

    await waitFor(() => expect(screen.queryByText("Old Shirt")).toBeNull());

    await act(async () => {
      resolveSecond(response([product("New Shirt")]));
      await secondRequest;
    });

    expect(await screen.findByText("New Shirt")).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
