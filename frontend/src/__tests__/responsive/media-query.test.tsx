import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "../../hooks/useMediaQuery";

describe("useMediaQuery", () => {
  it("subscribes, updates, and removes the same change listener", () => {
    let matches = false;
    let listener: (() => void) | undefined;
    const addEventListener = vi.fn((_type: string, next: () => void) => { listener = next; });
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ get matches() { return matches; }, addEventListener, removeEventListener })) });
    const view = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(view.result.current).toBe(false);
    matches = true;
    act(() => listener?.());
    expect(view.result.current).toBe(true);
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
