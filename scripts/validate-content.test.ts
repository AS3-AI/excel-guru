import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

  it("accepts the repository's learning articles", () => {
    expect(validateContent(join(fileURLToPath(new URL("..", import.meta.url)), "content"))).toEqual([]);
  });

  it("validates article shape, lesson links, related links and evaluated examples", () => {
    const dir = mkdtempSync(join(tmpdir(), "excel-guru-content-"));
    try {
      mkdirSync(join(dir, "lessons"));
      mkdirSync(join(dir, "learn"));
      writeFileSync(join(dir, "order.json"), "[]");
      const base = {
        slug: "sum", fn: "SUM", title: "SUM guide", description: "A guide", syntax: "=SUM(number1)",
        args: [{ name: "number1", required: true, text: "Numbers to add." }],
        sections: [{ heading: "Example", text: "Add these values.", grid: [[1, 2], [null, 0]], formula: "=SUM(A1:B1)", result: 3 }],
        lessonId: "missing", related: ["absent"],
      };
      writeFileSync(join(dir, "learn", "sum.json"), JSON.stringify(base));
      const errors = validateContent(dir).flatMap((entry) => entry.errors);
      expect(errors.some((error) => error.includes("lessonId \"missing\" does not exist"))).toBe(true);
      expect(errors.some((error) => error.includes("related slug \"absent\" does not exist"))).toBe(true);
      const bad = { ...base, description: "x".repeat(161), sections: [{ ...base.sections[0], result: 4 }] };
      writeFileSync(join(dir, "learn", "sum.json"), JSON.stringify(bad));
      const badErrors = validateContent(dir).flatMap((entry) => entry.errors);
      expect(badErrors.some((error) => error.includes("description must be 160 characters or fewer"))).toBe(true);
      expect(badErrors.some((error) => error.includes("does not evaluate to result"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid article fields and formula grids", () => {
    const dir = mkdtempSync(join(tmpdir(), "excel-guru-article-") );
    try {
      mkdirSync(join(dir, "lessons"));
      mkdirSync(join(dir, "learn"));
      writeFileSync(join(dir, "order.json"), "[]");
      const article = {
        slug: "sum", fn: "SUM", title: "SUM guide", description: "A guide", syntax: "=SUM(number1)",
        args: [], sections: [{ heading: "Example", text: "Add values.", grid: [[1, null]], formula: "=SUM(A1:A1)", result: 1 }],
        lessonId: "unused", related: [],
      };
      const write = (value: unknown, filename = "sum.json") => writeFileSync(join(dir, "learn", filename), JSON.stringify(value));
      const messages = (value: unknown, filename = "sum.json") => {
        write(value, filename);
        return validateContent(dir).flatMap((entry) => entry.errors);
      };

      expect(messages({ ...article, sections: [{ ...article.sections[0], grid: Array.from({ length: 8 }, () => Array(9).fill(1)) }] })).toEqual(
        expect.arrayContaining([expect.stringMatching(/grid must be no larger than 8 rows by 7 columns/)]),
      );
      expect(messages({ ...article, sections: [{ heading: "Example", text: "Add values.", grid: [[1, null]], formula: "=SUM(A1:A1)" }] })).toEqual(
        expect.arrayContaining([expect.stringMatching(/formula and result must be provided together/)]),
      );
      expect(messages({ ...article, sections: [{ heading: "Example", text: "Add values.", grid: [[1, null]], result: 1 }] })).toEqual(
        expect.arrayContaining([expect.stringMatching(/formula and result must be provided together/)]),
      );
      expect(messages({ ...article, slug: "other" })).toEqual(
        expect.arrayContaining([expect.stringMatching(/slug "other" must match file name "sum"/)]),
      );
      const { title: _title, ...missingTitle } = article;
      expect(messages(missingTitle)).toEqual(expect.arrayContaining([expect.stringMatching(/title must be a non-empty string/)]));
      expect(messages({ ...article, unexpected: true })).toEqual(
        expect.arrayContaining([expect.stringMatching(/unknown field "unexpected"/)]),
      );
      for (const grid of [[[1]], [[1, null, null]]]) {
        expect(messages({ ...article, sections: [{ ...article.sections[0], grid }] })).toEqual(
          expect.arrayContaining([expect.stringMatching(/section 1: a grid with a formula needs exactly one empty cell for the result/)]),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
    expect(errors.filter((e) => e.includes("browser-reserved"))).toHaveLength(6);
    expect(errors.some((e) => e.includes('step "ok"'))).toBe(false);
    expectEveryErrorNamesItsFile("reserved-win");
  });

  it("rejects reserved Cmd combos on mac", () => {
    const errors = errorsFor("reserved-mac", lessonFile("reserved-mac", "keys/keys-1.json"));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/step "w": mac shortcut "Cmd\+W" uses a browser-reserved combo/),
        expect.stringMatching(/step "t": mac shortcut "Cmd\+T" uses a browser-reserved combo/),
        expect.stringMatching(/step "n": mac shortcut "Shift\+Cmd\+N" uses a browser-reserved combo/),
        expect.stringMatching(/step "q": mac shortcut "Cmd\+Q" uses a browser-reserved combo/),
        expect.stringMatching(/step "tab": mac shortcut "Cmd\+Tab" uses a browser-reserved combo/),
        expect.stringMatching(/step "sq": mac shortcut "Cmd\+Q" uses a browser-reserved combo/),
      ]),
    );
    expect(errors).toHaveLength(6);
    expectEveryErrorNamesItsFile("reserved-mac");
  });
});

describe("validateContent: shifted US shortcut symbols", () => {
  it("rejects a shifted symbol and suggests its unshifted key with Shift", () => {
    const file = lessonFile("shifted-symbol", "keys/keys-1.json");
    const errors = errorsFor("shifted-symbol", file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/win shortcut ":" uses shifted US symbol ":"; write "Shift\+;" instead/);
    expectEveryErrorNamesItsFile("shifted-symbol");
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

describe("validateContent: step types", () => {
  it("rejects unknown step types and shortcut modes, and does not count them as gradable", () => {
    const errors = errorsFor("unknown-type", lessonFile("unknown-type", "count/count-1.json"));
    expect(errors).toEqual([
      expect.stringMatching(
        /step "s1": unknown type "Formula" \(expected one of: formula, select, shortcut, mcq, picture, project, info\)/,
      ),
      expect.stringMatching(/step "s2": unknown type "bogus"/),
      expect.stringMatching(/step "s3": shortcut mode "hold" must be "chord" or "sequence"/),
      expect.stringMatching(/requiredCorrect is 2 but the lesson has only 1 gradable step/),
    ]);
    expectEveryErrorNamesItsFile("unknown-type");
  });
});

describe("validateContent: lesson and step shape", () => {
  it("rejects a lesson whose fields have the wrong shape", () => {
    const errors = errorsFor("lesson-shape", lessonFile("lesson-shape", "count/count-1.json"));
    expect(errors).toEqual([
      expect.stringMatching(/title must be a non-empty string/),
      expect.stringMatching(/difficulty must be 1, 2 or 3 \(got 4\)/),
      expect.stringMatching(/requiredCorrect must be a positive integer \(got 0\)/),
      expect.stringMatching(/isIntro must be a boolean \(got "no"\)/),
      expect.stringMatching(/video must be a string or null \(got 3\)/),
      expect.stringMatching(/steps must be a non-empty array/),
    ]);
    expectEveryErrorNamesItsFile("lesson-shape");
  });

  it("rejects JSON that is not a lesson object", () => {
    const errors = errorsFor("not-a-lesson", lessonFile("not-a-lesson", "count/count-1.json"));
    expect(errors).toEqual([expect.stringMatching(/not a lesson: expected a JSON object/)]);
  });

  it("rejects steps missing required fields, per step type, and bad optional fields", () => {
    const errors = errorsFor("step-shape", lessonFile("step-shape", "count/count-1.json"));
    const expected = [
      /step #1: missing id \(every step needs a non-empty string id\)/,
      /step "f1": grid must be an array of rows of strings, numbers, booleans or null/,
      /step "f1": targetCell "c2" must be an uppercase cell reference like "B2"/,
      /step "f1": expectedValue must be a number, string, boolean, null or \{ "error": "#DIV\/0!" \| .* \}/,
      /step "f1": solution must be a string/,
      /step "sel": prompt must be a non-empty string/,
      /step "sel": target must be a string/,
      /step "ch": keys\.win must be a string for a chord/,
      /step "ch": keys\.mac must be a string or null for a chord/,
      /step "sq": keys\.win must be a non-empty array of strings for a sequence/,
      /step "sq": keys\.mac must be a non-empty array of strings or null for a sequence/,
      /step "mc": answer 3 is not an index into options \(0\.\.1\)/,
      /step "pic": image must be a non-empty string/,
      /step "pic": accept must be a non-empty array of strings/,
      /step "proj": file must be a non-empty string/,
      /step "inf": text must be a non-empty string/,
      /step "opt": activeCell must be a string/,
      /step "opt": highlightCells must be an array of strings/,
      /step "opt": postcondition\.grid must be an array of rows/,
      /step "opt": mobileButtons must be an array of strings/,
      /step "opt": options must be a non-empty array of strings/,
      /step "opt": answer must be an integer \(got 1\.5\)/,
    ];
    expect(errors).toEqual(expected.map((re) => expect.stringMatching(re)));
    expect(errors.some((e) => e.includes("undefined"))).toBe(false);
    expectEveryErrorNamesItsFile("step-shape");
  });
});

describe("validateContent: stray files", () => {
  it("reports files and folders that are not lessons/<module>/<id>.json", () => {
    const results = validateContent(fixture("stray-files"));
    const files = (rel: string) => results.find((r) => r.file === join(fixture("stray-files"), "lessons", rel))?.errors;
    expect(files("top.json")).toEqual([expect.stringMatching(/lesson files must live in lessons\/<module>\/<id>\.json/)]);
    expect(files("m/sub")).toEqual([expect.stringMatching(/unexpected folder: lessons must sit directly in lessons\/<module>\//)]);
    expect(files("m/y.JSON")).toEqual([expect.stringMatching(/unexpected file: only <id>\.json lesson files belong/)]);
    expect(files("m/notes.txt")).toEqual([expect.stringMatching(/unexpected file/)]);
    expect(results).toHaveLength(4);
    expectEveryErrorNamesItsFile("stray-files");
  });
});

describe("validateContent: canonical shortcut keys", () => {
  it("treats ⌘ and ⌃ as Cmd and Ctrl when checking reserved combos", () => {
    const errors = errorsFor("reserved-symbols", lessonFile("reserved-symbols", "keys/keys-1.json"));
    const reserved = errors.filter((e) => e.includes("browser-reserved"));
    expect(reserved).toEqual([
      expect.stringMatching(/step "m1": mac shortcut "⌘\+W" uses a browser-reserved combo/),
      expect.stringMatching(/step "m2": mac shortcut "⌘W" uses a browser-reserved combo/),
      expect.stringMatching(/step "w1": win shortcut "⌃\+T" uses a browser-reserved combo/),
    ]);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/step "m1": mac shortcut "⌘\+W" is not canonical; write "Cmd\+W"/),
        expect.stringMatching(/step "m2": mac shortcut "⌘W" is not canonical; write "Cmd\+W"/),
        expect.stringMatching(/step "w1": win shortcut "⌃\+T" is not canonical; write "Ctrl\+T"/),
      ]),
    );
    expect(errors).toHaveLength(6);
    expect(errors.some((e) => e.includes('step "ok"'))).toBe(false);
  });

  it("requires modifiers Ctrl, Alt, Shift, Cmd in that order, then one key", () => {
    const errors = errorsFor("noncanonical-keys", lessonFile("noncanonical-keys", "keys/keys-1.json"));
    expect(errors).toEqual([
      expect.stringMatching(
        /step "order": win shortcut "Shift\+Ctrl\+C" is not canonical; write "Ctrl\+Shift\+C" \(modifiers Ctrl, Alt, Shift, Cmd in that order, then one key\)/,
      ),
      expect.stringMatching(/step "case": win shortcut "ctrl\+C" is not canonical; write "Ctrl\+C"/),
      expect.stringMatching(/step "letter": win shortcut "Ctrl\+c" is not canonical; write "Ctrl\+C"/),
      expect.stringMatching(/step "dup": win shortcut "Ctrl\+Ctrl\+C" is not canonical; write "Ctrl\+C"/),
      expect.stringMatching(/step "nokey": win shortcut "Ctrl\+Shift" has no key after its modifiers/),
      expect.stringMatching(/step "seq": win shortcut "alt" is not canonical; write "Alt"/),
      expect.stringMatching(/step "empty": win shortcut "Ctrl\+" is not canonical \(modifiers/),
    ]);
    expectEveryErrorNamesItsFile("noncanonical-keys");
  });
});

describe("validateContent: canonical select targets", () => {
  it("requires uppercase targets with the top-left corner first", () => {
    const errors = errorsFor("select-canonical", lessonFile("select-canonical", "sel/sel-1.json"));
    expect(errors).toEqual([
      expect.stringMatching(
        /step "lower": target "b2" is not canonical; write "B2" \(uppercase, top-left corner first, a single cell as one reference\)/,
      ),
      expect.stringMatching(/step "rev": target "B4:A1" is not canonical; write "A1:B4"/),
      expect.stringMatching(/step "diag": target "A4:C1" is not canonical; write "A1:C4"/),
      expect.stringMatching(/step "cols": target "C:A" is not canonical; write "A:C"/),
      expect.stringMatching(/step "rows": target "3:1" is not canonical; write "1:3"/),
      expect.stringMatching(/step "lcol": target "b:b" is not canonical; write "B:B"/),
      expect.stringMatching(/step "same": target "B2:B2" is not canonical; write "B2"/),
    ]);
    expectEveryErrorNamesItsFile("select-canonical");
  });
});

describe("validateContent: unknown field names", () => {
  it("accepts the SPEC §5 example lesson verbatim", () => {
    expect(validateContent(fixture("spec-example"))).toEqual([]);
  });

  it("rejects unknown lesson, step and nested fields, suggesting case/underscore variants", () => {
    const errors = errorsFor("unknown-fields", lessonFile("unknown-fields", "count/count-1.json"));
    expect(errors).toEqual([
      expect.stringMatching(/lesson: unknown field "requiredcorrect" \(did you mean "requiredCorrect"\?\)/),
      expect.stringMatching(/lesson: unknown field "notes"$/),
      expect.stringMatching(/step "f1": unknown field "mustuse" \(did you mean "mustUse"\?\)/),
      expect.stringMatching(/step "f2": unknown field "must_use" \(did you mean "mustUse"\?\)/),
      expect.stringMatching(/step "f3": unknown field "MustUse" \(did you mean "mustUse"\?\)/),
      expect.stringMatching(/step "s1": unknown field "highlight_cells" \(did you mean "highlightCells"\?\)/),
      expect.stringMatching(/step "s1": unknown field "ActiveCell" \(did you mean "activeCell"\?\)/),
      expect.stringMatching(/step "s1": unknown field "postcondition\.Selection" \(did you mean "postcondition\.selection"\?\)/),
      expect.stringMatching(/step "k1": unknown field "keys\.linux"$/),
      expect.stringMatching(/step "m1": unknown field "explain"$/),
      expect.stringMatching(/step "i1": unknown field "prompt"$/),
    ]);
    expectEveryErrorNamesItsFile("unknown-fields");
  });
});
