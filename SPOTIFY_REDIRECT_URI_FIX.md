# Spotify Redirect URI Configuration - FIX

## Problem
You're getting a Spotify error (likely `invalid_request`) on the callback, which means **the redirect URI does not match**.

---

## Step 1: Open Spotify Developer Dashboard

1. Go to: https://developer.spotify.com/dashboard
2. Find and click on your app (Client ID: `060af9faf02a4879bf7081fd088e06cf`)
3. Click **Edit Settings** button

---

## Step 2: Check Redirect URIs

Look for the **Redirect URIs** section.

### ✅ CORRECT Configuration:

Add **ONLY this one**:
```
http://127.0.0.1:5500/callback/
```

**Important notes:**
- ✅ Must include the **trailing slash** (`/callback/`)
- ✅ Must be exactly: `http://127.0.0.1:5500/callback/`
- ✅ Don't include any other versions

### ❌ WRONG Configurations (Remove if present):

- `http://127.0.0.1:5500/callback` ← No trailing slash (DELETE)
- `http://127.0.0.1:5500/` ← Wrong path (DELETE)
- `http://localhost:5500/callback/` ← Wrong host (DELETE)
- Any duplicates (DELETE)

---

## Step 3: Save Changes

1. Scroll down to the bottom
2. Click **Save** button
3. Wait for confirmation

---

## Step 4: Test Again

1. Return to your app at: http://127.0.0.1:5500
2. Hard refresh: **Ctrl + F5**
3. Click "🎵 Connect Spotify" button
4. Check console (F12) for detailed logs
5. You should see progress: Code → Verify → Exchange → Token → Dashboard

---

## Debugging Logs

When you click "Connect Spotify", your console will show:

```
🟦 SPOTIFY AUTHORIZATION REQUEST:
═══════════════════════════════════════════════════════
Client ID: 060af9faf02a4879bf7081fd088e06cf
Redirect URI: http://127.0.0.1:5500/callback/
⚠️  VERIFY THIS MATCHES SPOTIFY DASHBOARD EXACTLY ⚠️
Scopes: user-read-private user-read-email playlist-read-private playlist-read-public user-top-read
...
```

**Compare the "Redirect URI" in console with what's in Spotify Dashboard** — they must match exactly.

---

## If Still Getting Error

### Check #1: URL Mismatch
Spotify shows error on callback? Check these:
- [ ] Redirect URI has trailing slash: `/callback/` not `/callback`
- [ ] Uses `127.0.0.1` not `localhost`
- [ ] Uses port `5500` (live-server port)
- [ ] No extra spaces or characters

### Check #2: Duplicate URIs
- [ ] Only ONE redirect URI registered in Spotify
- [ ] Not multiple versions with/without trailing slash
- [ ] No old URIs from previous tests still there

### Check #3: Console Logs
Open DevTools (F12) and:
1. Click "🎵 Connect Spotify" button
2. You'll be redirected to Spotify login
3. After authorizing, return to your app
4. You should see green debug logs showing each step
5. Or red error logs showing what failed

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_request` | Redirect URI mismatch | Check Spotify Dashboard redirect URIs |
| `invalid_scope` | Invalid scope requested | Scopes are hardcoded; check app permissions |
| `invalid_client` | Wrong Client ID | Verify Client ID: `060af9faf02a4879bf7081fd088e06cf` |
| Authorization code: NULL | URL doesn't have `?code=` | Redirect URI returned error instead of code |

---

## Quick Reference

```
✅ Correct Redirect URI:
http://127.0.0.1:5500/callback/

❌ Wrong Redirect URIs:
http://127.0.0.1:5500/callback    (no trailing slash)
http://localhost:5500/callback/   (uses localhost)
http://127.0.0.1:5500/            (wrong path)
```

**After any change in Spotify Dashboard, hard refresh your browser (Ctrl+F5)!**
