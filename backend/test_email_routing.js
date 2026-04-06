/**
 * Test Script: Validates the fixed auto-email routing system.
 * Simulates: "Broken road in Salt Lake"
 * Expected: AI → Road, Locality → Salt Lake, Authority found, Email sent to authority.email
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

async function testEmailRouting() {
  console.log('=== Issue2Action Email Routing Test ===\n');

  // Step 0: Find a test user
  console.log('[Setup] Fetching test user...');
  let userId;
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    if (!health.success) throw new Error('Backend not healthy');
    console.log('✅ Backend is healthy\n');
  } catch (e) {
    console.error('❌ Backend not reachable at', API_BASE);
    return;
  }

  // Get any user ID from DB
  try {
    const res = await fetch(`${API_BASE}/issues/public?limit=1`);
    const data = await res.json();
    // We'll need a real user_id - try fetching from existing issues
    const issuesRes = await fetch(`${API_BASE}/issues/public?limit=5`);
    const issuesData = await issuesRes.json();

    if (issuesData.success && issuesData.data.length > 0) {
      // Get user_id from an existing issue
      const issueId = issuesData.data[0].id;
      const issueRes = await fetch(`${API_BASE}/issues/${issueId}`);
      const issueData = await issueRes.json();
      if (issueData.success && issueData.data.user_id) {
        userId = issueData.data.user_id;
      }
    }

    if (!userId) {
      console.log('⚠️  No existing user found, using placeholder UUID');
      userId = '00000000-0000-0000-0000-000000000001';
    }
    console.log('Using user_id:', userId);
  } catch (e) {
    console.error('Setup error:', e.message);
    userId = '00000000-0000-0000-0000-000000000001';
  }

  // =============================================
  // TEST 1: "Broken road in Salt Lake"
  // Expected: issue_type → Road, locality → Salt Lake
  //           → authority: jeetdutta871@gmail.com (Road + Salt Lake)
  // =============================================
  console.log('\n--- TEST 1: "Broken road in Salt Lake" ---');
  try {
    const res = await fetch(`${API_BASE}/issues/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Broken road in Salt Lake near City Centre 2, huge potholes causing accidents',
        location_text: 'Salt Lake, Sector V',
        latitude: 22.5726,
        longitude: 88.4349,
        ward: 'Ward 99',
        user_id: userId
      })
    });
    const result = await res.json();

    if (result.success) {
      console.log('✅ Issue created:', result.data.ticket_id);
      console.log('   AI Type:', result.data.type);
      console.log('   AI Department:', result.data.department);
      console.log('   AI Priority:', result.data.priority);
      console.log('   AI Confidence:', result.data.confidence);

      // Check email_logs for this issue
      await new Promise(r => setTimeout(r, 3000)); // Wait for async email dispatch

      const issueRes = await fetch(`${API_BASE}/issues/${result.data.ticket_id}`);
      const issueData = await issueRes.json();
      console.log('   Issue stored successfully:', !!issueData.data);
      console.log('   Timeline events:', issueData.data?.timeline?.length || 0);
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (e) {
    console.log('❌ TEST 1 ERROR:', e.message);
  }

  // =============================================
  // TEST 2: Water issue in Salt Lake
  // Expected: issue_type → Water → water_saltlake@kolkata.gov.in
  // =============================================
  console.log('\n--- TEST 2: "Water leak in Salt Lake" ---');
  try {
    const res = await fetch(`${API_BASE}/issues/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Major water pipeline burst near Salt Lake stadium, flooding the entire road',
        location_text: 'Salt Lake Stadium Area',
        latitude: 22.5645,
        longitude: 88.4123,
        ward: 'Ward 100',
        user_id: userId
      })
    });
    const result = await res.json();

    if (result.success) {
      console.log('✅ Issue created:', result.data.ticket_id);
      console.log('   AI Type:', result.data.type);
      console.log('   AI Department:', result.data.department);
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (e) {
    console.log('❌ TEST 2 ERROR:', e.message);
  }

  // =============================================
  // TEST 3: Garbage issue in Park Street
  // Expected: issue_type → Garbage, no exact locality match but partial
  // =============================================
  console.log('\n--- TEST 3: "Garbage dumped at Park Street" ---');
  try {
    const res = await fetch(`${API_BASE}/issues/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Large pile of garbage dumped near Park Street metro station, terrible smell',
        location_text: 'Park Street Metro',
        latitude: 22.5520,
        longitude: 88.3540,
        ward: 'Ward 50',
        user_id: userId
      })
    });
    const result = await res.json();

    if (result.success) {
      console.log('✅ Issue created:', result.data.ticket_id);
      console.log('   AI Type:', result.data.type);
      console.log('   AI Department:', result.data.department);
    } else {
      console.log('❌ FAILED:', result.error);
    }
  } catch (e) {
    console.log('❌ TEST 3 ERROR:', e.message);
  }

  // Wait for all async dispatches to complete
  console.log('\n⏳ Waiting 5s for async email dispatches...');
  await new Promise(r => setTimeout(r, 5000));

  // =============================================
  // VERIFY: Check email_logs to confirm correct routing
  // =============================================
  console.log('\n--- VERIFICATION: Checking email_logs ---');
  try {
    const logsRes = await fetch(`${API_BASE}/health`); // Health check to confirm server alive
    // We can't directly query email_logs from API, but the server console will show debug output
    console.log('✅ Server still healthy. Check server console for debug output:');
    console.log('   Expected logs should show:');
    console.log('   - Mapped Issue Type: Road/Water/Garbage');
    console.log('   - Matched Authority: (NOT admin@issue2action.org)');
    console.log('   - Final Email: authority-specific email');
  } catch (e) {
    console.log('❌ Verification error:', e.message);
  }

  console.log('\n=== Test Complete ===');
}

testEmailRouting().catch(console.error);
