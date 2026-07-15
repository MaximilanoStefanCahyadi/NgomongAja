# NgomongAja — Project Setup & Environments Guide

> Audience: a beginner software engineer on **Windows 11**, rebuilding NgomongAja
> as a fresh **Expo (React Native) app on SDK 54**, backed by **Supabase**
> (Auth, Postgres, Storage, Realtime) instead of Firebase.
>
> Every step explains **why**, not just what. When in doubt about any Expo
> command or API, check the versioned docs first:
> <https://docs.expo.dev/versions/v54.0.0/> — Expo changes fast, and answers
> for other SDK versions (or old blog posts) will mislead you.

---

## 1. Repo layout for the rebuild

Recommended structure:

```
NgomongAja/
├── app/            ← the NEW Expo app (fresh start, SDK 54 + Supabase)
├── mobile/         ← OLD prototype (Expo + Firebase). READ-ONLY reference.
├── web/            ← OLD web prototype. READ-ONLY reference.
├── supabase/       ← Supabase config + SQL migrations (created by Supabase CLI)
│   └── migrations/
└── docs/           ← PRD.md, this file, and other planning docs
```

**Why a new `app/` folder instead of rewriting inside `mobile/`?**
A rebuild mixed into old code makes it impossible to tell "new and intentional"
from "leftover and broken". A clean folder means every file in it is something
you chose to write. Keep `mobile/` around as a reference for product behavior
(how did the voice flow work? what did the screens look like?) until the new
app reaches feature parity — then delete `mobile/` and `web/` in a single
commit, so the deletion is easy to revert if you ever need the reference back.

**Why does `supabase/` live in the repo root, not inside `app/`?**
The database schema belongs to the *product*, not to one client app. If you
later add a web client, both apps share the same `supabase/` folder. The
Supabase CLI also expects to be run from the folder that contains `supabase/`.

Rule of thumb: **do not edit anything in `mobile/` or `web/` from now on.**

---

## 2. Toolchain install (Windows 11)

### 2.1 Node.js (LTS)

Install the current **LTS** version of Node from <https://nodejs.org> (LTS =
Long Term Support; it gets bug fixes for years, while "Current" can break
tooling). Expo SDK 54 requires a recent Node 20+ — LTS is the safe choice.

Verify in PowerShell:

```powershell
node --version   # should print v20.x or v22.x
npm --version
```

**Why not install `expo` globally?** You don't need to. `npx` (bundled with
npm) runs the correct version of a tool on demand — `npx expo start` always
matches the Expo version pinned in your project's `package.json`, so you never
fight "global CLI is version X but project expects Y" errors.

### 2.2 Supabase CLI

Install it as a **dev dependency of the repo** rather than globally:

```powershell
cd c:\MAXI\ASLAB\LEARNING\NgomongAja
npm init -y            # only if there is no package.json at the repo root yet
npm install supabase --save-dev
npx supabase --version
```

**Why as a dev dependency?** The CLI version gets pinned in `package.json` and
committed, so anyone (including future-you on a new laptop) gets the exact
same tool version. Reproducibility beats convenience.

### 2.3 Physical Android phone vs emulator

**Use a physical Android phone with the Expo Go app** (install "Expo Go" from
the Play Store, the version matching SDK 54).

**Why physical?** NgomongAja's core feature is **voice recording**. Emulators
have unreliable microphone passthrough and fake GPS, so you would be testing
the one feature that matters least accurately. A real phone gives you real
mic quality, real network latency to Groq/Gemini, and real permission prompts.

Setup: phone and PC on the **same Wi-Fi network**. If your Wi-Fi blocks
device-to-device traffic (common on campus networks), use
`npx expo start --tunnel` — slower, but works anywhere.

An emulator (Android Studio) is still fine later for quick UI-only checks.

---

## 3. Create the fresh Expo app (SDK 54, TypeScript, expo-router)

From the repo root:

```powershell
cd c:\MAXI\ASLAB\LEARNING\NgomongAja
npx create-expo-app@latest app --template default@sdk-54
```

**Why pin `@sdk-54` in the template?** Plain `create-expo-app` gives you
whatever SDK is newest *today*, which may not match this project's target (and
the docs you'll be reading). Pinning versions is a habit worth building early.
Verify the exact create command against
<https://docs.expo.dev/versions/v54.0.0/> if it errors — per this repo's
AGENTS.md, the versioned docs are the source of truth.

The default template already includes **TypeScript** and **expo-router**:

- **TypeScript** catches whole categories of mistakes *while you type*
  (misspelled property, wrong argument type) instead of at runtime on your
  phone, and gives you much better autocomplete. For a beginner this is a
  net time-saver within days, not a burden.
- **expo-router** gives file-based navigation: a file in `app/app/(tabs)/`
  becomes a screen automatically. Less boilerplate to learn than wiring up
  React Navigation by hand.

Sanity check:

```powershell
cd app
npx expo start
```

Scan the QR code with Expo Go on your phone; you should see the template app.

---

## 4. Supabase setup

### 4.1 Client library

```powershell
cd c:\MAXI\ASLAB\LEARNING\NgomongAja\app
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage react-native-url-polyfill
```

**Why `npx expo install` instead of `npm install`?** Expo picks the exact
package versions known to work with SDK 54, avoiding native-module version
mismatches — the most common source of confusing beginner errors.

### 4.2 Initialize the client (one file, imported everywhere)

Create `app/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,      // persist login sessions on the device
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // no browser URL handling in native apps
  },
});
```

**Why one shared client file?** One place to configure auth/storage behavior;
every screen just does `import { supabase } from '../lib/supabase'`.

### 4.3 Link the repo to the existing hosted project

The Supabase project already exists at
`https://moemakdfkddlbwoahigw.supabase.co`. Link your local repo to it:

```powershell
cd c:\MAXI\ASLAB\LEARNING\NgomongAja
npx supabase login                                  # opens browser, one-time
npx supabase init                                   # creates supabase/ folder
npx supabase link --project-ref moemakdfkddlbwoahigw
```

### 4.4 Migrations workflow (schema changes live in git)

Every schema change follows the same three steps:

```powershell
npx supabase migration new create_orders_table
# → edits supabase/migrations/<timestamp>_create_orders_table.sql
#   Write your CREATE TABLE / ALTER TABLE / RLS policy SQL in that file.
npx supabase db push        # applies pending migrations to the hosted project
git add supabase/migrations && git commit -m "db: create orders table"
```

**Why migrations-in-git instead of clicking in the Supabase dashboard?**

1. **Reproducible** — the entire schema can be rebuilt from the migration
   files. Dashboard clicks leave no record; six months from now nobody knows
   why a column exists.
2. **Reviewable** — schema changes show up in git diffs and pull requests
   like any other code.
3. **You actually learn SQL** — which is the durable skill here. The dashboard
   UI is a crutch; the SQL you write in migrations transfers to every job.

Use the dashboard for *looking at* data and testing queries, not for changing
schema.

---

## 5. Environment variables & secrets — READ THIS SECTION TWICE

> [!WARNING]
> **Anything prefixed `EXPO_PUBLIC_` is embedded in plain text inside the app
> bundle.** Anyone who downloads your APK can extract these values with free
> tools in minutes. `EXPO_PUBLIC_` does not mean "environment variable that is
> safe" — it means "value I am intentionally publishing to the world".
>
> Additionally: the old `mobile/.env` currently contains a **Supabase SECRET
> key** (`EXPO_SUPABASE_SECRET_KEY=sb_secret_...`) plus live Groq, Gemini,
> OpenRouter and NVIDIA keys — and `mobile/.gitignore` does **not** ignore
> `.env`. Treat all of those keys as **compromised**: rotate them in each
> provider's dashboard, and never put a secret key in any Expo app again.

### 5.1 The rule, in one table

| Value                              | In the app (`EXPO_PUBLIC_`)? | Why |
|------------------------------------|------------------------------|-----|
| Supabase URL                       | Yes                          | Public by design. |
| Supabase **publishable/anon** key  | Yes                          | Designed for clients. Row Level Security (RLS) policies in Postgres decide what each logged-in user can actually read/write — the key alone grants nothing. |
| Supabase **secret** key            | **NEVER**                    | Bypasses RLS entirely — full read/write to everything. Server-side only (Edge Functions). Rotate the leaked one now. |
| Groq / Gemini / OpenRouter keys    | Short-term only              | Exposed to anyone with the APK; they can burn your quota/bill. Acceptable for a private learning prototype; must move server-side before any real users (see 5.4). |

### 5.2 `.env` and `.env.example` pattern

In `app/`, create two files:

`app/.env` — real values, **never committed**:

```
EXPO_PUBLIC_SUPABASE_URL=https://moemakdfkddlbwoahigw.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_GROQ_API_KEY=gsk_...        # temporary, see 5.4
EXPO_PUBLIC_GEMINI_API_KEY=...          # temporary, see 5.4
EXPO_PUBLIC_OPENROUTER_API_KEY=...      # temporary, see 5.4
```

`app/.env.example` — same variable names, **fake values, committed**:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
EXPO_PUBLIC_GROQ_API_KEY=gsk_xxx
EXPO_PUBLIC_GEMINI_API_KEY=xxx
EXPO_PUBLIC_OPENROUTER_API_KEY=xxx
```

**Why the `.example` file?** It documents which variables the app needs
without leaking any values. A new machine setup is: copy it to `.env`, fill
in real values.

### 5.3 Confirm `.env` is gitignored — do this before your first commit

```powershell
# app/.gitignore must contain a line:  .env*
# then verify git really ignores it:
cd c:\MAXI\ASLAB\LEARNING\NgomongAja
git check-ignore -v app/.env    # should print the matching .gitignore rule
git status                      # app/.env must NOT appear
```

Add `.env*` (but not `.env.example` — use `!.env.example` on the next line)
to `app/.gitignore` if the template didn't. Also add a root-level ignore for
`mobile/.env` before ever staging the old folder.

**Why so paranoid?** Keys committed to git stay in history forever, even after
you "delete" the file — the only fix is rotation. One minute of checking now
saves an afternoon of rotating keys later.

### 5.4 The right long-term home for API keys: Supabase Edge Functions (post-MVP)

The proper design is a small **proxy**: the app calls a Supabase **Edge
Function** (a serverless function running next to your database), the function
holds the Groq/Gemini/OpenRouter keys as Supabase **secrets**
(`npx supabase secrets set GROQ_API_KEY=...`), calls the external API, and
returns the result. The app then contains **zero** external API keys, and the
function can also verify the caller is a logged-in user before spending your
quota. Migration path: keep `EXPO_PUBLIC_` keys while learning → build one
Edge Function (start with the Groq/Whisper call, it's the most quota-hungry) →
point the app at it → delete the keys from `.env` and rotate them.

---

## 6. Dev workflow

**Running the app** — daily loop:

```powershell
cd c:\MAXI\ASLAB\LEARNING\NgomongAja\app
npx expo start          # add --tunnel if the phone can't reach your PC
```

Save a file → the app reloads on your phone in ~1 second (Fast Refresh).
Note: after changing `.env`, restart `expo start` — env values are read at
bundle time, not live.

**Branches** — work phase-by-phase on feature branches:

```
feat/phase-1-auth
feat/phase-2-voice-recording
fix/voice-parse-quantity-bug
```

**Why feature branches for a solo learning project?** `main` always stays in a
working state you can demo, and if an experiment goes wrong you throw the
branch away instead of untangling `main`. Merging a finished phase is also a
satisfying, visible milestone.

**Commits** — small and frequent, one logical change each
(`feat: record button with expo-av`, `db: add RLS policy for orders`).
Small commits make `git log` a diary of what you learned, and make it trivial
to find which change broke something.

---

## 7. Minimal CI with GitHub Actions (optional, post-MVP)

Once the app has real code, a tiny CI job that runs typecheck + lint on every
push catches "works on my machine" mistakes automatically. This is optional —
add it when it starts saving you time, not before.

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22          # pin: same major as your local LTS
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci                 # ci = exact versions from the lockfile
      - run: npx tsc --noEmit       # typecheck only, no build output
      - run: npx expo lint
```

**Why `npm ci` instead of `npm install`?** It installs *exactly* what the
lockfile says, so CI tests the same dependency versions you ran locally.
No secrets are needed for typecheck/lint — keep it that way; if a workflow
ever needs a key, it goes in GitHub Actions **Secrets**, never in the YAML.

---

## 8. Phased infrastructure roadmap

| Phase | What | Done when |
|-------|------|-----------|
| 0 | This document: toolchain, fresh `app/`, `.env` hygiene, keys rotated | Template app runs on your phone via Expo Go |
| 1 | Schema + RLS as migrations (`supabase migration new` → `db push`) | Tables exist; every table has RLS enabled with policies |
| 2 | Supabase Auth wired into the app (sign up / login / session persistence) | You can log in on the phone and stay logged in after restart |
| 3 | Core features: voice recording → Groq STT → LLM parse (Gemini, OpenRouter fallback) → match against store catalog → create order (keys still `EXPO_PUBLIC_`, prototype-only) | End-to-end voice order works on a real phone |
| 4 | Edge Functions proxy for Groq/Gemini/OpenRouter; delete client keys, rotate them | APK contains zero external API keys |
| 5 | EAS Build: `npx eas build -p android --profile preview` → installable APK for real-device testing without Expo Go | Testers install the APK directly |

Each phase leaves the project in a working, demoable state — that is the
whole point of phasing.
