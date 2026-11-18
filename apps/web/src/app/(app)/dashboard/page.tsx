"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Shirt,
  Sparkles,
  Search,
  Lightbulb,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { API_ENDPOINTS } from "@stylaiize/shared";
import { cn } from "@/lib/utils";

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
    placeholder: false,
  },
  {
    title: "My Wardrobe",
    subtitle: "Manage your clothing collection",
    icon: Shirt,
    href: "/wardrobe",
    accent: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    placeholder: false,
  },
  {
    title: "Outfit Ideas",
    subtitle: "Discover new style combinations",
    icon: Sparkles,
    href: "/outfits",
    accent: "from-fuchsia-500/20 to-fuchsia-600/5",
    iconColor: "text-fuchsia-400",
    placeholder: false,
  },
  {
    title: "Product Search",
    subtitle: "Find the best deals on fashion",
    icon: Search,
    href: "/products",
    accent: "from-sky-500/20 to-sky-600/5",
    iconColor: "text-sky-400",
    placeholder: false,
  },
];

const tips = [
  "Match your belt with your shoes",
  "Dark colors slim, light colors add volume",
  "Layer for depth and interest",
  "Accessorize to elevate any outfit",
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<number | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<number | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<number | null>(null);

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{
        conversations: number;
        savedOutfits: number;
        wardrobeItems: number;
      }>(API_ENDPOINTS.dashboard)
      .then((res) => {
        setConversations(res.conversations);
        setSavedOutfits(res.savedOutfits);
        setWardrobeItems(res.wardrobeItems);
      })
      .catch(() => {
        setConversations(0);
        setSavedOutfits(0);
        setWardrobeItems(0);
      });
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
        {/* Welcome */}
        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <h1 className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-3xl font-bold text-transparent">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s your fashion overview
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            const card = (
              <motion.div
                key={action.title}
                {...fadeUp}
                transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}
              >
                <div
                  className={cn(
                    "glass glass-hover group relative overflow-hidden rounded-2xl p-5 transition-all",
                    "cursor-pointer"
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100",
                      action.accent
                    )}
                  />
                  <div className="relative">
                    <Icon
                      className={cn("mb-3 h-6 w-6", action.iconColor)}
                    />
                    <h3 className="text-base font-semibold text-foreground">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {action.subtitle}
                    </p>
                  </div>
                </div>
              </motion.div>
            );

            return (
              <Link key={action.title} href={action.href}>
                {card}
              </Link>
            );
          })}
        </div>

        {/* Stats */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="glass rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-foreground">
              {conversations !== null ? conversations : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Conversations</p>
          </div>
          <Link href="/library" className="glass glass-hover rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-foreground">
              {savedOutfits !== null ? savedOutfits : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Outfits Saved</p>
          </Link>
          <Link href="/wardrobe" className="glass glass-hover rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-foreground">
              {wardrobeItems !== null ? wardrobeItems : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Wardrobe Items</p>
          </Link>
        </motion.div>

        {/* Style Tips */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            Style Tips
          </h2>
          <div className="no-scrollbar -mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="glass flex-shrink-0 rounded-xl px-5 py-4 text-sm text-muted-foreground"
                style={{
                  minWidth: 220,
                  background: `linear-gradient(135deg, rgba(139,92,246,${0.06 + i * 0.02}), rgba(236,72,153,${0.04 + i * 0.01}))`,
                }}
              >
                {tip}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
