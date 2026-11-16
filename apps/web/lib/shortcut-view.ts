type GridLiteral = string | number | boolean | null;
type PostconditionView = { selection?: string; grid?: GridLiteral[][]; format?: Record<string, string[]> };
type ShortcutViewInput = { activeCell?: string; grid?: GridLiteral[][]; postcondition?: PostconditionView };

export type ShortcutView = { grid: GridLiteral[][]; activeCell: string; selection: string; format?: Record<string, string[]> };

/** Select the worksheet data and range shown by a shortcut step at each stage. */
export function shortcutView(step: ShortcutViewInput, showPostcondition: boolean): ShortcutView | null {
  const grid = showPostcondition ? step.postcondition?.grid ?? step.grid : step.grid;
  if (!grid) return null;

  const initialCell = step.activeCell ?? "A1";
  const selection = showPostcondition ? step.postcondition?.selection ?? initialCell : initialCell;
  const firstCell = selection.split(":", 1)[0] || initialCell;

  return {
    grid,
    activeCell: firstCell,
    selection,
    ...(showPostcondition && step.postcondition?.format ? { format: step.postcondition.format } : {}),
  };
}
