import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContent } from "./validate-content";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");
const fixture = (name: string) => join(FIXTURES, name);
const lessonFile = (name: string, rel: string) => join(fixture(name), "lessons", rel);
const orderFile = (name: string) => join(fixture(name), "order.json");

/** All errors reported for one file in one fixture. */
function errorsFor(name: string, file: string): string[] {
  const results = validateContent(fixture(name));
  return results.find((r) => r.file === file)?.errors ?? [];
}

/** Every reported error must name its file, so CI output is self-explanatory. */
function expectEveryErrorNamesItsFile(name: string) {
  const results = validateContent(fixture(name));
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    expect(r.errors.length).toBeGreaterThan(0);
    for (const e of r.errors) expect(e).toContain(r.file);
  }
}

describe("validateContent: valid content", () => {
  it("accepts a valid lesson set (formula, select in all four shapes, shortcuts, mcq, info)", () => {
    expect(validateContent(fixture("valid"))).toEqual([]);
  });
});

describe("validateContent: file name and folder", () => {
  it("rejects a lesson whose id differs from its file name", () => {
    const file = lessonFile("id-mismatch", "count/count-1.json");
    const errors = errorsFor("id-mismatch", file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/id "count-2" must match the file name "count-1"/);
    expectEveryErrorNamesItsFile("id-mismatch");
  });

  it("rejects a lesson whose module differs from its folder", () => {
    const file = lessonFile("module-mismatch", "count/count-1.json");
    const errors = errorsFor("module-mismatch", file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/module "sum" must match the folder name "count"/);
    expectEveryErrorNamesItsFile("module-mismatch");
  });

  it("rejects a file that is not valid JSON", () => {
    const file = lessonFile("invalid-json", "count/count-1.json");
    const errors = errorsFor("invalid-json", file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/not valid JSON/);
    expect(errors[0]).toContain(file);
  });
});

describe("validateContent: formula solutions", () => {
  it("rejects a solution that does not evaluate to expectedValue", () => {
    const errors = errorsFor("formula-wrong-value", lessonFile("formula-wrong-value", "count/count-1.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/step "f1": solution "=COUNT\(B2:B4\)" is not graded correct \(wrong_value; expected 3\)/);
    expectEveryErrorNamesItsFile("formula-wrong-value");
  });

  it("rejects a solution that skips a mustUse function", () => {
    const errors = errorsFor("formula-missing-function", lessonFile("formula-missing-function", "count/count-1.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/step "f1": solution "=B2\/6" is not graded correct \(missing_function; mustUse COUNT\)/);
    expectEveryErrorNamesItsFile("formula-missing-function");
  });

  it("rejects a solution that does not parse", () => {
    const errors = errorsFor("formula-parse-error", lessonFile("formula-parse-error", "count/count-1.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/step "f1": solution "=COUNT\(B2:B4" is not graded correct \(parse_error\)/);
  });
});

describe("validateContent: select targets", () => {
  it("rejects every target outside the grid, for cells, ranges, columns and rows", () => {
    const file = lessonFile("select-outside", "sel/sel-1.json");
    const errors = errorsFor("select-outside", file);
    const byStep = (id: string) => errors.filter((e) => e.includes(`step "${id}"`));
    // Grid is 4 rows x 3 columns (A1:C4).
    expect(byStep("c1")[0]).toMatch(/target "D2" is outside the grid \(A1:C4\)/);
    expect(byStep("c2")[0]).toMatch(/target "B5" is outside the grid \(A1:C4\)/);
    expect(byStep("r1")[0]).toMatch(/target "B2:D4" is outside the grid/);
    expect(byStep("r2")[0]).toMatch(/target "A1:C5" is outside the grid/);
    expect(byStep("col")[0]).toMatch(/target "D:D" is outside the grid/);
    expect(byStep("row")[0]).toMatch(/target "5:5" is outside the grid/);
    expect(byStep("bad")[0]).toMatch(/target "B2:" is not a cell, range, column or row/);
    expect(byStep("ok")).toEqual([]);
    expect(errors).toHaveLength(7);
    expectEveryErrorNamesItsFile("select-outside");
  });
});

describe("validateContent: browser-reserved shortcuts", () => {
  it("rejects reserved Ctrl combos on win (W, T, N, Q, Tab, any case, with extra modifiers, in sequences)", () => {
    const errors = errorsFor("reserved-win", lessonFile("reserved-win", "keys/keys-1.json"));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/step "w": win shortcut "Ctrl\+W" uses a browser-reserved combo/),
        expect.stringMatching(/step "t": win shortcut "Ctrl\+Shift\+T" uses a browser-reserved combo/),
        expect.stringMatching(/step "n": win shortcut "Ctrl\+n" uses a browser-reserved combo/),
        expect.stringMatching(/step "q": win shortcut "Ctrl\+Q" uses a browser-reserved combo/),
        expect.stringMatching(/step "tab": win shortcut "Ctrl\+Tab" uses a browser-reserved combo/),
        expect.stringMatching(/step "sq": win shortcut "Ctrl\+W" uses a browser-reserved combo/),
      ]),
    );
    expect(errors).toHaveLength(6);
    expect(errors.some((e) => e.includes('step "ok"'))).toBe(false);
    expectEveryErrorNamesItsFile("reserved-win");
  });

  it("rejects reserved Cmd combos on mac", () => {
    const errors = errorsFor("reserved-mac", lessonFile("reserved-mac", "keys/keys-1.json"));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/step "w": mac shortcut "Cmd\+W" uses a browser-reserved combo/),
        expect.stringMatching(/step "t": mac shortcut "Cmd\+T" uses a browser-reserved combo/),
        expect.stringMatching(/step "n": mac shortcut "Cmd\+Shift\+N" uses a browser-reserved combo/),
        expect.stringMatching(/step "q": mac shortcut "Cmd\+Q" uses a browser-reserved combo/),
        expect.stringMatching(/step "tab": mac shortcut "Cmd\+Tab" uses a browser-reserved combo/),
        expect.stringMatching(/step "sq": mac shortcut "Cmd\+Q" uses a browser-reserved combo/),
      ]),
    );
    expect(errors).toHaveLength(6);
    expectEveryErrorNamesItsFile("reserved-mac");
  });
});

describe("validateContent: step ids and gradable steps", () => {
  it("rejects duplicate step ids within a lesson", () => {
    const errors = errorsFor("duplicate-step-ids", lessonFile("duplicate-step-ids", "count/count-1.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/step "s1": id is used by more than one step/);
    expectEveryErrorNamesItsFile("duplicate-step-ids");
  });

  it("rejects a lesson with fewer gradable steps than requiredCorrect", () => {
    const errors = errorsFor("too-few-gradable", lessonFile("too-few-gradable", "count/count-1.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/requiredCorrect is 2 but the lesson has only 1 gradable step \(non-info\)/);
    expectEveryErrorNamesItsFile("too-few-gradable");
  });
});

describe("validateContent: order.json", () => {
  it("rejects a lesson that order.json does not list", () => {
    const errors = errorsFor("order-missing-id", lessonFile("order-missing-id", "count/count-2.json"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lesson "count-2" is not listed in .*order\.json/);
    expectEveryErrorNamesItsFile("order-missing-id");
  });

  it("rejects a lesson id listed more than once", () => {
    const errors = errorsFor("order-duplicate", orderFile("order-duplicate"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lesson "count-1" is listed 2 times/);
    expectEveryErrorNamesItsFile("order-duplicate");
  });

  it("rejects an order entry with no lesson file", () => {
    const errors = errorsFor("order-names-missing", orderFile("order-names-missing"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/names lesson "ghost" but no lessons\/<module>\/ghost\.json exists/);
    expectEveryErrorNamesItsFile("order-names-missing");
  });

  it("rejects two lesson files with the same id", () => {
    const results = validateContent(fixture("duplicate-lesson-id"));
    expect(results).toHaveLength(1);
    expect(results[0]!.file).toBe(lessonFile("duplicate-lesson-id", "sum/count-1.json"));
    expect(results[0]!.errors).toEqual([
      expect.stringMatching(/lesson id "count-1" is also used by .*lessons\/count\/count-1\.json/),
    ]);
    expectEveryErrorNamesItsFile("duplicate-lesson-id");
  });

  it("reports a missing order.json", () => {
    const results = validateContent(fixture("no-order"));
    expect(results).toHaveLength(1);
    expect(results[0]!.file).toBe(orderFile("no-order"));
    expect(results[0]!.errors[0]).toMatch(/order\.json is missing/);
  });
});
