# Design Language — ControlPlane.ai (Tri-Guard)

---

## 1. Color & Theme

### Design Philosophy
ControlPlane.ai is an enterprise security and AI governance product. Its visual identity must convey **authority, precision, and real-time awareness** — the feeling of a mission-critical control room where operators trust what they see. The palette is deeply dark with high-contrast signal colors: a brand violet that communicates AI intelligence, semantic reds and ambers for risk, and clean greens for safe/governed states. This is not a consumer product — it should feel like Bloomberg Terminal meets modern SaaS design craft.

### Primary Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-brand-violet` | `#7C3AED` | Primary brand color. Used on key CTAs, active nav items, primary badges, Tri-Guard logo mark. Matches the reference imagery purple. |
| `--color-brand-violet-light` | `#A78BFA` | Hover states on violet elements, secondary highlights, inline callout borders |
| `--color-brand-violet-muted` | `#3B1F8C` | Deep violet for gradient backgrounds, sidebar dark panels, hero section depth |
| `--color-brand-green` | `#10B981` | "Governed / Safe / Pass" state indicators. Action: Silent Redact (low severity, resolved). |
| `--color-brand-amber` | `#F59E0B` | "Flag / Warning / Moderate risk" state. Action: Flag + Shadow Log. Cost risk indicators. |
| `--color-brand-red` | `#EF4444` | "Block / High severity / Critical risk" state. Action: Block + Escalate. Performance Risk high score. |
| `--color-brand-blue` | `#3B82F6` | "Reroute / Informational" state. Action: Reroute indicator. Info callouts. |

### Background & Surface Palette (Dark Mode — Primary)

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0A0A0F` | Deepest background. Page root, sidebar |
| `--bg-surface-1` | `#111118` | Card surfaces, panel backgrounds |
| `--bg-surface-2` | `#1A1A24` | Elevated surfaces, modals, dropdowns |
| `--bg-surface-3` | `#22222E` | Hovered card states, input backgrounds |
| `--bg-overlay` | `rgba(122, 58, 237, 0.06)` | Subtle violet tint overlay on focus areas, active sections |

### Text Palette

| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#F4F4F8` | Body text, headings on dark backgrounds |
| `--text-secondary` | `#A1A1B5` | Subtext, metadata, timestamps, helper labels |
| `--text-tertiary` | `#6B6B82` | Placeholder text, disabled states, faint labels |
| `--text-inverse` | `#0A0A0F` | Text on light/violet backgrounds (buttons) |

### Border Palette

| Token | Hex | Usage |
|---|---|---|
| `--border-subtle` | `rgba(255,255,255,0.06)` | Default card borders, dividers |
| `--border-default` | `rgba(255,255,255,0.12)` | Input borders, table separators |
| `--border-strong` | `rgba(255,255,255,0.24)` | Active/focused input borders |
| `--border-brand` | `rgba(124, 58, 237, 0.4)` | Focus rings on interactive elements |

### Risk Severity Color System

The risk color system is applied consistently across all guards and all views. This is a semantic system — the same color always means the same thing.

| Severity Level | Color Token | Score Range | Applied To |
|---|---|---|---|
| **Critical** | `--color-brand-red` (#EF4444) | 80–100 | Block + Escalate, high-risk incidents |
| **High** | `#F97316` (Orange) | 60–79 | Flag incidents, high attention items |
| **Medium** | `--color-brand-amber` (#F59E0B) | 40–59 | Flag + Log, moderate risk events |
| **Low** | `--color-brand-blue` (#3B82F6) | 20–39 | Reroute decisions, informational flags |
| **Safe** | `--color-brand-green` (#10B981) | 0–19 | Passed, redacted-and-resolved events |

### Gradient System

| Name | Definition | Usage |
|---|---|---|
| `gradient-brand` | `linear-gradient(135deg, #7C3AED 0%, #3B1F8C 100%)` | Primary CTA buttons, hero header background, sidebar top accent |
| `gradient-risk` | `linear-gradient(135deg, #EF4444 0%, #F97316 100%)` | Critical incident cards, high-risk score indicators |
| `gradient-safe` | `linear-gradient(135deg, #10B981 0%, #059669 100%)` | Governed output indicators, "all-clear" status banners |
| `gradient-surface` | `linear-gradient(180deg, #111118 0%, #0A0A0F 100%)` | Sidebar, navigation panel |
| `gradient-glow-violet` | `radial-gradient(ellipse at top, rgba(124,58,237,0.15) 0%, transparent 70%)` | Hero section ambient glow, dashboard header atmospheric effect |

### Dark Mode as Default, Light Mode as Option

The primary design mode is **dark**. Light mode is offered as a toggle for users in high-ambient-light environments or for printed compliance report export views. Light mode uses `#FAFAFA` base with the same brand violet and semantic risk colors.

---

## 2. Fonts

### Typeface Selection

| Role | Font Family | Source | Weight(s) Used |
|---|---|---|---|
| **Primary UI / Body / Labels** | `Inter` | Google Fonts | 400 (Regular), 500 (Medium), 600 (SemiBold) |
| **Headings / Display** | `Inter` | Google Fonts | 700 (Bold), 800 (ExtraBold) |
| **Monospace / Code / Log Data / Scores** | `JetBrains Mono` | Google Fonts | 400 (Regular), 500 (Medium) |
| **Brand / Marketing** | `Inter` | Google Fonts | 800 (ExtraBold) |

**Rationale**: Inter is the gold standard for dashboard-heavy enterprise SaaS (Linear, Vercel, Railway, Supabase all use it). It excels at both small UI labels and large display headings due to its optical sizing and tight letterspacing at display sizes. JetBrains Mono for all data-dense contexts (risk scores, token counts, log entries, audit hashes) signals precision and technical authority.

### Font Loading
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
```

---

## 3. Typography

### Type Scale

| Token | Font Size | Line Height | Letter Spacing | Font Weight | Usage |
|---|---|---|---|---|---|
| `--text-display-xl` | 48px | 1.1 | -0.03em | 800 | Hero page headline, marketing sections |
| `--text-display-lg` | 36px | 1.15 | -0.025em | 700 | Page titles, major section headers |
| `--text-display-md` | 28px | 1.2 | -0.02em | 700 | Dashboard section headings, modal titles |
| `--text-heading-lg` | 22px | 1.3 | -0.015em | 600 | Card headings, panel titles |
| `--text-heading-md` | 18px | 1.35 | -0.01em | 600 | Subsection headings, widget titles |
| `--text-heading-sm` | 15px | 1.4 | -0.005em | 600 | Table column headers, label headings |
| `--text-body-lg` | 16px | 1.6 | 0em | 400 | Primary body text, descriptions |
| `--text-body-md` | 14px | 1.55 | 0em | 400 | Default UI body text, form labels, table rows |
| `--text-body-sm` | 13px | 1.5 | 0em | 400 | Secondary text, metadata, captions |
| `--text-label` | 12px | 1.4 | 0.02em | 500 | Badge labels, chip text, nav item labels |
| `--text-micro` | 11px | 1.3 | 0.04em | 500 | Timestamps, chart axis labels, footnotes |
| `--text-mono-md` | 13px (JetBrains Mono) | 1.6 | 0em | 400 | Risk scores, token counts, log lines, hash values |
| `--text-mono-sm` | 12px (JetBrains Mono) | 1.5 | 0em | 400 | Inline code, API endpoint labels, audit IDs |

### Typography Rules

1. **Hierarchy enforced by weight + size, not color alone**. Color is used additively to reinforce meaning, not as the sole differentiator.
2. **Monospace for all numeric data in data-dense contexts** — risk scores, costs, token counts, latency values. This prevents layout shift as numbers update (fixed-width character widths).
3. **Uppercase sparingly** — only for `--text-label` and `--text-micro` contexts. Uppercase is used for category labels (e.g. "PERFORMANCE", "CRITICAL") with tight letter-spacing. Never for body copy.
4. **Line-height loosens with smaller font sizes** — maintains readability at dense UI scales.
5. **Maximum line-length** — body copy containers are capped at `68ch` to maintain optimal reading measure.
6. **Responsive scaling** — display sizes scale down on mobile via clamp(): `font-size: clamp(28px, 5vw, 48px)` for display-xl.

### CSS Custom Property Declaration

```css
:root {
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  --text-display-xl: 800 48px/1.1 var(--font-ui);
  --text-display-lg: 700 36px/1.15 var(--font-ui);
  --text-display-md: 700 28px/1.2 var(--font-ui);
  --text-heading-lg: 600 22px/1.3 var(--font-ui);
  --text-heading-md: 600 18px/1.35 var(--font-ui);
  --text-heading-sm: 600 15px/1.4 var(--font-ui);
  --text-body-lg: 400 16px/1.6 var(--font-ui);
  --text-body-md: 400 14px/1.55 var(--font-ui);
  --text-body-sm: 400 13px/1.5 var(--font-ui);
  --text-label: 500 12px/1.4 var(--font-ui);
  --text-micro: 500 11px/1.3 var(--font-ui);
  --text-mono-md: 400 13px/1.6 var(--font-mono);
  --text-mono-sm: 400 12px/1.5 var(--font-mono);
}
```

### Component-Level Typography Application

| Component | Typography Token | Notes |
|---|---|---|
| Governance Dashboard page title | `--text-display-md` | "Real-time Governance Feed" |
| Risk score number (large) | `--text-display-lg` + mono font | Numerals in metric cards |
| Incident card title | `--text-heading-md` | Event type label |
| Incident card body | `--text-body-md` | Rule triggered, short description |
| Badge/chip label | `--text-label` + uppercase | "CRITICAL", "REROUTED", "GDPR" |
| Table cell content | `--text-body-md` | Default row data |
| Timestamp | `--text-micro` + `--text-tertiary` | "2m ago", exact ISO timestamp on hover |
| Audit log entry | `--text-mono-md` | Log line, hash values |
| Cost value | `--text-mono-md` + `--text-body-lg` weight override | "$0.0042 / request" |
| Navigation labels | `--text-body-sm` + 500 weight | Sidebar nav items |
| CTA button text | `--text-heading-sm` | "Connect Model", "Create Policy" |
| Input placeholder | `--text-body-md` + `--text-tertiary` | Form inputs |
| Chart axis labels | `--text-micro` | X/Y axis tick labels |