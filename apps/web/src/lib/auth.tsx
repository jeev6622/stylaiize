"use client";

/**
 * Client-side auth state: React context backed by the StylAIze API's
 * JWT flow. Access/refresh tokens live in localStorage (see lib/api.ts);
 * the user object is hydrated from /auth/me on mount.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@stylaiize/shared";
import { API_ENDPOINTS } from "@stylaiize/shared";
import {
  apiClient,
  clearTokens,
  getRefreshToken,
  setTokens,
} from "@/lib/api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthResultPayload {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email?: string;
  countryCode?: string;
  mobile?: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobile: string;
  countryCode: string;
}

export type VerificationChannel = "email" | "mobile";

export interface StartRegistrationResult {
  registrationId: string;
  email: string;
  mobile: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface RegistrationVerificationResult {
  channel: VerificationChannel;
  verified: boolean;
  bothVerified: boolean;
}

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<User>;
  sendLoginOtp: (email: string) => Promise<void>;
  loginWithOtp: (email: string, code: string, rememberMe?: boolean) => Promise<User>;
  startRegistration: (credentials: RegisterCredentials) => Promise<StartRegistrationResult>;
  resendRegistrationOtp: (
    registrationId: string,
    channel: VerificationChannel,
  ) => Promise<{ channel: VerificationChannel; resendAvailableAt: string }>;
  verifyRegistrationOtp: (
    registrationId: string,
    channel: VerificationChannel,
    code: string,
  ) => Promise<RegistrationVerificationResult>;
  completeRegistration: (registrationId: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Used by the OAuth callback page to adopt tokens handed back by the API. */
  adoptTokens: (accessToken: string, refreshToken: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let sessionRestore: Promise<AuthResultPayload> | null = null;

function restoreSession(refreshToken: string): Promise<AuthResultPayload> {
  if (!sessionRestore) {
    sessionRestore = apiClient.post<AuthResultPayload>(
      API_ENDPOINTS.auth.refresh,
      { refreshToken },
      { skipAuth: true },
    );
  }
  return sessionRestore;
}

async function hydrateUser(accessToken: string): Promise<User | null> {
  try {
    const data = await apiClient.get<{ user: User }>(API_ENDPOINTS.auth.me, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Restore the session on first mount; refresh the token pair if needed.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const data = await restoreSession(refreshToken);
        if (cancelled) return;
        setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        clearTokens();
        setStatus("unauthenticated");
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const data = await apiClient.post<AuthResultPayload>(
      API_ENDPOINTS.auth.login,
      credentials,
      { skipAuth: true },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const sendLoginOtp = useCallback(async (email: string) => {
    await apiClient.post(
      API_ENDPOINTS.auth.sendLoginOtp,
      { email },
      { skipAuth: true },
    );
  }, []);

  const loginWithOtp = useCallback(async (email: string, code: string, rememberMe = false) => {
    const data = await apiClient.post<AuthResultPayload>(
      API_ENDPOINTS.auth.verifyLoginOtp,
      { email, code, rememberMe },
      { skipAuth: true },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const startRegistration = useCallback(async (credentials: RegisterCredentials) => {
    return apiClient.post<StartRegistrationResult>(
      API_ENDPOINTS.auth.registerStart,
      credentials,
      { skipAuth: true },
    );
  }, []);

  const resendRegistrationOtp = useCallback(
    async (registrationId: string, channel: VerificationChannel) => {
      return apiClient.post<{ channel: VerificationChannel; resendAvailableAt: string }>(
        API_ENDPOINTS.auth.registerResend,
        { registrationId, channel },
        { skipAuth: true },
      );
    },
    [],
  );

  const verifyRegistrationOtp = useCallback(
    async (registrationId: string, channel: VerificationChannel, code: string) => {
      return apiClient.post<RegistrationVerificationResult>(
        API_ENDPOINTS.auth.registerVerify,
        { registrationId, channel, code },
        { skipAuth: true },
      );
    },
    [],
  );

  const completeRegistration = useCallback(async (registrationId: string) => {
    const data = await apiClient.post<AuthResultPayload>(
      API_ENDPOINTS.auth.register,
      { registrationId },
      { skipAuth: true },
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post(
        API_ENDPOINTS.auth.logout,
        { refreshToken: getRefreshToken() },
        { skipAuth: true },
      );
    } catch {
      // Token may already be invalid; clearing locally is what matters.
    }
    clearTokens();
    sessionRestore = null;
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const adoptTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    const profile = await hydrateUser(accessToken);
    setTokens(accessToken, refreshToken);
    if (profile) {
      setUser(profile);
      setStatus("authenticated");
      return profile;
    }
    clearTokens();
    setStatus("unauthenticated");
    throw new Error("Could not load your profile after sign-in.");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      sendLoginOtp,
      loginWithOtp,
      startRegistration,
      resendRegistrationOtp,
      verifyRegistrationOtp,
      completeRegistration,
      logout,
      adoptTokens,
    }),
    [
      user,
      status,
      login,
      sendLoginOtp,
      loginWithOtp,
      startRegistration,
      resendRegistrationOtp,
      verifyRegistrationOtp,
      completeRegistration,
      logout,
      adoptTokens,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider.");
  return ctx;
}
