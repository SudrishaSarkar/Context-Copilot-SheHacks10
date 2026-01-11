# Testing Endpoints Guide

This guide shows you how to test all the new endpoints using **Postman** or **curl**.

## Prerequisites

1. **Start the server:**
   ```bash
   cd server
   pnpm dev
   ```

2. The server should be running on `http://localhost:8787`

---

## Option 1: Postman (Recommended)

### Setup

1. Open Postman
2. Set the base URL: `http://localhost:8787`
3. Set `Content-Type: application/json` in headers

### Sample PagePayload Structure

All endpoints use the same `PagePayload` structure. Here's a sample you can use:

```json
{
  "page": {
    "url": "https://example.com/article",
    "title": "Sample Article Title",
    "contentType": "html",
    "mainText": "This is a sample article about machine learning. Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It involves algorithms that improve their performance over time through experience. Key applications include image recognition, natural language processing, and predictive analytics. The field continues to evolve rapidly with advances in deep learning and neural networks.",
    "selectedText": null,
    "structure": null,
    "meta": {
      "siteHint": "generic"
    }
  }
}
```

---

## Testing Each Endpoint

### 1. `/summarize` - Summarize Page

**Method:** `POST`  
**URL:** `http://localhost:8787/summarize`

**Request Body:**
```json
{
  "page": {
    "url": "https://example.com/article",
    "title": "Sample Article",
    "contentType": "html",
    "mainText": "This is a long article about machine learning. Machine learning is a subset of artificial intelligence that enables computers to learn from data. Key applications include image recognition, natural language processing, and predictive analytics.",
    "meta": {
      "siteHint": "generic"
    }
  },
  "detailLevel": "brief"
}
```

**Try both:**
- `"detailLevel": "brief"` - 4-5 lines
- `"detailLevel": "detailed"` - up to 10 lines

**Expected Response:**
```json
{
  "summary": "Summary text here...",
  "detailLevel": "brief",
  "title": "Sample Article",
  "url": "https://example.com/article",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 2. `/key-points` - Extract Key Points

**Method:** `POST`  
**URL:** `http://localhost:8787/key-points`

**Request Body:**
```json
{
  "page": {
    "url": "https://example.com/article",
    "title": "Sample Article",
    "contentType": "html",
    "mainText": "Machine learning enables computers to learn from data. Key applications include image recognition, natural language processing, and predictive analytics. Neural networks are a popular approach. The field continues to evolve rapidly.",
    "meta": {
      "siteHint": "generic"
    }
  }
}
```

**Expected Response:**
```json
{
  "keyPoints": "• Machine learning enables computers to learn from data\n• Key applications include image recognition, NLP, and predictive analytics\n• Neural networks are a popular approach\n• The field continues to evolve rapidly",
  "title": "Sample Article",
  "url": "https://example.com/article",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 3. `/explain-like-5` - Explain Like I'm 5

**Method:** `POST`  
**URL:** `http://localhost:8787/explain-like-5`

**Request Body:**
```json
{
  "page": {
    "url": "https://example.com/article",
    "title": "How Machine Learning Works",
    "contentType": "html",
    "mainText": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It involves algorithms that improve their performance over time through experience.",
    "meta": {
      "siteHint": "generic"
    }
  }
}
```

**Expected Response:**
```json
{
  "explanation": "Imagine teaching a computer like teaching a kid to recognize cats. You show it lots of cat pictures, and over time it gets better at spotting cats on its own - that's machine learning!",
  "title": "How Machine Learning Works",
  "url": "https://example.com/article",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 4. `/action-items` - Extract Action Items

**Method:** `POST`  
**URL:** `http://localhost:8787/action-items`

**Request Body:**
```json
{
  "page": {
    "url": "https://example.com/meeting-notes",
    "title": "Team Meeting Notes",
    "contentType": "html",
    "mainText": "Action items for this week: 1) Complete the design mockups by Friday 2) Review the code PRs 3) Schedule client meeting for next Monday 4) Update documentation",
    "meta": {
      "siteHint": "generic"
    }
  }
}
```

**Expected Response:**
```json
{
  "actionItems": "- Complete the design mockups by Friday\n- Review the code PRs\n- Schedule client meeting for next Monday\n- Update documentation",
  "title": "Team Meeting Notes",
  "url": "https://example.com/meeting-notes",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Option 2: curl Commands

### Summarize (Brief)
```bash
curl -X POST http://localhost:8787/summarize ^
  -H "Content-Type: application/json" ^
  -d "{\"page\":{\"url\":\"https://example.com\",\"title\":\"Test Article\",\"contentType\":\"html\",\"mainText\":\"This is a test article about technology and innovation.\"},\"detailLevel\":\"brief\"}"
```

### Key Points
```bash
curl -X POST http://localhost:8787/key-points ^
  -H "Content-Type: application/json" ^
  -d "{\"page\":{\"url\":\"https://example.com\",\"title\":\"Test Article\",\"contentType\":\"html\",\"mainText\":\"This is a test article about technology and innovation.\"}}"
```

### Explain Like I'm 5
```bash
curl -X POST http://localhost:8787/explain-like-5 ^
  -H "Content-Type: application/json" ^
  -d "{\"page\":{\"url\":\"https://example.com\",\"title\":\"Test Article\",\"contentType\":\"html\",\"mainText\":\"Machine learning is a subset of artificial intelligence.\"}}"
```

### Action Items
```bash
curl -X POST http://localhost:8787/action-items ^
  -H "Content-Type: application/json" ^
  -d "{\"page\":{\"url\":\"https://example.com\",\"title\":\"Meeting Notes\",\"contentType\":\"html\",\"mainText\":\"Action items: Complete tasks by Friday. Review code PRs.\"}}"
```

---

## Option 3: Quick Test Script

Create a file `server/test-endpoints.js`:

```javascript
const testData = {
  page: {
    url: "https://example.com/test",
    title: "Test Article",
    contentType: "html",
    mainText: "Machine learning is a subset of artificial intelligence that enables computers to learn from data. Key applications include image recognition, natural language processing, and predictive analytics.",
    meta: { siteHint: "generic" }
  }
};

// Test summarize
fetch("http://localhost:8787/summarize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...testData, detailLevel: "brief" })
})
  .then(r => r.json())
  .then(console.log);

// Test key-points
fetch("http://localhost:8787/key-points", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(testData)
})
  .then(r => r.json())
  .then(console.log);
```

Run with Node.js:
```bash
node server/test-endpoints.js
```

---

## Health Check

Always test the health endpoint first:

**GET** `http://localhost:8787/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Tips

1. **Start with `/health`** to make sure the server is running
2. **Use short text first** (100-200 words) to test quickly
3. **Check server logs** in your terminal for errors
4. **Verify API key** is set in `.env` file
5. **For PDF content**, use `"contentType": "pdf_text"` or `"pdf_image"` with `imageBase64` field

---

## Common Issues

1. **500 Error**: Check server logs, verify `GEMINI_API_KEY` is set
2. **400 Error**: Check request body structure matches the schema
3. **Connection refused**: Make sure server is running on port 8787
4. **Timeout**: Large text may take longer - be patient
