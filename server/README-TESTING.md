# Backend Testing Guide

## Prerequisites

1. **Set up environment variable:**
   Create a `.env` file in the `server` directory:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

2. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

## Running the Server

```bash
npm run dev
```

The server will start on `http://localhost:8787`

## Testing Endpoints

### 1. Health Check
```bash
curl http://localhost:8787/health
```

### 2. Test with Preview Script (Recommended)

Run the automated test script:
```bash
node test-preview.js
```

This script will test:
- `/summarize` endpoint with different formats (summary, bullet, extract)
- `/ask` endpoint
- `/preview` endpoint
- `/summarize-and-export` endpoint

### 3. Manual Testing with curl

#### Summarize Endpoint
```bash
curl -X POST http://localhost:8787/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "page": {
      "url": "https://example.com/lease.pdf",
      "title": "Rental Lease Agreement",
      "contentType": "pdf_text",
      "mainText": "Your document text here...",
      "meta": { "siteHint": "generic" }
    },
    "format": "bullet"
  }'
```

#### Ask Endpoint
```bash
curl -X POST http://localhost:8787/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How much notice do I need to give?",
    "page": {
      "url": "https://example.com/lease.pdf",
      "title": "Rental Lease Agreement",
      "contentType": "pdf_text",
      "mainText": "Your document text here..."
    }
  }'
```

#### Summarize and Export (with PDF download)
```bash
curl -X POST http://localhost:8787/summarize-and-export \
  -H "Content-Type: application/json" \
  -d '{
    "page": {
      "url": "https://example.com/lease.pdf",
      "title": "Rental Lease Agreement",
      "contentType": "pdf_text",
      "mainText": "Your document text here..."
    },
    "format": "bullet",
    "saveToDownloads": true
  }'
```

#### Preview Endpoint (Test Backend)
```bash
# Test summarize action
curl -X POST http://localhost:8787/preview \
  -H "Content-Type: application/json" \
  -d '{
    "action": "summarize",
    "page": {
      "url": "https://example.com/lease.pdf",
      "title": "Rental Lease Agreement",
      "contentType": "pdf_text",
      "mainText": "Your document text here..."
    },
    "format": "bullet"
  }'

# Test ask action
curl -X POST http://localhost:8787/preview \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ask",
    "question": "How much notice do I need?",
    "page": {
      "url": "https://example.com/lease.pdf",
      "title": "Rental Lease Agreement",
      "contentType": "pdf_text",
      "mainText": "Your document text here..."
    }
  }'
```

## Available Formats

- `summary`: Comprehensive summary with main topics and findings
- `bullet`: Bullet points with key information
- `extract`: Extracted and organized critical information

## API Endpoints

### `POST /summarize`
Summarize/extract content from a page.

**Request Body:**
- `page`: PagePayload object
- `format`: "summary" | "bullet" | "extract"

**Response:**
- `summary`: Generated summary text
- `format`: Format used
- `title`: Document title
- `url`: Document URL
- `timestamp`: ISO timestamp

### `POST /export-pdf`
Generate PDF from summary text.

**Request Body:**
- `summary`: Summary text
- `title`: PDF title
- `format`: Format type
- `saveToDownloads`: Boolean (optional, defaults to false)

**Response:**
- `pdfBase64`: Base64 encoded PDF
- `savedPath`: Path where PDF was saved (if saveToDownloads is true)
- `filename`: Filename of saved PDF

### `POST /summarize-and-export`
Combines summarize and export in one call.

**Request Body:**
- `page`: PagePayload object
- `format`: "summary" | "bullet" | "extract"
- `saveToDownloads`: Boolean (optional, defaults to false)

**Response:**
- All fields from `/summarize` plus:
- `pdfBase64`: Base64 encoded PDF
- `savedPath`: Path where PDF was saved (if saveToDownloads is true)
- `filename`: Filename of saved PDF

### `POST /preview`
Test endpoint for backend preview without UI.

**Request Body:**
- `action`: "summarize" | "ask"
- Additional fields based on action

**Response:**
- Action-specific response data

## Notes

- PDFs are saved to the user's Downloads folder when `saveToDownloads: true`
- The system prompt is optimized for:
  - Rental leases and legal documents
  - Research papers
  - Reports and documents
- Gemini Vision API is used automatically for `pdf_image` content type
- For large documents, chunking is handled automatically

