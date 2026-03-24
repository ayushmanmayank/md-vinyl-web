# 🎵 Spotify Web API Integration - Setup Guide

## ✅ IMPLEMENTATION STATUS

All Spotify Web API integration modules have been created:
- ✅ PKCE implementation (SHA256, Base64 URL encoding)
- ✅ Authorization Code Flow with PKCE
- ✅ Token exchange and refresh
- ✅ Callback page handler
- ✅ Spotify API client
- ✅ Dashboard UI with React
- ✅ Client-side routing

---

## 🔴 CRITICAL: Add Spotify Client ID

**FILE:** `src/spotify/auth.js` (Line 13)

```javascript
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID_HERE';
```

**⚠️ MUST REPLACE WITH YOUR OWN CLIENT ID**

---

## 📋 REDIRECT URIs FOR SPOTIFY DASHBOARD

**Add these Redirect URIs in Spotify Developer Dashboard:**

### Local Development:
```
http://127.0.0.1:3000/callback/
http://127.0.0.1:5500/callback/
http://localhost:3000/callback/
http://localhost:5500/callback/
```

### Production (Vercel):
```
https://md-vinyl-web-eight.vercel.app/callback/
https://md-vinyl-web.vercel.app/callback/
```

### Steps to Add Redirect URIs:
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Sign in with your Spotify account
3. Select your app
4. Go to **Settings**
5. Under **Redirect URIs**, paste each URI above
6. Click **Save**

---

## 🏗️ PROJECT STRUCTURE

```
md-vinyl-web/
├── src/
│   ├── spotify/
│   │   ├── auth.js       (Authorization flow, token exchange)
│   │   ├── api.js        (Spotify API calls)
│   │   └── pkce.js       (PKCE implementation)
│   └── pages/
│       ├── Callback.jsx  (OAuth callback handler)
│       └── SpotifyDashboard.jsx (User dashboard)
├── index.html (Router & React components)
├── script.js  (Original vinyl player)
├── style.css  (Styling)
└── package.json
```

---

## 🔐 SECURITY FEATURES

✅ **PKCE (Proof Key for Public Clients)**
- Generates random 32-byte code verifier
- Creates SHA256 hash (code challenge)
- Base64 URL encodes both values
- No client secret needed (safe for browser)

✅ **Token Management**
- Stores access token in sessionStorage (not localStorage)
- Tracks token expiry
- Auto re-login on 401 Unauthorized
- Rate limit retries with exponential backoff

✅ **Error Handling**
- Comprehensive logging for debugging
- User-friendly error messages
- Automatic retry on network failures

---

## 🚀 AUTHENTICATION FLOW

### 1. **User Clicks "Connect Spotify"**
```
Home Page → Spotify Login Button
```

### 2. **Authorization Request**
```
Your App
    ↓
https://accounts.spotify.com/authorize
  - response_type=code ✅ (NOT token)
  - client_id
  - redirect_uri=/callback/
  - code_challenge (PKCE)
  - scopes
```

### 3. **User Authorizes**
```
Spotify Login → User Approves → Redirects to /callback/?code=XXXXX
```

### 4. **Callback Handler Extracts Code**
```
/callback/?code=XXXXX
    ↓
Extracts code from query params
```

### 5. **Token Exchange** (Backend won't work with PKCE client-side, but we're doing it here safely)
```
POST https://accounts.spotify.com/api/token
{
  grant_type: authorization_code
  code: XXXXX
  redirect_uri: /callback/
  client_id
  code_verifier (PKCE)
}
    ↓
Response: { access_token, expires_in, ... }
```

### 6. **Store Token & Redirect**
```
sessionStorage.setItem('spotify_access_token', token)
sessionStorage.setItem('spotify_token_expiry', expiry)
    ↓
window.location.href = '/spotify-dashboard'
```

### 7. **Load Dashboard**
```
Dashboard Component
    ↓
Fetch User Profile (/v1/me)
Fetch Playlists (/v1/me/playlists)
Fetch Top Tracks (/v1/me/top/tracks)
Fetch Recommendations (/v1/recommendations)
    ↓
Display Data
```

---

## 📡 API ENDPOINTS AVAILABLE

All Spotify API calls include `Authorization: Bearer {token}` header automatically.

### User Profile
```javascript
import { getCurrentUser } from './src/spotify/api.js';
const profile = await getCurrentUser();
```

### Playlists
```javascript
import { getUserPlaylists } from './src/spotify/api.js';
const playlists = await getUserPlaylists({ limit: 20 });
```

### Top Tracks
```javascript
import { getUserTopTracks } from './src/spotify/api.js';
const tracks = await getUserTopTracks({ 
  time_range: 'medium_term',  // or 'short_term', 'long_term'
  limit: 20 
});
```

### Recommendations
```javascript
import { getRecommendations } from './src/spotify/api.js';
const recommendations = await getRecommendations({
  seed_tracks: 'id1,id2,id3',
  limit: 20
});
```

### Search
```javascript
import { search } from './src/spotify/api.js';
const results = await search('Dua Lipa', 'track', { limit: 20 });
```

---

## 🧪 TESTING LOCALLY

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Get Your Client ID
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create an app
3. Copy your **Client ID**

### Step 3: Update Client ID
Edit `src/spotify/auth.js` line 13:
```javascript
const CLIENT_ID = 'your-actual-client-id-here';
```

### Step 4: Add Redirect URI
In Spotify Dashboard:
1. Go to Your App → Settings
2. Add: `http://127.0.0.1:5500/callback/`
3. Save

### Step 5: Start Development Server
```bash
npm run dev
```
This starts live-server on `http://127.0.0.1:5500`

### Step 6: Test the Flow
1. Navigate to `http://127.0.0.1:5500`
2. Click "🎵 Connect Spotify" button
3. Log in to Spotify
4. Authorize the app
5. Should be redirected to `/callback/?code=XXXXX`
6. Should show "Exchanging code for token..."
7. Should redirect to `/spotify-dashboard`
8. Should see your profile, playlists, top tracks

---

## 🔍 DEBUGGING

### Check Browser Console
Open DevTools (F12) → Console tab to see:
- ✅ Auth URL being constructed
- ✅ Code verifier and challenge
- ✅ Callback URL received
- ✅ Code extracted
- ✅ Token exchange request/response
- ❌ Any errors or missing code

### Common Issues

**"Authorization code missing from callback URL"**
- ❌ Using implicit flow (response_type=token) instead of code
- ✅ Solution: Ensure response_type=code in auth.js line 45

**"Code exchange failed"**
- ❌ Redirect URI mismatch between auth request and token exchange
- ✅ Solution: Check that redirect_uri is exactly the same in both places
- ✅ Solution: Add trailing slash if needed: `/callback/`

**Token Expired**
- ❌ Token stored is from previous session
- ✅ Solution: Clear sessionStorage and log in again

**CORS Errors**
- ❌ Spotify API doesn't allow cross-origin from browser
- ✅ Solution: This app uses CORS-friendly Spotify endpoints only

---

## 📚 KEY FILE LOCATIONS

| File | Purpose |
|------|---------|
| `src/spotify/pkce.js` | Generate code verifier and challenge |
| `src/spotify/auth.js` | OAuth flow and token management |
| `src/spotify/api.js` | Spotify API requests |
| `index.html` | Router and React components |
| `script.js` | Original vinyl player (unchanged) |

---

## 🎯 SCOPES REQUESTED

The app requests these Spotify permissions:
- `user-read-private` - Access user profile info
- `user-read-email` - Access user email
- `playlist-read-private` - Read private playlists
- `playlist-read-public` - Read public playlists  
- `user-top-read` - Access user's top tracks/artists

---

## 🚢 DEPLOYMENT TO VERCEL

### Step 1: Deploy
```bash
npm run build  # If you have a build script
git push      # Push to your repo linked to Vercel
```

### Step 2: Set Redirect URI in Spotify Dashboard
Add production URL:
```
https://md-vinyl-web-eight.vercel.app/callback/
```

### Step 3: Test Production
Click "Connect Spotify" button and verify the flow works

---

## 🔗 RELATED RESOURCES

- [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/general/guides/authorization/code-flow/)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api/)
- [Spotify Dashboard](https://developer.spotify.com/dashboard/)

---

## ✨ NEXT STEPS

1. ✅ Set your Spotify Client ID
2. ✅ Configure Redirect URIs in Spotify Dashboard
3. ✅ Test locally with `npm run dev`
4. ✅ Deploy to Vercel
5. ✅ Add production URL to Spotify Dashboard
6. ✅ Share with users!

---

**Status: Ready for Testing** 🚀
