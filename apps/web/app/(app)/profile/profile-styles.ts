export const statQuadCardClasses = [
  "flex items-center gap-s4 p-[var(--s4)_var(--s5)] bg-surface [border:var(--line)] rounded-ledger-lg",
  "[box-shadow:var(--shadow-1)] [transition:transform_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]",
  "[&:hover]:[transform:translate(-2px,_-2px)] [&:hover]:[box-shadow:5px_5px_0_var(--ink)]",
].join(" ");

export const statIconBoxClasses = [
  "grid place-items-center w-[48px] h-[48px] rounded-[var(--r-md,_8px)] [border:1.5px_solid_var(--ink)]",
  "[box-shadow:2px_2px_0_var(--ink)] [flex-shrink:0] text-ink",
  "[&.is-streak]:bg-butter [&.is-streak]:[color:#c2410c]",
  "[&.is-xp]:[background:#fef08a] [&.is-xp]:[color:#b45309]",
  "[&.is-league]:bg-lilac [&.is-league]:[color:#6b21a8]",
  "[&.is-rank]:bg-mint [&.is-rank]:text-primary-strong",
].join(" ");

export const profileCardHeaderClasses = [
  "flex items-center justify-between gap-s3 mb-s4 pb-s3 [border-bottom:2px_solid_var(--ink)]",
  "[&_h2]:m-0 [&_h2]:font-heading [&_h2]:text-ledger-lg [&_h2]:font-bold [&_h2]:flex [&_h2]:items-center",
  "[&_h2]:gap-[10px] [&_h2]:text-ink",
  "[&_p]:m-0 [&_p]:text-ledger-sm [&_p]:text-muted",
].join(" ");

export const duoAchievementCardClasses = [
  "flex flex-col gap-s3 p-[var(--s4)_var(--s5)] bg-surface [border:var(--line)] rounded-ledger-lg",
  "[box-shadow:var(--shadow-1)] [transition:transform_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]",
  "[&:hover]:[transform:translate(-1px,_-1px)] [&:hover]:[box-shadow:4px_4px_0_var(--ink)]",
].join(" ");

export const achievementIconBoxClasses = [
  "grid place-items-center w-[50px] h-[50px] rounded-[var(--r-md,_8px)] [border:2px_solid_var(--ink)]",
  "[box-shadow:2px_2px_0_var(--ink)] [flex-shrink:0] text-[1.5rem]",
  "[&.is-mint]:bg-mint",
  "[&.is-butter]:bg-butter",
  "[&.is-lilac]:bg-lilac",
  "[&.is-rose]:bg-rose",
  "[&.is-locked]:bg-surface-sunk [&.is-locked]:[border-style:dashed] [&.is-locked]:text-muted",
].join(" ");

export const stripedClasses = [
  "[&.meter]:relative [&.meter]:w-full [&.meter]:h-[12px] [&.meter]:bg-surface-sunk",
  "[&.meter]:[border:1.5px_solid_var(--ink)] [&.meter]:rounded-[9999px] [&.meter]:overflow-hidden",
  "[&.meter_i]:block [&.meter_i]:h-full [&.meter_i]:rounded-[9999px] [&.meter_i]:[background-color:var(--primary)]",
  "[&.meter_i]:[background-image:linear-gradient(_45deg,_rgba(255,_255,_255,_0.28)_25%,_transparent_25%,_transparent_50%,_rgba(255,_255,_255,_0.28)_50%,_rgba(255,_255,_255,_0.28)_75%,_transparent_75%,_transparent_)]",
  "[&.meter_i]:[background-size:16px_16px] [&.meter_i]:[animation:meter-stripes_2.2s_linear_infinite]",
  "[&.meter_i]:[transition:width_0.4s_var(--ease)]",
].join(" ");

export const achievementMeterFillClasses = [
  "block h-full rounded-[9999px] [background-color:var(--primary)]",
  "[background-image:linear-gradient(_45deg,_rgba(255,_255,_255,_0.28)_25%,_transparent_25%,_transparent_50%,_rgba(255,_255,_255,_0.28)_50%,_rgba(255,_255,_255,_0.28)_75%,_transparent_75%,_transparent_)]",
  "[background-size:16px_16px] [animation:meter-stripes_2.2s_linear_infinite] [transition:width_0.4s_var(--ease)]",
].join(" ");

export const badgeItemClasses = [
  "flex flex-col items-center text-center p-[var(--s4)_var(--s2)] [border:1.5px_dashed_var(--border)]",
  "rounded-[var(--r-md,_8px)] bg-surface opacity-[0.65] [transition:all_var(--d2)_var(--ease)]",
  "[&.is-unlocked]:opacity-[1] [&.is-unlocked]:[border-style:solid] [&.is-unlocked]:border-ink",
  "[&.is-unlocked]:[box-shadow:2.5px_2.5px_0_var(--ink)] [&.is-unlocked]:bg-surface",
  "[&:not(.is-unlocked)_.badge-icon-box]:bg-surface-sunk [&:not(.is-unlocked)_.badge-icon-box]:border-border",
  "[&:not(.is-unlocked)_.badge-icon-box]:text-muted",
  "[&_strong]:text-ledger-sm [&_strong]:text-ink [&_strong]:mb-[2px]",
  "[&_small]:text-[0.75rem] [&_small]:text-muted [&_small]:leading-[1.25]",
  "[&.is-unlocked_.badge-progress-pill]:bg-mint [&.is-unlocked_.badge-progress-pill]:border-ink",
].join(" ");

export const duoTabBtnClasses = [
  "[flex:1] p-[12px_14px] [background:transparent] [border:none] font-ledger-code text-ledger-xs font-bold",
  "tracking-[0.06em] uppercase text-muted cursor-pointer text-center relative",
  "[transition:color_var(--d1),_background_var(--d1)]",
  "[&:hover]:text-ink [&:hover]:[background:rgba(15,_23,_42,_0.04)]",
  "[&.is-active]:text-ink [&.is-active]:bg-surface [&.is-active]:[font-weight:800]",
  "[&.is-active::after]:[content:''] [&.is-active::after]:absolute [&.is-active::after]:bottom-[-2px]",
  "[&.is-active::after]:left-0 [&.is-active::after]:right-0 [&.is-active::after]:h-[3px]",
  "[&.is-active::after]:bg-primary [&.is-active::after]:z-[1]",
].join(" ");

export const lbTypeBtnClasses = [
  "[&:active]:[transform:scale(0.98)]",
  "p-[7px_10px] [border:1.5px_solid_var(--ink)] rounded-ledger-sm bg-surface-sunk text-muted font-ledger-code",
  "text-ledger-xs font-bold cursor-pointer [transition:background_var(--d1),_color_var(--d1)]",
  "[&.is-active]:bg-butter [&.is-active]:text-ink [&.is-active]:[box-shadow:2px_2px_0_var(--ink)]",
].join(" ");

export const lbStatusBoxClasses = [
  "p-s4 bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[var(--r-md,_8px)]",
  "[box-shadow:2px_2px_0_var(--ink)] text-center",
  "[&_h3]:m-[0_0_6px] [&_h3]:font-ledger-code [&_h3]:text-ledger-xs [&_h3]:uppercase [&_h3]:tracking-[0.05em]",
  "[&_h3]:text-muted",
].join(" ");

export const friendActionRowClasses = [
  "flex items-center gap-[12px] p-[12px_14px] bg-surface [border:1.5px_solid_var(--ink)] rounded-[var(--r-md,_8px)]",
  "[box-shadow:2px_2px_0_var(--ink)] no-underline text-ink cursor-pointer",
  "[transition:transform_var(--d1)_var(--ease),_box-shadow_var(--d1)_var(--ease),_background_var(--d1)]",
  "[&:hover]:bg-butter [&:hover]:[transform:translate(-1px,_-1px)] [&:hover]:[box-shadow:3.5px_3.5px_0_var(--ink)]",
  "[&:active]:[transform:translate(1.5px,_1.5px)] [&:active]:[box-shadow:0_0_0_var(--ink)]",
  "[&.is-done-row]:bg-surface-sunk [&.is-done-row]:cursor-default [&.is-done-row]:[box-shadow:none]",
].join(" ");

export const profileInputRowClasses = [
  "flex gap-s3",
  "[&_input]:[flex:1] [&_input]:min-w-0 [&_input]:p-[10px_14px] [&_input]:text-[0.95rem]",
  "[&_input]:[border:var(--line)] [&_input]:rounded-ledger [&_input]:bg-surface [&_input]:text-ink",
  "[&_input]:[box-shadow:2px_2px_0_var(--ink)] [&_input]:[transition:border-color_var(--d1),_box-shadow_var(--d1)]",
  "[&_input:focus]:[outline:none] [&_input:focus]:border-primary [&_input:focus]:[box-shadow:3px_3px_0_var(--ink)]",
].join(" ");

export const profileModalClasses = [
  "w-full max-w-[480px] p-s6 bg-surface [border:2px_solid_var(--ink)] rounded-ledger-lg",
  "[box-shadow:var(--shadow-pop)] [animation:profile-modal-in_var(--d2)_var(--ease)]",
  "[&_h3]:m-[0_0_var(--s3)] [&_h3]:font-heading [&_h3]:text-ledger-lg [&_h3]:[font-weight:800] [&_h3]:text-ink",
  "[&_p]:m-[0_0_var(--s5)] [&_p]:text-ledger-sm [&_p]:text-text [&_p]:leading-[1.5]",
].join(" ");
