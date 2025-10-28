import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Nav from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/contexts/RoleContext", () => ({
  useRole: () => ({
    activeRole: undefined,
    isApproved: false,
    isAdmin: false,
    company: "",
    firstName: "",
    lastName: "",
  }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    lang: "en",
    available: ["en", "es"],
    setLanguage: vi.fn(),
  }),
}));

describe("Nav dark mode toggle", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    localStorage.clear();
  });

  it("toggles dark class on documentElement and persists to localStorage", () => {
    render(<Nav />);
    const button = screen.getByRole("button", { name: /toggle dark mode/i });

    // initial: no dark
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // toggle to dark
    fireEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("color-scheme")).toBe("dark");

    // toggle back to light
    fireEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("color-scheme")).toBe("light");
  });
});
