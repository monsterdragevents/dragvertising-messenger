# 💬 Dragvertising Messenger

A standalone real-time messaging platform for the Dragvertising ecosystem, enabling seamless communication between talent, producers, promoters, and fans.

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
│   │   ├── shared/         # Shared components (EmojiPicker)
│   │   └── ui/             # UI primitives (shadcn)
│   ├── pages/             # Page components
│   │   └── RealtimeMessenger.tsx  # Main messenger component
│   ├── hooks/             # Custom React hooks
│   │   └── shared/        # Shared hooks (useUniverse, use-toast)
│   ├── services/          # Service layer
│   │   └── shared/        # Messaging services
│   ├── lib/               # Utility libraries
│   │   ├── messenger/     # Messenger utilities
│   │   └── utils.ts       # General utilities
│   ├── contexts/          # React contexts (AuthContext)
│   ├── integrations/      # External integrations
│   │   └── supabase/      # Supabase client
│   └── types/             # TypeScript definitions
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
- Supabase account and project (same as main Dragvertising app)

### Environment Setup
Create `.env.local` (copy from `.env.example`) and configure:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAIN_APP_URL=https://dragvertising.app
```

**Note:** 
- This messenger uses the **same Supabase instance** as the main Dragvertising app, so you can use the same credentials
- The `VITE_MAIN_APP_URL` should point to your main Dragvertising app URL (or `http://localhost:3000` for local development)

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
- **Video Calls**: WebRTC-based 1-on-1 video calling
- **Universe-aware**: Multi-tenant messaging with universe isolation
- **Role-based Access**: Secure messaging based on user roles
- **File Sharing**: Support for images, documents, and media
- **Group Chats**: Multi-participant conversations
- **Direct Messages**: One-on-one conversations
- **Typing Indicators**: Real-time typing status
- **Online Presence**: See who's online
- **Read Receipts**: Message read status
- **Emoji Support**: Built-in emoji picker
- **Android Integration**: Supports video calls with Android Broadcaster app

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **State Management**: React Query + Zustand
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Routing**: React Router v7
- **Notifications**: Sonner (toast notifications)

### Authentication
- Uses the same Supabase auth as the main Dragvertising app
- Users can log in with the same credentials
- Universe selection is preserved across apps

---

## 📦 Components

### Main Components
- **RealtimeMessenger**: Full-featured messenger interface (Facebook Messenger style)
- **VideoCallDialog**: Full-screen video call interface with WebRTC
- **EmojiPicker**: Emoji selection component
- **AuthContext**: Authentication context provider
- **useUniverse**: Hook for universe management

### Video Calling Hooks
- **useVideoCallSignaling**: WebRTC signaling via Supabase Realtime
- **useVideoCall**: WebRTC peer connection management

### Services
- **messagingService**: Message creation and retrieval
- **edgeFunctionService**: Supabase Edge Function client
- **conversationUtils**: Conversation management utilities

---

## 🔗 Integration with Main App

This messenger is a **child application** of the main Dragvertising app (`DragvertisingApp`). It's designed to work alongside the main app:

### Directory Structure
```
/Users/michaelryanwhitson/
├── DragvertisingApp/          # Main Dragvertising application
└── dragvertising-messenger/   # This messenger (child app)
```

### Integration Points

1. **Shared Database**: Uses the same Supabase project
2. **Shared Auth**: Same authentication system
3. **Shared Universe System**: Same universe/role system
4. **Standalone UI**: Independent interface optimized for messaging
5. **Navigation Link**: Header links back to main app via `VITE_MAIN_APP_URL`

### Configuration

Set the main app URL in your `.env.local`:
```env
VITE_MAIN_APP_URL=https://dragvertising.app
# Or for local development:
# VITE_MAIN_APP_URL=http://localhost:3000
```

Users can access the messenger at a separate URL (e.g., `messenger.dragvertising.com`) while maintaining the same authentication and universe context, and can easily navigate back to the main app via the header logo.

### Video Calling & Android Integration

The messenger supports video calling via WebRTC and integrates with the Android Broadcaster app:

- **WebRTC Video Calls**: 1-on-1 peer-to-peer video calls using Supabase Realtime for signaling
- **Android Broadcaster**: Supports video calls and livestreaming integration
- **Mux Livestreaming**: Group calls and broadcasting via Mux (shared with Android app)

See [Android Broadcaster Integration Guide](./docs/ANDROID_BROADCASTER_INTEGRATION.md) for detailed integration instructions.

---

## 🚀 Deployment

### Vercel Deployment
```bash
vercel --prod
```

### Subdomain Setup

The messenger is configured to work on its own subdomain: `messenger.dragvertising.com`

**To add the subdomain:**
```bash
bash scripts/add-messenger-subdomain.sh
```

Or manually:
```bash
vercel domains add messenger.dragvertising.com
```

**DNS Configuration:**
Add a CNAME record:
- Type: CNAME
- Name: messenger
- Value: cname.vercel-dns.com (or the value Vercel provides)

Vercel will automatically provision an SSL certificate once DNS propagates.

See [Messenger Subdomain Setup](../DragvertisingApp/docs/deployment/MESSENGER_SUBDOMAIN_SETUP.md) for detailed instructions.

### Environment Variables
Set these in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 📝 License

© 2026 Dragvertising LLC. All rights reserved.

