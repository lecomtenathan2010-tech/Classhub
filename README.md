# ClassHub: v0 prototype

A web app for class chat and shared study summaries ("synthèses"). It follows version 0 of your design document:
accounts, classes with an invite code, class chat (realtime), uploading and opening syntheses, and 1 to 5 star ratings.

Not included yet (versions 1 to 3): credits, AI checks, leaderboard, marketplace, payments.

**Stack:** React + TypeScript + Vite for the app, Supabase for login, database, file storage and realtime chat.
The app runs in a browser, including on a phone, so you can test it without building an iOS or Android app first.

---

## 1. Run it on your computer (about 15 minutes, free)

You need [Node.js 18+](https://nodejs.org) and a free [Supabase](https://supabase.com) account.

1. **Create a Supabase project.** Choose an **EU region** (for example Frankfurt). This matters for GDPR later.
2. **Create the database.** In Supabase, open *SQL Editor > New query*, paste the whole of `supabase/schema.sql`, and click *Run*.
   This creates the tables, the security rules (each class only sees its own data), the file storage and the realtime chat.
3. **For testing, turn off email confirmation.** Go to *Authentication > Providers > Email* and switch off "Confirm email".
   Otherwise every test account needs a real inbox. Turn it back on before a real release.
4. **Connect the app.** Copy `.env.example` to `.env.local`. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   from *Project Settings > API*. The anon key is meant to be public. Never put the `service_role` key in this app.
5. **Start it:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:5173.

## 2. Test it alone

Use two browsers (or one normal window and one private window) to be two students at once.

- [ ] Sign up as **Student A**. Create a class. Open "Inviter" and note the 6-character code.
- [ ] Sign up as **Student B** in the other browser. Join with the code.
- [ ] Send messages from A. They should appear in B **without refreshing**.
- [ ] A uploads a PDF in "Synthèses". B opens it and rates it. A cannot rate their own synthesis.
- [ ] Sign up as **Student C** and do not join. C must not see the class, its messages or its files.
      This is the most important check, because it proves the row-level security works.
- [ ] Try an invalid code, a file over 10 MB, and a `.docx`. You should get clear error messages.

## 3. Share it with coworkers

Pick whichever is easiest.

**Quick, on the same Wi-Fi.** `npm run dev` already listens on your network. Share `http://<your-computer-IP>:5173`.
It only works while your computer is on, and only for people on the same network.

**Proper, with a public link (recommended).** Deploy the built app for free on Vercel or Netlify:
1. Push this folder to a GitHub repository (`.env.local` is already git-ignored).
2. Import the repo on [vercel.com](https://vercel.com) or [netlify.com](https://netlify.com). The build command is `npm run build` and the output folder is `dist`.
3. In the project settings, add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. You get a link like `https://classhub-xyz.vercel.app` that works on any phone.
   On a phone, "Add to Home Screen" makes it feel like an app.

Then give your coworkers a short script: create an account, join your class with the code, post one real synthesis,
rate someone else's. Ask them what confused them. Collect feedback in one shared place.

Tip: create one "Demo" class yourself first, with a few messages and syntheses, so testers don't open an empty app.

## 4. From prototype to release

Follow the roadmap in your design document, and validate each step with real students before building the next.

| Stage | What to do |
|---|---|
| **Now: v0 with coworkers** | Test the flow. Fix confusing screens. Check that people actually come back to the chat. |
| **Pilot with 1 or 2 real classes** | Ask a teacher or school first. Real students are the only test that counts for credit values and the chat. |
| **v1** | Credit ledger (server side only, as your document says), AI check on publication through a Supabase Edge Function calling Gemini. The API key must never be in the app. Add AI quotas from day one. |
| **v2 and later** | Marketplace, Premium, payments (Stripe), then school licences. |
| **Native app (optional)** | Once the web version works, wrap it with Capacitor or rebuild in Flutter/React Native for the app stores. |

**Before real students use it, do these (not optional for minors):**
- Write a simple privacy policy and terms of use in French (no copying of courses or textbooks, no exam answers).
- Under 13 needs parental consent in Belgium. Easiest to start with 13 and over, and say so at sign-up.
- Add a report button and a way to delete one's account and data (GDPR). The v0 database already deletes everything tied to a user if the account is removed.
- Turn email confirmation back on, and set Supabase's auth rate limits.
- Supabase's free tier pauses inactive projects and has storage limits. Plan to upgrade to the paid plan before a real launch.
- Moderation: class admins can already delete chat messages. The team-side report queue is not built yet.

## 5. Project layout

```
supabase/schema.sql        database, security rules, storage, realtime
src/App.tsx                login gate
src/components/Auth.tsx    sign up / log in
src/components/Home.tsx    my classes, create, join
src/components/ClassView.tsx   class page with Chat and Synthèses tabs
src/components/Chat.tsx        realtime chat
src/components/Syntheses.tsx   upload, list, open, rate
```

## Known limits of v0

- One chat channel per class (`general`). The `channel` column is already in the database for subject channels later.
- Photos are uploaded as images, not converted to PDF yet.
- No password reset screen yet (Supabase can send reset emails, the screen is not built).
- Everything is in French, as your document targets Belgian students. Strings live inside the components if you want to translate.
