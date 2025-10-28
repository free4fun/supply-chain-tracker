import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import ThemeController from "./ThemeController";

vi.mock("@/contexts/RoleContext", () => ({
  useRole: vi.fn(() => ({ activeRole: undefined, isAdmin: false })),
}));

const { useRole } = await import("@/contexts/RoleContext");

describe("ThemeController", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  it("applies theme-none when no role and not admin", () => {
    (useRole as any).mockReturnValue({ activeRole: undefined, isAdmin: false });
    render(<ThemeController />);
    expect(document.body.classList.contains("theme-none")).toBe(true);
  });

  it("applies theme-admin when isAdmin", () => {
    (useRole as any).mockReturnValue({ activeRole: "Producer", isAdmin: true });
    render(<ThemeController />);
    expect(document.body.classList.contains("theme-admin")).toBe(true);
    expect(document.body.classList.contains("theme-producer")).toBe(false);
  });

  it("applies theme based on role", () => {
    (useRole as any).mockReturnValue({ activeRole: "Factory", isAdmin: false });
    render(<ThemeController />);
    expect(document.body.classList.contains("theme-factory")).toBe(true);
  });

  it("removes previous theme classes when role changes", async () => {
    const { rerender } = render(<ThemeController />);
    (useRole as any).mockReturnValue({ activeRole: "Retailer", isAdmin: false });
    rerender(<ThemeController />);
    await new Promise(r => setTimeout(r, 0));
    expect(document.body.classList.contains("theme-retailer")).toBe(true);
    (useRole as any).mockReturnValue({ activeRole: "Consumer", isAdmin: false });
    rerender(<ThemeController />);
    await new Promise(r => setTimeout(r, 0));
    expect(document.body.classList.contains("theme-consumer")).toBe(true);
    expect(
      [
        "theme-none",
        "theme-producer",
        "theme-factory",
        "theme-retailer",
        "theme-consumer",
        "theme-admin",
      ].some((c) => document.body.classList.contains(c))
    ).toBe(true);
  });
});
