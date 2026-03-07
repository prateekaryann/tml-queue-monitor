# 🎪 Tomorrowland Queue Monitor

Monitors Tomorrowland Thailand 2026 Hotel Packages queue for multiple users via GitHub Actions. Sends email/Telegram alerts when queue status changes.

## How It Works

```
GitHub Actions (every 2 min)
  → Runs monitor.py
  → POST to iq.prod.tomorrowland.com for each user
  → Compares with previous status (stored in GH Actions cache)
  → Sends email/Telegram if status changed
```

## Setup (5 minutes)

### 1. Create Repository

```bash
# Option A: Create on GitHub, then clone
gh repo create tml-queue-monitor --private --clone
cd tml-queue-monitor

# Option B: Or just push this folder
git init
git remote add origin git@github.com:YOUR_USERNAME/tml-queue-monitor.git
```

### 2. Copy Files

```
tml-queue-monitor/
├── .github/
│   └── workflows/
│       └── monitor.yml      ← GitHub Actions workflow
├── monitor.py                ← Monitor script
└── README.md
```

### 3. Add GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

#### Required:

| Secret | Format | Example |
|--------|--------|---------|
| `USERS` | `userId:email\|userId:email` | `0a221e94-d50a-4efe-bf25-3f1de70955af:user@gmail.com\|uuid2:user2@gmail.com` |

#### Optional (Email alerts):

| Secret | Value |
|--------|-------|
| `SMTP_EMAIL` | Your Gmail address (e.g. `you@gmail.com`) |
| `SMTP_PASSWORD` | Gmail App Password ([generate here](https://myaccount.google.com/apppasswords)) |

#### Optional (Telegram alerts):

| Secret | Value |
|--------|-------|
| `TELEGRAM_TOKEN` | Bot token from [@BotFather](https://t.me/botfather) |
| `TELEGRAM_CHAT_ID` | Your chat ID from [@userinfobot](https://t.me/userinfobot) |

### 4. Push and Go

```bash
git add -A
git commit -m "Setup TML queue monitor"
git push origin main
```

The workflow starts automatically. You can also trigger manually:  
**Actions** tab → **TML Queue Monitor** → **Run workflow**

## Finding Your User ID

1. Open the Tomorrowland queue page in your browser
2. Open DevTools (`F12` or `Cmd+Option+I`)
3. Go to **Network** tab
4. Filter by `iq.prod`
5. Click any **POST** request
6. Look at **Payload** → copy the `userId` value

Format: `0a221e94-d50a-4efe-bf25-3f1de70955af`

## Adding/Removing Users

Update the `USERS` secret in GitHub:

```
# Single user
0a221e94-d50a-4efe-bf25-3f1de70955af:user@gmail.com

# Multiple users (pipe-separated)
uuid1:user1@gmail.com|uuid2:user2@gmail.com|uuid3:user3@gmail.com
```

## Gmail App Password Setup

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (enable if not already)
3. Search "App passwords" or go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Create → name it "TML Monitor"
5. Copy the 16-character password
6. Add as `SMTP_PASSWORD` secret (with or without spaces)

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`, follow prompts
3. Copy the bot token → add as `TELEGRAM_TOKEN`
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID
5. Add as `TELEGRAM_CHAT_ID`
6. **Important**: Send any message to your new bot first (to initialize the chat)

## Monitoring

- Check **Actions** tab to see run history
- Each run logs: user statuses, system health, notification delivery
- State persists across runs via GitHub Actions cache

## Cost

**$0** — GitHub Actions free tier includes 2,000 minutes/month.  
This workflow uses ~1 minute per run × 720 runs/month = **~720 minutes** (well within limits).

## Architecture (discovered via reverse engineering)

```
static-feed.tomorrowland.com  → CMS content (DatoCMS + CloudFront)
queue.prod.tomorrowland.com   → Queue config (CloudFront)
iq.prod.tomorrowland.com      → Queue position (Laravel + FrankenPHP)
fallback.tomorrowland.com     → Circuit breaker (CloudFront)
Auth: email + userId in POST body (no tokens/cookies needed)
```
