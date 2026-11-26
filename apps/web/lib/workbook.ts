import ExcelJS from "exceljs";
import type { FormulaStep, Lesson, GridValue, Step } from "@excel-guru/grader";

export function practiceSheetName(stepNumber: number, label = ""): string {
  const safeLabel = [...label.replace(/[\\/*?:[\]]/g, "")]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("");
  const prefix = `Step ${stepNumber}`;
  return `${prefix}${safeLabel ? ` ${safeLabel}` : ""}`.slice(0, 31);
}

export function stripPromptMarkup(prompt: string): string {
  return prompt
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/==(.*?)==/gs, "$1")
    .replace(/\[\[(.*?)\]\]/gs, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "");
}

function isFormulaStep(step: Step): step is FormulaStep {
  return step.type === "formula";
}

function addGridValue(cell: ExcelJS.Cell, value: GridValue): void {
  if (typeof value === "string" && value.startsWith("=")) {
    cell.value = { formula: value.slice(1) };
  } else {
    cell.value = value;
  }
}

export async function buildPracticeWorkbook(lesson: Lesson): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const formulaSteps = lesson.steps.filter(isFormulaStep);
  if (formulaSteps.length === 0) {
    workbook.addWorksheet("About").getCell("A1").value = "Practice workbook";
  } else {
    formulaSteps.forEach((step, index) => {
      const worksheet = workbook.addWorksheet(practiceSheetName(index + 1));
      step.grid.forEach((row, rowIndex) =>
        row.forEach((value, columnIndex) => {
          addGridValue(worksheet.getCell(rowIndex + 1, columnIndex + 1), value);
        }),
      );
      const promptRow = step.grid.length + 2;
      worksheet.mergeCells(
        promptRow,
        1,
        promptRow,
        Math.max(1, ...step.grid.map((row) => row.length)),
      );
      worksheet.getCell(promptRow, 1).value = `Prompt: ${stripPromptMarkup(step.prompt)}`;
      worksheet.getCell(promptRow, 1).alignment = { wrapText: true, vertical: "top" };
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
