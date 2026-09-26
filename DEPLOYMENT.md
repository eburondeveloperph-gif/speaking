# Deployment Guide for Orbit

This document provides complete, step-by-step instructions for deploying Orbit across multiple production environments, including **Google Cloud Run**, **Vercel**, and **Self-Hosted Docker / VPS**.

---

## 📋 Table of Contents
1. [Prerequisites & Environment Variables](#1-prerequisites--environment-variables)
2. [Google OAuth & Calendar Setup](#2-google-oauth--calendar-setup)
3. [Deployment Options](#3-deployment-options)
   - [Option A: Google Cloud Run (Recommended for Full Stack & WebSockets)](#option-a-google-cloud-run)
   - [Option B: Vercel](#option-b-vercel)
   - [Option C: Self-Hosted Docker / Linux VPS](#option-c-self-hosted-docker--linux-vps)
4. [Post-Deployment Verification](#4-post-deployment-verification)
5. [Troubleshooting & Common Issues](#5-troubleshooting--common-issues)

---

## 1. Prerequisites & Environment Variables

### Required API Keys & Configurations
Create your production `.env` (or configure secrets in your cloud hosting provider):

| Variable Name | Description | Example / Format |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for real-time live translation | `AIzaSy...` |
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | Listening server port (default 8080) | `8080` |

---

## 2. Google OAuth & Calendar Setup

To allow users to view upcoming meetings and schedule Orbit calls directly to their Google Calendar:

1. **Open Google Cloud Console**:
   Go to [Google Cloud Console](https://console.cloud.google.com/).
2. **Enable Google Calendar API**:
   - Navigate to **APIs & Services > Library**.
   - Search for **Google Calendar API** and click **Enable**.
3. **Configure OAuth Consent Screen**:
   - Set User Type to **External**.
   - Add App Name: `Orbit Meetings` and Support Email.
   - Add Scopes:
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.readonly`
4. **Add Authorized Redirect URIs**:
   In **Credentials > OAuth 2.0 Client IDs** (or within your Firebase Auth project):
   - Add your production URL domain (e.g. `https://your-domain.com` and `https://<your-project>.firebaseapp.com/__/auth/handler`).

---

## 3. Deployment Options

### Option A: Google Cloud Run

Google Cloud Run provides auto-scaling, containerized HTTPS execution, and low-latency WebSocket routing.

#### Step 1: Install & Authenticate Google Cloud CLI
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### Step 2: Create a Production `Dockerfile` (if not present)
Ensure the repository contains the following multi-stage `Dockerfile`:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app ./
EXPOSE 8080

CMD ["npm", "start"]
```

#### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy orbit \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY",NODE_ENV="production"
```

#### Step 4: Map Custom Domain (Optional)
In Cloud Run > **Custom Domains**, map your root or subdomain (e.g., `meet.yourcompany.com`).

---

### Option B: Vercel

The project is built on TanStack Start with Vite and Nitro Vercel presets.

#### Step 1: Push Code to GitHub / GitLab
```bash
git add .
git commit -m "chore: prepare for production deployment"
git push origin main
```

#### Step 2: Import into Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Select your repository.
3. Configure Build Settings:
   - **Framework Preset**: Other / Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `.output` (or default TanStack Start output)
4. Add Environment Variables:
   - `GEMINI_API_KEY`: `<Your-Gemini-API-Key>`
5. Click **Deploy**.

---

### Option C: Self-Hosted Docker / Linux VPS

For Ubuntu / Debian VPS (DigitalOcean, AWS EC2, Linode, Hetzner):

#### Step 1: SSH into your server & install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

#### Step 2: Clone repository & build Docker image
```bash
git clone https://github.com/your-username/orbit-meet.git /opt/orbit
cd /opt/orbit

docker build -t orbit-app .
```

#### Step 3: Run with Docker Compose or Docker run
```bash
docker run -d \
  --name orbit \
  --restart unless-stopped \
  -p 8080:8080 \
  -e GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \
  -e NODE_ENV="production" \
  orbit-app
```

#### Step 4: Setup Nginx Reverse Proxy with SSL (Certbot)
```nginx
server {
    server_name meet.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable SSL:
```bash
sudo certbot --nginx -d meet.yourdomain.com
```

---

## 4. Post-Deployment Verification

After deploying, run through this quick checklist:

1. **Room Creation & WebRTC**:
   - Open your production URL.
   - Enter a meeting room name (e.g. `test-room`) and join.
   - Confirm microphone and camera stream correctly.
2. **Live Speech Translator**:
   - In the call, click **Start Translator** or press `E`.
   - Select a target language (e.g., Spanish or French).
   - Speak into your microphone and verify live transcription and voice output.
   - Verify the audio visualizer in the header pulses with voice playback.
3. **Google Calendar**:
   - Click the **Google Calendar** button or press `K`.
   - Complete Google Sign-In and authorize permissions.
   - Verify upcoming events load and schedule a test meeting.

---

## 5. Troubleshooting & Common Issues

| Issue | Cause | Solution |
|---|---|---|
| **Translation fails to connect** | Missing or invalid `GEMINI_API_KEY` | Ensure `GEMINI_API_KEY` is set in production environment variables. |
| **Microphone permission blocked** | Non-HTTPS domain | WebRTC and AudioWorklet require a secure context (`https://` or `localhost`). Ensure SSL is active. |
| **Google Sign-In popup blocked** | Browser popup blocking or missing redirect URI | Add production domain to Google Cloud Console OAuth Authorized JavaScript origins. |
| **WebSockets drop intermittently** | Proxy timeout | For Nginx/Cloudflare, set proxy read timeout to 3600s (`proxy_read_timeout 3600s;`). |
