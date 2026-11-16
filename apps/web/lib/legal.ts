export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview & Data Controller",
    body: "Excel Guru is operated by [LEGAL NAME], located at [ADDRESS]. This Privacy Policy explains what personal data we collect, why we collect it, and how it is processed when you use our interactive spreadsheet learning platform. If you have any questions or data requests, contact us at [CONTACT EMAIL].",
  },
  {
    id: "supabase-data",
    title: "2. User Accounts & Learning Progress (Supabase)",
    body: "We use Supabase for authentication and database management. When you create an account, we store your account email, name (first name), and chosen username. As you complete lessons, we record your progress: completed lessons, step attempts, first-try accuracy, practice streaks, and points earned. If you start lessons signed out, your progress is kept in your browser's local storage and can be merged into your Supabase account upon sign-in.",
  },
  {
    id: "google-signin",
    title: "3. Google Sign-In",
    body: "You may choose to register and sign in using Google OAuth via Supabase Auth. When you authenticate with Google, we receive your email address, basic profile name, and an authentication token to establish your Excel Guru account without requiring a separate password.",
  },
  {
    id: "razorpay-payments",
    title: "4. Payments & Billing (Razorpay)",
    body: "When you upgrade to a Premium subscription, your payment is processed securely by Razorpay in INR. We never see, process, or store your credit or debit card numbers, CVVs, UPI PINs, or bank credentials. Razorpay securely processes the transaction and transmits only an opaque customer ID, subscription ID, payment status, and billing cycle period dates, which we store to verify and maintain your access rights. (International transactions in USD are currently marked 'Coming soon' and are not active; Stripe is not live.)",
  },
  {
    id: "gemini-ai",
    title: "5. AI Explanations & Rate Limiting (Google Gemini)",
    body: "When you submit an incorrect answer and request an AI explanation, the formula you typed, along with the step prompt, expected solution, and grid values, is sent to Google's Gemini API to generate concise explanatory feedback. We do not transmit your name, email, or user profile to Gemini. To enforce our daily limit of 20 uncached AI calls per day, our servers compute a SHA-256 hash of your user ID, or a salted SHA-256 hash of your IP address if you are signed out. Raw IP addresses are never stored in our database, and the hashed identifier is not sent to Google. High-quality explanations are cached anonymously in our database so other learners encountering the same mistake receive instantaneous help.",
  },
  {
    id: "vercel-hosting",
    title: "6. Vercel Hosting Logs & Analytics",
    body: "Our web application is hosted on Vercel. Vercel automatically generates server request logs containing standard technical data, such as your IP address, browser user-agent, request timestamp, and requested URL, strictly for infrastructure operation, security, and performance monitoring. We also use privacy-friendly Vercel Analytics for aggregate page-view counts without cross-site tracking or advertising profiling.",
  },
  {
    id: "cookies",
    title: "7. Cookies",
    body: "We use only essential session cookies today: specifically, the secure Supabase authentication session cookie necessary to keep you signed in and verify your access as you navigate lessons. We do not set any advertising, tracking, or marketing cookies.",
  },
  {
    id: "retention-rights",
    title: "8. Data Retention & Account Deletion",
    body: "You maintain full control over your data. You may reset your lesson progress checkmarks at any time from your Dashboard. You have the right to request full deletion of your account and all associated personal data at any time by sending an email to [CONTACT EMAIL]. We will promptly delete your profile, progress history, and authentication records.",
  },
  {
    id: "contact",
    title: "9. Contact Us",
    body: "If you have questions about this privacy policy, your personal data, or wish to request account deletion, please contact [LEGAL NAME] at [CONTACT EMAIL], or by post at [ADDRESS].",
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "1. Agreement to Terms",
    body: "By accessing or using Excel Guru (operated by [LEGAL NAME], [ADDRESS]), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service. For inquiries, contact [CONTACT EMAIL].",
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
    title: "4. Subscriptions, Renewals, Cancellation & Refunds",
    body: "We offer free introductory access and paid Premium subscriptions (Monthly and Annual plans). Premium subscriptions automatically renew at the end of each billing cycle until cancelled. You can cancel your subscription at any time: go to the Pricing page → Manage / cancel subscription. If you cancel, your premium access lasts until the end of your current paid billing period. We offer a full refund if unhappy; cancel any time. To request a refund, contact us at [CONTACT EMAIL].",
  },
  {
    id: "ai-disclaimer",
    title: "5. AI-Generated Feedback & Learning Aids",
    body: "Explanations and hints provided during lessons may be generated by artificial intelligence (Google Gemini). While designed to deliver helpful instructional guidance, AI-generated explanations are provided 'as is' and should be treated as learning aids rather than definitive technical advice.",
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable Use Policy",
    body: "You agree not to misuse the service. Prohibited actions include: attempting to bypass access controls, lesson locks, or paywalls; scraping content, curriculum structures, or practice exercises; reverse-engineering our formula evaluator; forging points, streaks, or progress records; or deploying automated scripts or bots to manipulate leaderboards or daily challenges.",
  },
  {
    id: "intellectual-property",
    title: "7. Intellectual Property",
    body: "All lesson materials, custom curriculum structures, software code, graphic designs, and brand assets are the property of [LEGAL NAME] and Excel Guru, protected by applicable copyright and intellectual property laws.",
  },
  {
    id: "limitation-liability",
    title: "8. Limitation of Liability",
    body: "To the maximum extent permitted by applicable law, [LEGAL NAME], Excel Guru, and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your access to or use of the platform.",
  },
  {
    id: "governing-law",
    title: "9. Governing Law & Jurisdiction",
    body: "These Terms shall be governed by and construed in accordance with the laws of India. Any disputes, claims, or controversies arising out of or relating to these Terms or the use of Excel Guru shall be subject to the exclusive jurisdiction of the competent courts in [CITY/STATE], India.",
  },
  {
    id: "contact-inquiries",
    title: "10. Contact & Notices",
    body: "For any notices, questions, or concerns regarding these Terms of Service, please contact [LEGAL NAME] by email at [CONTACT EMAIL], or by post at [ADDRESS].",
  },
];
