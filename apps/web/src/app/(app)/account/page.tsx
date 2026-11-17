"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  KeyRound,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  User as UserIcon,
  BrainCircuit,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { API_ENDPOINTS, type FashionMemory } from "@stylaiize/shared";

interface AccountSummary {
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    avatarUrl: string | null;
    role: string;
    emailVerified: boolean;
    created: string;
  } & Record<string, unknown>;
  stats: {
    savedOutfits: number;
    wardrobeItems: number;
    memberSince: string;
  };
  security: {
    hasPassword: boolean;
    googleLinked: boolean;
  };
}

function memberSince(date: string): string {
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default function AccountPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [memory, setMemory] = useState<FashionMemory | null>(null);
  const [memoryColors, setMemoryColors] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<AccountSummary>(API_ENDPOINTS.account.base);
      setSummary(res);
      setName(res.user.name);
      setAvatarUrl(res.user.avatarUrl ?? "");
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMemory = useCallback(async () => {
    try {
      const res = await apiClient.get<{ memory: FashionMemory }>(API_ENDPOINTS.memory);
      setMemory(res.memory);
      setMemoryColors(res.memory.favoriteColors.join(", "));
      if (res.memory.budget) {
        setBudgetMin(String(res.memory.budget.min));
        setBudgetMax(String(res.memory.budget.max));
      }
    } catch {
      setMemory(null);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMemory();
  }, [load, loadMemory]);

  async function handleSaveMemory() {
    setSavingMemory(true);
    try {
      const colors = memoryColors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 200);
      const min = budgetMin.trim() === "" ? 0 : Number(budgetMin);
      const max = budgetMax.trim() === "" ? 0 : Number(budgetMax);
      const res = await apiClient.patch<{ memory: FashionMemory }>(API_ENDPOINTS.memory, {
        favoriteColors: colors,
        budget: min > 0 || max > 0 ? { min, max } : null,
      });
      setMemory(res.memory);
      toast.success("Fashion memory updated.");
    } catch {
      toast.error("Failed to update fashion memory.");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleSaveProfile() {
    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiClient.patch<{ user: { name: string; avatarUrl: string | null } }>(
        API_ENDPOINTS.account.base,
        {
          name: name.trim(),
          avatarUrl: avatarUrl.trim() === "" ? null : avatarUrl.trim(),
        },
      );
      setSummary((prev) => (prev ? { ...prev, user: { ...prev.user, ...res.user } } : prev));
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await apiClient.post(API_ENDPOINTS.account.changePassword, {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to change password. Check your current password.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  const initial = user?.name ? initialsOf(user.name) : "?";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <UserIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Account</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and security
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Identity card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
                <Avatar className="h-16 w-16">
                  {summary?.user.avatarUrl && (
                    <AvatarImage src={summary.user.avatarUrl} alt="" />
                  )}
                  <AvatarFallback className="text-xl">{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{summary?.user.name ?? user?.name}</h2>
                    <Badge variant="secondary" className="capitalize">
                      {summary?.user.role ?? user?.role ?? "user"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{summary?.user.email ?? user?.email}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    Member since{" "}
                    {summary?.stats.memberSince
                      ? memberSince(summary.stats.memberSince)
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-foreground">
                {summary?.stats.savedOutfits ?? 0}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Outfits Saved
              </p>
            </div>
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-foreground">
                {summary?.stats.wardrobeItems ?? 0}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Shirt className="h-3.5 w-3.5" /> Wardrobe Items
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">
                <Settings className="mr-2 h-4 w-4" /> Profile
              </TabsTrigger>
              <TabsTrigger value="security">
                <ShieldCheck className="mr-2 h-4 w-4" /> Security
              </TabsTrigger>
              <TabsTrigger value="memory">
                <BrainCircuit className="mr-2 h-4 w-4" /> Fashion Memory
              </TabsTrigger>
            </TabsList>

            {/* Profile tab */}
            <TabsContent value="profile" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Details</CardTitle>
                  <CardDescription>Update your name and avatar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatarUrl">Avatar URL</Label>
                    <Input
                      id="avatarUrl"
                      placeholder="https://..."
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => void handleSaveProfile()}
                    disabled={savingProfile}
                    className="gap-2"
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security tab */}
            <TabsContent value="security" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    {summary?.security.hasPassword
                      ? "Update your account password."
                      : "This account has no password set. Use password reset or sign in with Google."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary?.security.googleLinked && (
                    <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Linked with Google
                    </div>
                  )}
                  {summary?.security.hasPassword && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => void handleChangePassword()}
                        disabled={savingPassword}
                        className="gap-2"
                      >
                        {savingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                        Change Password
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Fashion Memory tab */}
            <TabsContent value="memory" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fashion Memory</CardTitle>
                  <CardDescription>
                    StylAIze remembers your colors, brands and budget so future
                    recommendations stay consistent with what you already own and wear.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {memory && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-secondary/40 p-4">
                          <p className="text-xs text-muted-foreground">Favorite colors</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {memory.favoriteColors.length > 0 ? (
                              memory.favoriteColors.map((c, i) => (
                                <span key={i} className="rounded-md bg-primary/10 px-2 py-1 text-sm">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">None yet</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl bg-secondary/40 p-4">
                          <p className="text-xs text-muted-foreground">Favorite brands</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {memory.favoriteBrands.length > 0 ? (
                              memory.favoriteBrands.map((b, i) => (
                                <span key={i} className="rounded-md bg-secondary px-2 py-1 text-sm">
                                  {b}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">None yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Prior looks worn:</span>{" "}
                          {memory.previousOutfits.length} time(s) ·{" "}
                          {memory.previousOutfits
                            .map((p) => p.eventId)
                            .slice(-3)
                            .join(", ") || "no history yet"}
                        </p>
                        <p className="mt-1">
                          <span className="font-medium text-foreground">Wardrobe items remembered:</span>{" "}
                          {memory.wardrobeOwned.length}
                        </p>
                        <p className="mt-1">
                          <span className="font-medium text-foreground">Items purchased:</span>{" "}
                          {memory.shoppingHistory.length}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="memoryColors">Favorite colors (comma separated)</Label>
                      <Input
                        id="memoryColors"
                        value={memoryColors}
                        onChange={(e) => setMemoryColors(e.target.value)}
                        placeholder="Navy, White, Maroon"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="budgetMin">Typical budget min (INR)</Label>
                        <Input
                          id="budgetMin"
                          value={budgetMin}
                          onChange={(e) => setBudgetMin(e.target.value)}
                          placeholder="e.g. 2000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="budgetMax">Typical budget max (INR)</Label>
                        <Input
                          id="budgetMax"
                          value={budgetMax}
                          onChange={(e) => setBudgetMax(e.target.value)}
                          placeholder="e.g. 10000"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => void handleSaveMemory()}
                      disabled={savingMemory}
                      className="gap-2"
                    >
                      {savingMemory ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Memory
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Saved outfits automatically build this memory — colors, brands and worn
                      contexts are recorded every time you save or shop a look.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
