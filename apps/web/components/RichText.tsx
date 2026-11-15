import type { ReactNode } from "react";

export type RichTextPart = { type: "text" | "bold" | "code"; value: string };

/** Parse the lesson's two supported markers without interpreting HTML. */
export function parseRichText(value: string): RichTextPart[] {
  const parts: RichTextPart[] = [];
  let buffer = "";
  let bold = false;
  const flush = (type: RichTextPart["type"] = bold ? "bold" : "text") => {
    if (buffer) parts.push({ type, value: buffer });
    buffer = "";
  };
  const hasClosingCode = (from: number) => value.indexOf("`", from) !== -1;
  const hasClosingBold = (from: number) => {
    let index = from;
    while (index < value.length) {
      if (value[index] === "`") {
        const close = value.indexOf("`", index + 1);
        if (close !== -1) { index = close + 1; continue; }
      }
      if (value.startsWith("**", index)) return index > from;
      index++;
    }
    return false;
  };

  for (let i = 0; i < value.length;) {
    if (value[i] === "`" && hasClosingCode(i + 1)) {
      const close = value.indexOf("`", i + 1);
      if (close > i + 1) {
        flush();
        parts.push({ type: "code", value: value.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    if (value.startsWith("**", i)) {
      if (bold || hasClosingBold(i + 2)) {
        flush();
        bold = !bold;
        i += 2;
        continue;
      }
    }
    buffer += value[i];
    i++;
  }
  flush();
  return parts;
}

export function RichText({ text }: { text: string }) {
  const nodes: ReactNode[] = parseRichText(text).map((part, index) => {
    if (part.type === "bold") return <strong key={index}>{part.value}</strong>;
    if (part.type === "code") return <code className="chip" key={index}>{part.value}</code>;
    return part.value;
  });
  return <>{nodes}</>;
}
