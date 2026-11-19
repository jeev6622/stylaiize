"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Shield,
  MessageSquare,
  Shirt,
  Activity,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  API_ENDPOINTS,
  type ShoppingProviderState,
  type ShoppingProviderStatus,
  type User,
} from "@stylaiize/shared";

type Tab = "overview" | "providers" | "users";

interface ProviderState {
  active?: string | boolean | null;
  demoMode?: boolean;
  configured?: boolean;
}

interface ProvidersStatus {
  ai?: ProviderState;
  database?: ProviderState;
  storage?: ProviderState;
  shopping?: ProviderState & ShoppingProviderStatus;
  vton?: ProviderState;
  email?: ProviderState;
  notification?: ProviderState;
}

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalWardrobeItems: number;
  recentUsers: User[];
  providers?: ProvidersStatus;
  uptime?: number;
}

interface ListUsersResult {
  users: User[];
  total: number;
}

function formatUptime(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "Unavailable";
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function providerLabel(provider?: ProviderState): { label: string; tone: "live" | "demo" | "none" } {
  if (!provider) return { label: "Unavailable", tone: "none" };
  const active = provider.active;
  const demo = provider.demoMode === true;

  if (active === false || active === "none" || active == null) {
    return { label: "None", tone: "none" };
  }
  if (demo || active === "mock") {
    return { label: typeof active === "string" && active !== "mock" ? `Demo (${active})` : "Demo", tone: "demo" };
  }
  if (typeof active === "boolean") {
    return { label: "Live", tone: "live" };
  }
  return { label: `Live (${active})`, tone: "live" };
}

function toneClasses(tone: "live" | "demo" | "none") {
  if (tone === "live") return "bg-emerald-500";
  if (tone === "demo") return "bg-amber-500";
  return "bg-muted-foreground/40";
}

const SHOPPING_STATE_LABELS: Record<ShoppingProviderState, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  approval_required: "Approval or credentials required",
  authentication_failed: "Authentication failed",
  temporarily_unavailable: "Temporarily unavailable",
  verification_pending: "Verification pending",
};

function shoppingStateTone(state: string): "live" | "demo" | "none" {
  if (state === "connected") return "live";
  if (
    state === "verification_pending" ||
    state === "not_configured" ||
    state === "approval_required"
  ) {
    return "demo";
  }
  return "none";
}

function shoppingStateLabel(state: string): string {
  return SHOPPING_STATE_LABELS[state as ShoppingProviderState] ?? state.replaceAll("_", " ");
}

function formatSyncTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid" : date.toLocaleString();
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card/50 p-5"
    >
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2.5", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant={role === "admin" ? "gradient" : "secondary"}
      className="text-[10px] uppercase"
    >
      {role}
    </Badge>
  );
}

function UserRow({
  user,
  expanded,
  onToggle,
  onRoleChange,
  onDelete,
}: {
  user: User;
  expanded: boolean;
  onToggle: () => void;
  onRoleChange: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/30"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
        <td className="px-4 py-3">
          <RoleBadge role={user.role} />
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onRoleChange}
            >
              {user.role === "admin" ? "Demote" : "Promote"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/50 bg-secondary/20">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">ID</span>
                <p className="truncate font-mono text-xs">{user.id}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Mobile</span>
                <p>
                  {user.mobile
                    ? `${user.countryCode} ${user.mobile}`
                    : "-"}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Providers</span>
                <p>{user.providers.join(", ")}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Email Verified</span>
                <p>{user.emailVerified ? "Yes" : "No"}</p>
              </div>

              {user.avatarUrl && (
                <div>
                  <span className="text-muted-foreground">Avatar</span>
                  <Image
                    src={user.avatarUrl}
                    alt={`${user.name}'s avatar`}
                    width={32}
                    height={32}
                    unoptimized
                    className="mt-1 h-8 w-8 rounded-full object-cover"
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OverviewTab({
  stats,
  loading,
  onRefresh,
}: {
  stats: AdminStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const providers = stats?.providers;
  const rows: { label: string; state?: ProviderState }[] = [
    { label: "AI Provider", state: providers?.ai },
    { label: "Database", state: providers?.database },
    { label: "Storage", state: providers?.storage },
    { label: "Shopping", state: providers?.shopping },
    { label: "VTON", state: providers?.vton },
    { label: "Email", state: providers?.email },
    { label: "Notifications", state: providers?.notification },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="bg-violet-500/15 text-violet-400"
          loading={loading}
        />
        <StatCard
          label="Conversations"
          value={stats?.totalConversations ?? 0}
          icon={MessageSquare}
          color="bg-blue-500/15 text-blue-400"
          loading={loading}
        />
        <StatCard
          label="Wardrobe Items"
          value={stats?.totalWardrobeItems ?? 0}
          icon={Shirt}
          color="bg-emerald-500/15 text-emerald-400"
          loading={loading}
        />
        <StatCard
          label="Uptime"
          value={formatUptime(stats?.uptime)}
          icon={Clock}
          color="bg-amber-500/15 text-amber-400"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card/50"
        >
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold">Recent Users</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : (stats?.recentUsers?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  stats!.recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                      <td className="px-5 py-3 text-sm font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-4"
        >
          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">System Health</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} title="Refresh status">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))
              ) : !providers ? (
                <p className="text-sm text-muted-foreground">Provider status is unavailable.</p>
              ) : (
                rows.map((row) => {
                  const { label, tone } = providerLabel(row.state);
                  return (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", toneClasses(tone))} />
                        <span className="text-sm">{row.label}</span>
                      </div>
                      <Badge
                        variant={tone === "live" ? "success" : "secondary"}
                        className="text-[10px]"
                      >
                        {label}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Error monitoring
            </h3>
            <p className="text-sm text-muted-foreground">
              Error monitoring is not configured for this deployment.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ProvidersTab() {
  const [status, setStatus] = useState<ShoppingProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get<ShoppingProviderStatus>(API_ENDPOINTS.shoppingStatus)
      .then(setStatus)
      .catch(() => toast.error("Failed to load shopping provider status."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/50 p-5">
        <div>
          <h2 className="text-sm font-semibold">Shopping provider status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Active: {status?.active ?? "unknown"} · {status?.activeProviderId ?? "none"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A provider is shown as connected only after a successful live request.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} title="Refresh status">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !status ? (
        <p className="text-sm text-muted-foreground">Shopping provider status is unavailable.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {status.providers.map((provider) => {
            const tone = shoppingStateTone(provider.state);
            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-border bg-card/50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2 w-2 rounded-full", toneClasses(tone))} />
                    <div>
                      <p className="text-sm font-medium">{provider.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{provider.id}</p>
                    </div>
                  </div>
                  <Badge
                    variant={tone === "live" ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {shoppingStateLabel(provider.state)}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{provider.reason}</p>
                {(provider.state === "approval_required" ||
                  (!provider.connected && provider.requiresCredentials)) && (
                  <p className="mt-2 text-[11px] font-medium text-amber-300">
                    Requires approval or credentials.
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <p>
                    Last successful sync: {formatSyncTime(provider.lastSuccessfulSyncAt)}
                  </p>
                  <p>Last error: {formatSyncTime(provider.lastErrorAt)}</p>
                  <p>Rate-limit events: {provider.rateLimitEvents ?? 0}</p>
                  <p>Last rate limit: {formatSyncTime(provider.lastRateLimitedAt ?? null)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (roleFilter) params.set("role", roleFilter);
      if (search.trim()) params.set("search", search.trim());

      const result = await apiClient.get<ListUsersResult>(
        `${API_ENDPOINTS.admin}/users?${params.toString()}`,
      );

      setUsers(result.users);
      setTotal(result.total);
    } catch {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search]);

  async function handleRoleChange(user: User) {
    const newRole = user.role === "admin" ? "user" : "admin";

    try {
      await apiClient.patch(`${API_ENDPOINTS.admin}/users/${user.id}/role`, { role: newRole });
      toast.success(`${user.name} is now ${newRole}.`);
      void fetchUsers();
    } catch {
      toast.error("Failed to update role.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await apiClient.delete(`${API_ENDPOINTS.admin}/users/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} has been deleted.`);
      setDeleteTarget(null);
      setExpandedId(null);
      void fetchUsers();
    } catch {
      toast.error("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {["", "user", "admin"].map((r) => (
              <Button
                key={r}
                variant={roleFilter === r ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(r)}
                className="capitalize"
              >
                {r || "All"}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => void fetchUsers()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-7 w-20" /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      expanded={expandedId === u.id}
                      onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
                      onRoleChange={() => void handleRoleChange(u)}
                      onDelete={() => setDeleteTarget(u)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
              </p>

              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </DialogTitle>

            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>

            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    apiClient
      .get<AdminStats>(`${API_ENDPOINTS.admin}/stats`)
      .then((data) => setStats(data))
      .catch(() => toast.error("Failed to load admin stats."))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "overview") {
      loadStats();
    }
  }, [tab, loadStats]);

  if (user && user.role !== "admin") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <Shield className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="text-xl font-bold">Access Denied</h1>

        <p className="max-w-sm text-sm text-muted-foreground">
          You do not have admin privileges to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Shield className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage users and monitor system health
          </p>
        </div>
      </div>

      <div className="border-b border-border px-6">
        <div className="flex gap-1">
          {(["overview", "providers", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "overview" ? (
          <OverviewTab stats={stats} loading={statsLoading} onRefresh={loadStats} />
        ) : tab === "providers" ? (
          <ProvidersTab />
        ) : (
          <UsersTab />
        )}
      </div>
    </div>
  );
}
