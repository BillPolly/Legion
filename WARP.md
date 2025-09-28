# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Monorepo overview
- Package manager: npm workspaces (root package.json defines workspaces under packages/* and subtrees)
- Language/runtime: Node.js, ES modules ("type": "module")
- Tests: Jest per-package
- Lint: ESLint

Common commands
- One-time setup
  - npm install

- Build
  - Build all workspaces: npm run build
  - Build a single workspace: npm run build --workspace=@legion/<package>

- Lint
  - Lint JS sources: npm run lint

- Test
  - Run all tests across workspaces: npm test
  - Run tests for a single workspace: npm run test --workspace=@legion/<package>
  - Run a single test file in a workspace: npm run test --workspace=@legion/<package> -- path/to/test.spec.[jt]s
  - Run tests matching a name/pattern: npm run test --workspace=@legion/<package> -- -t "<pattern>"
  - Watch mode (if the workspace defines it): npm run test:watch --workspace=@legion/<package>
    - Otherwise: npm run test --workspace=@legion/<package> -- --watch
  - Coverage across all workspaces: npm run test:coverage
  - Coverage per workspace: npm run test --workspace=@legion/<package> -- --coverage

- Developer utilities and demos
  - Interactive CLI: npm run cli
  - Start the generic dev server (port 3000): npm run server:start
  - Kill the generic dev server port: npm run server:kill (or npm run server:force-kill)
  - Storage Browser demo (recommended starting point)
    - Start both server and browser: npm run storage:demo
    - Start only the storage server (port 3700): npm run storage:server
    - Start only the browser UI: npm run storage:browser
    - Integration test for storage demo: npm run storage:test
    - Stop the storage server: npm run storage:kill
  - MCP helpers
    - Run MCP: npm run mcp
    - Generate MCP config: npm run mcp:config

Workspace selection
- Replace @legion/<package> with a workspace name, e.g. @legion/tools-registry, @legion/triplestore, @legion/node-runner, etc.
- To list all declared workspaces, inspect the workspaces field in package.json and the package.json names under packages/.

High-level architecture (big picture)
- Dependency and configuration via ResourceManager (CRITICAL)
  - There is exactly one ResourceManager singleton for the entire process.
  - All environment/config access MUST flow through it. Do not read process.env directly and do not use dotenv.
  - The ResourceManager auto-loads the single .env at the monorepo root and lazily initializes services.
  - Usage example:
    - const rm = await ResourceManager.getInstance();
    - const apiKey = rm.get('env.API_KEY');
    - const llmClient = await rm.get('llmClient');

- Handle/Proxy pattern for resources
  - Handles provide a consistent proxy-style interface to resources through the ResourceManager.
  - Handles are not constructed directly; they are created by the ResourceManager or projected from parent handles.
  - ResourceManager implementors must expose synchronous query(), subscribe(), and getSchema() to support handles.

- Agents, Modules, and Tools
  - Tools are small, focused capabilities (OpenAI function style schemas) packaged into Modules.
  - Modules group related tools and handle event emission.
  - Agents orchestrate module execution, retries, and LLM interactions; they also aggregate and stream events.

- Event system and transport
  - Rich, structured event types (progress, info, warning, error) are emitted from tools/modules and aggregated by agents.
  - Event streaming to clients is designed around WebSockets. Frontends interact via actor-based protocols over WS (no REST fallback).

- Frontend/UI guidelines
  - UI components follow MVVM and interact with backends through the actor framework over WebSockets.
  - Prefer generic, reusable components with incremental state mapping and event dispatch.

- Package boundaries and imports
  - This is a strict workspaces monorepo; do not import across packages via relative paths. Use workspace-scoped imports like @legion/<package>.

Testing principles (from project rules)
- Jest is the only test runner and must be ES module aware.
- Tests live under __tests__ directories at the package root (not in src).
- Favor sequential tests unless you are certain concurrency is safe.
- Integration tests should avoid mocks whenever possible; fail fast rather than falling back.
- No skipping tests; failures should be explicit.

Important references
- Root README.md contains quick-starts (notably the Storage Browser demo) and architectural context.
- CLAUDE.md documents strict development rules used in this repo. Key items incorporated above include:
  - ResourceManager as the sole source for env/config (singleton, auto-initialized)
  - Handle/Proxy pattern contract and usage
  - Test placement, no mocks in integration tests, no skipped tests, fail fast
  - ES modules everywhere; no shell scripts (developer scripts are JS under scripts/)

Notes for environment and secrets
- There must be exactly one .env at the monorepo root; the ResourceManager will load it automatically.
- Do not access secrets via process.env; obtain them from ResourceManager (e.g., rm.get('env.MY_SECRET')).
