# Full-Stack Debugging Agent System

A suite of specialized Claude Code sub-agents for systematic full-stack application debugging using UAT (User Acceptance Testing) methodology.

## Overview

This agent system solves the problem of **context loss and methodical debugging** by breaking down the debugging workflow into specialized agents that maintain focus and work systematically through UAT test scenarios.

### The Problem

When debugging complex full-stack applications, Claude Code (in general-purpose mode):
- Loses context across long conversations
- Jumps between different issues without completing tasks
- Lacks systematic approach to finding and fixing bugs
- Doesn't maintain clear progress tracking

### The Solution

A **multi-agent orchestration system** where:
1. **UAT Writer** analyzes the application and creates comprehensive test documentation
2. **UAT Orchestrator** executes tests systematically and coordinates specialist agents
3. **Specialist Agents** (Backend, Frontend, Integration, Logs) focus on specific problem domains
4. All agents work through **structured test scenarios** with clear success criteria

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Claude Code                        │
│                   (User Interface Layer)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │      UAT Writer Agent        │
        │  (Analyzes app structure)    │
        │  Outputs: UAT-TEST-PLAN.md   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   UAT Orchestrator Agent     │
        │  (Executes test scenarios)   │
        │  (Manages todo list)         │
        └─────┬────────┬────────┬──────┘
              │        │        │
       ┌──────▼──┐  ┌──▼─────┐ ┌▼──────────┐
       │Backend  │  │Frontend│ │Integration│
       │Debugger │  │Debugger│ │Tester     │
       └────┬────┘  └───┬────┘ └─────┬─────┘
            │           │            │
            └───────────┴────────────┴──────┐
                                            │
                                 ┌──────────▼──────────┐
                                 │   Log Analyzer      │
                                 │ (Correlates errors) │
                                 └─────────────────────┘
```

## Agents

### 1. UAT Writer (`uat-writer.md`)

**Purpose**: Analyze application code and generate comprehensive UAT test documentation

**Inputs**:
- Application source code directory
- Package.json to identify tech stack

**Process**:
1. Discovers application structure (routes, components, APIs)
2. Identifies user flows and critical paths
3. Maps frontend-backend integration points
4. Documents prerequisites and expected results

**Outputs**:
- `docs/UAT-TEST-PLAN.md` - Structured test scenarios

**Tools**: Task, Read, Glob, Grep, Write

**When to use**: First step of any debugging workflow, or when application structure changes significantly

### 2. UAT Orchestrator (`uat-orchestrator.md`)

**Purpose**: Execute UAT test plan systematically, coordinate specialist agents, track progress

**Inputs**:
- `docs/UAT-TEST-PLAN.md` from UAT Writer
- Running application (via node-runner)

**Process**:
1. Reads test scenarios from UAT document
2. Creates master todo list of all tests
3. Executes each test via Integration Tester
4. Routes failures to appropriate specialist agents
5. Re-runs tests after fixes
6. Aggregates results and generates report

**Outputs**:
- `docs/UAT-TEST-EXECUTION-REPORT.md` - Comprehensive test results
- Real-time todo list updates showing progress

**Tools**: Task, Read, Write, TodoWrite

**When to use**: After UAT document is created, to systematically fix all bugs

### 3. Backend Debugger (`backend-debugger.md`)

**Purpose**: Fix server-side bugs (API errors, database issues, authentication failures)

**Inputs**:
- Test scenario that failed
- API endpoint involved
- Server logs showing error
- Request/response details

**Process**:
1. Locates route handlers and dependencies
2. Analyzes error flow through middleware chain
3. Identifies root cause (SQL errors, null access, validation failures, etc.)
4. Applies fix with proper error handling
5. Writes integration test to verify fix

**Outputs**:
- Fixed backend code
- Integration test verifying fix
- Structured result report

**Tools**: Task, Read, Glob, Grep, Edit, Write, Bash

**When to use**: Backend API returning errors, server crashes, database issues

### 4. Frontend Debugger (`frontend-debugger.md`)

**Purpose**: Fix client-side bugs (UI not updating, event handlers broken, React errors)

**Inputs**:
- Test scenario that failed
- Component or page involved
- Browser console logs
- Expected vs actual UI behavior

**Process**:
1. Locates React components and dependencies
2. Analyzes data flow (props, state, API calls)
3. Identifies root cause (null access, lifecycle issues, event binding)
4. Applies fix with proper null checks and error handling
5. Writes component test to verify fix

**Outputs**:
- Fixed frontend code
- Component test verifying fix
- Structured result report

**Tools**: Task, Read, Glob, Grep, Edit, Write, Bash

**When to use**: UI not rendering correctly, event handlers not firing, console errors

### 5. Integration Tester (`integration-tester.md`)

**Purpose**: Execute UAT test steps via browser automation, verify end-to-end workflows

**Inputs**:
- Test scenario with step-by-step instructions
- Running application server

**Process**:
1. Uses Computer Use Agent or Playwright for browser automation
2. Executes each test step (navigate, fill forms, click buttons)
3. Captures screenshots at key steps
4. Monitors API calls and browser console
5. Verifies expected results vs actual results

**Outputs**:
- Structured test result (passed/failed)
- Screenshots of each step
- API calls made during test
- Browser console logs
- Detailed failure information if test failed

**Tools**: Task, Read, Write, Bash (calls Computer Use Agent)

**When to use**: Executing UAT test scenarios, verifying fixes work end-to-end

### 6. Log Analyzer (`log-analyzer.md`)

**Purpose**: Search logs, correlate frontend/backend errors, identify patterns

**Inputs**:
- Search query (keyword, regex)
- Log source (stdout, stderr, frontend console)
- Time range (optional)

**Process**:
1. Searches logs using Grep or node-runner SearchLogsTool
2. Parses log entries (timestamp, level, message)
3. Categorizes errors by type and severity
4. Correlates frontend and backend logs by timestamp
5. Identifies recurring patterns and performance issues

**Outputs**:
- Structured analysis report
- Error categorization
- Root cause suggestions
- Recommendation for which debugger agent to use

**Tools**: Task, Read, Grep, Write

**When to use**: Investigating errors, correlating frontend/backend issues, finding patterns

## Workflow

### Complete Debugging Workflow

```bash
# Step 1: Generate UAT Test Plan
Use uat-writer agent on /path/to/app
→ Creates docs/UAT-TEST-PLAN.md

# Step 2: Execute Tests and Fix Bugs
Use uat-orchestrator agent with UAT document
→ Executes all test scenarios
→ Delegates to specialist agents for failures
→ Re-runs tests after fixes
→ Creates docs/UAT-TEST-EXECUTION-REPORT.md

# Step 3: Verify All Tests Pass
Check UAT execution report
→ Pass rate should be 100%
→ All bugs documented and fixed
```

### Example Usage

```javascript
// From main Claude Code instance

// Step 1: Generate UAT document
await Task({
  subagent_type: 'general-purpose',
  description: 'Analyze application for UAT',
  prompt: `Use the uat-writer agent to analyze the application at /path/to/app and create a comprehensive UAT test document.

  The application is a full-stack Node.js + React app. Analyze all routes, components, and API endpoints. Create detailed test scenarios with step-by-step instructions.

  Output the UAT document to docs/UAT-TEST-PLAN.md`
});

// Step 2: Execute UAT test plan
await Task({
  subagent_type: 'general-purpose',
  description: 'Execute UAT testing workflow',
  prompt: `Use the uat-orchestrator agent to execute the complete UAT test plan at docs/UAT-TEST-PLAN.md.

  Application: /path/to/app
  Server running on: http://localhost:3000

  Execute ALL test scenarios systematically. For any failures, delegate to specialist agents to debug and fix. Re-run tests after fixes.

  Generate comprehensive test report showing all results.`
});
```

## Test Application

A sample buggy application is included for testing the agent system:

**Location**: `__tests__/test-apps/buggy-todo-app/`

**Description**: Express + Vanilla JS todo app with 14 intentional bugs (7 backend, 7 frontend)

**Bugs Include**:
- Case-sensitive email comparison
- Missing error handling
- Form validation issues
- State update bugs
- API integration errors

**See**: `__tests__/test-apps/buggy-todo-app/README.md` for full bug list and expected test scenarios

## Integration with Node-Runner

The agents integrate with the `@legion/node-runner` package for:
- Starting/stopping test servers
- Monitoring server logs in real-time
- Searching logs with SearchLogsTool
- Capturing frontend console output

**Prerequisites**:
- Node-runner session running for application
- Logs being captured to stdout/stderr
- Server accessible on localhost

## Testing the Agents

```bash
# Run agent integration tests
npm test agents/full-stack/__tests__/agent-integration.test.js

# Tests verify:
# - All agent definitions exist and have correct structure
# - Test application is runnable
# - Agents have consistent YAML frontmatter
# - (Full execution tests are marked as .skip for MVP)
```

## Agent Design Principles

1. **Single Responsibility**: Each agent focuses on one domain (backend, frontend, logs, etc.)

2. **Context Preservation**: Agents maintain focus on their specific task without context loss

3. **Systematic Approach**: UAT methodology ensures all scenarios are tested, not just known bugs

4. **Clear Communication**: Structured input/output formats for agent coordination

5. **Progress Tracking**: TodoWrite tool maintains visible progress through entire workflow

6. **No Guessing**: Agents read actual code, search real logs, don't make assumptions

7. **Fail Fast**: No mocks in integration tests, no fallbacks, real errors surface immediately

8. **Verification**: All fixes verified with integration tests before marking complete

## File Structure

```
agents/full-stack/
├── README.md                           # This file
├── uat-writer.md                       # UAT document generator
├── uat-orchestrator.md                 # Test execution coordinator
├── backend-debugger.md                 # Backend bug fixer
├── frontend-debugger.md                # Frontend bug fixer
├── integration-tester.md               # Browser automation executor
├── log-analyzer.md                     # Log search and correlation
└── __tests__/
    ├── agent-integration.test.js       # Agent system tests
    └── test-apps/
        └── buggy-todo-app/             # Sample app with bugs
            ├── README.md               # Bug documentation
            ├── package.json
            ├── server.js               # Backend (7 bugs)
            └── public/
                ├── index.html
                ├── app.js              # Frontend (7 bugs)
                └── styles.css
```

## Benefits

### For Users
- **Systematic**: All bugs found and fixed, not just obvious ones
- **Traceable**: Clear documentation of what was tested and fixed
- **Reliable**: Every fix verified with integration test
- **Educational**: UAT document becomes living documentation

### For Development
- **Maintainable**: Changes to app structure → re-run UAT Writer → updated tests
- **Scalable**: Add more specialist agents as needed (Performance, Security, etc.)
- **Testable**: Agent definitions are markdown files, easy to version and review
- **Debuggable**: Each agent's work is documented and traceable

## Future Enhancements

- **Performance Analyzer Agent**: Identify slow queries, N+1 problems, render bottlenecks
- **Security Auditor Agent**: Check for common vulnerabilities (XSS, CSRF, injection)
- **Database Debugger Agent**: Specialized in MongoDB/SQL query optimization
- **API Contract Validator Agent**: Verify OpenAPI/Swagger compliance
- **Accessibility Checker Agent**: Ensure WCAG compliance

## Notes

- Agents are **stateless** - All state is in UAT document and todo list
- Agents **don't guess** - They read actual code and logs
- Agents **verify fixes** - Every fix gets an integration test
- Agents **fail fast** - No mocks, fallbacks, or workarounds
- Agents **maintain context** - Focused on specific domain, don't get distracted

## License

Part of the Legion monorepo - see root LICENSE file
