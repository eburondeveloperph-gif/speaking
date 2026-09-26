# Orbit Video Meetings & Live Speech Translator

Orbit is a modern, privacy-first web video conferencing application featuring real-time speech-to-speech AI translation (powered by Gemini Live WebSocket API across 249+ languages) and native Google Calendar synchronization.

---

## 🌟 Key Features

- **Instant Video Conferencing**:
  - Peer-to-peer and multi-party video rooms without mandatory user registration.
  - Granular in-call moderator controls: Mute/unmute all, room locking, hand raising, screen sharing, active speaker detection, and low-latency audio visualization.
  - Native keyboard shortcuts (`M` for Mute, `V` for Video, `E` for Translator, `K` for Calendar, `C` for Chat, `P` for Participants, `R` for Hand Raise).

- **Real-Time Speech-to-Speech Translation**:
  - Full support for **249+ languages** across the global Google Translate catalog.
  - Bi-directional bidirectional audio streaming over Gemini Multimodal Live WebSockets (`models/gemini-3.5-live-translate-preview` live service).
  - Audio source routing: Translate your personal microphone, incoming meeting participant audio, or system screen audio.
  - Live transcript feeds with timestamped history, copyable phrases, and voice synthesis toggling.
  - Dynamic audio visualizer synced with live voice output.

- **Google Calendar Integration**:
  - Secure Google OAuth integration with granular calendar scopes (`https://www.googleapis.com/auth/calendar.events`).
  - View upcoming schedule and join Orbit video calls in 1 click.
  - Schedule new meetings with custom Orbit room URLs, attendee email invites, and duration presets.
  - Explicit confirmation workflows for event modifications and cancellations.

---

## 🏗 System Architecture & Flow Diagrams

### 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client["Web Browser Client (React 19 / TanStack Start)"]
        UI[Orbit UI Shell & Dock]
        AudioEngine[Web Audio API Engine & Worklet]
        MeetingStore[Zustand Meeting Store]
        CalClient[Google Calendar Client]
    end

    subgraph Backend["Orbit Server (Express / TanStack Start Server)"]
        TokenRoute["/api/translate-token"]
        DonateRoute["/api/donate"]
        LangRoute["/api/translation-languages"]
    end

    subgraph External["Cloud & Third-Party Services"]
        GeminiAPI["Gemini Live WebSockets\n(generativelanguage.googleapis.com)"]
        GoogleCalAPI["Google Calendar API v3\n(googleapis.com/calendar)"]
        FirebaseAuth["Firebase Auth & Google OAuth"]
    end

    UI --> MeetingStore
    UI --> CalClient
    MeetingStore --> AudioEngine

    UI -->|1. Request Live Token| TokenRoute
    TokenRoute -->|Generate Ephemeral Credential| GeminiAPI

    AudioEngine -->|2. Stream 16kHz PCM Audio| GeminiAPI
    GeminiAPI -->|3. Receive 24kHz PCM Audio & Transcripts| AudioEngine

    CalClient -->|Google OAuth Popup| FirebaseAuth
    CalClient -->|OAuth Bearer Token / REST API| GoogleCalAPI
```

---

### 2. Live Translation Audio & WebSocket Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Participant
    participant App as Orbit Client (Web Audio API)
    participant Server as Orbit Backend Server
    participant Gemini as Gemini Live WebSocket

    User->>App: Click "Start Translator" & select Target Language (e.g., Spanish)
    App->>Server: POST /api/translate-token { targetLanguageCode: "es" }
    Server-->>App: { token: "ephemeral-gemini-token", model: "models/..." }

    App->>Gemini: Connect WSS with token
    App->>Gemini: Send setup payload (targetLanguageCode, responseModalities: ["AUDIO"])
    Gemini-->>App: setupComplete confirmation

    loop Audio Capture & Streaming
        App->>App: Capture audio (16kHz PCM conversion & downsampling)
        App->>Gemini: realtimeInput.audio { data: "<base64 PCM>" }
        Gemini-->>App: serverContent.outputTranscription { text: "..." }
        Gemini-->>App: serverContent.modelTurn.parts[].inlineData (24kHz PCM Voice)
        App->>App: Play synthesized voice & update equalizer visualizer
        App->>User: Display live translated text in sidebar
    end

    User->>App: Click "Stop Translator"
    App->>Gemini: Close WebSocket connection
    App->>App: Release Web Audio processor & reset visualizer
```

---

### 3. Google Calendar Scheduling Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Orbit Calendar Panel
    participant Auth as Firebase Google Auth
    participant GCal as Google Calendar API v3

    User->>App: Click "Sign in with Google Calendar"
    App->>Auth: signInWithPopup(GoogleAuthProvider)
    Auth-->>App: Return User Profile & Access Token (stored in-memory)

    App->>GCal: GET /calendarList & GET /events?timeMin=now
    GCal-->>App: Return upcoming events list
    App->>User: Render upcoming meetings & 1-click Join buttons

    User->>App: Fill Schedule Form (Title, Date, Time, Duration, Attendees)
    App->>GCal: POST /calendars/primary/events { summary, description, location: orbitUrl, attendees }
    GCal-->>App: Event Created 200 OK
    App->>User: Show success banner with direct Google Calendar link
```

---

## 🛠 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) / React 19 / TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) / Lucide Icons
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Audio Processing**: Web Audio API, AudioWorklet, PCM Float32 downsampler & 16-bit PCM encoder
- **AI & Translation**: Google Gemini Multimodal Live API (`@google/genai`)
- **Calendar & Auth**: Google Calendar REST API v3, Firebase Authentication (Google OAuth Provider)
- **Build & Bundler**: Vite 8, Nitro

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 22+
- npm or bun

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy or create the `.env` file (or export variables in your environment):
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:8080` (or `http://localhost:3000`).

---

## 📦 Deployment Guide

### Option 1: Deploy to Google Cloud Run / Container

1. **Build Docker Container**:
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

2. **Deploy with gcloud**:
   ```bash
   gcloud run deploy orbit-meet \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY="your-gemini-key"
   ```

---

### Option 2: Deploy to Vercel

The project includes pre-configured Nitro and TanStack Start plugins with the Vercel preset.

1. Install the Vercel CLI or link via GitHub:
   ```bash
   vercel
   ```
2. Set your environment variables in the Vercel Dashboard:
   - `GEMINI_API_KEY`: Your Google Gemini API Key
3. Deploy:
   ```bash
   vercel --prod
   ```

---

## 🔒 Security & Privacy Best Practices

- **In-Memory Tokens**: Google OAuth access tokens are kept exclusively in memory and never stored in `localStorage` or `sessionStorage`.
- **Client-Side Proxy**: API routes proxy credentials on the server side (`/api/*`), ensuring no private API keys are leaked to the client bundle.
- **Microphone & Camera Control**: Tracks are stopped immediately when muting or leaving rooms to prevent unintended audio/video capture.
