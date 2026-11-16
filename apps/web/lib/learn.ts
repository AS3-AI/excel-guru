import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type LearnArticle = {
  slug: string;
  fn: string;
  title: string;
  description: string;
  syntax: string;
  args: { name: string; required: boolean; text: string }[];
  sections: { heading: string; text: string; grid?: (string | number | boolean | null)[][]; formula?: string; result?: string | number | boolean | null }[];
  lessonId: string;
  related: string[];
};

// The web workspace runs from apps/web both in tests and at build time. Keeping this
// path scoped lets Next trace only the content directory (also included by next.config).
const LEARN_DIR = join(process.cwd(), "../../content/learn");

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function getArticles(): LearnArticle[] {
  return readdirSync(LEARN_DIR).filter((file) => /^[a-z0-9][a-z0-9-]*\.json$/.test(file))
    .filter((file) => statSync(join(LEARN_DIR, file)).isFile())
    .sort().map((file) => JSON.parse(readFileSync(join(LEARN_DIR, file), "utf8")) as LearnArticle);
}

export function getArticle(slug: string): LearnArticle | null {
  if (!SLUG_RE.test(slug)) return null;
  const file = join(LEARN_DIR, `${slug}.json`);
  return existsSync(file) && statSync(file).isFile()
    ? JSON.parse(readFileSync(file, "utf8")) as LearnArticle
    : null;
}
