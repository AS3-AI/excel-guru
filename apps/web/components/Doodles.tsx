// Hand-drawn line doodles (original artwork). Every path uses pathLength=1 so CSS can "draw" it in:
// .doodle path { stroke-dasharray: 1; stroke-dashoffset: 1 } → 0 when shown. Decorative only: aria-hidden.
import type { CSSProperties } from "react";

const ART = {
  // pencil writing a scribble
  pencil: { box: "0 0 160 120", paths: [
    "M104 14 L140 50 L74 116 L38 116 L38 80 Z",
    "M92 26 L128 62",
    "M38 80 L74 116",
    "M46 104 L50 108",
    "M8 112 C 20 96, 26 120, 34 104",
  ] },
  sparkle: { box: "0 0 48 48", paths: ["M24 4 C 26 18, 30 22, 44 24 C 30 26, 26 30, 24 44 C 22 30, 18 26, 4 24 C 18 22, 22 18, 24 4 Z"] },
  arrow: { box: "0 0 140 90", paths: [
    "M6 20 C 30 4, 58 6, 66 26 C 74 46, 48 58, 42 42 C 36 26, 70 18, 96 34 C 112 44, 120 60, 124 74",
    "M110 66 L124 76 L132 60",
  ] },
  bulb: { box: "0 0 80 100", paths: [
    "M40 10 C 18 10, 8 30, 16 46 C 22 58, 28 60, 28 72 L52 72 C 52 60, 58 58, 64 46 C 72 30, 62 10, 40 10 Z",
    "M30 80 L50 80",
    "M32 88 L48 88",
    "M34 40 C 36 50, 44 50, 46 40",
    "M40 50 L40 70",
    "M6 14 L0 8", "M74 14 L80 8", "M40 2 L40 -6",
  ] },
  trophy: { box: "0 0 100 100", paths: [
    "M28 12 L72 12 L70 44 C 68 60, 32 60, 30 44 Z",
    "M28 20 C 10 18, 10 42, 30 42",
    "M72 20 C 90 18, 90 42, 70 42",
    "M50 58 L50 74",
    "M34 88 L66 88 L62 74 L38 74 Z",
    "M44 26 L50 22 L50 40",
  ] },
  bubble: { box: "0 0 110 90", paths: [
    "M14 12 C 40 4, 80 4, 98 14 C 108 24, 106 50, 94 58 C 78 66, 52 64, 40 64 L20 82 L24 62 C 8 56, 4 24, 14 12 Z",
    "M46 26 C 46 16, 64 16, 64 28 C 64 36, 54 36, 54 44",
    "M54 52 L54 53",
  ] },
  squiggle: { box: "0 0 220 24", paths: ["M4 14 C 24 2, 34 24, 54 12 C 74 2, 84 24, 104 12 C 124 2, 134 24, 154 12 C 174 2, 184 24, 216 10"] },
  cells: { box: "0 0 120 90", paths: [
    "M6 8 C 40 6, 80 10, 114 6 L112 84 C 80 86, 40 82, 8 86 Z",
    "M6 30 C 40 28, 80 32, 114 28", "M7 56 C 40 54, 80 58, 113 54",
    "M44 8 C 42 30, 46 60, 44 84", "M80 8 C 78 30, 82 60, 80 84",
    "M54 40 L62 48 L74 34",
  ] },
  check: { box: "0 0 60 60", paths: ["M30 4 C 50 4, 56 20, 56 30 C 56 46, 44 56, 30 56 C 14 56, 4 44, 4 30 C 4 14, 16 4, 34 6", "M18 30 L27 40 L44 20"] },
} as const;

export type DoodleName = keyof typeof ART;

export function Doodle({ name, className, style, fill }: { name: DoodleName; className?: string; style?: CSSProperties; fill?: string }) {
  const art = ART[name];
  return (
    <svg className={`doodle doodle-${name}${className ? ` ${className}` : ""}`} viewBox={art.box} style={style} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" overflow="visible">
      {art.paths.map((d, i) => <path key={i} d={d} pathLength={1} fill={i === 0 && fill ? fill : undefined} style={{ "--d": i } as CSSProperties} />)}
    </svg>
  );
}
