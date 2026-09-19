<p align="center">
  <h1 align="center">⛓️ Word Chain</h1>
  <p align="center">
    <strong>A fast-paced, real-time word game built for speed and fun.</strong>
  </p>
  <p align="center">
    Practice solo against an intelligent bot · Battle friends in real-time multiplayer · Works on desktop & mobile
  </p>
  <p align="center">
    <em>A Product by Aarnav Kothawade</em>
  </p>
</p>

---

## 🎮 What is Word Chain?

Word Chain is a turn-based word game where players take turns typing words that begin with the last letters of the previous word. Think fast — you only have **15 seconds** per turn. Miss it, and you lose a life.

The game starts easy with single-letter prefixes and ramps up to 2–3 letter prefixes as time goes on, keeping every round intense and unpredictable.

---

## ✨ Features

### 🧠 Practice Mode (vs Bot)
- Play 1v1 against an intelligent bot that adapts its difficulty over time
- Bot picks short words early, then shifts to longer, harder words after 3 minutes
- Bot responds in **400–750ms** for snappy, natural-feeling gameplay
- **Progressive Hint System** (3 hints per session):
  - **1st hint** → Reveals 1 additional letter
  - **2nd hint** → Reveals 3 more letters
  - **3rd hint** → Reveals the entire word
  - If the game clock passes **4 minutes**, the 3rd hint auto-reveals the full word regardless
- See what the bot played with a visible **"🤖 Bot played: WORD"** badge

### 👥 Multiplayer Mode (2–5 Players)
- Create a room and share the code or link with friends
- Real-time **live typing broadcast** — see what your opponent is typing as they type
- Synchronized countdown timers across all clients
- Host controls: only the host can start the game and trigger rematches
- **Spectator mode**: eliminated players can continue watching the game
- Automatic turn advancement when a player disconnects

### 🚫 Duplicate Word Prevention
- No word can be used twice in a single game — enforced on both client and server
- Immediate, clear error feedback if a duplicate is attempted

### ⚡ Ultra Low-Latency Engine
- **274,000+ word** dictionary loaded and prefix-indexed at startup in ~190ms
- All word lookups, bot moves, and hint generation run in **O(1)** via pre-built prefix maps
- WebSocket-only transport (no HTTP long-polling) for minimal round-trip times

### 🎹 Input System
- **On-screen keyboard** optimized for mobile with touch-action manipulation and zero tap delay
- **Physical keyboard** support on desktop — just type and hit Enter
- Backspace protection: can't delete the required prefix

### 🌗 Light & Dark Mode
- Toggle between light and dark themes with one click
- Theme choice **persists across reloads** via `localStorage`
- Zero-flash pre-paint script prevents white flicker on dark mode reload
- High-contrast text in dark mode for full readability

### 📱 Responsive Design
- Fully responsive layout — works seamlessly on phones, tablets, and desktops
- Adaptive keyboard sizing for small screens
- Credits and footer elements reflow cleanly on mobile

---

## 🏗️ Architecture

```
Word_Game/
├── frontend/          → Next.js (App Router) + React 19 + Tailwind CSS v4
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             → Home / lobby screen
│   │   │   ├── practice/page.tsx    → Practice mode (vs Bot)
│   │   │   ├── room/[code]/page.tsx → Multiplayer game room
│   │   │   ├── layout.tsx           → Root layout, theme toggle, socket provider
│   │   │   └── globals.css          → Design tokens (light/dark CSS variables)
│   │   ├── components/
│   │   │   └── Keyboard.tsx         → On-screen QWERTY keyboard
│   │   ├── context/
│   │   │   └── SocketContext.tsx     → Persistent socket connection provider
│   │   └── hooks/
│   │       └── useSocket.ts         → Socket access hook
│   └── package.json
│
├── backend/           → Node.js + Express + Socket.io
│   ├── src/
│   │   ├── server.js                → WebSocket event handlers, game state, bot logic
│   │   ├── engine.js                → Dictionary, validation, prefix indexing, hints
│   │   └── constants.js             → Game configuration (lives, timer, difficulty)
│   └── package.json
│
├── vercel.json        → Vercel deployment config (frontend)
├── .gitignore
└── README.md
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Lucide Icons |
| Backend | Node.js, Express 5, Socket.io 4 |
| Dictionary | [`word-list`](https://www.npmjs.com/package/word-list) (274K English words) |
| Transport | WebSocket (persistent, bidirectional) |
| State | In-memory Maps & Sets (zero database dependency) |

---

## ⚙️ Game Configuration

All game constants are in [`backend/src/constants.js`](backend/src/constants.js):

| Constant | Default | Description |
|---|---|---|
| `TURN_TIMER_SECONDS` | `15` | Seconds per turn |
| `STARTING_LIVES` | `2` | Lives each player starts with |
| `MAX_PLAYERS_PER_ROOM` | `5` | Maximum players in a multiplayer room |
| `MIN_PLAYERS_TO_START` | `2` | Minimum players to start a game |
| `MAX_HINTS_PER_PRACTICE_SESSION` | `3` | Total hints available per practice game |
| `MIN_WORD_LENGTH` | `3` | Minimum acceptable word length |
| `DIFFICULTY_SWITCH_SECONDS` | `65` | Seconds before harder prefixes appear |
| `ROOM_CODE_LENGTH` | `6` | Length of generated room codes |
| `MAX_DISPLAY_NAME_LENGTH` | `10` | Max characters for player names |

---

<p align="center">
  <strong>Built with ❤️ by Aarnav Kothawade</strong>
</p>
