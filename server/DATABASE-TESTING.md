# Database Testing Guide

## Step 1: Verify Server Starts with MongoDB Connection

Run:
```bash
cd server
pnpm dev
```

**Expected Output:**
```
🔌 Attempting to connect to MongoDB: mongodb+srv://shehacks:***@...
✅ Connected to MongoDB successfully
ContextCopilot server running on http://localhost:8787
✓ GEMINI_API_KEY is set (loaded from ...)
🚀 Server is ready and waiting for requests...
```

If you see **"✅ Connected to MongoDB successfully"**, your database connection is working!

---

## Step 2: Test Database with a Simple API Call

### Option A: Using Postman or Browser

1. **Test Health Endpoint:**
   ```
   GET http://localhost:8787/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Create a Test Session:**
   ```
   POST http://localhost:8787/api/sessions
   Content-Type: application/json
   
   {
     "userId": "test-user-123",
     "email": "test@example.com"
   }
   ```
   **Expected Response:**
   ```json
   {
     "sessionId": "...",
     "userId": "test-user-123",
     "email": "test@example.com",
     "createdAt": "...",
     "lastActive": "..."
   }
   ```

3. **Make a Test API Call (that saves history):**
   ```
   POST http://localhost:8787/summarize
   Content-Type: application/json
   
   {
     "userId": "test-user-123",
     "page": {
       "url": "https://example.com",
       "title": "Test Page",
       "contentType": "html",
       "mainText": "This is a test document about machine learning and artificial intelligence. It discusses various algorithms and their applications."
     },
     "detailLevel": "brief"
   }
   ```
   **Expected Response:**
   ```json
   {
     "summary": "...",
     "detailLevel": "brief",
     "title": "Test Page",
     "url": "https://example.com",
     "timestamp": "..."
   }
   ```
   
   ✅ **If this works, history was saved to MongoDB!**

---

## Step 3: Retrieve History from Database

1. **Get User's Chat History:**
   ```
   GET http://localhost:8787/api/history/test-user-123
   ```
   **Expected Response:**
   ```json
   {
     "history": [
       {
         "_id": "...",
         "userId": "test-user-123",
         "requestType": "summarize",
         "pageUrl": "https://example.com",
         "pageTitle": "Test Page",
         "timestamp": "...",
         "input": {
           "detailLevel": "brief",
           "mainTextPreview": "..."
         },
         "output": {
           "summary": "..."
         },
         "responseTime": 1234,
         "success": true
       }
     ],
     "total": 1,
     "limit": 50,
     "offset": 0
     }
   ```

2. **Get User Stats:**
   ```
   GET http://localhost:8787/api/sessions/test-user-123
   ```
   **Expected Response:**
   ```json
   {
     "session": {
       "userId": "test-user-123",
       "email": "test@example.com",
       "createdAt": "...",
       "lastActive": "..."
     },
     "stats": {
       "totalInteractions": 1,
       "requestTypeBreakdown": {
         "summarize": 1
       }
     }
   }
   ```

---

## Step 4: Test Other Endpoints (All Save History)

### Test "Ask" Endpoint:
```
POST http://localhost:8787/ask
Content-Type: application/json

{
  "userId": "test-user-123",
  "question": "What is this about?",
  "page": {
    "url": "https://example.com",
    "title": "Test Page",
    "contentType": "html",
    "mainText": "Machine learning is a subset of artificial intelligence."
  }
}
```

### Test "Key Points" Endpoint:
```
POST http://localhost:8787/key-points
Content-Type: application/json

{
  "userId": "test-user-123",
  "page": {
    "url": "https://example.com",
    "title": "Test Page",
    "contentType": "html",
    "mainText": "Machine learning is important. AI has many applications."
  }
}
```

---

## Step 5: Verify Data in MongoDB (Optional)

If you have MongoDB Compass or access to your MongoDB Atlas dashboard:

1. **Check Collections:**
   - `sessions` - Should have your test user
   - `chat_history` - Should have your test requests
   - `pages` - Should have your test pages

2. **Query Examples:**
   ```javascript
   // In MongoDB Compass or shell
   db.sessions.find({ userId: "test-user-123" })
   db.chat_history.find({ userId: "test-user-123" })
   db.pages.find({ url: "https://example.com" })
   ```

---

## Quick Test Script (PowerShell)

Run this to test everything at once:

```powershell
$userId = "test-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
$baseUrl = "http://localhost:8787"

Write-Host "1. Creating session..."
$session = Invoke-RestMethod -Uri "$baseUrl/api/sessions" -Method POST -ContentType "application/json" -Body (@{userId=$userId;email="test@example.com"} | ConvertTo-Json)
Write-Host "✅ Session created: $($session.sessionId)"

Write-Host "`n2. Testing summarize endpoint..."
$summarizeBody = @{
    userId = $userId
    page = @{
        url = "https://example.com"
        title = "Test Page"
        contentType = "html"
        mainText = "This is a test document about artificial intelligence and machine learning algorithms."
    }
    detailLevel = "brief"
} | ConvertTo-Json

$summary = Invoke-RestMethod -Uri "$baseUrl/summarize" -Method POST -ContentType "application/json" -Body $summarizeBody
Write-Host "✅ Summary received: $($summary.summary.Substring(0, [Math]::Min(50, $summary.summary.Length)))..."

Write-Host "`n3. Getting history..."
$history = Invoke-RestMethod -Uri "$baseUrl/api/history/$userId"
Write-Host "✅ Found $($history.total) history entries"

Write-Host "`n4. Getting stats..."
$stats = Invoke-RestMethod -Uri "$baseUrl/api/sessions/$userId"
Write-Host "✅ Total interactions: $($stats.stats.totalInteractions)"

Write-Host "`n✅ All tests passed! Database is working correctly."
```

---

## What to Expect (Success Indicators)

✅ **Server starts without errors**
✅ **MongoDB connection message appears**
✅ **API endpoints return responses**
✅ **History endpoints return data after making requests**
✅ **Stats show correct counts**

If all of these work, your database integration is successful! 🎉
