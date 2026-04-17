# ContextCopilot
## Screenshots of our product : 

### AI-Powered Chrome Extension

<img width="634" height="752" alt="image" src="https://github.com/user-attachments/assets/92a8d165-34e1-45b9-9527-df46496686ba" />

### Web-App to store history of past searches and data, including timestamps, original links and stored AI-powered analyses; includes filtering options
<img width="1831" height="873" alt="image" src="https://github.com/user-attachments/assets/f2cb35cf-df7d-4a4b-a665-13b4a325c453" />


Ask questions about any webpage and get answers grounded in its content — with clickable citations that highlight exactly where the answer came from.

ContextCopilot is a Chrome Extension that understands the page you are currently viewing and lets you interact with it using natural language. Instead of copy-pasting content into ChatGPT and losing context, users can ask questions directly and receive accurate, contextual answers instantly.

## The Problem

Modern AI assistants lack awareness of what is on your screen.

As a result:

Users constantly copy-paste content into AI tools
Context is lost or incomplete
Answers miss critical details
Switching between tabs slows down workflow

This creates a hidden productivity tax for developers, students, and professionals.

## The Solution

ContextCopilot brings AI directly into your browsing experience.

On any webpage, it:

Reads visible content from the page
Understands structure and context
Answers questions about that specific page
Provides grounded responses with citations
Highlights and scrolls to the exact source of information

No copy-pasting. No context switching. Just answers where you need them.

## Where It Works

ContextCopilot is designed to be domain-agnostic and works across:

GitHub repositories and pull requests
StackOverflow questions and answers
Documentation and technical guides
Research papers and PDFs
Dashboards and long-form content
Key Features
Context-aware Q&A on any webpage
Grounded responses with clickable citations
Automatic content extraction from the DOM
Real-time interaction via a Chrome Extension
Clean UI for seamless user experience

## Tech Stack

- **Extension**: React + Vite + TypeScript (Manifest V3)
- **Backend**: Node.js + Express (TypeScript)
- **AI**: Google Gemini API

## Project Structure

```
/
  shared/
    contracts.ts          # Shared TypeScript type definitions
  
  server/
    src/
      index.ts           # Express backend server
      types.ts           # Server-side type definitions
    package.json
    tsconfig.json
    .env.example
  
  extension/
    src/
      manifest.json      # Chrome extension manifest
      popup.tsx          # React popup UI
      popup.css          # Popup styles
      contentScript.ts   # Content script for page interaction
      background.ts      # Background service worker
      main.tsx           # React entry point
      types.ts           # Extension-side type definitions
    index.html
    package.json
    tsconfig.json
    vite.config.ts
```
## My Contributions:
-Led version control - in charge of resolving merge conflicts and reviewing pull requests before merging
-Implemented content extraction and interaction with live webpages
-Developed the Express backend and API integration with Gemini
-Built citation mapping and highlighting logic for grounded responses
-Structured the project using shared contracts for type safety

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### 1. Install Dependencies

From the project root, install dependencies for both server and extension:

```bash
# Install server dependencies
cd server
pnpm install

# Install extension dependencies
cd ../extension
pnpm install
```

Or install both at once from root (if using a monorepo tool):

```bash
pnpm install --recursive
```

### 2. Configure Backend

1. Copy the example environment file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `server/.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### 3. Run the Backend Server

From the `server` directory:

```bash
# Development mode (auto-reload)
pnpm dev

# Or production mode
pnpm build
pnpm start
```

The server will run on `http://localhost:8787`

### 4. Build the Extension

From the `extension` directory:

```bash
# Development mode (watch mode)
pnpm dev

# Production build
pnpm build
```

This will create a `dist` folder with the compiled extension.

### 5. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. The ContextCopilot extension icon should appear in your toolbar

## Usage

1. Navigate to any webpage (GitHub repo, StackOverflow question, PDF viewer, etc.)
2. Click the ContextCopilot extension icon in your toolbar
3. Type a question about the page content in the textarea
4. Click "Ask" to get an answer grounded in the page content
5. View the answer with citations
6. Click any citation to highlight and scroll to the source text on the page

### Tips for Best Results

- **Selected Text**: If you select text on the page before asking, the extension will prioritize that selection
- **GitHub**: Works great on README files, issue discussions, and code documentation
- **StackOverflow**: Perfect for Q&A pages and technical discussions
- **PDFs**: If the PDF is viewable in Chrome (text-based), it will extract and answer questions
- **Long Documents**: The system automatically selects the most relevant chunks for very long pages

## Development

### Server Development

- **Entry**: `server/src/index.ts`
- **API Endpoint**: `POST /ask` - Accepts `AskRequest`, returns `AskResponse`
- **Health Check**: `GET /health`

### Extension Development

- **Popup UI**: `extension/src/popup.tsx`
- **Content Script**: `extension/src/contentScript.ts` - Handles page interaction
- **Background**: `extension/src/background.ts` - Service worker

### Type Safety

Shared types are defined in:
- `shared/contracts.ts` (reference)
- `server/src/types.ts` (server copy)
- `extension/src/types.ts` (extension copy)

For a production setup, use a monorepo tool or shared package to avoid duplication.

## Troubleshooting

### Extension not loading
- Make sure you built the extension (`pnpm build` in extension directory)
- Check that `dist` folder contains `manifest.json`, `index.html`, and JS files
- Check Chrome console (`chrome://extensions/` → click "Inspect views" on the extension)

### API errors
- Verify `GEMINI_API_KEY` is set correctly in `server/.env`
- Check server logs for detailed error messages
- Ensure server is running on port 8787
- Check CORS settings if calling from a different origin

### Citations not highlighting
- Ensure content script is injected (check page source)
- Some pages may block script injection
- Try refreshing the page and asking again

### Build errors
- Clear `node_modules` and reinstall: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
- Check TypeScript errors: `pnpm tsc --noEmit` in respective directories

## License

MIT (Hackathon Project)
