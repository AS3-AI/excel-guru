import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript (main: src/index.ts).
  transpilePackages: ["@excel-guru/engine", "@excel-guru/grader", "@excel-guru/payments"],
  // Lesson pages read content/ (repo root) at request time; trace from the monorepo root and ship it.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: { "/**": ["../../content/**/*"] },
};

export default nextConfig;
