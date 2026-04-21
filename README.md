# FiveM Payout Bot — Setup Guide

## What it does
- Watches your invoice channel for "Invoice Paid" embeds from Snipe Logs
- Automatically tracks each employee's paid invoices across the week
- Posts a weekly payout summary every Sunday at 8 PM (configurable)
- Also works on-demand with commands

---

## Step 1 — Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. "Payout Bot")
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent**
5. Click **Reset Token** → copy your token → paste into `bot.js` as `BOT_TOKEN`
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Read Messages`, `Send Messages`, `Read Message History`
7. Open the generated URL and invite the bot to your server

---

## Step 2 — Get Channel IDs

In Discord: **Settings → Advanced → Enable Developer Mode**

Then right-click your invoice channel → **Copy Channel ID** → paste as `INVOICE_CHANNEL_ID`
Do the same for the channel you want payout summaries posted in → `PAYOUT_CHANNEL_ID`

---

## Step 3 — Install & Run

Make sure you have Node.js installed (https://nodejs.org — get the LTS version).

```bash
# In the payout-bot folder:
npm install
npm start
```

The bot will log `Bot online as Payout Bot#1234` when it's working.

---

## Commands

| Command | What it does |
|---|---|
| `!payout` | Post the weekly summary right now and reset |
| `!status` | Show this week's totals without resetting |
| `!reset` | Clear this week's data |
| `!setcut 65` | Change employee cut to 65% on the fly |

---

## Config options (top of bot.js)

| Setting | Default | Description |
|---|---|---|
| `CUT_PERCENT` | `0.70` | Employee cut (70%) |
| `PAYOUT_DAY` | `0` | Auto-post day (0=Sunday) |
| `PAYOUT_HOUR` | `20` | Auto-post hour (20=8PM) |

---

## Free hosting options (so the bot stays online 24/7)

- **Railway** — https://railway.app (free tier, easy deploy)
- **Render** — https://render.com (free background worker)
- **Your own PC** — just leave the terminal open or use PM2:
  ```bash
  npm install -g pm2
  pm2 start bot.js
  pm2 save
  ```
