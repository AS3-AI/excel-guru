/**
 * Point mode and coloured references (T18): pure helpers over the engine's tokenizer, unit-tested in
 * refs.test.ts. References are always found from tokens, never by pattern-matching the text.
 */
import { tokenize, TokenizeError, type Token } from "@excel-guru/engine";

/** A reference in a formula: [start, end) offsets into it and the text as typed. */
export type RefSpan = { start: number; end: number; text: string };
export type Span = { start: number; end: number };
/** A draft after an insertion, with the inserted reference's span. */
export type Inserted = { draft: string; start: number; end: number };

/** How many reference colours grid.css defines (.eg-ref-0 … .eg-ref-5). */
export const REF_COLOURS = 6;

/**
 * Tokens of `src`, or of its longest prefix that tokenizes: a half-typed formula (an open string,
 * a stray "#") still shows the references before the problem.
 */
function tokensOf(src: string): Token[] {
  for (let end = src.length; ; ) {
    try {
      return tokenize(src.slice(0, end));
    } catch (e) {
      if (!(e instanceof TokenizeError) || e.pos >= end) throw e;
      end = e.pos;
    }
  }
}

/** Source length of a token whose text is the same length as its value (refs, numbers, names). */
const endOf = (t: Token) => t.pos + t.value.length;
const isRowNumber = (t: Token | undefined): boolean => t?.type === "NUM" && /^\d+$/.test(t.value);

/** Every cell, range, whole-column and whole-row reference in a formula, in order. */
export function findRefs(formula: string): RefSpan[] {
  if (!formula.startsWith("=")) return [];
  const toks = tokensOf(formula);
  const out: RefSpan[] = [];
  const push = (a: Token, b: Token) => out.push({ start: a.pos, end: endOf(b), text: formula.slice(a.pos, endOf(b)) });
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!, colon = toks[i + 1], end = toks[i + 2];
    if (t.type === "REF") {
      if (colon?.type === "COLON" && end?.type === "REF") {
        push(t, end);
        i += 2;
      } else if (/^\$?\d+$/.test(t.value) && colon?.type === "COLON" && end?.type === "NUM" && isRowNumber(end)) {
        push(t, end);
        i += 2;
      } else push(t, t);
    } else if (t.type === "NUM" && isRowNumber(t) && colon?.type === "COLON" && end && ((end.type === "NUM" && isRowNumber(end)) || (end.type === "REF" && /^\$?\d+$/.test(end.value)))) {
      push(t, end); // a whole row, 3:3
      i += 2;
    }
  }
  return out;
}

/** A colour index (0 … REF_COLOURS-1) per reference; the same range (ignoring case and $) shares one. */
export function refColours(refs: RefSpan[]): number[] {
  const seen = new Map<string, number>();
  return refs.map(({ text }) => {
    const key = text.replace(/[\s$]/g, "").toUpperCase();
    if (!seen.has(key)) seen.set(key, seen.size % REF_COLOURS);
    return seen.get(key)!;
  });
}

const OPERATOR_CHARS = "+-*/^&=<>";

/** The caret isn't in front of an operand: only spaces, then the end, ")", "," or an operator. */
function freeAfter(draft: string, caret: number): boolean {
  const next = draft.slice(caret).trimStart()[0];
  return next === undefined || next === ")" || next === "," || OPERATOR_CHARS.includes(next);
}

/** Tokens before the caret, or null if that part doesn't tokenize (e.g. inside a string). */
function tokensBefore(draft: string, caret: number): Token[] | null {
  try {
    return tokenize(draft.slice(0, caret));
  } catch {
    return null;
  }
}

const isTrigger = (t: Token | undefined) =>
  t === undefined || t.type === "LPAREN" || t.type === "COMMA" || (t.type === "OP" && t.value !== "%");

/**
 * Point mode: the caret is in a formula right after "=", "(", "," or an operator (spaces allowed),
 * so an arrow key or a click on the grid inserts a reference there.
 */
export function canPoint(draft: string, caret: number): boolean {
  if (!draft.startsWith("=") || caret < 1) return false;
  const toks = tokensBefore(draft, caret);
  return toks !== null && isTrigger(toks[toks.length - 1]) && freeAfter(draft, caret);
}

/** Puts `text` at the caret, or in place of the last reference point mode inserted. */
export function insertRef(draft: string, last: Span | null, caret: number, text: string): Inserted {
  const start = last ? last.start : caret;
  const end = last ? last.end : caret;
  return { draft: draft.slice(0, start) + text + draft.slice(end), start, end: start + text.length };
}

function colNumber(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * Whether an arrow key points rather than moving the caret: Excel's Enter mode. Only while the
 * learner is entering (`entering`: the last change was typed text or a pointed reference, not a
 * click in the input or a caret move), and only where point mode applies: right after the last
 * pointed reference, or at a trigger (canPoint).
 */
export function arrowPoints(draft: string, caret: number, entering: boolean, last: Span | null): boolean {
  if (!entering) return false;
  return (last !== null && last.end === caret) || canPoint(draft, caret);
}

/** Space after a point-mode row number or column letter completes its whole-line reference. */
export function wholeLineRef(draft: string, caret: number, size: { rows: number; cols: number }): Inserted | null {
  if (!draft.startsWith("=") || !freeAfter(draft, caret)) return null;
  const toks = tokensBefore(draft, caret);
  const last = toks?.[toks.length - 1];
  if (!toks || !last || endOf(last) !== caret) return null;
  if (!isTrigger(toks[toks.length - 2])) return null;
  if (last.type === "NAME" && /^[A-Z]{1,3}$/.test(last.value)) {
    if (colNumber(last.value) > size.cols) return null;
    return insertRef(draft, { start: last.pos, end: caret }, caret, `${last.value}:${last.value}`);
  }
  const trigger = toks[toks.length - 2];
  if (isRowNumber(last) && (trigger === undefined || trigger.type === "LPAREN" || trigger.type === "COMMA") && Number(last.value) > 0 && Number(last.value) <= size.rows)
    return insertRef(draft, { start: last.pos, end: caret }, caret, `${last.value}:${last.value}`);
  return null;
}
