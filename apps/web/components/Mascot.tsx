// "Cel", the lesson guide: an original doodle of a spreadsheet cell with a face. Purely decorative (aria-hidden);
// the speech bubble next to it carries the words. Moods are CSS-animated in globals.css (.mascot-*).
export type MascotMood = "idle" | "happy" | "oops" | "party";

const MOUTH: Record<MascotMood, string> = {
  idle: "M50 70 C 56 75, 64 75, 70 70",
  happy: "M46 66 C 52 80, 68 80, 74 66 Z",
  oops: "M48 74 C 52 70, 56 70, 60 74 C 64 78, 68 78, 72 74",
  party: "M44 64 C 50 84, 70 84, 76 64 Z",
};

export function Mascot({ mood = "idle", className }: { mood?: MascotMood; className?: string }) {
  return (
    <svg className={`mascot mascot-${mood}${className ? ` ${className}` : ""}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false" fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" overflow="visible">
      <ellipse className="mascot-shadow" cx="60" cy="112" rx="30" ry="4" fill="var(--ink)" stroke="none" opacity="0.15" />
      <g className="mascot-body">
        {/* arms: down when idle, up when happy/party */}
        <path className="mascot-arm mascot-arm-l" d="M22 66 C 12 72, 10 80, 14 88" />
        <path className="mascot-arm mascot-arm-r" d="M98 66 C 108 72, 110 80, 106 88" />
        {/* the cell */}
        <path d="M24 30 C 24 24, 28 20, 34 20 L 86 20 C 92 20, 96 24, 96 30 L 96 92 C 96 98, 92 102, 86 102 L 34 102 C 28 102, 24 98, 24 92 Z" fill="var(--surface)" />
        <path d="M24 38 L 96 38" />
        <text x="32" y="33" fill="var(--ink)" stroke="none" fontSize="12" fontFamily="var(--mono)" fontWeight="700">A1</text>
        <path d="M86 98 L 96 98 L 96 88" stroke="var(--primary)" strokeWidth={4} />
        {/* face */}
        <g className="mascot-eyes">
          <ellipse cx="46" cy="56" rx="5" ry="6" fill="var(--ink)" stroke="none" />
          <ellipse cx="74" cy="56" rx="5" ry="6" fill="var(--ink)" stroke="none" />
          <circle cx="48" cy="54" r="1.6" fill="#fff" stroke="none" />
          <circle cx="76" cy="54" r="1.6" fill="#fff" stroke="none" />
        </g>
        <ellipse cx="38" cy="68" rx="5" ry="3" fill="var(--rose)" stroke="none" />
        <ellipse cx="82" cy="68" rx="5" ry="3" fill="var(--rose)" stroke="none" />
        <path className="mascot-mouth" d={MOUTH[mood]} fill={mood === "happy" || mood === "party" ? "var(--ink)" : "none"} />
        {mood === "oops" && <path className="mascot-sweat" d="M100 34 C 96 42, 98 46, 102 46 C 106 46, 107 42, 100 34 Z" fill="var(--sky)" strokeWidth={2} />}
      </g>
      {(mood === "happy" || mood === "party") && (
        <g className="mascot-sparks" strokeWidth={2.5}>
          <path d="M10 22 L 10 32 M5 27 L 15 27" stroke="var(--primary)" />
          <path d="M108 14 L 108 24 M103 19 L 113 19" stroke="var(--warning)" />
          <path d="M112 50 L 116 54" stroke="var(--track-sql)" />
        </g>
      )}
    </svg>
  );
}
