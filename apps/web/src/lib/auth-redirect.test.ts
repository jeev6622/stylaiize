import { describe, expect, it } from "vitest";
import { DEFAULT_POST_LOGIN_URL, getPostLoginRedirect } from "@/lib/auth-redirect";

describe("post-login redirect", () => {
  it("uses the StylAIze homepage by default", () => {
    expect(getPostLoginRedirect(new URLSearchParams())).toBe(DEFAULT_POST_LOGIN_URL);
    expect(DEFAULT_POST_LOGIN_URL).toBe("https://www.stylaiize.site/");
  });

  it("preserves a safe intended internal page", () => {
    const params = new URLSearchParams({ next: "/build-look?event=wedding" });
    expect(getPostLoginRedirect(params)).toBe("/build-look?event=wedding");
  });

  it("ignores external and protocol-relative redirects", () => {
    expect(getPostLoginRedirect(new URLSearchParams({ next: "https://evil.example/" }))).toBe(
      DEFAULT_POST_LOGIN_URL,
    );
    expect(getPostLoginRedirect(new URLSearchParams({ next: "//evil.example/" }))).toBe(
      DEFAULT_POST_LOGIN_URL,
    );
  });
});
