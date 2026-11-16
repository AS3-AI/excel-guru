import { describe, expect, it } from "vitest";
import { shortcutView } from "./shortcut-view";

describe("shortcutView", () => {
  const step = {
    activeCell: "B2",
    grid: [["Item", "Qty"], ["Pens", 12]],
    postcondition: {
      selection: "B2:C2",
      grid: [["Item", "Qty", "Total"], ["Pens", 12, 12]],
      format: { "B2:C2": ["bold", "center"] },
    },
  };

  it("before success: uses the step grid, selection = activeCell, no format", () => {
    expect(shortcutView(step, false)).toEqual({
      grid: step.grid,
      activeCell: "B2",
      selection: "B2",
    });
  });

  it("after success: uses postcondition.grid, postcondition.selection, postcondition.format", () => {
    expect(shortcutView(step, true)).toEqual({
      grid: step.postcondition.grid,
      activeCell: "B2",
      selection: "B2:C2",
      format: step.postcondition.format,
    });
  });

  it("after success with no postcondition.grid falls back to step grid", () => {
    const withoutPostGrid = {
      ...step,
      postcondition: {
        selection: "C3:D4",
        format: { "C3:D4": ["italic"] },
      },
    };
    expect(shortcutView(withoutPostGrid, true)).toEqual({
      grid: step.grid,
      activeCell: "C3",
      selection: "C3:D4",
      format: { "C3:D4": ["italic"] },
    });
  });

  it("handles only postcondition.grid (null before success, postcondition.grid after success)", () => {
    const onlyPostGrid = {
      activeCell: "B7",
      postcondition: { grid: [[1, 2]] },
    };
    expect(shortcutView(onlyPostGrid, false)).toBeNull();
    expect(shortcutView(onlyPostGrid, true)).toEqual({
      grid: [[1, 2]],
      activeCell: "B7",
      selection: "B7",
    });
  });

  it("handles no postcondition at all", () => {
    const noPost = {
      activeCell: "B2",
      grid: [["A", "B"]],
    };
    expect(shortcutView(noPost, false)).toEqual({
      grid: [["A", "B"]],
      activeCell: "B2",
      selection: "B2",
    });
    expect(shortcutView(noPost, true)).toEqual({
      grid: [["A", "B"]],
      activeCell: "B2",
      selection: "B2",
    });
  });

  it("returns null when there is no grid at all", () => {
    expect(shortcutView({}, false)).toBeNull();
    expect(shortcutView({}, true)).toBeNull();
    expect(shortcutView({ activeCell: "A1" }, false)).toBeNull();
    expect(shortcutView({ activeCell: "A1" }, true)).toBeNull();
    expect(shortcutView({ activeCell: "A1", postcondition: { selection: "B2" } }, false)).toBeNull();
    expect(shortcutView({ activeCell: "A1", postcondition: { selection: "B2" } }, true)).toBeNull();
  });
});
