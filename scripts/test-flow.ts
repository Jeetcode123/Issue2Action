// @ts-nocheck
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load the environment variables from the backend folder
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { classifyIssue } = require('../backend/aiService');
const { createClient } = require('@insforge/sdk');

const API_BASE = 'http://localhost:3001/api';

async function runTests() {
  console.log('--- Issue2Action End-to-End Test Flow ---');

  // 0. Setup: Ensure we have a valid database client and user
  console.log('\n[Setup] Initializing InsForge client and finding a test user...');
  const insforge = createClient({
    baseUrl: process.env.INSFORGE_BASE_URL || '',
    anonKey: process.env.INSFORGE_ANON_KEY || ''
  });

  let userId: string;
  try {
    const { data: users, error: usersErr } = await insforge.database.from('users').select('id').limit(1);
    if (usersErr) throw usersErr;

    if (users && users.length > 0) {
      userId = users[0].id;
    } else {
      // Create a dummy user if none exist
      const { data: newUser, error: createErr } = await insforge.database.from('users').insert([{ 
        name: 'Test Tester', 
        email: `test-${Date.now()}@test.com`,
        ward: 'TestWard'
      }]).select('id').single();
      
      if (createErr) throw createErr;
      userId = newUser.id;
    }
    console.log(`✅ Using User ID: ${userId}`);
  } catch (error: any) {
    console.error(`❌ Setup failed: Unable to fetch or create user: ${error.message}`);
    console.log('Make sure the backend is running and .env is configured correctly.');
    return;
  }

  // 1. POST /api/issues/create
  console.log('\n1. Testing Issue Creation...');
  let ticketId: string;
  try {
    const res = await fetch(`${API_BASE}/issues/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Huge pothole at MG Road intersection',
        location_text: 'MG Road',
        latitude: 22.5726,
        longitude: 88.3639,
        ward: 'TestWard',
        user_id: userId
      })
    });
    const result = await res.json();

    if (result.success && /^I2A-\d{4}-\d{4}$/.test(result.data.ticket_id)) {
      ticketId = result.data.ticket_id;
      console.log(`✅ PASS: Issue created. Ticket ID: ${ticketId}`);
      console.log('Response data:', result.data);
    } else {
      console.log(`❌ FAIL: Invalid response format`);
      console.log(result);
      return; 
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
    return;
  }

  // 2. GET /api/issues/{ticketId}
  console.log('\n2. Testing Issue Retrieval...');
  try {
    const res = await fetch(`${API_BASE}/issues/${ticketId}`);
    const result = await res.json();
    if (result.success && result.data.id === ticketId && result.data.ai_summary) {
      console.log(`✅ PASS: Issue retrieved successfully. AI Summary: "${result.data.ai_summary}"`);
      console.log(`Fields populated -> Type: ${result.data.type}, Priority: ${result.data.priority}, Department: ${result.data.department}`);
    } else {
      console.log(`❌ FAIL: Could not retrieve valid issue details`);
      console.log(result);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  // 3. POST /api/issues/{ticketId}/upvote
  console.log('\n3. Testing Upvote functionality...');
  try {
    const res = await fetch(`${API_BASE}/issues/${ticketId}/upvote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    const result = await res.json();
    // It could be success, or already upvoted if the duplication logic somehow fired, but ideally success
    if (result.success && result.data.upvotes > 0) {
      console.log(`✅ PASS: Upvoted successfully. Total upvotes: ${result.data.upvotes}`);
    } else if (result.error === 'Already upvoted') {
       console.log(`✅ PASS (Auto-Upvoted): Already upvoted (possibly due to duplicate detection).`);
    } else {
      console.log(`❌ FAIL: Upvote failed`);
      console.log(result);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  // 4. PATCH /api/issues/{ticketId}/status
  console.log('\n4. Testing Status Update...');
  try {
    const res = await fetch(`${API_BASE}/issues/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'assigned', message: 'Assigned to PWD team' })
    });
    const result = await res.json();
    if (result.success) {
      // Verify timeline event exists
      const verifyRes = await fetch(`${API_BASE}/issues/${ticketId}`);
      const verify = await verifyRes.json();
      const hasTimeline = verify.data.timeline && verify.data.timeline.length > 0;
      const timelineEvent = verify.data.timeline.find((t: any) => t.event_type === 'updated' || t.message === 'Assigned to PWD team');
      
      if (hasTimeline && verify.data.status === 'assigned') {
        console.log(`✅ PASS: Status updated to 'assigned' and timeline_event created.`);
      } else {
        console.log(`❌ FAIL: Status altered but timeline verification failed`);
        console.log(verify);
      }
    } else {
      console.log(`❌ FAIL: Status update request rejected`);
      console.log(result);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  // 5. GET /api/issues/public?ward=TestWard
  console.log('\n5. Testing Public Listing...');
  try {
    const res = await fetch(`${API_BASE}/issues/public?ward=TestWard`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data) && result.data.some((i: any) => i.id === ticketId)) {
      console.log(`✅ PASS: Issue successfully appeared in public list for ward=TestWard`);
    } else {
      console.log(`❌ FAIL: Issue not found in public list for ward`);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  // 6. GET /api/users/{userId}/issues
  console.log('\n6. Testing User History...');
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/issues`);
    const result = await res.json();
    if (result.success && Array.isArray(result.data) && result.data.some((i: any) => i.id === ticketId)) {
      console.log(`✅ PASS: Issue found in user history`);
    } else {
      console.log(`❌ FAIL: Issue not found in user history`);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  // 7. Verify Claude Integration
  console.log('\n7. Verifying Claude Integration Separately...');
  try {
    const res = await classifyIssue("Large pothole on main road causing accidents");
    
    // Assert response has: type, priority, department, confidence > 0
    if (res && res.type && res.priority && res.department && typeof res.confidence === 'number' && res.confidence > 0) {
      console.log(`✅ PASS: Claude effectively classified the issue.`);
      console.log('Result:', res);
    } else {
      console.log(`❌ FAIL: Claude classification missing expected fields or confidence <= 0.`);
      console.log('Output:', res);
    }
  } catch (e: any) {
    console.log(`❌ FAIL: ${e.message}`);
  }

  console.log('\n--- Script Completed ---');
}

runTests().catch(console.error);
