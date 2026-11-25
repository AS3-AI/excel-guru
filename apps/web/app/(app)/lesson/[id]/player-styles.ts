export const plListDialogClasses = [
  "fixed inset-[0_auto_0_0] w-[min(380px,_92vw)] max-w-[none] h-[100dvh] max-h-none m-0 p-0 [border-block:0] [border-left:0]",
  "[border-right:var(--line)] bg-surface text-text [box-shadow:var(--shadow-pop)]",
  "[&[open]]:flex [&[open]]:flex-col [&[open]]:[animation:pl-list-in_var(--d3)_var(--ease)]",
  "[&::backdrop]:[background:rgb(20_32_26_/_0.45)] [&::backdrop]:[animation:fade-in_var(--d2)_var(--ease)]",
  "[&>header]:flex [&>header]:items-center [&>header]:justify-between",
  "[&>header]:p-[var(--s3)_var(--s3)_var(--s3)_var(--s5)] [&>header]:[border-bottom:1px_solid_var(--border)]",
  "[&>header_strong]:font-heading [&>header_strong]:text-ink",
  "[&>header_button]:grid [&>header_button]:place-items-center [&>header_button]:w-[40px]",
  "[&>header_button]:h-[40px] [&>header_button]:[border:0] [&>header_button]:rounded-ledger-sm",
  "[&>header_button]:[background:none] [&>header_button]:text-ink [&>header_button]:cursor-pointer",
  "[&>header_button:hover]:bg-surface-sunk",
].join(" ");

export const plArenaClasses = [
  "grid grid-cols-[repeat(12,_minmax(0,_1fr))] gap-[var(--s4)_var(--s5)] [align-items:start]",
  "[&.is-solo_.pl-stage]:[grid-column:2_/_span_10] [&.is-solo_.pl-stage]:p-s6",
  "[@media(max-width:900px)]:[&.is-solo_.pl-stage]:[grid-column:1_/_-1]",
  "[@media(max-width:640px)]:[&.is-solo_.pl-stage]:p-s4",
  "[&.is-solo_.pl-stage_.pl-card]:[border-block:0] [&.is-solo_.pl-stage_.pl-card]:[border-right:0] [&.is-solo_.pl-stage_.pl-card]:[border-left:3px_solid_var(--primary)]",
  "[&.is-solo_.pl-stage_.pl-card]:rounded-[0] [&.is-solo_.pl-stage_.pl-card]:p-[var(--s2)_0_var(--s2)_var(--s5)]",
  "[&.is-solo_.pl-stage_.pl-card]:m-0 [&.is-solo_.pl-stage_.pl-card]:[background:none]",
  "[&.is-solo_.pl-stage_.pl-prompt]:[font:500_clamp(1.15rem,_2vw,_1.45rem)/1.5_var(--font-display)]",
  "[&.is-solo_.pl-stage_.pl-prompt]:tracking-[-0.01em]",
  "[&[data-feedback='wrong']_.pl-stage]:border-ink",
  "[&[data-feedback='wrong']_.pl-stage]:[animation:pl-shake_380ms_var(--ease)]",
  "[&[data-feedback='wrong']_.pl-stage]:[box-shadow:5px_5px_0_var(--danger)]",
  "[&[data-feedback='correct']_.pl-stage]:border-ink",
  "[&[data-feedback='correct']_.pl-stage]:[box-shadow:5px_5px_0_var(--primary)]",
  "[&.is-solo_.pl-options]:[border:0] [&.is-solo_.pl-options]:p-0 [&.is-solo_.pl-options]:[background:none]",
  "[&.is-solo_.pl-options_legend]:[font:600_clamp(1.2rem,_2vw,_1.5rem)/1.4_var(--font-display)]",
  "[&.is-solo_.pl-options_legend]:tracking-[-0.015em] [&.is-solo_.pl-options_legend]:mb-s4",
  "[&.is-solo_.pl-actions]:[grid-column:2_/_span_10]",
  "[@media(max-width:900px)]:[&.is-solo_.pl-actions]:[grid-column:1_/_-1]",
].join(" ");

export const plKeyClasses = [
  "[--btn-bg:var(--surface)] [--btn-fg:var(--ink)] [--btn-edge:var(--border-strong)] min-h-[48px] p-[10px_20px]",
  "text-[1rem]",
  "[&:hover]:[--btn-bg:var(--surface-sunk)]",
  "[&>span[aria-hidden]]:font-ledger-code [&>span[aria-hidden]]:text-[0.85em] [&>span[aria-hidden]]:opacity-[0.7]",
].join(" ");

export const plStatsClasses = [
  "relative grid grid-cols-[repeat(auto-fit,_minmax(150px,_1fr))] gap-0 w-full m-[var(--s3)_0] [border:var(--line)]",
  "rounded-ledger overflow-hidden",
  "[&>div]:p-[var(--s4)_var(--s5)] [&>div]:bg-surface [&>div]:[animation:pl-enter_var(--d3)_var(--ease)_backwards]",
  "[&>div+div]:[border-left:var(--line)]",
  "[@media(max-width:640px)]:[&>div+div]:[border-left:0]",
  "[@media(max-width:640px)]:[&>div+div]:[border-top:var(--line)]",
  "[&>div:nth-child(2)]:[animation-delay:80ms]",
  "[&>div:nth-child(3)]:[animation-delay:160ms]",
  "[&>div:nth-child(4)]:[animation-delay:240ms]",
  "[&_dt]:[font:500_var(--fs-xs)/1.2_var(--mono)] [&_dt]:tracking-[0.06em] [&_dt]:uppercase [&_dt]:text-muted",
  "[&_dd]:m-[6px_0_0] [&_dd]:text-[2.25rem] [&_dd]:font-semibold [&_dd]:leading-[1] [&_dd]:text-ink",
  "[&_.is-gold]:bg-butter",
].join(" ");

export const plBriefClasses = [
  "[grid-column:span_4] sticky top-s4 grid gap-s4 p-s5 bg-ink [color:rgb(255_255_255_/_0.82)] rounded-ledger-lg",
  "[box-shadow:var(--shadow-2)] [animation:pl-enter_var(--d3)_var(--ease)] overflow-hidden [border:var(--line)]",
  "[@media(max-width:900px)]:[grid-column:1_/_-1] [@media(max-width:900px)]:static",
  "[@media(max-width:640px)]:p-s4",
  "[&::after]:[content:''] [&::after]:absolute [&::after]:inset-[auto_-20px_-30px_auto] [&::after]:w-[180px]",
  "[&::after]:h-[120px]",
  "[&::after]:[background-image:linear-gradient(rgb(255_255_255_/_0.07)_1px,_transparent_1px),_linear-gradient(90deg,_rgb(255_255_255_/_0.07)_1px,_transparent_1px)]",
  "[&::after]:[background-size:45px_20px] [&::after]:[transform:rotate(-8deg)] [&::after]:pointer-events-none",
  "[&_.pl-prompt]:[color:#fff] [&_.pl-prompt]:[font:600_clamp(1.15rem,_1.8vw,_1.4rem)/1.4_var(--font-display)]",
  "[&_.pl-prompt]:tracking-[-0.015em]",
  "[&_.chip]:[background:rgb(255_255_255_/_0.1)] [&_.chip]:[border-color:rgb(255_255_255_/_0.22)]",
  "[&_.chip]:[color:#fff]",
].join(" ");

export const plActionsClasses = [
  "[grid-column:1_/_-1] flex flex-wrap items-center gap-[var(--s2)_var(--s3)] p-s3 [border:var(--line)]",
  "rounded-ledger-lg bg-surface",
  "[transition:background-color_var(--d3)_var(--ease),_border-color_var(--d3)_var(--ease)]",
  "[box-shadow:var(--shadow-1)]",
  "[&.is-correct]:text-ink [&.is-correct]:bg-mint [&.is-correct]:border-ink",
  "[&.is-correct]:[animation:pl-correct_var(--d3)_var(--ease)]",
  "[&.is-correct_span]:text-ink",
  "[&.is-correct_.chip]:bg-surface [&.is-correct_.chip]:border-ink [&.is-correct_.chip]:text-ink",
  "[&.is-correct_.pl-key-enter]:ml-auto",
  "[@media(max-width:640px)]:sticky [@media(max-width:640px)]:bottom-[8px] [@media(max-width:640px)]:z-[5]",
  "[@media(max-width:640px)]:[&_.pl-key]:[flex:1]",
  "[&.is-correct_.pl-correct-label]:text-ink",
].join(" ");

export const plDrawerClasses = [
  "fixed z-[var(--z-drawer)] top-0 right-0 bottom-0 w-[min(400px,_92vw)] p-s5 [overflow:auto] bg-surface",
  "[border-left:var(--line)] [box-shadow:var(--shadow-pop)] [animation:pl-drawer-in_var(--d3)_var(--ease)]",
  "[&_header]:flex [&_header]:items-center [&_header]:justify-between",
  "[&_header]:m-[calc(-1_*_var(--s5))_calc(-1_*_var(--s5))_var(--s5)] [&_header]:p-[var(--s4)_var(--s5)]",
  "[&_header]:text-ink [&_header]:bg-butter [&_header]:[border-bottom:var(--line)] [&_header]:[box-shadow:none]",
  "[&_header_strong]:font-heading [&_header_strong]:text-[1.1rem]",
  "[&_header_button]:grid [&_header_button]:place-items-center [&_header_button]:w-[40px]",
  "[&_header_button]:h-[40px] [&_header_button]:[border:0] [&_header_button]:rounded-ledger-sm",
  "[&_header_button]:[background:transparent] [&_header_button]:[color:inherit] [&_header_button]:cursor-pointer",
  "[&_header_button:hover]:[background:rgb(20_32_26_/_0.06)]",
].join(" ");

export const plTileStatClasses = [
  "[grid-column:span_2] grid [align-content:start] gap-[4px] p-s4 bg-surface [border:var(--line)] rounded-ledger-lg",
  "[box-shadow:var(--shadow-1)]",
  "[@media(900px<width<=1100px)]:[grid-column:span_3]",
  "[@media(max-width:900px)]:[grid-column:span_6]",
  "[&_span]:[font:500_var(--fs-xs)/1.2_var(--mono)] [&_span]:tracking-[0.06em] [&_span]:uppercase",
  "[&_span]:text-muted",
  "[&_b]:text-[2rem] [&_b]:font-semibold [&_b]:leading-[1.1] [&_b]:text-ink",
  "[&_small]:text-muted [&_small]:text-[0.8rem]",
  "[&:nth-of-type(1)]:bg-mint",
  "[&:nth-of-type(2)]:bg-butter",
].join(" ");

export const plTileBoardClasses = [
  "[grid-column:span_3]",
  "[@media(900px<width<=1100px)]:[grid-column:span_6]",
  "[@media(max-width:900px)]:[grid-column:1_/_-1]",
  "[&_.leaderboard-card]:h-full [&_.leaderboard-card]:p-s4 [&_.leaderboard-card]:[box-shadow:var(--shadow-1)]",
  "[&_h2]:text-ledger-base",
].join(" ");

export const plLessonsClasses = [
  "[flex:1] min-h-0 flex flex-col",
  "[&_h2]:flex [&_h2]:justify-between [&_h2]:items-baseline [&_h2]:m-0 [&_h2]:p-[var(--s3)_var(--s5)]",
  "[&_h2]:text-muted [&_h2]:[font:500_var(--fs-xs)/1_var(--mono)] [&_h2]:tracking-[0.06em] [&_h2]:uppercase",
  "[&_ol]:[flex:1] [&_ol]:min-h-0 [&_ol]:[overflow-y:auto] [&_ol]:[overscroll-behavior:contain] [&_ol]:list-none",
  "[&_ol]:m-0 [&_ol]:p-[0_var(--s2)_var(--s4)]",
  "[&_a]:grid [&_a]:grid-cols-[24px_minmax(0,_1fr)_16px] [&_a]:gap-[8px] [&_a]:[align-items:start]",
  "[&_a]:p-[9px_8px] [&_a]:rounded-ledger-sm [&_a]:text-text [&_a]:no-underline [&_a]:text-[0.9rem]",
  "[&_a]:leading-[1.35] [&_a]:[transition:background-color_var(--d1)_var(--ease)]",
  "[&_a:hover]:bg-surface-sunk",
  "[&_a:focus-visible]:[outline-offset:-2px]",
  "[&_.is-done_.pl-lesson-dot]:bg-primary [&_.is-done_.pl-lesson-dot]:border-primary",
  "[&_.is-done_.pl-lesson-dot]:[color:#fff]",
  "[&_.is-current_a]:bg-mint [&_.is-current_a]:text-ink [&_.is-current_a]:font-semibold",
  "[&_.is-current_a]:[box-shadow:inset_4px_0_0_var(--ink)]",
  "[&_.is-current_.pl-lesson-dot]:border-primary",
  "[&_.pl-lesson-dot.is-loading]:[background:none] [&_.pl-lesson-dot.is-loading]:border-border",
  "[&_.pl-lesson-dot.is-loading]:[border-top-color:var(--primary)]",
  "[&_.pl-lesson-dot.is-loading]:[animation:pl-spin_0.7s_linear_infinite]",
  "[&_a:has(.is-loading)]:bg-surface-sunk",
  "[@media(prefers-reduced-motion:reduce)]:[&_.pl-lesson-dot.is-loading]:[animation-duration:2s]",
].join(" ");

export const plOptionsClasses = [
  "m-0 p-[var(--s4)_var(--s5)] [border-block:1px_solid_var(--border)] [border-right:1px_solid_var(--border)] [border-left:3px_solid_var(--primary)]",
  "rounded-ledger bg-surface grid gap-s2",
  "[&_legend]:[float:left] [&_legend]:w-full [&_legend]:p-0 [&_legend]:mb-s3",
  "[&_label]:flex [&_label]:items-center [&_label]:gap-s3 [&_label]:min-h-[48px] [&_label]:p-[0_var(--s4)]",
  "[&_label]:[border:var(--line)] [&_label]:rounded-ledger [&_label]:text-text [&_label]:cursor-pointer",
  "[&_label]:[transition:border-color_var(--d2)_var(--ease),_background-color_var(--d2)_var(--ease)]",
  "[&_label:hover]:border-border-strong [&_label:hover]:bg-surface-warm",
  "[&_label:has(input:checked)]:border-primary [&_label:has(input:checked)]:bg-mint",
  "[&_label:has(input:checked)]:text-ink [&_label:has(input:checked)]:[box-shadow:3px_3px_0_var(--ink)]",
  "[&_label:has(input:checked)]:[transform:translate(-2px,_-2px)]",
  "[&_input]:[accent-color:var(--primary)] [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:[flex:none]",
].join(" ");

export const plPageClasses = [
  "max-w-[1440px] pb-s8 [transition:margin_var(--d3)_var(--ease),_max-width_var(--d3)_var(--ease)]",
  "[@media(min-width:900px)]:[body.has-drawer_&]:ml-[max(var(--s5),_calc((100vw_-_min(400px,_92vw)_-_1440px)_/_2))]",
  "[@media(min-width:900px)]:[body.has-drawer_&]:mr-[min(400px,_92vw)]",
  "[@media(min-width:900px)]:[body.has-drawer_&]:max-w-[calc(100vw_-_min(400px,_92vw)_-_var(--s5)_*_2)]",
  "[@media(min-width:900px)]:[&:has(.pl-drawer)]:ml-[max(var(--s5),_calc((100vw_-_min(400px,_92vw)_-_1440px)_/_2))]",
  "[@media(min-width:900px)]:[&:has(.pl-drawer)]:mr-[min(400px,_92vw)]",
  "[@media(min-width:900px)]:[&:has(.pl-drawer)]:max-w-[calc(100vw_-_min(400px,_92vw)_-_var(--s5)_*_2)]",
  "[@media(max-width:640px)]:p-[0_var(--s4)_var(--s7)]",
].join(" ");

export const plCardClasses = [
  "relative bg-surface [border-block:var(--line)] [border-right:var(--line)] [border-left:3px_solid_var(--primary)]",
  "rounded-ledger px-s5 py-s4 mb-s4 [box-shadow:var(--shadow-1)]",
].join(" ");
