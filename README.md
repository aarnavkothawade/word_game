# Word Chain

A real-time, turn-based minimalist word game with:
- **Practice Mode**: 1 player vs. intelligent Bot, with progressive hints (1st hint: 1 letter, 2nd: 3 letters, 3rd: full word, or 4+ min rule) and strict duplicate word prevention.
- **Multiplayer Mode**: 2–5 players in real-time rooms with live typing broadcasts, synchronized countdown timers, and spectator elimination.
- **Ultra Low-Latency Engine**: O(1) prefix-indexed dictionary lookups (<1ms response times).
- **Responsive On-Screen & Physical Keyboard**: Optimized touch feedback on mobile and desktop keyboard support.
- **Light & Dark Mode**: Persistent theme selection with high-contrast text.

---

## Architecture

- **Frontend**: Next.js (App Router), React 19, Tailwind CSS v4, Lucide Icons, Socket.io Client.
- **Backend**: Node.js, Express, Socket.io, In-memory state engine, `word-list` dictionary.

---

## Local Development

### 1. Start the Backend Server (Port 3001)
```bash
cd backend
npm install
npm start
```

### 2. Start the Frontend Dev Server (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment Guide

### 1. Deploying Frontend to Vercel

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Initial Word Chain commit"
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git push -u origin main
   ```

2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. In the configuration settings:
   - **Root Directory**: Select `frontend` (or leave default if using the included `vercel.json`).
   - **Environment Variables**:
     - `NEXT_PUBLIC_SOCKET_URL`: Enter your deployed backend URL (e.g. `https://your-backend.onrender.com`).
5. Click **Deploy**.

---

### 2. Deploying Backend (Render, Railway, or Fly.io)

Since Socket.io requires persistent WebSocket connections, the backend should be hosted on a persistent Node.js runtime:

#### Deploying on Render (Free):
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **Create Web Service**.
6. Copy the service URL (e.g. `https://word-chain-backend.onrender.com`) and add it as `NEXT_PUBLIC_SOCKET_URL` in your Vercel project settings!
