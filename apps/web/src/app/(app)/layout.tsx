"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Sparkles,
  LogOut,
  LayoutDashboard,
  Shirt,
  Search,
  CalendarDays,
  Luggage,
  Shield,
  ScanLine,
  User,
  Heart,
  Users,
  Leaf,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";

export const APP_SCROLL_CONTAINER_ID = "app-main-content";

const PREFETCH_ROUTES = new Set([
  "/dashboard",
  "/chat",
  "/build-look",
  "/outfits",
  "/products",
  "/library",
]);

function shouldPrefetch(href: string): boolean {
  return PREFETCH_ROUTES.has(href);
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const navItemClass =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary";
  const navSectionClass =
    "mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground first:mt-0";

  const navLinks = (
    <nav className="flex flex-1 flex-col overflow-y-auto px-1 py-2">
      <Link href="/dashboard" prefetch={shouldPrefetch("/dashboard")} className={navItemClass}>
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>

      <div className={navSectionClass}>AI Stylist</div>
      <Link href="/chat" prefetch={shouldPrefetch("/chat")} className={navItemClass}>
        <MessageSquare className="h-4 w-4" />
        Chat
      </Link>

      <div className={navSectionClass}>Wardrobe</div>
      <Link href="/wardrobe" prefetch={shouldPrefetch("/wardrobe")} className={navItemClass}>
        <Shirt className="h-4 w-4" />
        My Wardrobe
      </Link>

      <div className={navSectionClass}>Discover</div>
      <Link href="/outfits" prefetch={shouldPrefetch("/outfits")} className={navItemClass}>
        <Sparkles className="h-4 w-4" />
        Outfit Ideas
      </Link>
      <Link href="/library" prefetch={shouldPrefetch("/library")} className={navItemClass}>
        <Sparkles className="h-4 w-4" />
        Saved Outfits
      </Link>
      <Link href="/products" prefetch={shouldPrefetch("/products")} className={navItemClass}>
        <Search className="h-4 w-4" />
        Product Search
      </Link>
      <Link href="/build-look" prefetch={shouldPrefetch("/build-look")} className={navItemClass}>
        <Sparkles className="h-4 w-4" />
        Build Your Look
      </Link>
      <Link href="/try-on" prefetch={shouldPrefetch("/try-on")} className={navItemClass}>
        <ScanLine className="h-4 w-4" />
        Virtual Try-On
      </Link>

      <div className={navSectionClass}>Tools</div>
      <Link href="/calendar" prefetch={shouldPrefetch("/calendar")} className={navItemClass}>
        <CalendarDays className="h-4 w-4" />
        Calendar
      </Link>
      <Link href="/packing" prefetch={shouldPrefetch("/packing")} className={navItemClass}>
        <Luggage className="h-4 w-4" />
        Packing Assistant
      </Link>
      <Link href="/couple" prefetch={shouldPrefetch("/couple")} className={navItemClass}>
        <Heart className="h-4 w-4" />
        Couple Mode
      </Link>
      <Link href="/group" prefetch={shouldPrefetch("/group")} className={navItemClass}>
        <Users className="h-4 w-4" />
        Group Styling
      </Link>
      <Link href="/sustainability" prefetch={shouldPrefetch("/sustainability")} className={navItemClass}>
        <Leaf className="h-4 w-4" />
        Sustainability
      </Link>

      <div className={navSectionClass}>Account</div>
      <Link href="/account" prefetch={shouldPrefetch("/account")} className={navItemClass}>
        <User className="h-4 w-4" />
        My Account
      </Link>

      {user?.role === "admin" && (
        <>
          <Separator className="my-2" />
          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <Link href="/admin" prefetch={shouldPrefetch("/admin")} className={navItemClass}>
            <Shield className="h-4 w-4" />
            Admin Panel
          </Link>
        </>
      )}
    </nav>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-64 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Logo size="sm" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-3 py-4">
          {navLinks}
        </div>

        <Separator />

        <div className="p-3">
          {user && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <Avatar className="h-8 w-8">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs">{initialsOf(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => void logout()}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                aria-expanded={mobileNavOpen}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] max-w-sm flex-col p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="flex items-center gap-2">
                  <Logo size="sm" />
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-3">{navLinks}</div>
              {user && (
                <>
                  <Separator />
                  <div className="p-3">
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <Avatar className="h-8 w-8">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                        <AvatarFallback className="text-xs">{initialsOf(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => void logout()}
                        aria-label="Sign out"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
          <Logo size="sm" />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat" prefetch={shouldPrefetch("/chat")} aria-label="Open chat">
              <Sparkles className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        <main
          id={APP_SCROLL_CONTAINER_ID}
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
