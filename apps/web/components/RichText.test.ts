import { describe, expect, it } from "vitest";
import { parseRichText } from "./RichText";

describe("parseRichText", () => {
  it("keeps plain text", () =>
    expect(parseRichText("Hello world")).toEqual([{ type: "text", value: "Hello world" }]));
  it("parses bold", () =>
    expect(parseRichText("**SUM** total")).toEqual([
      { type: "bold", value: "SUM" },
      { type: "text", value: " total" },
    ]));
  it("parses inline code", () =>
    expect(parseRichText("Use `A1`")).toEqual([
      { type: "text", value: "Use " },
      { type: "code", value: "A1" },
    ]));
  it("parses both markups", () =>
    expect(parseRichText("**SUM** `A1`")).toEqual([
      { type: "bold", value: "SUM" },
      { type: "text", value: " " },
      { type: "code", value: "A1" },
    ]));
  it("lets code markers win inside bold", () =>
    expect(parseRichText("**a `b` c**")).toEqual([
      { type: "bold", value: "a " },
      { type: "code", value: "b" },
      { type: "bold", value: " c" },
    ]));
  it("keeps bold markers literal inside code", () =>
    expect(parseRichText("`**SUM**`")).toEqual([{ type: "code", value: "**SUM**" }]));
  it("keeps unmatched bold literal", () =>
    expect(parseRichText("before **open")).toEqual([{ type: "text", value: "before **open" }]));
  it("keeps unmatched backticks literal", () =>
    expect(parseRichText("before `open")).toEqual([{ type: "text", value: "before `open" }]));
  it("handles an empty string", () => expect(parseRichText("")).toEqual([]));
  it("parses adjacent bold markers", () =>
    expect(parseRichText("**one****two**")).toEqual([
      { type: "bold", value: "one" },
      { type: "bold", value: "two" },
    ]));
  it("keeps HTML-like characters as plain text", () =>
    expect(parseRichText("<b>&</b>")).toEqual([{ type: "text", value: "<b>&</b>" }]));
  it("parses multiple code chips", () =>
    expect(parseRichText("`A1` + `B1`")).toEqual([
      { type: "code", value: "A1" },
      { type: "text", value: " + " },
      { type: "code", value: "B1" },
    ]));
  it("coalesces adjacent plain text", () =>
    expect(parseRichText("a**b**c")).toEqual([
      { type: "text", value: "a" },
      { type: "bold", value: "b" },
      { type: "text", value: "c" },
    ]));
  it("treats empty markers literally", () =>
    expect(parseRichText("**** ``")).toEqual([{ type: "text", value: "**** ``" }]));
  it("allows markup to touch punctuation", () =>
    expect(parseRichText("(**SUM**),`A1`.")).toEqual([
      { type: "text", value: "(" },
      { type: "bold", value: "SUM" },
      { type: "text", value: ")," },
      { type: "code", value: "A1" },
      { type: "text", value: "." },
    ]));
  it("parses repeated code chips next to each other", () =>
    expect(parseRichText("`A1``B1`")).toEqual([
      { type: "code", value: "A1" },
      { type: "code", value: "B1" },
    ]));
  it("parses yellow highlights and keycaps", () =>
    expect(parseRichText("Click ==B2== and press [[Enter]]")).toEqual([
      { type: "text", value: "Click " },
      { type: "mark", value: "B2" },
      { type: "text", value: " and press " },
      { type: "kbd", value: "Enter" },
    ]));
  it("keeps highlight and keycap markers literal inside code", () =>
    expect(parseRichText("`==A1== [[Enter]]`")).toEqual([
      { type: "code", value: "==A1== [[Enter]]" },
    ]));
});
