"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export const APP_SCROLL_CONTAINER_ID = "app-main-content";

const PREFETCH_ROUTES = new Set([
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-64 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Logo size="sm" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Link
            href="/chat"
            prefetch={shouldPrefetch("/chat")}
            className="mb-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>

          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI Stylist
          </div>
          <Link
            href="/chat"
            prefetch={shouldPrefetch("/chat")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>

          <div className="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Wardrobe
          </div>
          <Link
            href="/wardrobe"
            prefetch={shouldPrefetch("/wardrobe")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Shirt className="h-4 w-4" />
            My Wardrobe
          </Link>

          <div className="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Discover
          </div>
          <Link
            href="/outfits"
            prefetch={shouldPrefetch("/outfits")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Sparkles className="h-4 w-4" />
            Outfit Ideas
          </Link>
          <Link
            href="/library"
            prefetch={shouldPrefetch("/library")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Sparkles className="h-4 w-4" />
            Saved Outfits
          </Link>
          <Link
            href="/products"
            prefetch={shouldPrefetch("/products")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Search className="h-4 w-4" />
            Product Search
          </Link>
          <Link
            href="/build-look"
            prefetch={shouldPrefetch("/build-look")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Sparkles className="h-4 w-4" />
            Build Your Look
          </Link>
          <Link
            href="/try-on"
            prefetch={shouldPrefetch("/try-on")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ScanLine className="h-4 w-4" />
            Virtual Try-On
          </Link>

          <div className="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tools
          </div>
          <Link
            href="/calendar"
            prefetch={shouldPrefetch("/calendar")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            href="/packing"
            prefetch={shouldPrefetch("/packing")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Luggage className="h-4 w-4" />
            Packing Assistant
          </Link>
          <Link
            href="/couple"
            prefetch={shouldPrefetch("/couple")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Heart className="h-4 w-4" />
            Couple Mode
          </Link>
          <Link
            href="/group"
            prefetch={shouldPrefetch("/group")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Users className="h-4 w-4" />
            Group Styling
          </Link>
          <Link
            href="/sustainability"
            prefetch={shouldPrefetch("/sustainability")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Leaf className="h-4 w-4" />
            Sustainability
          </Link>

          <div className="mb-2 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Account
          </div>
          <Link
            href="/account"
            prefetch={shouldPrefetch("/account")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <User className="h-4 w-4" />
            My Account
          </Link>

          {user?.role === "admin" && (
            <>
              <Separator className="my-2" />
              <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Admin
              </div>
              <Link
                href="/admin"
                prefetch={shouldPrefetch("/admin")}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </Link>
            </>
          )}
        </nav>

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
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border px-4 lg:hidden">
          <Logo size="sm" />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat" prefetch={shouldPrefetch("/chat")}>
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
