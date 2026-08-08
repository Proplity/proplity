# Proplity — Next.js

This is the [Proplity](../Webapplicationandlogo-main) property-management app, converted from a
Vite + React SPA to **Next.js 14 (App Router)**.

## How the conversion works

The original app is a single-page app whose navigation is driven entirely by React state in
`app/App.tsx` (not by URLs). To preserve that behavior exactly:

- `app/App.tsx` is the interactive root and is marked `"use client"`. Every component it imports
  is automatically part of the client bundle — no other changes were needed.
- `app/page.tsx` (a server component) simply renders `<App />`.
- `app/layout.tsx` provides the root `<html>`/`<body>` and loads global styles.
- `app/globals.css` merges the original Tailwind v4 setup (`tailwind.css`) and design tokens
  (`theme.css`). Tailwind runs through `@tailwindcss/postcss` instead of the Vite plugin.
- All UI components live under `app/components/` exactly as in the original project.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Production build

```bash
npm run build
npm start
```
