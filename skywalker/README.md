# Skywalker

A travel journal you lay out like a scrapbook. Write stories on a free-form canvas
(photos, polaroids, collages, stickers, notes, video, music), pin them to places on a
3D globe, group them into multi-stop trips, and browse every photo in a gallery.
Readers can comment and react to each section of a story.

Built with React 19, Vite 6, Tailwind 4, react-globe.gl / three.js and Supabase.
It also installs as a PWA (iOS and Android).

## Quick start

```sh
nvm use            # Node 24 (from .nvmrc); package.json requires >= 22
npm ci
cp .env.example .env   # optional: leave the key blank for mock mode
npm run dev
```

Then open http://localhost:5173.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (Dashboard → Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | The project's **publishable / anon** key |

Only use the publishable key. Every `VITE_*` variable ends up in the client bundle,
so a `service_role` key must never go here.

## Two data modes

The app picks its backend at startup ([src/lib/supabase.js](src/lib/supabase.js)):

- **Supabase mode**: both env vars are set. Data, auth, storage and realtime come
  from Supabase, and access is enforced by RLS.
- **Mock mode**: either var is unset. The stores (`collection.js`, `blogStore`,
  `commentStore`, `tripStore`) read and write `localStorage` instead
  ([src/lib/storage.js](src/lib/storage.js)), with fake latency so the Promise API
  behaves the same. There is no sign-in, and editing is always allowed. This is useful for
  UI work offline. It is also what CI builds.

Every feature should work in both modes.

## Accounts and roles (Supabase mode)

Roles: `pending` → `user` → `admin` → `super_admin`.

- The **first** account to sign up on a fresh project becomes `super_admin`.
- Everyone after that starts as `pending` and can't do anything until a super admin
  approves them (or rejects them, which deletes the sign-up) on `/account`.
- Anyone can read published stories. Only `admin` / `super_admin` can create, edit or
  delete content.

## Database migrations

The schema lives in [supabase/migrations/](supabase/migrations/), as timestamped SQL
files. Apply them **in filename order** to a new project, for example with the
Supabase CLI:

```sh
supabase link --project-ref <your-ref>
supabase db push
```

The data model (locations/pins, trips and trip stops, blogs, photos) is described in
[docs/data-architecture-spec.md](docs/data-architecture-spec.md). The canvas editor is
described in [docs/canvas-editor-spec.md](docs/canvas-editor-spec.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Run the Vitest unit tests once (`src/**/*.test.js`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run pwa-assets` | Regenerate PWA icons and splash screens in `public/pwa/` from `art/brand/logo.png` |
| `npm run scrapbook-art` | Cut the sticker sheets in `art/sheets/*.svg` into `public/scrapbook/` and update `src/data/scrapbookArt.json` |

Unit tests sit next to the module they cover (`src/lib/geo.js` → `src/lib/geo.test.js`)
and import `describe`/`it`/`expect` from `vitest` explicitly. CI
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs `npm ci` → `lint` →
`build` → `test` on Ubuntu for every push to `main` and every PR.

## Routes

| Path | Page |
|---|---|
| `/` | Landing: hero carousel and story feed |
| `/blogs` | All stories |
| `/blogs/:id` | Read a story, with comments and reactions |
| `/blogs/new`, `/blogs/edit/:id` | Scrapbook editor (admin only in Supabase mode) |
| `/blogs/drafts` | Drafts (admin only in Supabase mode) |
| `/globe` | 3D globe with pins and trips (`/maps` redirects here) |
| `/gallery` | Photo and video gallery |
| `/account` | Sign in, profile, avatar, account approval |

## Project layout

```text
src/
  pages/        route components
  components/   UI, including Editor/Canvas (scrapbook editor) and the globe
  lib/          data stores, Supabase client, geo, EXIF, media helpers
  data/         scrapbook art catalogue, keyword dictionary
  types/        JSDoc type definitions (hierarchy.d.ts)
supabase/migrations/   database schema
public/        static assets (scrapbook art, avatars, PWA icons, countries.geojson)
art/           source artwork for the two asset scripts (not shipped)
scripts/       the asset-generation scripts
docs/          specs
```
