# jsEnvoy Tools Testing Plan

This document outlines the comprehensive testing strategy for all tools in the @jsenvoy/tools package. Each tool will have both unit tests (isolated, mocked) and integration tests (live API calls using credentials from root .env).

## Phase 1: Setup and Infrastructure ⚙️

- [ ] Create `__tests__` directory structure
- [ ] Set up test utilities and helpers  
- [ ] Configure test environment with .env loading
- [ ] Create mock utilities for external dependencies

## Phase 2: Unit Tests (Isolated Testing) 🧪

### Core Tools
- [ ] **Calculator Tool** - Test mathematical operations, error handling
- [ ] **File Tool** - Test file operations with mocked filesystem
- [ ] **Command Executor** - Test command execution with mocked child_process

### Web & API Tools  
- [ ] **Serper Tool** - Test with mocked HTTP requests
- [ ] **GitHub Tool** - Test with mocked GitHub API calls
- [ ] **Crawler Tool** - Test with mocked web requests
- [ ] **Page Screenshoter** - Test with mocked Puppeteer
- [ ] **Webpage-to-Markdown** - Test with mocked web content
- [ ] **YouTube Transcript** - Test with mocked YouTube API

### Server Tools
- [ ] **Server Starter** - Test server lifecycle with mocked processes

## Phase 3: Integration Tests (Live API Testing) 🌐

### API Integration Tests
- [ ] **Serper Integration** - Live Google search API calls
- [ ] **GitHub Integration** - Live GitHub API calls using PAT
- [ ] **YouTube Integration** - Live YouTube transcript fetching
- [ ] **Page Screenshot Integration** - Live webpage screenshots
- [ ] **Webpage-to-Markdown Integration** - Live webpage conversion

### Local Integration Tests  
- [ ] **File Tool Integration** - Real filesystem operations
- [ ] **Command Executor Integration** - Real command execution
- [ ] **Server Starter Integration** - Real server startup/shutdown

## Phase 4: Validation and Coverage 📊

- [ ] Run all unit tests and ensure 100% pass rate
- [ ] Run all integration tests and ensure 100% pass rate  
- [ ] Generate test coverage report (target: >90%)
- [ ] Validate ResourceManager .env loading works in tests
- [ ] Performance benchmarking for critical tools

## Test Structure

```
packages/tools/__tests__/
├── unit/
│   ├── calculator.test.js
│   ├── file.test.js
│   ├── command-executor.test.js
│   ├── server-starter.test.js
│   ├── serper.test.js
│   ├── github.test.js
│   ├── crawler.test.js
│   ├── page-screenshoter.test.js
│   ├── webpage-to-markdown.test.js
│   └── youtube-transcript.test.js
├── integration/
│   ├── serper-live.test.js
│   ├── github-live.test.js
│   ├── youtube-live.test.js
│   ├── page-screenshot-live.test.js
│   ├── webpage-markdown-live.test.js
│   ├── file-operations.test.js
│   ├── command-execution.test.js
│   └── server-lifecycle.test.js
├── utils/
│   ├── test-helpers.js
│   ├── mock-factories.js
│   └── env-setup.js
└── setup.js
```

## Environment Variables Required

The following environment variables must be present in the root `.env` file for integration tests:

- `ANTHROPIC_API_KEY` - For LLM calls
- `OPENAI_API_KEY` - For LLM calls  
- `SERPER` - For Google search API
- `GITHUB_PAT` - For GitHub API operations

## Test Execution Commands

```bash
# Run all tests
npm test

# Run only unit tests
npm test -- --testPathPattern=unit

# Run only integration tests  
npm test -- --testPathPattern=integration

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Success Criteria

- ✅ All unit tests pass with proper mocking
- ✅ All integration tests pass with live APIs
- ✅ Test coverage > 90%
- ✅ All error scenarios tested
- ✅ Performance benchmarks meet targets
- ✅ No flaky tests
- ✅ Clear test documentation

---

## Progress Tracking

**Phase 1 Progress:** 0/4 ⬜⬜⬜⬜
**Phase 2 Progress:** 0/10 ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜  
**Phase 3 Progress:** 0/8 ⬜⬜⬜⬜⬜⬜⬜⬜
**Phase 4 Progress:** 0/4 ⬜⬜⬜⬜

**Overall Progress:** 0/26 (0%)