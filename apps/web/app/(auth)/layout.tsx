import { Logo } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import "./auth.css";

const PERKS = [
  "Progress saved across devices",
  "Daily streak and points",
  "A place on today's leaderboard",
  "One more free lesson after the intro",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-pane">
        <header className="auth-top"><Logo /></header>
        <main className="auth-main" id="main">{children}</main>
      </div>
      <aside className="auth-aside" aria-label="What an account gives you">
        <p className="auth-fx num" aria-hidden="true"><b>fx</b>=SAVE(progress)</p>
        <h2>Every formula you type, kept.</h2>
        <ul>
          {PERKS.map((p) => <li key={p}><span aria-hidden="true"><Icon name="check" size={14} strokeWidth={2.5} /></span>{p}</li>)}
        </ul>
        <div className="auth-sheet" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <i key={i} />)}
        </div>
      </aside>
    </div>
  );
}
