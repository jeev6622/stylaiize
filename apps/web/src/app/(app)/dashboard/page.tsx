"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Shirt,
  Sparkles,
  Search,
  Bell,
  Settings,
  User as UserIcon,
  Heart,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiClient, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { API_ENDPOINTS } from "@stylaiize/shared";
import type { Product } from "@stylaiize/shared";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type DashboardActivity = {
  id: string;
  type: "conversation" | "outfit" | "alert" | "event" | string;
  title: string;
  at: string;
  href?: string | null;
};

type DashboardSummaryData = {
  conversations: number;
  savedOutfits: number;
  wardrobeItems: number;
  alerts?: number;
  events?: number;
  favourites?: number;
  recentConversations: { id: string; title: string; updatedAt: string }[];
  recentOutfits: { id: string; name: string; occasion?: string | null; createdAt: string }[];
  favouriteProducts: Product[];
  recentActivity: DashboardActivity[];
  notifications?: {
    active: boolean;
    demoMode: boolean;
    deviceCount?: number;
    pushEnabled?: boolean;
  };
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const quickActions = [
  {
    title: "AI Stylist Chat",
    subtitle: "Get personalized outfit recommendations",
    icon: MessageSquare,
    href: "/chat",
    accent: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-400",
  },
  {
    title: "My Wardrobe",
    subtitle: "Manage your clothing collection",
    icon: Shirt,
    href: "/wardrobe",
    accent: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
  },
  {
    title: "Outfit Ideas",
    subtitle: "Discover new style combinations",
    icon: Sparkles,
    href: "/outfits",
    accent: "from-fuchsia-500/20 to-fuchsia-600/5",
    iconColor: "text-fuchsia-400",
  },
  {
    title: "Product Search",
    subtitle: "Find the best deals on fashion",
    icon: Search,
    href: "/products",
    accent: "from-sky-500/20 to-sky-600/5",
    iconColor: "text-sky-400",
  },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FavouriteCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${encodeURIComponent(product.id)}`}
      className="glass glass-hover flex gap-3 rounded-xl p-3"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/50">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <Heart className="h-5 w-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[product.brand, product.store].filter(Boolean).join(" · ") || "Saved product"}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-foreground">
          {formatCurrency(product.price, product.currency || "INR")}
        </p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<DashboardSummaryData>(API_ENDPOINTS.dashboard)
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load your dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const notifications = summary?.notifications;
  const notificationsUnavailable = !notifications || notifications.demoMode || !notifications.active;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <h1 className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-3xl font-bold text-transparent">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s your fashion overview</p>
        </motion.div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}>
                <Link href={action.href}>
                  <div className="glass glass-hover group relative cursor-pointer overflow-hidden rounded-2xl p-5 transition-all">
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100",
                        action.accent,
                      )}
                    />
                    <div className="relative">
                      <Icon className={cn("mb-3 h-6 w-6", action.iconColor)} />
                      <h3 className="text-base font-semibold text-foreground">{action.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{action.subtitle}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
        >
          {[
            { label: "Conversations", value: summary?.conversations, href: "/chat" },
            { label: "Outfits Saved", value: summary?.savedOutfits, href: "/library" },
            { label: "Wardrobe Items", value: summary?.wardrobeItems, href: "/wardrobe" },
            { label: "Favourites", value: summary?.favourites, href: "/dashboard#favourites" },
            { label: "Price Alerts", value: summary?.alerts, href: "/products" },
            { label: "Events", value: summary?.events, href: "/calendar" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="glass glass-hover rounded-2xl p-4 text-center">
              {loading ? (
                <Skeleton className="mx-auto h-8 w-12" />
              ) : error ? (
                <p className="text-sm font-medium text-muted-foreground">Unavailable</p>
              ) : (
                <p className="text-2xl font-bold text-foreground">{stat.value ?? 0}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </Link>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.55 }} className="glass rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Clock className="h-5 w-5 text-violet-400" />
              Recent styling recommendations
            </h2>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">Unable to load recent recommendations.</p>
            ) : (summary?.recentConversations?.length ?? 0) === 0 && (summary?.recentOutfits?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recommendations yet. Start a chat or build a look to see them here.
              </p>
            ) : (
              <div className="space-y-4">
                {(summary?.recentOutfits?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Saved outfits
                    </p>
                    <div className="space-y-2">
                      {summary!.recentOutfits.map((outfit) => (
                        <Link
                          key={outfit.id}
                          href="/library"
                          className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm hover:bg-secondary/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{outfit.name}</p>
                            {outfit.occasion ? (
                              <p className="truncate text-xs text-muted-foreground">{outfit.occasion}</p>
                            ) : null}
                          </div>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            {formatDate(outfit.createdAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {(summary?.recentConversations?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversations
                    </p>
                    <div className="space-y-2">
                      {summary!.recentConversations.map((conv) => (
                        <Link
                          key={conv.id}
                          href="/chat"
                          className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm hover:bg-secondary/50"
                        >
                          <span className="truncate font-medium text-foreground">{conv.title}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                            {formatDate(conv.updatedAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.section>

          <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.6 }} className="glass rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Bell className="h-5 w-5 text-amber-400" />
              Recent activity
            </h2>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">Unable to load recent activity.</p>
            ) : (summary?.recentActivity?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {summary!.recentActivity.map((activity) => {
                  const safeHref =
                    activity.type === "conversation"
                      ? "/chat"
                      : activity.type === "outfit"
                        ? "/library"
                        : activity.type === "event"
                          ? "/calendar"
                          : null;
                  const content = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{activity.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">{activity.type}</p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{formatDate(activity.at)}</span>
                    </>
                  );
                  return (
                    <li key={activity.id}>
                      {safeHref ? (
                        <Link
                          href={safeHref}
                          className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm hover:bg-secondary/50"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>
        </div>

        <motion.section
          id="favourites"
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.65 }}
          className="glass rounded-2xl p-5 scroll-mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Heart className="h-5 w-5 text-pink-400" />
              Favourite products
            </h2>
            <Link href="/products" className="text-xs text-primary hover:underline">
              Browse products
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">Unable to load favourite products.</p>
          ) : (summary?.favouriteProducts?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No favourite products yet. Save products from search results to see them here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summary!.favouriteProducts.slice(0, 6).map((product) => (
                <FavouriteCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </motion.section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.7 }} className="glass rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <UserIcon className="h-5 w-5 text-sky-400" />
              Profile
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{user?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate font-medium text-foreground">{user?.email ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize text-foreground">{user?.role ?? "—"}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/account"
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                <Settings className="h-4 w-4" /> Account settings
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
              >
                <Sparkles className="h-4 w-4" /> Saved outfits
              </Link>
            </div>
          </motion.section>

          <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.75 }} className="glass rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Bell className="h-5 w-5 text-amber-400" />
              Notifications
            </h2>
            {loading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : notificationsUnavailable ? (
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Notifications unavailable</p>
                <p className="mt-1">
                  Push notifications are not active on this deployment
                  {notifications?.demoMode ? " (demo mode)" : ""}. You can still use in-app features and check alerts manually.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Registered devices</span>
                  <span className="font-medium text-foreground">{notifications?.deviceCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Push enabled</span>
                  <span className="font-medium text-foreground">{notifications?.pushEnabled ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
