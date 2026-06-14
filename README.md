# BulkPilot — Bulk Mail Sender

A local-first bulk mail studio built with **Next.js (App Router) + TypeScript + Tailwind**. All configuration (SMTP credentials, templates, attachments) lives in your **browser's localStorage** — nothing is persisted on a server. Sending happens through a Next.js API route using `nodemailer`, because a browser cannot open an SMTP socket directly.

## Flow

| Step | What it does | Stored in |
|------|--------------|-----------|
| **1. SMTP Setup** | Gmail address + 16-char App Password + sender name. Host/port preset to `smtp.gmail.com:465`. Includes a **Send test mail** button to verify the connection before bulk sending. | localStorage `bms:smtp` |
| **2. Templates** | Create/edit/delete multiple templates. Subject + body with `{{placeholder}}` tokens + attachments (base64). | localStorage `bms:templates` |
| **3. Recipients** | Upload `.xlsx/.xls/.csv`. Auto-detects email column, validates format, removes duplicates, flags bad rows in a preview. | in-memory (per session) |
| **4. Send** | Pick a template, preview the first recipient, send personalized mail to everyone. | — |

## Personalization

Every recipient gets the **same template**, but `{{column}}` tokens are filled from their Excel row (case-insensitive match against column headers). `{{email}}` always works. Unknown tokens render blank and are flagged before sending. Attachments are the **same files for every recipient**.

## Excel format

First row = headers. One column must be (or contain) emails — a header matching `email` is auto-detected, otherwise the most email-like column is used. Click **Download sample** in the app for a starter `.xlsx`:

```
email                | name  | company
alice@example.com    | Alice | Globex
bob@example.com      | Bob   | Initech
```

## Getting a Gmail App Password

1. Enable **2-Step Verification** on your Google account.
2. Go to `myaccount.google.com/apppasswords`.
3. Create a password for "Mail" and copy the 16 characters.
4. Paste it into Step 1 (spaces are stripped automatically).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Notes & limits

- Attachments are capped at **4 MB/file** and total localStorage is ~5 MB (browser limit) — large attachments may hit quota.
- Emails are sent **sequentially** server-side to stay under Gmail's rate/spam thresholds. Gmail free accounts allow ~500 recipients/day.
- SMTP credentials never touch any database — they travel from your browser to the API route to Gmail per request only.

## Stack

`next@14` · `react@18` · `nodemailer` · `xlsx` · `tailwindcss`

# BulkPilot---Bulk-mail-sender
