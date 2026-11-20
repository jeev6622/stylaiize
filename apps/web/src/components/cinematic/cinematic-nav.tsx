"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

const NAV_LINKS = [
  { label: "Build Your Look", href: "/build-look" },
  { label: "AI Stylist", href: "/chat" },
  { label: "Smart Shopping", href: "/products" },
  { label: "Wardrobe", href: "/wardrobe" },
  { label: "How It Works", href: "#how-it-works" },
];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function CinematicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, status, logout } = useAuth();
  const startHref = status === "authenticated" ? "/build-look" : "/register";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function onLogout() {
    await logout();
    toast.success("Signed out. See you soon!");
  }

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`mx-auto flex h-16 max-w-7xl items-center justify-between px-5 transition-all duration-500 sm:px-6 lg:px-8 ${
          scrolled
            ? "mt-3 h-14 max-w-6xl rounded-full border border-neutral-200 bg-white/80 px-5 shadow-lg shadow-neutral-900/5 backdrop-blur-xl sm:px-6"
            : "bg-transparent"
        }`}
      >
        <Link href="/" className="group flex items-center" aria-label="StylAIze home">
          <Logo size="sm" tone={scrolled ? "dark" : "light"} />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-[13px] font-light tracking-wide transition-colors ${
                scrolled ? "text-neutral-700 hover:text-black" : "text-white/80 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {status === "loading" && (
            <Skeleton className={`h-9 w-24 rounded-full ${scrolled ? "bg-neutral-200" : "bg-white/20"}`} />
          )}

          {status === "unauthenticated" && (
            <Link
              href="/login"
              className={`text-[13px] font-light tracking-wide transition-colors ${
                scrolled ? "text-neutral-700 hover:text-black" : "text-white/80 hover:text-white"
              }`}
            >
              Sign in
            </Link>
          )}

          {status !== "loading" && (
            <Button
              asChild
              size="sm"
              className={
                scrolled
                  ? "border border-neutral-300 bg-white/80 text-neutral-900 hover:border-neutral-900 hover:bg-white hover:text-black"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_10px_30px_rgba(217,119,66,0.35)] hover:brightness-110"
              }
            >
              <Link href={startHref}>Start Styling</Link>
            </Button>
          )}

          {status === "authenticated" && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 rounded-full border pl-1 pr-3 ${
                    scrolled
                      ? "border-neutral-200 bg-white/80 text-neutral-900"
                      : "border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  }`}
                >
                  <Avatar className="h-7 w-7">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{initialsOf(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className={`max-w-[9rem] truncate ${scrolled ? "text-neutral-800" : "text-white/90"}`}>
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void onLogout()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`lg:hidden ${scrolled ? "text-neutral-900" : "text-white"}`}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="border-neutral-200 bg-white text-neutral-900">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Logo size="sm" tone="dark" />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-light text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              {status !== "loading" && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:brightness-110"
                >
                  <Link href={startHref} onClick={() => setMenuOpen(false)}>
                    Start Styling
                  </Link>
                </Button>
              )}
              {status === "authenticated" ? (
                <Button
                  variant="secondary"
                  className="border-neutral-200 bg-neutral-100 text-neutral-900"
                  onClick={() => {
                    setMenuOpen(false);
                    void onLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  asChild
                  className="border-neutral-200 bg-neutral-100 text-neutral-900"
                >
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Sign in
                  </Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
