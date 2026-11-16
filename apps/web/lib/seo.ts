import type { Metadata, MetadataRoute } from "next";

export const SITE_NAME = "Excel Guru";
export const DEFAULT_TAGLINE = "Learn Excel by typing real formulas";

export const STATIC_METADATA = {
  landing: {
    title: `${SITE_NAME} — ${DEFAULT_TAGLINE}`,
    description:
      "Interactive spreadsheet lessons in your browser with instant grading and AI explanations. Master 80+ Excel lessons from SUM to dynamic arrays.",
  },
  pricing: {
    title: "Pricing & Plans",
    description:
      "Unlock all 80+ interactive Excel lessons. Choose monthly or annual billing.",
  },
  help: {
    title: "Help & FAQ",
    description:
      "Find answers to frequently asked questions about lessons, spreadsheet formulas, keyboard shortcuts, billing, and your account.",
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "Learn how Excel Guru handles and protects your data, including Supabase authentication, Razorpay and Stripe payments, Gemini AI, and analytics.",
  },
  terms: {
    title: "Terms of Service",
    description:
      "Terms and conditions for using Excel Guru interactive spreadsheet lessons, subscriptions, and AI explanations.",
  },
  dashboard: {
    title: "Learning Dashboard",
    description:
      "Track your completed Excel lessons, daily streak, points, and next recommended interactive lesson.",
  },
  login: {
    title: "Log in",
    description:
      "Log in to your Excel Guru account to continue your interactive spreadsheet lessons.",
  },
  signup: {
    title: "Sign up",
    description:
      "Create your free Excel Guru account to track your progress and learn Excel with real formulas.",
  },
  onboarding: {
    title: "Finish your profile",
    description: "Complete your Excel Guru learner profile.",
  },
} as const;

export function siteUrl(path = "", customBase?: string): string {
  const rawBase = customBase ?? (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  const base = rawBase.replace(/\/+$/, "");
  if (!path) return base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function pageTitle(prefix?: string): string {
  if (!prefix || prefix.trim() === "") {
    return `${SITE_NAME} — ${DEFAULT_TAGLINE}`;
  }
  return `${prefix.trim()} — ${SITE_NAME}`;
}

export type PageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  baseUrl?: string;
  noIndex?: boolean;
};

export function buildMetadata(options: PageMetadataOptions): Metadata {
  const fullTitle = pageTitle(options.title === STATIC_METADATA.landing.title ? "" : options.title);
  const url = options.path ? siteUrl(options.path, options.baseUrl) : undefined;
  const meta: Metadata = {
    title: fullTitle,
    description: options.description,
    openGraph: {
      title: fullTitle,
      description: options.description,
      ...(url ? { url } : {}),
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
    },
  };
  if (url) {
    meta.alternates = { canonical: url };
  }
  if (options.noIndex) {
    meta.robots = { index: false, follow: false };
  }
  return meta;
}

export function lessonMetadata(
  lesson: { id?: string; title: string; module: string } | null,
  baseUrl?: string,
): Metadata {
  if (!lesson) {
    return {
      title: pageTitle("Lesson not found"),
      description: "The requested Excel lesson could not be found.",
      robots: { index: false, follow: false },
    };
  }
  return buildMetadata({
    title: lesson.title,
    description: `Practice ${lesson.title} in Excel with interactive browser-based spreadsheet exercises, real-time formula evaluation, and instant grading.`,
    path: lesson.id ? `/lesson/${lesson.id}` : undefined,
    baseUrl,
  });
}

export function moduleMetadata(
  module: { slug: string; title: string; total: number } | null,
  baseUrl?: string,
): Metadata {
  if (!module) {
    return {
      title: pageTitle("Module not found"),
      description: "The requested Excel module could not be found.",
      robots: { index: false, follow: false },
    };
  }
  return buildMetadata({
    title: `${module.title} Excel Lessons`,
    description: `Master Excel ${module.title} functions and techniques with ${module.total} interactive hands-on lessons with real spreadsheet practice.`,
    path: `/modules/${module.slug}`,
    baseUrl,
  });
}

export type BuildSitemapInput = {
  baseUrl: string;
  learnSlugs?: readonly string[];
  articles?: readonly { slug: string }[];
  order?: readonly string[];
  modules?: readonly { slug: string }[];
  now?: Date;
};

export function buildSitemap(input: BuildSitemapInput): MetadataRoute.Sitemap {
  const lastModified = input.now ?? new Date();
  const learnSlugs = input.learnSlugs ?? input.articles?.map((a) => a.slug) ?? [];
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl("/", input.baseUrl),
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: siteUrl("/pricing", input.baseUrl),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: siteUrl("/learn", input.baseUrl),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  for (const slug of learnSlugs) {
    entries.push({
      url: siteUrl(`/learn/${slug}`, input.baseUrl),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  entries.push(
    {
      url: siteUrl("/privacy", input.baseUrl),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: siteUrl("/terms", input.baseUrl),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: siteUrl("/help", input.baseUrl),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: siteUrl("/lesson/intro", input.baseUrl),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  );

  return entries;
}

export function buildRobots(input: { baseUrl: string }): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/profile",
        "/admin",
        "/onboarding",
        "/review",
      ],
    },
    sitemap: siteUrl("/sitemap.xml", input.baseUrl),
  };
}
