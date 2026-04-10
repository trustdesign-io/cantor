Apply a client brand to the project end-to-end: full multi-palette colour system
generation, design system, token application, typography, and documentation.

---

## INPUTS — Gather before touching any files

Ask the user for all five before proceeding.

| # | Input | Example |
|---|-------|---------|
| 1 | **Brand name** (lowercase, no spaces — used as palette prefix and folder name) | `acme` |
| 2 | **Primary hex colour** | `#2563eb` |
| 3 | **Industry / product type** | `B2B SaaS`, `fintech`, `healthcare` |
| 4 | **3 words describing the brand personality** | `trustworthy, modern, minimal` |
| 5 | **Palette relationship** | `complementary` / `analogous` / `triadic` / `split-complementary` / `let ui-ux-pro-max decide` (default) |

Do not proceed until all five are provided.

---

## Step 1 — Generate the full colour system

Derive five complete 11-shade scales (50–950) programmatically from the primary hex.

Use the shade generation algorithm and hue derivation rules from the starter-web `/apply-brand` command. The algorithm is identical — only the CSS target files differ.

---

## Step 2 — Apply tokens to src/index.css

Open `src/index.css`.

### 2a — Add all five scales as CSS custom properties in `:root`

```css
:root {
  /* [Brand name] colour system */
  --color-[brand]-primary-50:      #...;
  /* ... all 11 primary shades ... */
  --color-[brand]-primary-950:     #...;

  --color-[brand]-secondary-50:    #...;
  /* ... */

  --color-[brand]-accent-50:       #...;
  /* ... */

  --color-[brand]-success-50:      #...;
  /* ... */

  --color-[brand]-destructive-50:  #...;
  /* ... */
}
```

### 2b — Map to shadcn semantic variables

Update the existing semantic variables in `:root`:

```css
:root {
  --primary:                <brand-primary-500-hex>;
  --primary-foreground:     <brand-primary-50-hex>;
  --secondary:              <brand-secondary-500-hex>;
  --secondary-foreground:   <brand-secondary-50-hex>;
  --accent:                 <brand-accent-500-hex>;
  --accent-foreground:      <brand-accent-50-hex>;
  --destructive:            <brand-destructive-500-hex>;
  --ring:                   <brand-primary-500-hex>;
}
```

Leave `--background`, `--foreground`, `--muted`, `--border`, `--card`, and all other semantic variables unchanged.

---

## Step 3 — Apply typography

Choose a Google Font appropriate for the brand personality.

Update `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

Update `index.html` to add the `<link>` preconnect and font stylesheet in `<head>`.

---

## Step 4 — Write BRAND.md

Create `design-system/[brand-name]/BRAND.md` documenting:
- Brand name and personality words
- Palette relationship used
- All five colour scales with base-500 hex and intended usage
- Typography: font name, CSS variable, Google Fonts URL
- Key design decisions

---

## Step 5 — Commit

```bash
git add src/index.css index.html design-system/
git commit -m "brand: apply [brand-name] brand tokens and design system"
```
