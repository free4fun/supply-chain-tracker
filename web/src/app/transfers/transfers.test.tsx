import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TransfersPage from "./page";
import { I18nProvider } from "@/contexts/I18nContext";

vi.mock("@/contexts/Web3Context", () => ({
  useWeb3: () => ({ account: "0x0000000000000000000000000000000000000001", ready: true })
}));
vi.mock("@/contexts/RoleContext", () => ({
  useRole: () => ({ activeRole: "Producer", isApproved: true, loading: false, statusLabel: undefined, isAdmin: false })
}));
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ push: () => {} })
}));
vi.mock("@/lib/sc", () => ({
  transfer: vi.fn(async () => {}),
  acceptTransfer: vi.fn(async () => {}),
  rejectTransfer: vi.fn(async () => {}),
  getUserTransfers: vi.fn(async () => []),
  getTransfer: vi.fn(async () => {}),
  getUserTokens: vi.fn(async () => []),
  getTokenBalance: vi.fn(async () => 0n),
  listUsers: vi.fn(async () => []),
  getTokenView: vi.fn(async () => [1n, "0x0", "Token", "", 100n, "{}", 0n, 0n, 100n])
}));

describe("TransfersPage", () => {
  it("renders the transfers form UI", async () => {
    render(
      <I18nProvider>
        <TransfersPage />
      </I18nProvider>
    );
    expect(screen.getByText(/New transfer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create transfer/i })).toBeInTheDocument();
  });
});
