import { Logo } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";

const PERKS = [
  "Progress saved across devices",
  "Daily streak and points",
  "A place on today's leaderboard",
  "One more free lesson after the intro",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] flex-[1_0_auto] grid-cols-[minmax(0,1fr)] min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] [&_.btn]:min-h-[48px] [&_.btn]:w-full">
      <div className="flex min-w-0 flex-col">
        <header className="px-s5 pt-s5"><Logo /></header>
        <main className="flex flex-1 items-center justify-center px-s5 pt-s7 pb-s8 [@media(max-width:640px)]:items-start [@media(max-width:640px)]:pt-s6" id="main">{children}</main>
      </div>
      <aside className="hidden min-[960px]:relative min-[960px]:flex min-[960px]:flex-col min-[960px]:justify-center min-[960px]:gap-s5 min-[960px]:overflow-hidden min-[960px]:border-l-2 min-[960px]:border-solid min-[960px]:border-ink min-[960px]:bg-ink min-[960px]:px-[clamp(var(--s7),6vw,var(--s9))] min-[960px]:py-s8 min-[960px]:text-[rgb(255_255_255/0.78)] [&_h2]:relative [&_h2]:m-0 [&_h2]:max-w-[14ch] [&_h2]:text-[clamp(2rem,3.2vw,2.75rem)] [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_ul]:relative [&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-s3 [&_ul]:p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-s3 [&_li_span]:grid [&_li_span]:h-[22px] [&_li_span]:w-[22px] [&_li_span]:shrink-0 [&_li_span]:place-items-center [&_li_span]:rounded-[5px] [&_li_span]:bg-primary [&_li_span]:text-white" aria-label="What an account gives you">
        <p className="num relative m-0 inline-flex self-start gap-[12px] rounded-ledger-sm border border-solid border-white/[0.16] px-[12px] py-[6px] text-ledger-sm [&_b]:text-highlight [&_b]:italic" aria-hidden="true"><b>fx</b>=SAVE(progress)</p>
        <h2>Every formula you type, kept.</h2>
        <ul>
          {PERKS.map((p) => <li key={p}><span aria-hidden="true"><Icon name="check" size={14} strokeWidth={2.5} /></span>{p}</li>)}
        </ul>
        <div className="absolute right-[-40px] bottom-[-40px] grid auto-rows-[36px] grid-cols-[repeat(4,110px)] rotate-[-6deg] opacity-50 [mask-image:linear-gradient(to_top_left,#000,transparent_70%)] [&_i]:border-r [&_i]:border-b [&_i]:border-solid [&_i]:border-white/[0.12] [&_i:nth-child(11)]:bg-[rgb(246_220_110/0.18)] [&_i:nth-child(11)]:shadow-[inset_0_0_0_2px_var(--highlight)]" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <i key={i} />)}
        </div>
      </aside>
    </div>
  );
}
