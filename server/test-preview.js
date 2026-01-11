/**
 * Test/Preview script for backend API
 * Usage: node test-preview.js
 * 
 * This script tests the summarize and ask endpoints without needing the UI
 */

const API_URL = "http://localhost:8787";

// Test data - sample rental lease document
const sampleRentalLease = {
  url: "https://example.com/lease.pdf",
  title: "Residential Lease Agreement - 2024",
  contentType: "pdf_text",
  mainText: `
RESIDENTIAL LEASE AGREEMENT

This Residential Lease Agreement ("Lease") is entered into on January 1, 2024, between 
John Doe ("Landlord") and Jane Smith ("Tenant").

1. LEASE TERM
The lease term shall commence on February 1, 2024, and shall continue until January 31, 2025, 
unless earlier terminated in accordance with the terms of this Lease.

2. RENT
The monthly rent shall be $2,000.00, payable in advance on the first day of each month. 
Rent shall be paid to the Landlord at the address specified in Section 15 of this Lease.

3. SECURITY DEPOSIT
Tenant shall pay a security deposit of $2,000.00 upon execution of this Lease. The security 
deposit shall be held by Landlord as security for the performance of Tenant's obligations 
under this Lease.

4. TERMINATION
Either party may terminate this Lease upon giving ninety (90) days written notice to the 
other party. Notice shall be deemed delivered when deposited in the United States mail, 
postage prepaid, addressed to the other party at the address set forth in this Lease.

5. MAINTENANCE AND REPAIRS
Tenant shall maintain the Premises in good condition and shall make all necessary repairs, 
except those which are the responsibility of Landlord as set forth in this Lease.

6. USE OF PREMISES
The Premises shall be used solely for residential purposes. Tenant shall not use the Premises 
for any illegal purpose or in any manner that would constitute a nuisance.

7. PETS
No pets are allowed on the Premises without the prior written consent of Landlord.

8. ALTERATIONS
Tenant shall not make any alterations, additions, or improvements to the Premises without 
the prior written consent of Landlord.

9. INSURANCE
Tenant is responsible for maintaining renter's insurance covering personal property and 
liability. Landlord maintains property insurance on the building.

10. DEFAULT
If Tenant fails to pay rent when due or breaches any other provision of this Lease, 
Landlord may terminate this Lease and take such action as permitted by law.

11. QUIET ENJOYMENT
Landlord covenants that Tenant shall have quiet enjoyment of the Premises, subject to 
the terms of this Lease.

12. ASSIGNMENT AND SUBLETTING
Tenant shall not assign this Lease or sublet the Premises without the prior written 
consent of Landlord.

13. UTILITIES
Tenant shall be responsible for all utilities, including but not limited to electricity, 
gas, water, sewer, and trash removal.

14. PARKING
One parking space is assigned to Tenant at no additional charge.

15. NOTICES
All notices required or permitted under this Lease shall be in writing and shall be 
deemed delivered when mailed by certified mail, return receipt requested, to the 
addresses set forth below or such other addresses as the parties may designate in writing.

LANDLORD ADDRESS:
123 Main Street
City, State 12345

TENANT ADDRESS:
456 Oak Avenue
City, State 12345

IN WITNESS WHEREOF, the parties have executed this Lease as of the date first written above.

LANDLORD: _______________________    TENANT: _______________________

Date: _______________            Date: _______________
  `.trim(),
  selectedText: undefined,
  structure: [
    { id: "sec_1", title: "Lease Term", startChar: 100, endChar: 300 },
    { id: "sec_2", title: "Rent", startChar: 301, endChar: 450 },
    { id: "sec_3", title: "Security Deposit", startChar: 451, endChar: 600 },
    { id: "sec_4", title: "Termination", startChar: 601, endChar: 800 },
  ],
  meta: {
    siteHint: "generic",
    timestamp: Date.now(),
  },
};

// Test data - sample question
const sampleQuestion = {
  question: "How much notice do I need to give to end the lease?",
  page: sampleRentalLease,
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

async function testHealth() {
  console.log(`${colors.blue}Testing health endpoint...${colors.reset}`);
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log(`${colors.green}✓${colors.reset} Health check:`, data);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Health check failed:`, error.message);
    return false;
  }
}

async function testSummarize(format = "summary") {
  console.log(`\n${colors.blue}Testing /summarize endpoint (format: ${format})...${colors.reset}`);
  try {
    const response = await fetch(`${API_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: sampleRentalLease,
        format: format,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log(`${colors.green}✓${colors.reset} Summarize successful!`);
    console.log(`${colors.bright}Title:${colors.reset} ${data.title}`);
    console.log(`${colors.bright}Format:${colors.reset} ${data.format}`);
    console.log(`${colors.bright}Summary Length:${colors.reset} ${data.summary.length} characters`);
    console.log(`\n${colors.bright}Summary Preview:${colors.reset}`);
    console.log("─".repeat(60));
    console.log(data.summary.substring(0, 500) + (data.summary.length > 500 ? "..." : ""));
    console.log("─".repeat(60));
    
    if (data.summary.length > 500) {
      console.log(`\n${colors.yellow}Full summary (${data.summary.length} chars) available in response${colors.reset}`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Summarize failed:`, error.message);
    return null;
  }
}

async function testAsk() {
  console.log(`\n${colors.blue}Testing /ask endpoint...${colors.reset}`);
  console.log(`${colors.bright}Question:${colors.reset} ${sampleQuestion.question}`);
  try {
    const response = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleQuestion),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log(`${colors.green}✓${colors.reset} Ask successful!`);
    console.log(`\n${colors.bright}Answer:${colors.reset}`);
    console.log("─".repeat(60));
    console.log(data.answer);
    console.log("─".repeat(60));
    
    if (data.citations && data.citations.length > 0) {
      console.log(`\n${colors.bright}Citations (${data.citations.length}):${colors.reset}`);
      data.citations.forEach((citation, idx) => {
        console.log(`\n${idx + 1}. ${colors.yellow}Quote:${colors.reset} "${citation.quote.substring(0, 100)}..."`);
        if (citation.sectionHint) {
          console.log(`   Section: ${citation.sectionHint}`);
        }
        if (citation.confidence) {
          console.log(`   Confidence: ${citation.confidence}`);
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Ask failed:`, error.message);
    return null;
  }
}

async function testPreview(action = "summarize") {
  console.log(`\n${colors.blue}Testing /preview endpoint (action: ${action})...${colors.reset}`);
  try {
    const body = action === "summarize" 
      ? { action: "summarize", page: sampleRentalLease, format: "bullet" }
      : { action: "ask", ...sampleQuestion };

    const response = await fetch(`${API_URL}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log(`${colors.green}✓${colors.reset} Preview successful!`);
    console.log(`${colors.bright}Action:${colors.reset} ${data.action}`);
    
    if (action === "summarize") {
      console.log(`${colors.bright}Summary Length:${colors.reset} ${data.summaryLength} characters`);
      console.log(`${colors.bright}PDF Size:${colors.reset} ${data.pdfSize} bytes`);
      console.log(`\n${colors.bright}Preview:${colors.reset}`);
      console.log("─".repeat(60));
      console.log(data.preview);
      console.log("─".repeat(60));
    } else {
      console.log(`${colors.bright}Answer:${colors.reset} ${data.answer.substring(0, 200)}...`);
      console.log(`${colors.bright}Citations:${colors.reset} ${data.citationsCount}`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Preview failed:`, error.message);
    return null;
  }
}

async function testSummarizeAndExport(saveToDownloads = false) {
  console.log(`\n${colors.blue}Testing /summarize-and-export endpoint (saveToDownloads: ${saveToDownloads})...${colors.reset}`);
  try {
    const response = await fetch(`${API_URL}/summarize-and-export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: sampleRentalLease,
        format: "bullet",
        saveToDownloads: saveToDownloads,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log(`${colors.green}✓${colors.reset} Summarize and export successful!`);
    console.log(`${colors.bright}Title:${colors.reset} ${data.title}`);
    console.log(`${colors.bright}Summary Length:${colors.reset} ${data.summary.length} characters`);
    console.log(`${colors.bright}PDF Base64 Length:${colors.reset} ${data.pdfBase64.length} characters`);
    
    if (saveToDownloads && data.savedPath) {
      console.log(`${colors.green}✓${colors.reset} PDF saved to: ${colors.bright}${data.savedPath}${colors.reset}`);
    } else if (saveToDownloads) {
      console.log(`${colors.yellow}⚠${colors.reset} saveToDownloads was true but no savedPath returned`);
    } else {
      console.log(`${colors.blue}ℹ${colors.reset} PDF generated but not saved (saveToDownloads: false)`);
      console.log(`${colors.blue}ℹ${colors.reset} PDF base64 data is in response.pdfBase64`);
    }
    
    return data;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Summarize and export failed:`, error.message);
    return null;
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}ContextCopilot Backend Test Suite${colors.reset}`);
  console.log(`${colors.bright}${"=".repeat(60)}${colors.reset}`);
  
  // Check if server is running
  const isHealthy = await testHealth();
  if (!isHealthy) {
    console.log(`\n${colors.red}Server is not running. Please start it with:${colors.reset}`);
    console.log(`  cd server && npm run dev`);
    process.exit(1);
  }

  // Run tests
  await testSummarize("summary");
  await testSummarize("bullet");
  await testSummarize("extract");
  await testAsk();
  await testPreview("summarize");
  await testPreview("ask");
  await testSummarizeAndExport(false);
  // Uncomment to test saving to Downloads (will actually save a file)
  // await testSummarizeAndExport(true);

  console.log(`\n${colors.bright}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.green}All tests completed!${colors.reset}`);
  console.log(`${colors.bright}${"=".repeat(60)}${colors.reset}`);
}

// Run tests
runAllTests().catch(console.error);

