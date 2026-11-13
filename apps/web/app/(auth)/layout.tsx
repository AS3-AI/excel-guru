import Link from "next/link";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="wrap">
        <div className="brand">
          <Link href="/" style={{ textDecoration: "none" }}>Excel Guru</Link>
        </div>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  );
}
