# Full-Stack Debugging Agents - Interactive Demo

This demo shows how the agent system tests **interactive full-stack web apps** where bugs can be in the frontend, backend, or both!

## The Problem We're Solving

Traditional debugging approaches fail with interactive web apps because:
- ❌ You can't see what's happening in the browser
- ❌ Frontend and backend logs are disconnected
- ❌ Manual testing is slow and error-prone
- ❌ No systematic way to verify all user flows
- ❌ Hard to reproduce bugs that only happen during user interaction

## Our Solution

**Multi-agent system with real browser automation:**
1. **Computer Use Agent** interacts with the web UI like a real user
2. **Server logs** are captured in real-time
3. **Browser console** is monitored for frontend errors
4. **Network requests** are tracked (API calls)
5. **Screenshots** document every step
6. **Debugging agents** fix issues in frontend, backend, or both

---

## Demo Workflow

### Step 1: Start the Buggy App

```bash
cd /Users/williampearson/Legion/agents/full-stack/__tests__/test-apps/buggy-todo-app
npm install
node server.js
```

Server runs on: `http://localhost:3001`

### Step 2: Generate UAT Documentation

The **UAT Writer Agent** analyzes the app and creates test scenarios:

```javascript
// Claude Code invokes the agent
await Task({
  subagent_type: 'general-purpose',
  description: 'Generate UAT documentation',
  prompt: `Use the uat-writer agent to analyze buggy-todo-app and create comprehensive UAT test plan.`
});
```

**Output**: `docs/UAT-TEST-PLAN.md` with 14 test scenarios

### Step 3: Execute Interactive Tests with Computer Use

The **Integration Tester** uses the **Computer Use Agent** to actually interact with the web page:

```javascript
const agent = new ComputerUseAgent(resourceManager, {
  headless: false,  // Show browser so you can watch!
  startUrl: 'http://localhost:3001',
  outDir: './test-results'
});

await agent.initialize();

// Agent actually fills forms, clicks buttons, navigates pages!
const result = await agent.executeTask(`
  Test the login flow:
  1. Type email: TEST@EXAMPLE.COM (uppercase)
  2. Type password: test123
  3. Click Login button
  4. Report what happens
`);
```

**What happens**:
- ✅ Browser opens and navigates to the app
- ✅ Agent finds input fields and types
- ✅ Agent clicks the Login button
- ✅ Screenshots captured at each step
- ❌ **BUG DETECTED**: Login fails with "Invalid credentials"

### Step 4: Monitor Both Frontend and Backend

**Server logs captured in real-time**:
```
[SERVER] Login attempt for email: TEST@EXAMPLE.COM
[SERVER] ERROR: Invalid credentials
```

**Browser console** (captured by Computer Use Agent):
```javascript
consoleLogs: [
  { type: 'error', text: 'Login failed' }
]
```

**Network requests** (tracked by browser):
```javascript
{
  method: 'POST',
  url: 'http://localhost:3001/api/auth/login',
  status: 401,
  response: { error: 'Invalid credentials' }
}
```

### Step 5: Correlate Frontend + Backend Errors

The **Log Analyzer** correlates the errors:

```javascript
{
  timestamp: '2025-10-14T10:30:45.500Z',
  frontendError: 'Login failed',
  backendError: 'ERROR: Invalid credentials',
  apiCall: 'POST /api/auth/login (401)',
  rootCause: 'Backend email comparison is case-sensitive',
  affectedFile: 'server.js:41',
  assignTo: 'backend-debugger'
}
```

### Step 6: Delegate to Specialist Debuggers

The **UAT Orchestrator** routes the bug to the correct agent:

```javascript
// Bug is in backend → delegate to Backend Debugger
await Task({
  subagent_type: 'general-purpose',
  description: 'Fix backend login bug',
  prompt: `Use backend-debugger agent to fix:

    BUG: Case-sensitive email comparison
    File: server.js:41
    Current: users.find(u => u.email === req.body.email)
    Fix: Use case-insensitive comparison
  `
});
```

**Backend Debugger**:
1. Reads `server.js`
2. Finds the bug on line 41
3. Applies the fix
4. Writes integration test
5. Verifies fix works

### Step 7: Re-run Test to Verify Fix

```javascript
// Run the same test again
const result = await agent.executeTask(`
  Test login with uppercase email:
  1. Type: TEST@EXAMPLE.COM
  2. Type password: test123
  3. Click Login
  4. Verify you reach the dashboard
`);
```

**Result**: ✅ Login succeeds! User reaches dashboard.

---

## Real Example: Delete Todo Bug

This demonstrates a bug that requires **both frontend and backend investigation**:

### Initial Test

```javascript
await agent.executeTask(`
  1. Login to the app
  2. Count the todos
  3. Click Delete on the first todo
  4. Confirm deletion
  5. Refresh the page
  6. Count the todos again - did it really delete?
`);
```

### What the Agent Sees

**Before Delete**: 2 todos
- "Buy groceries"
- "Walk dog"

**After Delete**: 1 todo (appears deleted)
- "Walk dog"

**After Refresh**: 2 todos (reappeared!)
- "Buy groceries" ← It's back!
- "Walk dog"

### Correlation Analysis

**Server logs**:
```
DELETE /api/todos/1
Deleted todo: { id: 1, title: 'Buy groceries', completed: false }
```

**API response**: `200 OK` - claims success

**Browser network tab**: DELETE request succeeded

**Root cause**: Backend BUG! Uses `.slice()` instead of `.splice()`

```javascript
// server.js:117
todos.slice(index, 1);  // ❌ Returns new array, doesn't mutate!

// Should be:
todos.splice(index, 1);  // ✅ Mutates array in place
```

### Detection Flow

1. **Integration Tester**: "Delete appears to work but todo reappears"
2. **Log Analyzer**: "Server claims success, API returns 200"
3. **Backend Debugger**: Reads code, finds `.slice()` instead of `.splice()`
4. **Fix Applied**: Change to `.splice()`
5. **Integration Tester**: Re-runs test → ✅ Delete now works!

---

## Key Advantages of This Approach

### 1. **Real Browser Interaction** 🌐
- Computer Use Agent actually fills forms, clicks buttons
- Tests real user workflows, not just APIs
- Catches bugs that only happen in the browser

### 2. **Full-Stack Visibility** 👀
- Frontend: Browser console, DOM state, screenshots
- Backend: Server logs, API responses, database state
- Network: All HTTP requests/responses tracked

### 3. **Automatic Correlation** 🔗
- Links frontend errors to backend logs by timestamp
- Identifies if bug is frontend, backend, or integration
- Routes to correct specialist debugger

### 4. **Systematic Coverage** ✅
- UAT methodology ensures all workflows tested
- No manual clicking through forms repeatedly
- Reproducible tests that run automatically

### 5. **Visual Debugging** 📸
- Screenshots at every step
- Watch the browser in action (headless: false)
- See exactly what the user sees

---

## Demo Test Scenarios

### Scenario 1: Frontend Bug (BUG #8)
**Symptom**: Page reloads on login instead of staying on same page
**Root Cause**: Missing `e.preventDefault()` in form handler
**Detected**: Browser navigation instead of AJAX call
**Fixed by**: Frontend Debugger

### Scenario 2: Backend Bug (BUG #1)
**Symptom**: Login fails with uppercase email
**Root Cause**: Case-sensitive email comparison
**Detected**: API returns 401, server logs "Invalid credentials"
**Fixed by**: Backend Debugger

### Scenario 3: Backend Bug (BUG #5)
**Symptom**: Deleted todo reappears after refresh
**Root Cause**: Using `.slice()` instead of `.splice()`
**Detected**: API claims success but data persists
**Fixed by**: Backend Debugger

### Scenario 4: Integration Bug
**Symptom**: Todo added but UI doesn't update
**Root Cause**: API succeeds but frontend doesn't refresh state
**Detected**: Network shows 201, but DOM doesn't change
**Fixed by**: Frontend Debugger (add state update)

---

## Running the Demo

### Quick Test (3 scenarios):

```bash
# Terminal 1: Start server
cd __tests__/test-apps/buggy-todo-app
node server.js

# Terminal 2: Run E2E tests
cd /Users/williampearson/Legion/agents/full-stack
npm test __tests__/e2e-computer-use.test.js

# Watch the browser automation in action!
# Results saved to: __tests__/tmp/e2e-results/
```

### Full UAT Workflow:

```javascript
// 1. Generate UAT document
await Task({
  subagent_type: 'general-purpose',
  prompt: 'Use uat-writer agent to analyze buggy-todo-app'
});

// 2. Execute all tests with orchestrator
await Task({
  subagent_type: 'general-purpose',
  prompt: 'Use uat-orchestrator agent to execute all 14 test scenarios'
});

// Orchestrator will:
// - Run each test via Computer Use Agent
// - Detect bugs (frontend, backend, integration)
// - Route to specialist debuggers
// - Re-run tests after fixes
// - Generate final report with 100% pass rate
```

---

## Test Results Structure

After running tests, you get comprehensive reports:

```
__tests__/tmp/e2e-results/
├── scenario-1-report.json       # Login flow test
├── scenario-2-report.json       # Case-insensitive email
├── scenario-3-report.json       # Delete todo
├── test-summary.json            # Aggregated results
├── server-logs.json             # All backend logs
└── scenario-N/
    ├── initial-000.png          # Screenshots
    ├── step-001.png
    ├── final-002.png
    └── run.log                  # Agent execution log
```

**Each report includes**:
- Test steps executed
- Screenshots at key moments
- Server logs correlated by timestamp
- Browser console logs
- Network requests/responses
- Root cause analysis
- Suggested fix and file location
- Which debugger agent should handle it

---

## Architecture in Action

```
User: "Test the login flow"
  ↓
Integration Tester Agent
  ↓
Computer Use Agent
  ↓ (Interacts with browser)
Web App UI ←→ Backend API
  ↓              ↓
Browser         Server
Console         Logs
  ↓              ↓
Log Analyzer (correlates errors)
  ↓
Bug Report → Backend Debugger OR Frontend Debugger
  ↓
Fix Applied
  ↓
Integration Tester (re-runs test)
  ↓
✅ Test Passes!
```

---

## Why This Works for Interactive Apps

**Traditional approach**:
```javascript
// Just test API
const response = await fetch('/api/auth/login', {...});
expect(response.status).toBe(200);
// ❌ But does the UI actually update?
// ❌ Does the form submit correctly?
// ❌ Are there console errors?
```

**Our approach**:
```javascript
// Actually interact with the web page
await agent.executeTask('Fill login form and click submit');
// ✅ Tests real user interaction
// ✅ Monitors browser console
// ✅ Tracks network requests
// ✅ Captures screenshots
// ✅ Correlates with backend logs
```

---

## Next Steps

1. **Run the demo**:
   ```bash
   npm test __tests__/e2e-computer-use.test.js
   ```

2. **Watch the browser automation** (headless: false)

3. **Check the test reports** in `__tests__/tmp/e2e-results/`

4. **Try the full orchestrator workflow** with all 14 bugs

5. **Apply to your own app**:
   - Point UAT Writer at your app directory
   - Let it generate test scenarios
   - Run orchestrator to find all bugs
   - Watch agents systematically fix them

---

## Summary

✅ **Real browser automation** (not just API testing)
✅ **Full-stack visibility** (frontend + backend)
✅ **Automatic bug detection** (interactive testing)
✅ **Correlation** (frontend errors ↔ backend logs)
✅ **Systematic fixes** (specialist debugger agents)
✅ **Reproducible** (same tests run automatically)
✅ **Visual** (screenshots + logs)

**This is how you debug interactive full-stack web apps systematically!** 🚀
