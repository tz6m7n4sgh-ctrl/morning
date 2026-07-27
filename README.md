# Morning — AI &amp; Tech News Digest

A tiny, zero-build web app that displays the daily AI &amp; technology news
digest collected into Supabase by the scheduled "Daily AI/Tech News Digest"
routine. It reads two tables and renders them as a clean, responsive feed:

- **News digest** — `public.ai_news_digest` (title, url, source, summary)
- **Model releases** — `public.ai_model_releases` (model, vendor, version, …)

## Stack

Plain HTML, CSS, and JavaScript. No build step, no framework, no bundler.
Data is read directly in the browser via [`@supabase/supabase-js`][sb] loaded
from a CDN. That means you can host it on any static host (GitHub Pages,
Netlify, Vercel, Cloudflare Pages) or just open `index.html` over a local
server.

```
index.html    markup + layout
styles.css    theme (light/dark) and components
app.js        data fetching, filtering, rendering
config.js     Supabase URL + publishable key
```

## Run locally

The app uses ES modules, so it must be served over HTTP (not opened as a
`file://` URL). Any static server works:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

## Configuration

Edit `config.js` to point at a different project or key:

```js
export const SUPABASE_URL = "https://<project-ref>.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_...";
```

The publishable (anon) key is **safe to ship in client-side code** — it only
ever grants what your Row Level Security (RLS) policies allow.

## Required: allow public read (RLS)

Both tables have **Row Level Security enabled**, which by default denies all
access. For this browser app to read them with the publishable key, add a
read-only policy for the `anon` role. Run this once in the Supabase SQL editor
(or via a migration):

```sql
-- Allow anonymous, read-only access to the digest tables.
create policy "public read" on public.ai_news_digest
  for select to anon using (true);

create policy "public read" on public.ai_model_releases
  for select to anon using (true);
```

This grants **read-only** access to these two tables only. Inserts/updates
still require the service role (used by the daily routine), so the public site
can display the digest but cannot modify it.

If the policy is missing, the app shows a clear message explaining that RLS is
blocking reads, rather than failing silently.

## Deploy

**GitHub Pages:** push these files, then enable Pages for the branch (root).
Because there is no build step, the repository root *is* the site.

**Netlify / Vercel / Cloudflare Pages:** point the project at this repo with
no build command and the repository root as the publish directory.

[sb]: https://supabase.com/docs/reference/javascript/introduction
