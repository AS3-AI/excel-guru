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
    category: "Getting Started & Lessons",
    id: "getting-started",
    items: [
      {
        q: "Do I need Microsoft Excel installed on my computer?",
        a: "No. All lessons run inside a fast, lightweight spreadsheet simulator directly in your web browser. You can learn on macOS, Windows, Linux, or mobile devices without installing any software or extensions.",
        tags: ["setup", "browser", "installation"],
      },
      {
        q: "Which lessons can I try for free?",
        a: "You can try the introductory lesson immediately with no sign-up or credit card. Creating a free account unlocks a second lesson and saves your learning streak and points. Upgrading to Premium gives unlimited access to all 80+ curriculum lessons.",
        tags: ["free", "trial", "pricing"],
      },
      {
        q: "Do the formulas I learn work in Google Sheets?",
        a: "Yes. Almost all standard spreadsheet functions taught in our curriculum—including SUM, COUNT, IF, VLOOKUP, INDEX, MATCH, and dynamic array formulas—use the exact same syntax and arguments in Google Sheets.",
        tags: ["google sheets", "compatibility"],
      },
      {
        q: "What should I do if I get stuck on a step?",
        a: "If your answer isn't quite right, an inline hint will highlight the issue. After an incorrect attempt, you can click 'Show Answer' in the feedback drawer to see the correct formula, or view an instant AI-powered explanation tailored specifically to your attempt.",
        tags: ["hints", "show answer", "stuck"],
      },
    ],
  },
  {
    category: "Spreadsheet & Keyboard Shortcuts",
    id: "spreadsheet-shortcuts",
    items: [
      {
        q: "How do I type and check formulas?",
        a: "Formulas always start with an equals sign (=). Type your formula into the target cell or the formula bar above the grid, and press Enter (or click Check Answer) to submit. The engine verifies your formula calculation instantly.",
        tags: ["formula", "check", "grading"],
      },
      {
        q: "How do keyboard shortcuts work on Mac vs Windows?",
        a: "Our player automatically detects your operating system and displays the appropriate shortcut keys (e.g. Cmd on macOS vs Ctrl on Windows). For shortcut lessons that are Windows-specific, Mac learners can use the on-screen skip bar.",
        tags: ["mac", "windows", "shortcuts", "keyboard"],
      },
      {
        q: "Can I practice on a mobile phone or tablet?",
        a: "Yes. The grid adapts to smaller screens down to 375 px, and quick tap buttons appear for formula syntax like parentheses, commas, and colons. For shortcut-focused modules, a physical keyboard provides the best experience.",
        tags: ["mobile", "phone", "responsive", "ipad"],
      },
    ],
  },
  {
    category: "AI Explanations & Instant Feedback",
    id: "ai-feedback",
    items: [
      {
        q: "How do AI explanations work?",
        a: "When you submit an incorrect answer on a formula, select, or shortcut step, you can request an AI explanation. The explanation analyzes your specific input against the expected solution and explains where the discrepancy occurred in under 80 words.",
        tags: ["ai", "gemini", "hints", "explanations"],
      },
      {
        q: "How does rating an explanation help?",
        a: "Giving a thumbs up or thumbs down helps us maintain high-quality feedback. Explanations with positive ratings are cached to help future learners instantly, while poorly rated explanations are retired and regenerated.",
        tags: ["rating", "thumbs up", "feedback"],
      },
    ],
  },
  {
    category: "Subscriptions & Billing",
    id: "billing",
    items: [
      {
        q: "What subscription plans are available?",
        a: "We offer both Monthly and Annual Premium plans, with prices shown in your local currency (INR for visitors from India via Razorpay, or USD via Stripe for international learners). Annual plans include a significant discount.",
        tags: ["plans", "annual", "monthly", "inr", "usd"],
      },
      {
        q: "How do I cancel my subscription?",
        a: "To cancel, use the Help page. Once cancelled, your premium access will remain active until the end of your current billing period.",
        tags: ["cancel", "subscription", "billing"],
      },
      {
        q: "What is your refund policy?",
        a: "Cancel any time · full refund if unhappy. We offer a full refund if you're unhappy; cancel any time. Use the Help page to contact us.",
        tags: ["refund", "guarantee", "money back"],
      },
      {
        q: "How do I earn and verify my completion certificate?",
        a: "When you finish all 80+ lessons across our 15 curriculum modules with an active Premium membership, you can generate an official certificate. Each certificate includes a permanent, public verification link at /verify/[id] to share on LinkedIn and resumes.",
        tags: ["certificate", "verification", "linkedin"],
      },
    ],
  },
  {
    category: "Account & Progress",
    id: "account-progress",
    items: [
      {
        q: "How is my lesson progress saved?",
        a: "When you are logged in, all lesson completions, step attempts, accuracy scores, and streaks sync securely to your account. If you completed lessons while signed out, your progress is saved on your device and merged automatically as soon as you sign in or create an account.",
        tags: ["progress", "sync", "save"],
      },
      {
        q: "Can I reset my progress to practice again from scratch?",
        a: "Yes. On the Dashboard, click 'Reset Progress' and confirm. This clears your lesson completion checkmarks so you can replay lessons fresh, while keeping your lifetime points and streak intact.",
        tags: ["reset", "restart", "replay"],
      },
      {
        q: "How do I delete my account and data?",
        a: "To delete your account and associated data, use the Help page to contact us.",
        tags: ["delete", "privacy", "account"],
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
