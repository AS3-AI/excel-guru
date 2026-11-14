import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript (main: src/index.ts).
  transpilePackages: ["@excel-guru/engine", "@excel-guru/grader"],
};

export default nextConfig;
