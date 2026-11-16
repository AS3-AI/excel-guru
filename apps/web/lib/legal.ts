export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview & Commitment",
    body: "Excel Guru respects your privacy and is committed to protecting your personal data. This privacy policy explains what information we collect, how it is used to deliver interactive spreadsheet lessons, and the third-party infrastructure providers that power our platform: Supabase, Razorpay, Stripe, Google Gemini, and privacy-friendly analytics.",
  },
  {
    id: "supabase-data",
    title: "2. User Accounts & Learning Progress (Supabase)",
    body: "We use Supabase for authentication and database services. When you create an account or sign in with Google OAuth, we store your email address, an encrypted authentication token or password hash, your chosen username, and optional profile metadata (such as your first name and LinkedIn profile URL). We also store your learning activity, including lesson completions, step attempts, first-try accuracy percentages, points earned, practice streaks, and daily challenge scores. If you use Excel Guru signed out, your progress is stored locally in your browser (via localStorage) and can be merged into your Supabase profile when you sign in.",
  },
  {
    id: "payments-data",
    title: "3. Payments & Billing (Razorpay & Stripe)",
    body: "When you upgrade to a Premium subscription, your payment is processed securely by our authorized payment providers: Razorpay (for INR transactions in India) and Stripe (for international USD transactions). We never store or handle your credit card numbers, debit card details, CVVs, or bank credentials on our servers. The payment gateways transmit only an opaque customer ID, subscription status, and billing cycle period dates, which we store to verify your access rights.",
  },
  {
    id: "gemini-ai",
    title: "4. AI Explanations & Hints (Google Gemini)",
    body: "When you submit an incorrect answer and request an AI explanation, we transmit the step's prompt, grid values, the correct solution, and the learner's wrong answer to Google's Gemini API to generate tailored explanatory feedback. We do not send your name or email. A hashed ID is used only for the daily limit and is not sent to Gemini. High-quality explanations are cached anonymously in our database so other learners encountering the same mistake receive instantaneous help.",
  },
  {
    id: "analytics",
    title: "5. Analytics & Cookies",
    body: "We collect aggregate, privacy-friendly analytics (via Vercel Analytics) to track page views, feature adoption, and application error rates. We do not use intrusive third-party cross-site advertising trackers, nor do we sell, rent, or trade your personal information with advertisers or data brokers. Session cookies are strictly used for user authentication and security.",
  },
  {
    id: "retention-rights",
    title: "6. Data Retention & Your Rights",
    body: "You maintain full control over your data. You may reset your lesson progress at any time from your Dashboard. To request account deletion or data removal, use the Help page to contact us.",
  },
  {
    id: "contact",
    title: "7. Contact Us",
    body: "If you have questions about this privacy policy or our data practices, please use the Help page to contact us.",
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "1. Agreement to Terms",
    body: "By accessing or using Excel Guru (excelguru.dev), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.",
  },
  {
    id: "disclaimer",
    title: "2. Educational Service & Microsoft Trademark Disclaimer",
    body: "Excel Guru is an independent interactive educational platform. Microsoft and Excel are registered trademarks of Microsoft Corporation. Excel Guru is not endorsed by, sponsored by, or affiliated with Microsoft Corporation. All spreadsheet exercises and simulations are designed strictly for educational and instructional purposes.",
  },
  {
    id: "accounts",
    title: "3. Accounts & Security",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate registration information and not to share your account with third parties.",
  },
  {
    id: "subscriptions-billing",
    title: "4. Subscriptions, Payments & Refund Policy",
    body: "We offer free introductory access and paid Premium subscriptions (Monthly and Annual plans). Premium subscriptions automatically renew at the end of each billing cycle unless cancelled prior to renewal. You can cancel your subscription at any time: to cancel, use the Help page; you will retain premium access through the end of the paid period. We offer a full refund if you're unhappy; cancel any time. Use the Help page to contact us.",
  },
  {
    id: "ai-disclaimer",
    title: "5. AI-Generated Feedback & Learning Aids",
    body: "Explanations and hints provided during lessons may be generated by artificial intelligence (Google Gemini). While designed to deliver helpful instructional guidance, AI-generated explanations are provided 'as is' and may occasionally contain inaccuracies. They should be treated as learning aids rather than definitive technical advice.",
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use Policy",
    body: "You agree not to misuse the service, including: attempting to bypass access controls or paywalls, forging progress or points logs, scraping content or exercises, reverse-engineering our formula evaluator, or deploying automated bots to manipulate leaderboards.",
  },
  {
    id: "intellectual-property",
    title: "7. Intellectual Property",
    body: "All lesson materials, custom curriculum structures, software code, graphic designs, and brand assets are the exclusive property of Excel Guru and protected by copyright and intellectual property laws.",
  },
  {
    id: "limitation-liability",
    title: "8. Limitation of Liability",
    body: "To the maximum extent permitted by applicable law, Excel Guru and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your access to or use of the platform.",
  },
  {
    id: "governing-law",
    title: "9. Modifications & Inquiries",
    body: "We reserve the right to modify these terms as our platform evolves. Any changes will be posted to this page. If you have questions regarding these terms, please use the Help page to contact us.",
  },
];
