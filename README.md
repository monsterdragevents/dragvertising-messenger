# 💬 Dragvertising Messenger

A real-time messaging platform for the Dragvertising ecosystem, enabling seamless communication between talent, producers, promoters, and fans.

---

## 🚀 Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Build for production
```

---

## 📁 Project Structure

```
dragvertising-messenger/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Service layer (Supabase, messaging)
│   ├── lib/               # Utility libraries
│   ├── types/             # TypeScript definitions
│   ├── contexts/          # React contexts
│   └── routes/            # Route definitions
│
├── docs/                  # Documentation
├── scripts/                # Utility scripts
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge functions
│   └── migrations/        # Database migrations
│
└── public/                # Public assets
```

---

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm
- Supabase account and project

### Environment Setup
Create `.env.local` and configure:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Lint code
npm run typecheck    # Type check
```

---

## 🏗️ Architecture

### Key Features
- **Real-time Messaging**: Supabase Realtime for instant message delivery
- **Universe-aware**: Multi-tenant messaging with universe isolation
- **Role-based Access**: Secure messaging based on user roles
- **File Sharing**: Support for images, documents, and media
- **Group Chats**: Multi-participant conversations
- **Direct Messages**: One-on-one conversations

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Radix UI + Tailwind CSS
- **State Management**: Zustand + React Query
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Routing**: React Router v7

---

## 📝 License

© 2026 Dragvertising LLC. All rights reserved.
