---
name: sveltekit-reference
description: Offline snapshot of the official SvelteKit 2 documentation (routing, load functions, form actions, remote functions, hooks, page options, adapters/deployment, advanced routing, best practices, and full API reference). Reach for this when building or debugging a SvelteKit app — +page/+layout/+server files, load/actions, SSR/CSR/prerendering, adapters, env handling, hooks — and you want the authoritative docs offline. Vendored doc bundle, not authored guidance; treat kit.svelte.dev / svelte.dev as source of truth for anything newer.
user-invocable: true
---

# SvelteKit 2 — Reference Bundle

A local mirror of the official SvelteKit documentation tree, bundled for offline grep/read.
**Verbatim snapshot, not curated guidance** — confirm time-sensitive details against the live docs.

## What's inside — `docs/`

Mirrors the upstream SvelteKit docs section ordering:

| Folder | Covers |
|---|---|
| `10-getting-started/` | Introduction, project structure, web standards, `npx sv create` |
| `20-core-concepts/` | Routing, `load`, form actions, page options, state management, **remote functions** (experimental, since 2.27) |
| `25-build-and-deploy/` | Adapters (auto/node/static/vercel/netlify/cloudflare), SSR/prerender, env vars |
| `30-advanced/` | Advanced routing, hooks, errors, link options, service workers, server-only modules, snapshots, shallow routing, packaging |
| `40-best-practices/` | Auth, performance, images, accessibility, SEO |
| `60-appendix/` | Migration notes, integrations, breakpoints, glossary |
| `98-reference/` | Full API reference (`$app/*`, `$env/*`, `@sveltejs/kit`, CLI, config, types) |

## How to use

- Data loading semantics (`load`, `parent`, `depends`, invalidation, streaming)? `docs/20-core-concepts/`.
- Form handling (`actions`, `use:enhance`, progressive enhancement)? `docs/20-core-concepts/`.
- Deploying / choosing an adapter? `docs/25-build-and-deploy/`.
- Hooks (`handle`, `handleFetch`, `handleError`) and server-only modules? `docs/30-advanced/`.
- Exact signature of a `$app/*` or `@sveltejs/kit` export? `docs/98-reference/`.
- `grep -ri "<topic>" docs/` — pages keep their upstream frontmatter titles.

## Caveats

- Point-in-time snapshot. SvelteKit ships frequently and some features (e.g. remote functions)
  are experimental and evolving — see **Source & freshness** and check upstream for changes.
- Pairs with the `svelte5-reference` bundle for the component-level (runes/template) docs.

## Source & freshness

- Upstream: https://svelte.dev/docs/kit
- Reflects: SvelteKit 2.x (current latest at capture ≈ **2.68.x**), Svelte 5.
- Verified: 2026-06-30
