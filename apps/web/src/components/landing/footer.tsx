import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { APP_TAGLINE } from "@stylaiize/shared";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "AI Stylist", href: "/chat" },
      { label: "Build Your Look", href: "/build-look" },
      { label: "Wardrobe", href: "/wardrobe" },
      { label: "Virtual Try-On", href: "/try-on" },
      { label: "Smart Shopping", href: "/products" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Outfit Ideas", href: "/outfits" },
      { label: "Saved Outfits", href: "/library" },
      { label: "Couple Mode", href: "/couple" },
      { label: "Group Styling", href: "/group" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Create Account", href: "/register" },
      { label: "My Account", href: "/account" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-secondary/10">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {APP_TAGLINE}. Your AI personal stylist — styled, explained, and
              shoppable for less.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="glass rounded-full px-3 py-1.5">Gemini 3 Flash</span>
              <span className="glass rounded-full px-3 py-1.5">IDM-VTON</span>
              <span className="glass rounded-full px-3 py-1.5">Cloudinary</span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-foreground">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} StylAIze. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            See it. Style it. <span className="text-aurora-subtle">Buy it for less.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
