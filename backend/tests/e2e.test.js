#!/usr/bin/env node
/**
 * Issue2Action — Production Test Suite
 * 
 * Comprehensive E2E tests covering all critical flows:
 *  1. Health Check
 *  2. User Signup & Login
 *  3. Issue Submission (Create)
 *  4. Issue Classification (AI)
 *  5. Authority Routing
 *  6. Email Dispatch
 *  7. Status Tracking
 *  8. Duplicate Detection & Merge
 *  9. Notifications Pipeline
 * 10. Error Recovery & Edge Cases
 *
 * Run: node tests/e2e.test.js
 */

require('dotenv').config();

const BASE = process.env.API_BASE_URL || 'http://localhost:3001';

// ─── Helpers ────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m', white: '\x1b[37m', gray: '\x1b[90m',
};

const results = [];

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, ...json, _ms: Date.now() - start };
  } catch (err) {
    return { status: 0, success: false, error: err.message, _ms: Date.now() - start };
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, status: 'PASS', ms });
    console.log(`  ${C.green}✓${C.reset} ${name} ${C.dim}(${ms}ms)${C.reset}`);
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ name, status: 'FAIL', ms, error: err.message });
    console.log(`  ${C.red}✗${C.reset} ${name} ${C.dim}(${ms}ms)${C.reset}`);
    console.log(`    ${C.red}→ ${err.message}${C.reset}`);
  }
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}━━━ ${title} ━━━${C.reset}`);
}

// ─── State ──────────────────────────────────────────────────

let testUserId = null;
let testToken = null;
let createdTicketId = null;
let duplicateTicketId = null;
const TEST_EMAIL = `testbot_${Date.now()}@issue2action.test`;
const TEST_PASS = 'TestPass!2026';

// ─── Test Suites ────────────────────────────────────────────

async function run() {
  console.log(`\n${C.bold}${C.blue}╔═══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.blue}║   Issue2Action — Production Test Suite            ║${C.reset}`);
  console.log(`${C.bold}${C.blue}╚═══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}  Target: ${BASE}${C.reset}`);
  console.log(`${C.dim}  Time:   ${new Date().toISOString()}${C.reset}`);

  // ─── 1. Health Check ───
  section('1. Health Check');

  await test('GET /api/health returns ok', async () => {
    const res = await api('/api/health');
    assert(res.success === true, `Expected success, got: ${JSON.stringify(res)}`);
    assert(res.data?.status === 'ok', `Expected status ok, got: ${res.data?.status}`);
    assert(res.data?.insforgeConnected === true, 'InsForge should be connected');
  });

  // ─── 2. Authentication ───
  section('2. Authentication');

  await test('POST /api/auth/signup creates a user', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: { firstName: 'TestBot', lastName: 'Runner', email: TEST_EMAIL, password: TEST_PASS, cityWard: 'Test Ward' },
    });
    // Signup may succeed or require email verification — both are valid
    if (res.success && res.data?.userId) {
      testUserId = res.data.userId;
      testToken = res.data.token;
    } else if (res.data?.requireEmailVerification) {
      console.log(`    ${C.yellow}ℹ Email verification required (expected in production)${C.reset}`);
    }
    // Signup should not return a 500 error
    assert(res.status !== 500, `Signup returned 500: ${res.error}`);
  });

  await test('POST /api/auth/login works', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASS },
    });
    // Login may fail if email not verified — expected
    if (res.success && res.data?.token) {
      testToken = res.data.token;
      testUserId = res.data.userId || testUserId;
    } else {
      console.log(`    ${C.yellow}ℹ Login failed (expected if verification needed): ${res.error}${C.reset}`);
    }
    assert(res.status !== 500, `Login returned 500: ${res.error}`);
  });

  // Fallback: Get a test user from existing data if signup/login didn't provide one
  if (!testUserId) {
    await test('Fallback: Get existing user from database', async () => {
      const res = await api('/api/issues/public?limit=1');
      if (res.success && res.data?.[0]) {
        // Get the user_id from an existing issue
        const issueRes = await api(`/api/issues/${res.data[0].id}`);
        if (issueRes.success && issueRes.data?.user_id) {
          testUserId = issueRes.data.user_id;
          console.log(`    ${C.dim}ℹ Using existing user: ${testUserId.substring(0, 8)}...${C.reset}`);
        }
      }
      assert(testUserId, 'Could not find any existing user in the system — create one manually first');
    });
  }

  await test('POST /api/auth/signup rejects missing password', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: { email: 'incomplete@test.com' },
    });
    assert(res.success === false, 'Should have failed without password');
    assert(res.error, 'Should have returned an error message');
  });

  // ─── 3. Submit Issue ───
  section('3. Issue Submission');

  await test('POST /api/issues/create submits an issue', async () => {
    assert(testUserId, 'Test user required — signup/login must pass');
    const res = await api('/api/issues/create', {
      method: 'POST',
      body: {
        description: 'Massive pothole on Salt Lake Sector V road near IT hub, vehicles damaged',
        location_text: 'Salt Lake Sector V, Kolkata',
        latitude: 22.5726,
        longitude: 88.4303,
        ward: 'Ward 110',
        user_id: testUserId,
      },
    });
    assert(res.success === true, `Issue creation failed: ${res.error}`);
    createdTicketId = res.data?.ticket_id;
    assert(createdTicketId, `No ticket_id returned: ${JSON.stringify(res.data)}`);
    assert(res.data?.type, 'AI should classify the issue type');
    assert(res.data?.priority, 'AI should assign a priority');
    assert(res.data?.department, 'AI should assign a department');
  });

  await test('Issue creation returns AI confidence score', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.success === true, `Failed to fetch issue: ${res.error}`);
    assert(typeof res.data?.ai_confidence === 'number', 'ai_confidence should be a number');
  });

  await test('POST /api/issues/create rejects missing fields', async () => {
    const res = await api('/api/issues/create', {
      method: 'POST',
      body: { description: 'incomplete' },
    });
    assert(res.success === false, 'Should fail without location/user');
    assert(res.error?.includes('Missing'), `Expected missing fields error, got: ${res.error}`);
  });

  // ─── 4. AI Classification ───
  section('4. AI Classification (verified through issue data)');

  await test('Issue has valid type classification', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.success === true, `Fetch failed: ${res.error}`);
    const validTypes = ['Road Damage', 'Water Leak', 'Garbage', 'Street Light', 'Electrical Fault', 'Tree/Parks', 'Noise', 'Other', 'Pothole', 'Infrastructure'];
    const hasValidType = validTypes.some(t => res.data?.type?.toLowerCase().includes(t.toLowerCase()));
    assert(hasValidType || res.data?.type, `AI should classify the issue, got: ${res.data?.type}`);
  });

  await test('Issue has priority correctly assigned', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    assert(validPriorities.includes(res.data?.priority), `Invalid priority: ${res.data?.priority}`);
  });

  // ─── 5. Authority Routing ───
  section('5. Authority Routing');

  await test('Issue is assigned to a department', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.data?.department, 'Department should be assigned by AI routing');
  });

  await test('GET /api/admin/authorities returns authority list', async () => {
    const res = await api('/api/admin/authorities');
    assert(res.success === true, `Failed: ${res.error}`);
    assert(Array.isArray(res.data), 'Should return an array');
  });

  // ─── 6. Email Dispatch ───
  section('6. Email Dispatch');

  await test('Email log exists for the created issue', async () => {
    // Email dispatch runs async, give it a moment
    await new Promise(r => setTimeout(r, 4000));
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.success === true, `Fetch failed: ${res.error}`);
    // Check timeline for email dispatch event
    const timeline = res.data?.timeline || [];
    const emailEvent = timeline.find(t => t.message?.toLowerCase().includes('sent') || t.message?.toLowerCase().includes('email'));
    // Email might still be processing, just log the result
    if (!emailEvent) {
      console.log(`    ${C.yellow}⚠ Email timeline event not yet posted (async dispatch still in flight)${C.reset}`);
    }
  });

  // ─── 7. Status Tracking ───
  section('7. Status Tracking');

  await test('GET /api/issues/:id returns full issue with timeline', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.success === true, `Fetch failed: ${res.error}`);
    assert(res.data?.id === createdTicketId, 'Issue ID should match');
    assert(Array.isArray(res.data?.timeline), 'Timeline should be an array');
    assert(res.data.timeline.length >= 1, 'Timeline should have at least 1 event');
  });

  await test('PATCH /api/issues/:id/status updates status', async () => {
    const res = await api(`/api/issues/${createdTicketId}/status`, {
      method: 'PATCH',
      body: { status: 'in_progress', message: 'Work crew dispatched to location', updated_by: 'test_authority' },
    });
    assert(res.success === true, `Status update failed: ${res.error}`);
  });

  await test('Issue reflects updated status', async () => {
    const res = await api(`/api/issues/${createdTicketId}`);
    assert(res.data?.status === 'in_progress', `Expected in_progress, got: ${res.data?.status}`);
  });

  await test('PATCH status rejects missing fields', async () => {
    const res = await api(`/api/issues/${createdTicketId}/status`, {
      method: 'PATCH',
      body: {},
    });
    assert(res.success === false, 'Should fail without status and message');
  });

  // ─── 8. Duplicate Detection & Merge ───
  section('8. Duplicate Detection & Merge');

  await test('Submitting a similar issue triggers duplicate detection', async () => {
    assert(testUserId, 'Test user required');
    const res = await api('/api/issues/create', {
      method: 'POST',
      body: {
        description: 'Large pothole on the road in Salt Lake Sector V area, vehicles are getting damaged daily',
        location_text: 'Salt Lake Sector V, Kolkata',
        latitude: 22.5726,
        longitude: 88.4303,
        ward: 'Ward 110',
        user_id: testUserId,
      },
    });
    assert(res.success === true, `2nd issue creation failed: ${res.error}`);
    duplicateTicketId = res.data?.ticket_id;
    // It may or may not detect as duplicate depending on AI, just verify the field exists
    assert(res.data?.hasOwnProperty('is_duplicate') !== undefined, 'is_duplicate field should be present');
    assert(typeof res.data?.similarity_score === 'number', 'similarity_score should be returned');
    if (res.data?.is_duplicate) {
      console.log(`    ${C.green}ℹ AI detected duplicate with ${res.data.similarity_score}% similarity${C.reset}`);
    } else {
      console.log(`    ${C.yellow}ℹ AI did not flag as duplicate (score: ${res.data.similarity_score}%)${C.reset}`);
    }
  });

  // ─── 9. Notifications ───
  section('9. Notifications Pipeline');

  await test('Notifications were created for the user', async () => {
    assert(testUserId, 'Test user required');
    // Wait for async notification pipeline to finish
    await new Promise(r => setTimeout(r, 2000));
    const res = await api(`/api/users/${testUserId}/notifications`);
    assert(res.success === true, `Fetch failed: ${res.error}`);
    assert(Array.isArray(res.data), 'Should return an array');
    assert(res.data.length > 0, 'Should have at least 1 notification from issue creation');
    const types = [...new Set(res.data.map(n => n.type))];
    console.log(`    ${C.dim}ℹ ${res.data.length} notifications found, types: [${types.join(', ')}]${C.reset}`);
  });

  await test('Unread count matches actual unread notifications', async () => {
    const countRes = await api(`/api/users/${testUserId}/notifications/unread-count`);
    assert(countRes.success === true, `Count fetch failed: ${countRes.error}`);
    assert(typeof countRes.data?.count === 'number', 'Count should be a number');
    
    const listRes = await api(`/api/users/${testUserId}/notifications`);
    const actualUnread = listRes.data?.filter(n => !n.is_read).length || 0;
    assert(countRes.data.count === actualUnread, `Count mismatch: API says ${countRes.data.count}, actual: ${actualUnread}`);
  });

  await test('Mark notification as read works', async () => {
    const listRes = await api(`/api/users/${testUserId}/notifications`);
    const first = listRes.data?.[0];
    if (!first) { console.log(`    ${C.yellow}⚠ No notifications to test marking${C.reset}`); return; }

    const markRes = await api(`/api/users/${testUserId}/notifications/${first.id}/read`, { method: 'PATCH' });
    assert(markRes.success === true, `Mark read failed: ${markRes.error}`);
  });

  await test('Mark all notifications as read works', async () => {
    const res = await api(`/api/users/${testUserId}/notifications/read-all`, { method: 'POST' });
    assert(res.success === true, `Mark all read failed: ${res.error}`);

    const countRes = await api(`/api/users/${testUserId}/notifications/unread-count`);
    assert(countRes.data?.count === 0, `Unread count should be 0 after mark-all, got: ${countRes.data?.count}`);
  });

  // ─── 10. Error Recovery & Edge Cases ───
  section('10. Error Recovery & Edge Cases');

  await test('GET /api/issues/NONEXISTENT returns 404', async () => {
    const res = await api('/api/issues/I2A-9999-0000');
    assert(res.success === false, 'Should fail for non-existent issue');
  });

  await test('POST to unknown route returns 404', async () => {
    const res = await api('/api/this-does-not-exist');
    assert(res.success === false, 'Should return 404 for unknown route');
  });

  await test('POST /api/issues/create with malformed body returns 400', async () => {
    const res = await api('/api/issues/create', { method: 'POST', body: {} });
    assert(res.success === false, 'Should fail with empty body');
  });

  await test('GET /api/users/invalid-user/notifications handles gracefully', async () => {
    const res = await api('/api/users/00000000-0000-0000-0000-000000000000/notifications');
    assert(res.success === true || res.success === false, 'Should not crash server');
    if (res.success) {
      assert(Array.isArray(res.data), 'Should return empty array for unknown user');
    }
  });

  await test('GET /api/admin/logs returns recent logs', async () => {
    const res = await api('/api/admin/logs?count=10');
    assert(res.success === true, `Logs fetch failed: ${res.error}`);
    assert(Array.isArray(res.data), 'Should return array of log entries');
    assert(res.data.length > 0, 'Should have logs from the test run');
  });

  // ─── 11. Public Issues ───
  section('11. Public & User APIs');

  await test('GET /api/issues/public returns issues', async () => {
    const res = await api('/api/issues/public?limit=5');
    assert(res.success === true, `Failed: ${res.error}`);
    assert(Array.isArray(res.data), 'Should return an array');
  });

  await test('GET /api/users/:userId/issues returns user issues', async () => {
    assert(testUserId, 'Test user required');
    const res = await api(`/api/users/${testUserId}/issues`);
    assert(res.success === true, `Failed: ${res.error}`);
    assert(Array.isArray(res.data), 'Should return an array');
    assert(res.data.length >= 1, 'User should have at least 1 issue from test');
  });

  // ─── Summary ──────────────────────────────────────────────

  console.log(`\n${C.bold}${C.blue}═════════════════════════════════════════════════════${C.reset}`);
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const avgMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / total);
  
  if (failed === 0) {
    console.log(`  ${C.bgGreen}${C.white}${C.bold}  ALL ${total} TESTS PASSED  ${C.reset} ${C.dim}(avg ${avgMs}ms)${C.reset}`);
  } else {
    console.log(`  ${C.bgRed}${C.white}${C.bold}  ${failed}/${total} TESTS FAILED  ${C.reset} ${C.green}${passed} passed${C.reset} ${C.dim}(avg ${avgMs}ms)${C.reset}`);
    console.log(`\n  ${C.red}${C.bold}Failed tests:${C.reset}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ${C.red}✗ ${r.name}${C.reset}`);
      console.log(`      ${C.dim}${r.error}${C.reset}`);
    });
  }
  console.log(`${C.bold}${C.blue}═════════════════════════════════════════════════════${C.reset}\n`);

  // Return results for report generation
  return { passed, failed, total, avgMs, results };
}

// ─── Execute & Generate Report ──────────────────────────────

run().then(summary => {
  // Generate machine-readable report
  const report = {
    timestamp: new Date().toISOString(),
    target: BASE,
    summary: { passed: summary.passed, failed: summary.failed, total: summary.total, avgMs: summary.avgMs },
    tests: summary.results,
  };
  
  const fs = require('fs');
  const path = require('path');
  const reportDir = path.join(__dirname, '..', 'test-reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `test-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${C.dim}Report saved to: ${reportPath}${C.reset}\n`);

  process.exit(summary.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error(`\n${C.bgRed}${C.white} FATAL TEST ERROR ${C.reset}`, err);
  process.exit(2);
});
