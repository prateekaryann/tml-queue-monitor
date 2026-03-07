#!/usr/bin/env python3
"""
Tomorrowland Queue Monitor — GitHub Actions Edition
=====================================================
Runs as a single check (--once mode) with state persisted via JSON file.
GitHub Actions calls this every 2 minutes via cron.

State flow:
  1. Load previous state from state.json (restored from GH Actions cache)
  2. Check each user's queue position via iq.prod
  3. Compare with previous state → send alerts if changed
  4. Save new state to state.json (cached for next run)

Env vars (set as GitHub Secrets):
  USERS           - Pipe-separated "userId:email" pairs
                    e.g. "uuid1:email1|uuid2:email2"
  SMTP_EMAIL      - Gmail address to send from (optional)
  SMTP_PASSWORD   - Gmail App Password (optional)
  TELEGRAM_TOKEN  - Telegram Bot Token (optional)
  TELEGRAM_CHAT_ID - Telegram Chat ID (optional)
"""

import json
import os
import sys
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

import requests

# ─── Config ───

QUEUE_ID = "WD9YMQT37OCGMH15UNTZR"
IQ_URL = f"https://iq.prod.tomorrowland.com/tickets/{QUEUE_ID}"
FALLBACK_URL = f"https://fallback.tomorrowland.com/queue.prod.tomorrowland.com/{QUEUE_ID}/fallback.json"
STATE_FILE = "state.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://queue.prod.tomorrowland.com",
    "Referer": "https://queue.prod.tomorrowland.com/",
}


# ─── State Management ───

def load_state() -> dict:
    """Load previous run state from JSON file."""
    try:
        with open(STATE_FILE, "r") as f:
            state = json.load(f)
            print(f"  Loaded state: {len(state.get('users', {}))} users tracked")
            return state
    except (FileNotFoundError, json.JSONDecodeError):
        print("  No previous state found (first run)")
        return {"users": {}, "system_healthy": True, "last_run": None}


def save_state(state: dict):
    """Save current state to JSON file."""
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    print(f"  State saved: {len(state['users'])} users")


# ─── API Checks ───

def check_queue_position(user_id: str, email: str) -> dict:
    """POST to iq.prod to check queue status."""
    url = f"{IQ_URL}/{user_id}"
    payload = {"id": user_id, "email": email, "userId": user_id}
    resp = requests.post(url, json=payload, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    rl = resp.headers.get("x-ratelimit-remaining", "?")
    return {"status": data.get("status", "unknown"), "full_response": data, "rate_limit": rl}


def check_system_health() -> bool:
    """Check fallback endpoint."""
    try:
        url = f"{FALLBACK_URL}?cacheBust={int(time.time())}"
        resp = requests.get(url, headers=HEADERS, timeout=10)
        data = resp.json()
        return not bool(data)  # empty {} = healthy
    except Exception:
        return False


# ─── Notifications ───

def send_email(to_email: str, subject: str, html_body: str):
    """Send email via SMTP."""
    smtp_email = os.environ.get("SMTP_EMAIL")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_email or not smtp_password:
        print("  Email not configured, skipping")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_email
        msg["To"] = to_email
        msg["Subject"] = subject

        html = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #d63a76, #8c0038); color: white; 
                        padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                <div style="font-size: 11px; letter-spacing: 3px; opacity: 0.8;">QUEUE ALERT</div>
                <div style="font-size: 20px; font-weight: 700; margin-top: 6px;">
                    Tomorrowland Thailand 2026
                </div>
            </div>
            <div style="padding: 20px; background: #fff; border: 1px solid #eee; 
                        border-top: none; border-radius: 0 0 10px 10px;">
                {html_body}
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee; 
                            font-size: 11px; color: #999;">
                    Queue ID: {QUEUE_ID}<br>
                    Checked at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
                </div>
            </div>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)
        print(f"  ✅ Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"  ❌ Email failed: {e}")
        return False


def send_telegram(message: str):
    """Send Telegram notification."""
    token = os.environ.get("TELEGRAM_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        resp = requests.post(url, json={
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
        }, timeout=10)
        if resp.ok:
            print(f"  ✅ Telegram sent")
        return resp.ok
    except Exception as e:
        print(f"  ❌ Telegram failed: {e}")
        return False


def notify_status_change(email: str, user_id: str, old_status: str, new_status: str, full_response: dict):
    """Send all configured notifications."""
    print(f"\n  🚨 STATUS CHANGED: {email}")
    print(f"     {old_status} → {new_status}")
    print(f"     Response: {json.dumps(full_response)}")

    is_turn = new_status not in ("in_queue", "error", "unknown")

    # Email
    subject = f"🎪 TML Queue: {new_status.upper()} — {email}"
    html_body = f"""
        <div style="font-size: 15px; margin-bottom: 12px; font-weight: 600;">
            Queue status changed!
        </div>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #999; width: 100px;">Email</td>
                <td style="padding: 8px 0; font-weight: 600;">{email}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #999;">Previous</td>
                <td style="padding: 8px 0;">{old_status}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #999;">Current</td>
                <td style="padding: 8px 0; font-weight: 700; 
                    color: {'#059669' if is_turn else '#d97706'};">
                    {new_status}
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #999;">Raw</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">
                    {json.dumps(full_response)}
                </td>
            </tr>
        </table>
        {'<div style="margin-top: 16px; padding: 14px; background: #ecfdf5; border-radius: 8px; color: #059669; font-weight: 700; font-size: 15px; text-align: center;">🚀 CHECK YOUR BROWSER NOW!</div>' if is_turn else ''}
    """
    send_email(email, subject, html_body)

    # Telegram
    tg_msg = (
        f"🎪 <b>TML Queue Alert</b>\n\n"
        f"<b>{email}</b>\n"
        f"Status: {old_status} → <b>{new_status}</b>\n"
        f"Response: <code>{json.dumps(full_response)}</code>\n\n"
        f"{'🚀 CHECK YOUR BROWSER NOW!' if is_turn else ''}"
    )
    send_telegram(tg_msg)


def notify_system_health_change(healthy: bool):
    """Alert on system health changes."""
    status = "HEALTHY ✅" if healthy else "DEGRADED ⚠️"
    print(f"\n  ⚠️ SYSTEM HEALTH CHANGED: {status}")

    send_telegram(f"🎪 <b>TML System Health</b>\n\nStatus: <b>{status}</b>")


# ─── Main ───

def main():
    print("=" * 55)
    print(f"  🎪 TML Queue Monitor — GitHub Actions")
    print(f"  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 55)

    # Parse users from env
    users_env = os.environ.get("USERS", "")
    if not users_env:
        print("  ❌ No USERS env var set. Add it as a GitHub Secret.")
        print('  Format: "uuid1:email1|uuid2:email2"')
        sys.exit(1)

    users = []
    for entry in users_env.split("|"):
        entry = entry.strip()
        if not entry or ":" not in entry:
            continue
        user_id, email = entry.split(":", 1)
        users.append({"user_id": user_id.strip(), "email": email.strip()})

    print(f"\n  Users: {len(users)}")
    for u in users:
        print(f"    • {u['email']} ({u['user_id'][:12]}…)")

    # Notification config
    has_email = bool(os.environ.get("SMTP_EMAIL") and os.environ.get("SMTP_PASSWORD"))
    has_telegram = bool(os.environ.get("TELEGRAM_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"))
    print(f"\n  Notifications:")
    print(f"    Email:    {'✅ Configured' if has_email else '❌ Not set'}")
    print(f"    Telegram: {'✅ Configured' if has_telegram else '❌ Not set'}")

    # Load previous state
    print(f"\n  Loading state...")
    state = load_state()

    # Check system health
    print(f"\n  Checking system health...")
    healthy = check_system_health()
    prev_healthy = state.get("system_healthy", True)
    if healthy != prev_healthy:
        notify_system_health_change(healthy)
    state["system_healthy"] = healthy
    print(f"  System: {'🟢 Healthy' if healthy else '🔴 Degraded'}")

    # Check each user
    print(f"\n  Checking queue positions...")
    results = []
    for u in users:
        try:
            result = check_queue_position(u["user_id"], u["email"])
            new_status = result["status"]
            prev_status = state["users"].get(u["user_id"], {}).get("status")

            status_icon = "⏳" if new_status == "in_queue" else "🚀"
            print(f"  {status_icon} {u['email']:35s} {new_status:15s} (rl: {result['rate_limit']})")

            # Detect change
            if prev_status and prev_status != new_status:
                notify_status_change(
                    u["email"], u["user_id"],
                    prev_status, new_status,
                    result["full_response"]
                )

            # Update state
            state["users"][u["user_id"]] = {
                "email": u["email"],
                "status": new_status,
                "last_checked": datetime.now(timezone.utc).isoformat(),
                "full_response": result["full_response"],
            }

            results.append({"email": u["email"], "status": new_status})

            # Rate limit delay between users
            if len(users) > 1:
                time.sleep(3)

        except Exception as e:
            print(f"  ❌ {u['email']:35s} ERROR: {str(e)[:50]}")
            state["users"][u["user_id"]] = {
                "email": u["email"],
                "status": "error",
                "last_checked": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            }
            results.append({"email": u["email"], "status": "error"})

    # Save state
    print(f"\n  Saving state...")
    save_state(state)

    # Summary
    print(f"\n{'─' * 55}")
    statuses = {}
    for r in results:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    summary = " | ".join(f"{s}: {c}" for s, c in statuses.items())
    print(f"  Summary: {summary}")
    print(f"{'─' * 55}\n")


if __name__ == "__main__":
    main()
