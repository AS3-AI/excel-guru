import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import type { Lesson } from "@excel-guru/grader";
import { buildPracticeWorkbook, practiceSheetName, stripPromptMarkup } from "./workbook";
import { isValidYouTubeVideoId } from "../components/VideoModal";

const lesson = (steps: Lesson["steps"] = []): Lesson => ({
  id: "sum-1",
  module: "sum",
  title: "Sum",
  difficulty: 1,
  requiredCorrect: 1,
  isIntro: false,
  video: null,
  steps,
});
const formulaStep = (overrides: Record<string, unknown> = {}) => ({
  id: "s1",
  type: "formula" as const,
  prompt: "Add **these** values with `=SUM(A1:A2)`",
  grid: [
    [2, 3],
    ["=A1+A2", null],
  ],
  targetCell: "C3",
  expectedValue: 5,
  solution: "=SUM(A1:A2)",
  ...overrides,
});
const loadWorkbook = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
};

describe("practice workbook", () => {
  it("accepts an 11 character YouTube id", () =>
    expect(isValidYouTubeVideoId("dQw4w9WgXcQ")).toBe(true));
  it("rejects short, long, and punctuation-containing video ids", () => {
    expect(isValidYouTubeVideoId("short")).toBe(false);
    expect(isValidYouTubeVideoId("dQw4w9WgXcQx")).toBe(false);
    expect(isValidYouTubeVideoId("dQw4w9WgX!Q")).toBe(false);
  });
  it("names formula sheets by step number", () => expect(practiceSheetName(2)).toBe("Step 2"));
  it("bounds and sanitizes Excel worksheet names", () => {
    expect(practiceSheetName(1, "a/b\\c?d*e[f]g:h")).toBe("Step 1 abcdefgh");
    expect(practiceSheetName(1, "abcdefghijklmnopqrstuvwxyz0123456789")).toHaveLength(31);
  });
  it("strips bold and code markup from prompts", () =>
    expect(stripPromptMarkup("Use **bold** and `code`.")).toBe("Use bold and code."));
  it("strips highlight and keycap markup from prompts", () =>
    expect(stripPromptMarkup("Click ==B2== and press [[Enter]].")).toBe(
      "Click B2 and press Enter.",
    ));
  it("strips unmatched markup markers as plain text", () =>
    expect(stripPromptMarkup("**unfinished and `code")).toBe("unfinished and code"));
  it("writes a worksheet for each formula step only", async () => {
    const buffer = await buildPracticeWorkbook(
      lesson([
        formulaStep(),
        { ...formulaStep({ id: "s2" }), id: "s2" },
        { id: "s3", type: "info", text: "Info" },
      ]),
    );
    const book = await loadWorkbook(buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Step 1", "Step 2"]);
  });
  it("writes grid values, formulas, and the stripped prompt below the grid", async () => {
    const buffer = await buildPracticeWorkbook(lesson([formulaStep()]));
    const book = await loadWorkbook(buffer);
    const sheet = book.worksheets[0]!;
    expect(sheet.getCell("A1").value).toBe(2);
    expect(sheet.getCell("B1").value).toBe(3);
    expect(sheet.getCell("A2").value).toEqual({ formula: "A1+A2", result: undefined });
    expect(sheet.getCell("B2").value).toBeNull();
    expect(sheet.getCell("A4").value).toBe("Prompt: Add these values with =SUM(A1:A2)");
  });
  it("preserves large numeric grid values", async () => {
    const buffer = await buildPracticeWorkbook(
      lesson([formulaStep({ grid: [[1234567890123, 9876543210123]], prompt: "Large values" })]),
    );
    const book = await loadWorkbook(buffer);
    expect(book.worksheets[0]!.getCell("A1").value).toBe(1234567890123);
    expect(book.worksheets[0]!.getCell("B1").value).toBe(9876543210123);
  });
  it("stores formula-like text only as a literal when it is not a grid formula", async () => {
    const buffer = await buildPracticeWorkbook(
      lesson([formulaStep({ grid: [["'=SUM(A1:A2)", "text =SUM(A1:A2)"]] })]),
    );
    const book = await loadWorkbook(buffer);
    expect(book.worksheets[0]!.getCell("A1").value).toBe("'=SUM(A1:A2)");
    expect(book.worksheets[0]!.getCell("B1").value).toBe("text =SUM(A1:A2)");
  });
  it("creates an About sheet for lessons without formula steps", async () => {
    const buffer = await buildPracticeWorkbook(lesson([{ id: "s", type: "info", text: "Hi" }]));
    const book = await loadWorkbook(buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["About"]);
  });
  it("handles empty grids and null cells", async () => {
    const buffer = await buildPracticeWorkbook(lesson([formulaStep({ grid: [[null, null]] })]));
    const book = await loadWorkbook(buffer);
    expect(book.worksheets[0]!.getCell("A1").value).toBeNull();
    expect(book.worksheets[0]!.getCell("B1").value).toBeNull();
  });
  it("does not put solutions or expected values in workbook XML", async () => {
    const steps = [
      formulaStep({ id: "one", solution: "=SECRET_ONE()", expectedValue: "LEAK_ONE" }),
      formulaStep({ id: "two", solution: "=SECRET_TWO()", expectedValue: 987654321 }),
    ];
    const buffer = await buildPracticeWorkbook(lesson(steps));
    const xml: string[] = [];
    for (let offset = 0; offset + 30 < buffer.length;) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
      const method = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const name = buffer.toString("utf8", nameStart, nameStart + nameLength);
      const contentStart = nameStart + nameLength + extraLength;
      const compressed = buffer.subarray(contentStart, contentStart + compressedSize);
      if (name.endsWith(".xml"))
        xml.push((method === 8 ? inflateRawSync(compressed) : compressed).toString("utf8"));
      offset = contentStart + compressedSize;
    }
    const xmlText = xml.join("\n");
    for (const secret of ["SECRET_ONE", "LEAK_ONE", "SECRET_TWO", "987654321"])
      expect(xmlText).not.toContain(secret);
  });
});
