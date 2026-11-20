import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmailOtpLogin } from "@/components/auth/email-otp-login";
import { ApiError } from "@/lib/api";

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  sendLoginOtp: vi.fn(),
  loginWithOtp: vi.fn(),
}));

const redirectMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/lib/auth-redirect", () => ({
  redirectAfterLogin: redirectMock,
  DEFAULT_POST_LOGIN_URL: "https://www.stylaiize.site/",
}));

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => null,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: ({ children }: { children: import("react").ReactNode }) =>
        React.createElement("div", null, children),
    },
  };
});

async function requestCode(email = "user@example.com") {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /continue with email/i }));
  await waitFor(() => expect(authMocks.sendLoginOtp).toHaveBeenCalledWith(email));
  await waitFor(() => expect(screen.getByLabelText("Digit 1 of 6")).toBeTruthy());
}

function fillOtp(code: string) {
  for (let index = 0; index < code.length; index += 1) {
    fireEvent.change(screen.getByLabelText(`Digit ${index + 1} of 6`), {
      target: { value: code[index] },
    });
  }
}

describe("email OTP login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.login.mockResolvedValue({});
    authMocks.sendLoginOtp.mockResolvedValue(undefined);
    authMocks.loginWithOtp.mockResolvedValue({});
  });

  it("shows mobile OTP as unavailable", () => {
    render(<EmailOtpLogin />);
    expect(screen.getByText("Phone code")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /phone.*otp.*sent/i })).toBeNull();
  });

  it("authenticates with an email OTP and redirects to the homepage", async () => {
    render(<EmailOtpLogin />);
    await requestCode();

    fillOtp("123456");
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));

    await waitFor(() =>
      expect(authMocks.loginWithOtp).toHaveBeenCalledWith("user@example.com", "123456", false),
    );
    await waitFor(() => expect(redirectMock).toHaveBeenCalledTimes(1));
  });

  it("does not redirect when OTP verification fails", async () => {
    authMocks.loginWithOtp.mockRejectedValueOnce(new Error("Invalid code"));
    render(<EmailOtpLogin />);
    await requestCode();

    fillOtp("654321");
    fireEvent.click(screen.getByRole("button", { name: /verify and sign in/i }));

    await waitFor(() => expect(authMocks.loginWithOtp).toHaveBeenCalledTimes(1));
    expect(redirectMock).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalled();
  });

  it("shows a clear error when email delivery is unavailable", async () => {
    authMocks.sendLoginOtp.mockRejectedValueOnce(
      new ApiError("Email delivery is currently unavailable.", 503, "EMAIL_DELIVERY_UNAVAILABLE"),
    );
    render(<EmailOtpLogin />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue with email/i }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Email delivery is currently unavailable."),
    );
    expect(screen.queryByLabelText("Digit 1 of 6")).toBeNull();
  });

  it("keeps password login as a backup and redirects on success", async () => {
    render(<EmailOtpLogin />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Password" }));
    fireEvent.click(screen.getByRole("tab", { name: "Password" }));

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "Str0ng!Passw0rd" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in with password/i }));

    await waitFor(() =>
      expect(authMocks.login).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "Str0ng!Passw0rd",
        rememberMe: false,
      }),
    );
    await waitFor(() => expect(redirectMock).toHaveBeenCalledTimes(1));
  });
});
