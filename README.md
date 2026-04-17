# ContextCopilot
Screenshots of our product : 
<img width="634" height="752" alt="image" src="https://github.com/user-attachments/assets/92a8d165-34e1-45b9-9527-df46496686ba" />
<img width="1831" height="873" alt="image" src="https://github.com/user-attachments/assets/f2cb35cf-df7d-4a4b-a665-13b4a325c453" />


A Chrome Extension (Manifest V3) that lets users ask questions about the current webpage (GitHub, StackOverflow, PDFs, rental documents, research papers) and receive answers grounded in the page content, with clickable citations that scroll and highlight the source text.

## Tech Stack

- **Extension**: React + Vite + TypeScript (Manifest V3)
- **Backend**: Express + TypeScript
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

## Demo Tips

For a great demo, try these pages:

1. **GitHub README**: Ask "What are the main features?" or "How do I install this?"
2. **StackOverflow**: Ask "What's the solution?" or "Why doesn't this work?"
3. **Documentation**: Ask specific questions about API usage or configuration
4. **Research Paper (PDF)**: If Chrome can render it, ask about key findings or methodology

Remember: The extension works best with text-based content. Images and heavy JavaScript pages may have limited content extraction.

## License

MIT (Hackathon Project)
