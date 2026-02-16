# Render Deployment Guide (Backend)

This guide walks you through deploying the **mvx-websocket-backend** to [Render](https://render.com).

---

## Prerequisites

- GitHub account with your `mvx-websocket-dapp` repo
- Render account (free at [render.com](https://render.com))

---

## Step 1: Push Your Code to GitHub

Ensure your project is pushed to a GitHub repository. The backend lives in the `backend/` subfolder.

---

## Step 2: Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub account if you haven’t already
4. Select the **mvx-websocket-dapp** repository
5. Click **Connect**

---

## Step 3: Configure the Web Service

| Setting | Value |
|---------|-------|
| **Name** | `mvx-websocket-backend` (or your preferred name) |
| **Region** | Choose closest to your users |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | `backend` ⚠️ **Important** – backend lives in a subfolder |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or paid for more resources) |

---

## Step 4: Add PostgreSQL Database

1. In the Render dashboard, click **New** → **PostgreSQL**
2. Create a free PostgreSQL database (or paid for production)
3. Note the **Internal Database URL** – you'll use this for `DATABASE_URL`
4. Optionally link it to your Web Service so `DATABASE_URL` is auto-injected

---

## Step 5: Environment Variables

In the **Environment** section of your Web Service, add these variables. **Never** commit `.env` or secrets to Git.

| Key | Value | Required |
|-----|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `PORT` | *(Render sets this automatically – optional)* | No |
| `DATABASE_URL` | Your PostgreSQL connection string (from Step 4) | Yes |
| `JWT_SECRET` | Generate a strong random string (e.g. `openssl rand -hex 32`) | Yes |
| `JWT_EXPIRES_IN` | `7d` | Yes |
| `FRONTEND_URL` | Your Netlify URL, e.g. `https://your-app.netlify.app` | Yes (for CORS) |
| `MVX_API_MAINNET` | `https://api.multiversx.com` | Yes |
| `MVX_API_TESTNET` | `https://testnet-api.multiversx.com` | Yes |
| `MVX_API_DEVNET` | `https://devnet-api.multiversx.com` | Yes |
| `RATE_LIMIT_WINDOW_MS` | `900000` | No (default) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | No (default) |
| `WEBHOOK_TIMEOUT_MS` | `10000` | No (default) |
| `WEBHOOK_MAX_RETRIES` | `3` | No (default) |
| `LOG_LEVEL` | `info` | No (default) |

**Generate a secure JWT secret:**
```bash
# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Or use Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 6: Health Check (Optional but Recommended)

Render uses health checks to keep your service running:

- **Path:** `/health`
- **Initial delay:** 30 seconds (or leave default)

Your backend already exposes this endpoint, so no code changes are needed.

---

## Step 7: Deploy

1. Click **Create Web Service**
2. Render will build and deploy; logs will appear in the dashboard
3. When done, your API URL will be like: `https://mvx-websocket-backend.onrender.com`
4. Test: `https://your-service.onrender.com/health`
5. API docs: `https://your-service.onrender.com/api`

---

## Database: PostgreSQL

The backend uses **PostgreSQL**. Render provides a free PostgreSQL plan.

When you create a PostgreSQL database and link it to your Web Service, `DATABASE_URL` is injected automatically.

---

## Custom Domain (Optional)

1. In your Render service, go to **Settings** → **Custom Domains**
2. Add your domain and follow the DNS instructions

---

## Connecting Netlify (Frontend) Later

After your Netlify site is live:

1. Copy your Netlify URL (e.g. `https://your-app.netlify.app`)
2. In Render → Environment, add or update `FRONTEND_URL` with that URL
3. Redeploy so CORS allows your frontend

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check **Root Directory** is `backend` |
| 503 / service unavailable | Verify `/health` returns 200 and check logs |
| CORS errors from frontend | Add Netlify URL to `FRONTEND_URL` |
| Database errors | Verify `DATABASE_URL` is set and PostgreSQL is reachable |
| Slow cold starts | Free tier spins down after ~15 min inactivity; first request may be slow |

---

## Quick Reference: Render URLs

- Dashboard: https://dashboard.render.com
- Docs: https://render.com/docs
- Node.js guide: https://render.com/docs/deploy-node-express-app
