# Substack light theme (reference for approval)

Source: substack.com home page, light mode, captured 2026-11-23 from computed styles and Substack's own CSS variables. Mechanics only: we copy the look (colour roles, type scale), never their text, logo or imagery (see CLAUDE.md on docs/teardown.md).

## Colours

| Role | Hex | Substack variable / where used |
|---|---|---|
| Page background | `#FFFFFF` | `--cover_bg_color`, body |
| Surface (cards, chips hover) | `#F5F5F5` | feed cards (20px radius) |
| Surface alt | `#F0F0F0` | `--background_contrast_1`, `--cover_bg_color_secondary` |
| Divider / border | `#DDDDDD` | `--background_contrast_2`; chip border is `rgba(0,0,0,.10)` |
| Text primary | `#363737` | `--cover_print_primary`: body, headings, nav |
| Text secondary | `#757575` | `--cover_print_secondary`: card excerpts, inactive chips |
| Text tertiary | `#B6B6B6` | `--cover_print_tertiary`: counts, meta |
| Accent (brand orange) | `#FF6719` | `--background_pop`: primary buttons, hero panel, focus |
| Accent hover | `#FF5600` | `--background_pop_darken` |
| Accent tint | `rgba(255,103,25,.4)` | `--background_contrast_pop` |
| Text on accent | `#FFFFFF` | `--print_on_pop` |
| Strong button / active chip | `#363737` bg, `#FFF` text | "All" chip |
| Hero CTA | `#FFFFFF` bg, `#111111` text | button on orange panel |

## Typography

Fonts: **system sans** (`system-ui, -apple-system, Segoe UI, Roboto, Helvetica`) for UI and headings; **serif** (Spectral on body, `ui-serif` for italic hero emphasis and article previews) for editorial moments.

| Style | Font | Size / line-height | Weight | Notes |
|---|---|---|---|---|
| Hero display | system sans | 44 / 44.9px | 700 | letter-spacing -0.44px, white on orange |
| Hero emphasis word | serif italic | 49.3 / 44.4px | 400 | letter-spacing -0.49px; one word per headline |
| Page H1 | system sans | 38px | 700 | `#363737` |
| Card title | system sans | 20 / 25px | 700 | |
| Card body | system sans | 17 / 24.7px | 400 | |
| Excerpt (secondary) | system sans | 14 / 19.6px | 400 | `#757575` |
| Button | system sans | 15px | 600 | |
| Chip | system sans | 14px | 600 | pill |
| Author / meta | system sans | 12-13px | 500-600 | `#757575` |
| Tiny meta | system sans | 9-11px | 400-600 | previews only |

## Shape

- Buttons: 8px radius (hero CTA 12px). Chips, subscribe pills: 999px. Cards: 20px.
- No heavy shadows; separation by tint (`#F5F5F5`) and 1px hairlines.

## Proposed mapping for Excel Guru (preview deployment only)

- `--background` #FFFFFF, `--surface` #F5F5F5, `--border` #DDDDDD
- `--text` #363737, `--text-muted` #757575, `--text-faint` #B6B6B6
- `--accent` #FF6719, `--accent-hover` #FF5600, `--on-accent` #FFFFFF
- Headings: system sans 700 with a serif-italic emphasis word in the hero; body system sans 17px/1.45.
- Keep Excel-grid colours (cells, ref highlights, green/red feedback) unchanged so lessons stay readable.

## Open question

Substack's orange is a brand colour. Using `#FF6719` exactly makes the preview look like Substack; a nearby orange avoids that. Your call on approval.
