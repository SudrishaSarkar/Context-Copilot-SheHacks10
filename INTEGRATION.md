# Integration Guide: Extension ↔ Backend ↔ System Prompt

This document explains how the extension, backend, and system prompt work together.

## Data Flow

```
1. User enters question in extension popup
   ↓
2. Extension (popup.tsx) queries content script for page data
   ↓
3. Content script (contentScript.ts) extracts page content and returns PagePayload
   ↓
4. Extension sends POST request to /ask endpoint with { question, page: PagePayload }
   ↓
5. Backend (server/src/index.ts) processes request:
   - Validates request with Zod
   - If selectedText exists, uses it as context
   - Otherwise, chunks mainText and selects top 6 chunks by relevance
   ↓
6. Backend calls Gemini API with system prompt (server/src/prompt.ts)
   ↓
7. Gemini returns JSON response: { answer: string, citations: Citation[] }
   ↓
8. Backend validates and processes citations to ensure quotes exist in context
   ↓
9. Extension receives response and displays answer + citations
   ↓
10. User clicks citation → Extension sends HIGHLIGHT_QUOTE message to content script
    ↓
11. Content script highlights the quote on the page with yellow marker
```

## Key Files

### Extension Side
- **`extension/src/popup.tsx`** - Main UI, handles user input and API calls
- **`extension/src/contentScript.ts`** - Extracts page content, handles highlighting
- **`extension/src/types.ts`** - TypeScript types matching shared contracts

### Backend Side
- **`server/src/index.ts`** - Express server, handles `/ask` endpoint
- **`server/src/prompt.ts`** - System prompt builder (modify this to change AI behavior)
- **`server/src/types.ts`** - TypeScript types matching shared contracts

### Shared
- **`shared/contracts.ts`** - Shared type definitions (reference for both sides)

## Modifying the System Prompt

The system prompt is in **`server/src/prompt.ts`**. To modify how Gemini answers questions:

1. Open `server/src/prompt.ts`
2. Edit the `buildSystemPrompt` function
3. The function receives:
   - `context: string` - The page content or selected text
   - `question: string` - The user's question
4. It should return a formatted prompt string that instructs Gemini how to respond

### Example: Current Prompt Structure

```typescript
export function buildSystemPrompt(context: string, question: string): string {
  return `You are a helpful assistant that answers questions based ONLY on the provided text below.

PROVIDED TEXT:
${context}

QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using ONLY information from the provided text above.
2. ...
3. ...
...
`;
}
```

### Important: JSON Response Format

The prompt MUST instruct Gemini to return JSON in this exact format:

```json
{
  "answer": "Your answer here",
  "citations": [
    {
      "quote": "exact verbatim quote from provided text",
      "sectionHint": "optional section hint",
      "confidence": 0.95
    }
  ]
}
```

The `quote` field MUST be verbatim text from the `context` parameter, otherwise citation highlighting won't work correctly.

## Testing the Integration

1. **Start the backend:**
   ```bash
   pnpm -C server dev
   ```
   Should see: `ContextCopilot server running on http://localhost:8787`

2. **Build the extension:**
   ```bash
   pnpm -C extension build
   ```

3. **Load extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `extension/dist` folder

4. **Test:**
   - Navigate to any webpage (e.g., a GitHub README or StackOverflow question)
   - Click the ContextCopilot extension icon
   - Enter a question about the page
   - Click "Ask"
   - Should see answer with citations
   - Click a citation to see it highlighted on the page

## Debugging

### Check Server Logs
The server logs detailed information:
- `[API]` - API request/response logs
- `[Gemini]` - Gemini API call logs

### Check Extension Console
1. Right-click extension icon → "Inspect popup"
2. Check Console tab for logs prefixed with `[Extension]`

### Check Content Script Console
1. Open DevTools on the webpage you're testing
2. Check Console tab for content script logs (if any)

### Common Issues

**"Cannot connect to server"**
- Make sure backend is running: `pnpm -C server dev`
- Check it's on port 8787: Visit `http://localhost:8787/health`

**"Failed to get page content"**
- Refresh the webpage
- Some pages may block content scripts (e.g., `chrome://` pages)

**"Server error: 400"**
- Check server console for validation errors
- Ensure request body matches `AskRequest` schema

**Citations not highlighting**
- Quotes must be exact substrings from the page content
- Check browser console for content script errors

## API Contract

### Request (Extension → Backend)
```typescript
POST http://localhost:8787/ask
Content-Type: application/json

{
  "question": "What is React?",
  "page": {
    "url": "https://example.com",
    "title": "Example Page",
    "contentType": "html",
    "selectedText": "optional selected text",
    "mainText": "full page text content...",
    "structure": [
      { "id": "heading-0", "title": "Introduction" }
    ]
  }
}
```

### Response (Backend → Extension)
```typescript
{
  "answer": "React is a JavaScript library...",
  "citations": [
    {
      "quote": "React is a JavaScript library for building user interfaces",
      "sectionHint": "Introduction",
      "confidence": 0.95
    }
  ]
}
```

## Next Steps for System Prompt Improvement

When modifying the system prompt, consider:
1. **Tone** - How formal/conversational should answers be?
2. **Length** - Should answers be concise or detailed?
3. **Citation quality** - How many citations? What confidence thresholds?
4. **Edge cases** - How to handle ambiguous questions? Missing information?
5. **Context awareness** - Should the prompt consider page structure (headings, sections)?
