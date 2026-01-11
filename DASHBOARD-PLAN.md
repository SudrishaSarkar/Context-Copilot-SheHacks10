# Dashboard & Chat History - Implementation Plan

This document outlines the step-by-step plan to create a website dashboard that stores and displays chat history from the ContextCopilot Chrome extension.

---

## 🎯 Goal

Create a web dashboard that:
- Stores chat history (user prompts and AI responses) from the Chrome extension
- Displays history in a user-friendly dashboard
- Uses MongoDB for persistent storage
- Allows users to view, search, and manage their chat history

---

## 📋 Architecture Overview

```
┌─────────────────┐         ┌──────────────┐         ┌──────────────┐
│ Chrome Extension│ ──────> │ Express API  │ ──────> │   MongoDB    │
│  (Frontend)     │         │  (Backend)   │         │  (Database)  │
└─────────────────┘         └──────────────┘         └──────────────┘
                                     │
                                     ▼
                            ┌──────────────┐
                            │ Web Dashboard│
                            │  (Frontend)  │
                            └──────────────┘
```

---

## 🗂️ Step-by-Step Implementation Plan

### Phase 1: Database Setup & Schema Design

#### Step 1.1: Set up MongoDB
- [ ] Install MongoDB locally OR set up MongoDB Atlas (cloud)
- [ ] Create a database (e.g., `contextcopilot`)
- [ ] Set up connection string and store in `.env`

#### Step 1.2: Design Database Schema
Plan the MongoDB collections and documents:

**Collection: `sessions`** (or `users`)
```javascript
{
  userId: String (unique),
  email: String (optional),
  createdAt: Date,
  lastActive: Date
}
```

**Collection: `chathistory`**
```javascript
{
  sessionId: ObjectId (reference to sessions),
  userId: String,
  timestamp: Date,
  
  // Request data
  requestType: String ("ask" | "summarize" | "key-points" | "explain-like-5" | "action-items"),
  pageUrl: String,
  pageTitle: String,
  contentType: String ("html" | "pdf_text" | "pdf_image"),
  
  // Input
  input: {
    question: String (if requestType is "ask"),
    detailLevel: String (if requestType is "summarize"),
    selectedText: String (optional),
    mainTextPreview: String (first 500 chars)
  },
  
  // Output
  output: {
    answer: String (if requestType is "ask"),
    summary: String (if requestType is "summarize"),
    keyPoints: String,
    explanation: String,
    actionItems: String,
    citations: Array (if requestType is "ask")
  },
  
  // Metadata
  responseTime: Number (milliseconds),
  modelUsed: String,
  success: Boolean
}
```

**Collection: `pages`** (optional - for analytics)
```javascript
{
  url: String,
  title: String,
  firstSeen: Date,
  lastSeen: Date,
  interactionCount: Number
}
```

---

### Phase 2: Backend API - Database Integration

#### Step 2.1: Add MongoDB Dependencies
- [ ] Install `mongodb` or `mongoose` package
- [ ] Create database connection module
- [ ] Add MongoDB connection string to `.env`

#### Step 2.2: Create Database Models/Schemas
- [ ] Create TypeScript interfaces for database documents
- [ ] Set up MongoDB schemas (if using Mongoose) or TypeScript types
- [ ] Create helper functions for database operations

#### Step 2.3: Create New API Endpoints

**History Management Endpoints:**
- [ ] `POST /api/history/save` - Save a chat interaction
- [ ] `GET /api/history/:userId` - Get all history for a user
- [ ] `GET /api/history/:userId/:sessionId` - Get history for a specific session
- [ ] `DELETE /api/history/:historyId` - Delete a specific history entry
- [ ] `GET /api/history/search` - Search history by query

**Session Management Endpoints:**
- [ ] `POST /api/sessions/create` - Create a new user session
- [ ] `GET /api/sessions/:userId` - Get user info and stats
- [ ] `PUT /api/sessions/:userId` - Update user info

#### Step 2.4: Modify Existing Endpoints
- [ ] Update existing endpoints (`/ask`, `/summarize`, `/key-points`, etc.) to:
  - Accept `userId` or `sessionId` in request
  - Save interaction to database after processing
  - Return history ID in response

---

### Phase 3: Chrome Extension Updates

#### Step 3.1: Add User Identification
- [ ] Add user authentication or unique user ID generation
- [ ] Store user ID in Chrome storage (`chrome.storage.local`)
- [ ] Add option for users to sign in (optional)

#### Step 3.2: Update Extension to Send History
- [ ] After each API call (`/ask`, `/summarize`, etc.), also call `/api/history/save`
- [ ] Send userId, request data, and response data
- [ ] Handle errors gracefully (don't break extension if history save fails)

#### Step 3.3: Add History Sync Indicator
- [ ] Show a small indicator when history is being saved
- [ ] Optional: Add settings to enable/disable history saving

---

### Phase 4: Web Dashboard - Frontend Setup

#### Step 4.1: Choose Frontend Framework
- [ ] Decide on framework (React, Vue, Next.js, vanilla HTML/JS, etc.)
- [ ] Set up project structure
- [ ] Create base HTML/CSS template

#### Step 4.2: Create Dashboard Layout
- [ ] Header with user info/logout
- [ ] Sidebar navigation
- [ ] Main content area for history display
- [ ] Search/filter section

#### Step 4.3: Build Dashboard Pages/Components

**Main Dashboard Page:**
- [ ] Recent history list (last 20-50 interactions)
- [ ] Quick stats (total interactions, most used features, etc.)
- [ ] Quick filters (by date, by type, by page)

**History Detail Page:**
- [ ] Full interaction details
- [ ] Page context (URL, title)
- [ ] Input and output display
- [ ] Export/share options

**Search/Filter Page:**
- [ ] Search by keywords
- [ ] Filter by date range
- [ ] Filter by request type
- [ ] Filter by page URL

---

### Phase 5: Authentication & User Management

#### Step 5.1: Decide on Auth Strategy
Options:
- **Simple**: Unique device ID (no login required)
- **Email-based**: Users sign up with email
- **OAuth**: Google/GitHub login

#### Step 5.2: Implement Authentication (if needed)
- [ ] Create auth endpoints (`/api/auth/login`, `/api/auth/register`)
- [ ] Add JWT tokens or session management
- [ ] Protect API endpoints with auth middleware

#### Step 5.3: Link Extension to Web Account
- [ ] Add "Link Account" option in extension
- [ ] Generate temporary link code
- [ ] User enters code on website to link extension

---

### Phase 6: Dashboard Features & Polish

#### Step 6.1: Display Features
- [ ] Timeline view (chronological list)
- [ ] Card view (visual cards for each interaction)
- [ ] Table view (sortable/filterable table)
- [ ] Dark/light mode toggle

#### Step 6.2: Search & Filter
- [ ] Full-text search across all history
- [ ] Filter by request type
- [ ] Filter by date range
- [ ] Filter by page URL/domain
- [ ] Save favorite filters

#### Step 6.3: Analytics & Insights
- [ ] Usage statistics (requests per day/week/month)
- [ ] Most frequently used features
- [ ] Most visited pages
- [ ] Average response times
- [ ] Charts/graphs (using a library like Chart.js)

#### Step 6.4: Export & Sharing
- [ ] Export history as JSON
- [ ] Export history as CSV
- [ ] Export single interaction as markdown
- [ ] Copy to clipboard
- [ ] Share link (if making public sharing)

---

### Phase 7: Deployment & Configuration

#### Step 7.1: Backend Deployment
- [ ] Deploy Express API to a hosting service (Heroku, Railway, Render, etc.)
- [ ] Set up MongoDB Atlas (cloud database)
- [ ] Update API URLs in extension
- [ ] Set up environment variables on hosting platform

#### Step 7.2: Frontend Deployment
- [ ] Deploy dashboard to hosting service (Vercel, Netlify, etc.)
- [ ] Configure CORS properly
- [ ] Set up custom domain (optional)

#### Step 7.3: Extension Updates
- [ ] Update extension to point to production API
- [ ] Test end-to-end flow
- [ ] Publish updated extension to Chrome Web Store

---

## 🔧 Technical Decisions Needed

### 1. User Identification
- **Option A**: Anonymous (device ID) - Easy, no auth needed
- **Option B**: Email signup - Users can access from multiple devices
- **Option C**: OAuth (Google/GitHub) - Users can use existing accounts

**Recommendation**: Start with Option A, add Option B/C later

### 2. Database Choice
- **MongoDB Atlas** (cloud) - Recommended for easier deployment
- **Local MongoDB** - Good for development

### 3. Frontend Framework
- **React + Vite** - Matches extension tech stack
- **Next.js** - Good for full-stack apps with SSR
- **Vanilla HTML/JS** - Simplest, no build step

**Recommendation**: React + Vite (consistency with extension)

### 4. ORM vs Native Driver
- **Mongoose** - Schema validation, easier to use
- **MongoDB Native Driver** - More control, lighter weight

**Recommendation**: Mongoose (easier development)

---

## 📦 Project Structure (Suggested)

```
/
├── server/                    # Existing Express backend
│   ├── src/
│   │   ├── index.ts          # Main server (add new routes)
│   │   ├── db/               # NEW: Database connection
│   │   │   ├── connection.ts
│   │   │   └── models/       # Mongoose models or TypeScript interfaces
│   │   ├── routes/           # NEW: API routes
│   │   │   ├── history.ts
│   │   │   └── sessions.ts
│   │   └── ...
│   └── ...
│
├── extension/                 # Existing Chrome extension
│   └── src/
│       ├── history.ts        # NEW: History saving logic
│       └── ...
│
├── dashboard/                 # NEW: Web dashboard
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/         # API calls
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── shared/                    # Existing shared types
    └── contracts.ts          # Add database types here
```

---

## 🔐 Security Considerations

1. **API Key Protection**: Already handled (`.env` in `.gitignore`)
2. **User Data Privacy**: Encrypt sensitive data in database
3. **Rate Limiting**: Prevent abuse of API endpoints
4. **CORS**: Configure properly for dashboard domain
5. **Input Validation**: Validate all user inputs (already using Zod)
6. **Authentication**: If adding auth, use secure tokens (JWT)

---

## 🧪 Testing Strategy

### Unit Tests
- Database operations
- API endpoints
- History saving logic

### Integration Tests
- Extension → API → Database flow
- Dashboard → API → Database flow

### End-to-End Tests
- User completes action in extension → Appears in dashboard
- Search and filter functionality

---

## 📊 Success Metrics

- Users can view their chat history in dashboard
- History persists across browser sessions
- Search works quickly (< 1 second for 1000+ entries)
- Dashboard loads in < 2 seconds
- API response time < 500ms

---

## 🚀 MVP (Minimum Viable Product) Scope

**Phase 1 MVP Features:**
1. ✅ Save history from extension to database
2. ✅ Display history list in dashboard
3. ✅ Basic search functionality
4. ✅ Simple user identification (device ID)

**Can Add Later:**
- Advanced analytics
- User accounts
- Export features
- Sharing capabilities

---

## ⏱️ Estimated Timeline

- **Phase 1**: 2-3 hours (Database setup)
- **Phase 2**: 4-6 hours (Backend API)
- **Phase 3**: 2-3 hours (Extension updates)
- **Phase 4**: 6-8 hours (Dashboard frontend)
- **Phase 5**: 2-4 hours (Auth - if needed)
- **Phase 6**: 4-6 hours (Features & polish)
- **Phase 7**: 2-3 hours (Deployment)

**Total**: ~22-33 hours

---

## 🎯 Next Steps

1. **Review this plan** and adjust based on your priorities
2. **Decide on**: Auth strategy, frontend framework, deployment platform
3. **Start with Phase 1**: Set up MongoDB and design schemas
4. **Build incrementally**: Get MVP working, then add features

---

## ❓ Questions to Consider

1. Do you need multi-device sync? (If yes, need user accounts)
2. Should history be private or can users share links?
3. Do you need real-time updates? (WebSockets vs polling)
4. What's the maximum history size per user?
5. Do you need data retention policies? (Delete old history after X days)
