import { PLANS, formatPrice } from "./plans";

export type HelpItem = {
  q: string;
  a: string;
  tags?: string[];
};

export type HelpCategory = {
  category: string;
  id: string;
  items: HelpItem[];
};

export const HELP_SECTIONS: HelpCategory[] = [
  {
    category: "How Lessons Work",
    id: "lessons",
    items: [
      {
        q: "How do lessons and formula grading work?",
        a: "Lessons run in a real spreadsheet directly in your web browser. Type your formula starting with an equals sign (=) and press Enter or click Check to verify your calculation instantly. If you need assistance, click Show Answer to see the expected solution, or click Skip to move on to the next question.",
        tags: ["formula", "check", "show answer", "skip", "grading"],
      },
      {
        q: "How do keyboard shortcuts work on Mac vs Windows?",
        a: "Our simulator automatically detects your operating system and displays the appropriate shortcut keys (such as Cmd on macOS vs Ctrl on Windows). For shortcut lessons that are Windows-specific, Mac learners can use the on-screen skip bar.",
        tags: ["mac", "windows", "shortcuts", "keyboard"],
      },
      {
        q: "Do I need Microsoft Excel installed on my computer?",
        a: "No. All exercises run inside a browser-based spreadsheet simulator. You can practice on macOS, Windows, Linux, or mobile devices without installing any software or extensions.",
        tags: ["setup", "browser", "installation"],
      },
      {
        q: "Can I practice on a phone or tablet?",
        a: "Yes. The simulator adapts to mobile screens down to 375 px, including tap-to-insert buttons for syntax like parentheses and commas. For shortcut-focused modules, a physical keyboard provides the best experience.",
        tags: ["mobile", "phone", "responsive"],
      },
    ],
  },
  {
    category: "Free vs Premium & Billing",
    id: "plans-billing",
    items: [
      {
        q: "What is the difference between free and premium?",
        a: `You can try introductory lessons completely free without entering card details. Creating a free account saves your learning progress and streak. Upgrading to Premium gives unlimited access to all 80+ interactive lessons across our 15 curriculum modules, starting at ${formatPrice("INR", PLANS.INR.monthly)}/month or ${formatPrice("INR", PLANS.INR.annual)}/year.`,
        tags: ["free", "premium", "plans", "pricing"],
      },
      {
        q: "How do I cancel my subscription?",
        a: "You can cancel your subscription at any time: go to the Pricing page → Manage / cancel subscription. Your premium access will remain active through the end of your current paid billing period.",
        tags: ["cancel", "subscription", "manage"],
      },
      {
        q: "What is your refund policy?",
        a: "Cancel any time · full refund if unhappy. If you are not satisfied with Excel Guru for any reason, email us at [CONTACT EMAIL] for a full refund.",
        tags: ["refund", "guarantee", "cancel"],
      },
    ],
  },
  {
    category: "Account & Support",
    id: "account-support",
    items: [
      {
        q: "How is my lesson progress saved?",
        a: "When you are logged in, completed lessons, step attempts, accuracy scores, and streaks sync securely to your account. If you start lessons while signed out, your progress is kept in your browser and automatically merges when you sign in.",
        tags: ["progress", "sync", "save"],
      },
      {
        q: "Can I reset my progress to practice again from scratch?",
        a: "Yes. On your Dashboard, click 'Reset Progress' to clear your lesson checkmarks while keeping your lifetime points and streak intact.",
        tags: ["reset", "restart", "replay"],
      },
      {
        q: "How do I delete my account and personal data?",
        a: "To request full deletion of your account and personal data, send an email to [CONTACT EMAIL]. We will promptly delete your records.",
        tags: ["delete", "privacy", "account"],
      },
      {
        q: "How do I contact support?",
        a: "If you have questions, feedback, or need help with your account or billing, please email us at [CONTACT EMAIL].",
        tags: ["contact", "support", "email"],
      },
    ],
  },
];

export function getHelpCategories(): string[] {
  return HELP_SECTIONS.map((section) => section.category);
}

export function searchHelp(query: string): HelpItem[] {
  const trimmed = query.trim().toLowerCase();
  const allItems = HELP_SECTIONS.flatMap((section) => section.items);
  if (!trimmed) return allItems;

  return allItems.filter(
    (item) =>
      item.q.toLowerCase().includes(trimmed) ||
      item.a.toLowerCase().includes(trimmed) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(trimmed)),
  );
}
