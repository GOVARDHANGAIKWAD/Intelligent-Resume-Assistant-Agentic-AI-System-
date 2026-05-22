# 🤖 Intelligent Resume Assistant — Agentic AI System

> A production-ready AI hiring assistant powered by GPT-4o, LangChain-style agent orchestration, WebSocket streaming, and a stunning glassmorphism UI.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Backend](https://img.shields.io/badge/Node.js-Express-green?style=flat-square&logo=node.js)
![AI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)
![DB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)
![WS](https://img.shields.io/badge/WebSocket-Streaming-blue?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Agentic AI** | True ReAct-style agent with tool calling, intent detection, and memory |
| 📄 **Resume Parsing** | GPT-4o extracts name, email, skills, experience, education, projects |
| 🛡️ **Anti-Hallucination** | Confidence scoring + validation layer prevents fabricated data |
| ⚡ **Real-time Streaming** | WebSocket token streaming with exponential backoff reconnect |
| 📊 **Candidate Scoring** | Multi-dimensional score: experience, skills, education, communication |
| 🔍 **Skill Matching** | Match candidate against required skill set with percentage score |
| 💬 **Multi-tab Chats** | Multiple concurrent resume sessions with persistent history |
| 🌙 **Dark Glassmorphism UI** | Premium ChatGPT + Linear + Vercel inspired design |
| 🐳 **Docker Ready** | Full docker-compose with MongoDB, backend, and frontend |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)             │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Sidebar  │  │ UploadZone│  │  ChatInterface   │  │
│  │ (Zustand)│  │ (Dropzone)│  │ (WS Streaming)   │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────┐
│                  BACKEND (Express + WS)              │
│                                                      │
│  POST /api/upload-resume  →  [Multer → pdf-parse]    │
│  POST /api/chat           →  [Agent Orchestrator]    │
│  GET  /api/session/:id    →  [Session Manager]       │
│  WS   /ws                 →  [Token Streaming]       │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │          AGENT ORCHESTRATOR                     │ │
│  │  1. Intent Detection (skill/score/keyword)      │ │
│  │  2. Tool Routing                                │ │
│  │  3. LLM Call (GPT-4o, JSON mode)               │ │
│  │  4. Hallucination Validator                     │ │
│  │  5. Structured Response {answer,confidence...} │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  TOOLS: ResumeParseTool | SkillMatcher |             │
│         KeywordExtractor | CandidateScore            │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  MONGODB + Memory                    │
│  Collections: resumes | sessions                    │
│  Fallback: In-memory Map (no DB required)           │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas) — *optional, falls back to in-memory*
- OpenAI API key

### 1. Clone & Setup

```bash
git clone <repo-url>
cd AI
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm install --legacy-peer-deps
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 🐳 Docker Deployment

```bash
# From root directory
cp backend/.env.example .env
echo "OPENAI_API_KEY=sk-your-key" >> .env

docker-compose up --build
```

Services:
- Frontend → http://localhost:3000
- Backend  → http://localhost:4000
- MongoDB  → localhost:27017

---

## ☁️ Cloud Deployment

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
# Set env vars in Vercel dashboard:
# NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
```

### Backend → Render / Railway
- Connect GitHub repo
- Set root to `backend/`
- Build command: `npm install --legacy-peer-deps && npm run build`
- Start command: `npm start`
- Add env vars: `OPENAI_API_KEY`, `MONGODB_URI`, `FRONTEND_URL`

---

## 🔑 Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `OPENAI_MODEL` | No | Default: `gpt-4o` |
| `MONGODB_URI` | No | Falls back to in-memory |
| `PORT` | No | Default: `4000` |
| `FRONTEND_URL` | No | CORS origin, default: `http://localhost:3000` |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend HTTP URL |
| `NEXT_PUBLIC_WS_URL` | ✅ | Backend WebSocket URL |

---

## 📡 API Reference

### `POST /api/upload-resume`
Upload a PDF or TXT resume file.

**Request:** `multipart/form-data`
- `file`: PDF or TXT (max 10MB)
- `sessionId`: string (optional)

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid",
  "candidateName": "John Doe",
  "score": 78,
  "resumeData": { "name": "...", "skills": [...], ... }
}
```

### `POST /api/chat`
Send a question about the resume.

**Request:**
```json
{ "sessionId": "uuid", "message": "What are their top skills?" }
```

**Response:**
```json
{
  "success": true,
  "response": {
    "answer": "The candidate has strong expertise in React, TypeScript, and Node.js.",
    "confidence": 0.95,
    "source": "resume",
    "missing_data": [],
    "tool_used": "skill_matcher"
  }
}
```

### `GET /api/session/:sessionId`
Get full session with chat history and resume analytics.

### `GET /health`
Health check with DB connection status.

---

## 🛠️ Agent Tools

| Tool | Trigger | Description |
|---|---|---|
| `resume_parser` | On upload | GPT-4o structured extraction |
| `skill_matcher` | "know", "match", "proficient" | Fuzzy skill comparison |
| `keyword_extractor` | "keywords", "ats" | Top resume keywords |
| `candidate_score` | "score", "rate", "evaluate" | Multi-dimensional scoring |

---

## 🏛️ Project Structure

```
AI/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx          # Root layout + fonts
│   │   ├── page.tsx            # Main app shell
│   │   └── globals.css         # Design system CSS
│   ├── components/
│   │   ├── Sidebar.tsx         # Multi-tab navigation
│   │   ├── UploadZone.tsx      # Drag-and-drop upload
│   │   ├── ChatInterface.tsx   # Chat + WS streaming
│   │   ├── ChatBubble.tsx      # Message + metadata
│   │   └── Dashboard.tsx       # Recruiter analytics
│   ├── hooks/
│   │   ├── useWebSocket.ts     # WS with reconnect
│   │   └── useApi.ts           # REST API calls
│   ├── lib/
│   │   ├── store.ts            # Zustand state
│   │   └── utils.ts            # Helpers + constants
│   └── types/index.ts          # TypeScript types
│
├── backend/
│   └── src/
│       ├── index.ts            # Express entry point
│       ├── agents/
│       │   └── orchestrator.ts # ReAct agent + streaming
│       ├── tools/
│       │   └── index.ts        # 4 agent tools
│       ├── api/
│       │   ├── uploadResume.ts # POST /upload-resume
│       │   ├── chat.ts         # POST /chat
│       │   └── session.ts      # GET/DELETE /session
│       ├── services/
│       │   └── websocket.ts    # WS server + heartbeat
│       ├── memory/
│       │   └── sessionManager.ts # DB + in-memory store
│       ├── models/index.ts     # Mongoose schemas
│       ├── config/database.ts  # MongoDB connection
│       └── types/index.ts      # TypeScript types
│
├── docker-compose.yml
└── README.md
```

---

## 🎨 Design Decisions

1. **No LangChain Community** — Used OpenAI SDK directly to avoid peer dependency conflicts while keeping full agent control
2. **MongoDB Optional** — In-memory fallback means zero-setup dev experience
3. **WebSocket + REST Fallback** — If WS is unavailable, automatically falls back to REST
4. **JSON Mode** — All LLM calls use `response_format: { type: 'json_object' }` to enforce structured output
5. **Hallucination Guard** — Post-generation validation adjusts confidence if fabricated data is detected
6. **Zustand Persist** — Chat tabs survive page refresh via localStorage

---

## 📸 Screenshots

> Upload your resume → Ask anything → Get grounded, structured answers

*See the running app at http://localhost:3000*

---

## 📄 License
MIT
