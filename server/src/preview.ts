// Run this script to test the backend
// Usage: npx tsx preview.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runPreview() {
  console.log('🔍 Starting Backend Preview...');

  // 1. Check if server is running
  try {
    const health = await fetch('http://localhost:8787/health');
    if (!health.ok) throw new Error('Server not healthy');
    console.log('✅ Server is running.');
  } catch (e) {
    console.error('❌ Server is NOT running. Please run `npm run dev` in the server folder first.');
    process.exit(1);
  }

  // 2. Simulate a request (Mocking a Rental Lease context)
  console.log('\n📝 Sending mock request (Rental Lease Summary)...');
  
  const mockContext = `
    RESIDENTIAL LEASE AGREEMENT. 
    Term: This lease shall begin on January 1, 2024 and end on December 31, 2024.
    Rent: The Tenant agrees to pay $2,500 per month, due on the 1st of each month.
    Security Deposit: A deposit of $5,000 is required prior to move-in.
    Pets: No pets are allowed without prior written consent.
  `;

  const askResponse = await fetch('http://localhost:8787/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: "Summarize the key financial obligations and dates.",
      page: {
        url: "http://mock-rental.com",
        title: "Rental Lease",
        contentType: "html",
        mainText: mockContext
      }
    })
  });

  if (!askResponse.ok) {
    console.error("Ask request failed:", await askResponse.text());
    return;
  }

  const data = await askResponse.json() as { answer: string };
  console.log('\n🤖 AI Response:\n', '-----------------------------------');
  console.log(data.answer);
  console.log('-----------------------------------');

  // 3. Test PDF Generation
  console.log('\n📄 Testing PDF Generation...');
  const pdfResponse = await fetch('http://localhost:8787/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      summary: data.answer,
      title: "Rental Lease Summary",
      format: "summary",
      saveToDownloads: true
    })
  });

  if (pdfResponse.ok) {
    const result = await pdfResponse.json() as { savedPath?: string };
    console.log('✅ PDF generated successfully.');
    if (result.savedPath) console.log(`📂 Saved to: ${result.savedPath}`);
  } else {
    console.log('❌ PDF generation failed.');
  }

  // 4. Test ELI5 Mode
  console.log('\n👶 Testing ELI5 Mode...');
  const eli5Response = await fetch('http://localhost:8787/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: {
        url: "http://mock-rental.com",
        title: "Rental Lease",
        contentType: "html",
        mainText: mockContext
      },
      format: "eli5"
    })
  });

  if (eli5Response.ok) {
    const data = await eli5Response.json() as { summary: string };
    console.log('✅ ELI5 Summary generated:');
    console.log('-----------------------------------');
    console.log(data.summary);
    console.log('-----------------------------------');
  } else {
    console.log('❌ ELI5 generation failed.');
  }

  // 5. Test Voice Transcription
  console.log('\n🎙️ Testing Voice Transcription...');
  const audioPath = path.join(__dirname, '../test_audio.wav');
  
  if (fs.existsSync(audioPath)) {
    console.log(`   - Found audio file: ${audioPath}`);
    const audioBuffer = fs.readFileSync(audioPath);
    const formData = new FormData();
    // Create a Blob from the buffer - Node 18+ supports global Blob
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('audio', blob, 'test_audio.wav');

    const transcribeResponse = await fetch('http://localhost:8787/transcribe', {
      method: 'POST',
      body: formData
    });

    if (transcribeResponse.ok) {
      const data = await transcribeResponse.json() as { transcript: string };
      console.log('✅ Transcription Result:', data.transcript);
    } else {
      console.error('❌ Transcription failed:', await transcribeResponse.text());
    }
  } else {
    console.log('⚠️  Skipping transcription test (no test_audio.wav found in server root)');
  }
}

runPreview();