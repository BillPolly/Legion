# ROMA Agent Design

## Purpose
ROMA (Recursive Open Meta-Agent) coordinates hierarchical task execution on top of the Legion runtime. The package exposes a single programmable agent (`ROMAAgent`) that can accept atomic actions or nested plans, expand them when additional structure is needed, run the resulting work graph through Legion tools, and stream progress and results to callers and user interfaces.

## High-Level Workflow
1. **Initialization** – `ROMAAgent` acquires the shared `ResourceManager` and `ToolRegistry` singletons so every run uses the same environment (`src/ROMAAgent.js`). During initialization the agent wires the strategy resolver, dependency resolver, and error subsystems with those dependencies.
2. **Request setup** – Each execution call creates an immutable `ExecutionContext` that tracks depth, breadcrumbs, shared state, prior results, and deadlines (`src/core/ExecutionContext.js`).
3. **Task routing** – Simple tasks are dispatched directly to an execution strategy. Composite submissions are normalized, passed through the `DependencyResolver` to construct a directed acyclic graph, and scheduled by the `TaskQueue` respecting dependency order and optional parallel groups (`src/ROMAAgent.js`, `src/core/DependencyResolver.js`).
4. **Strategy selection** – `ExecutionStrategyResolver` evaluates the task against registered strategies (recursive, parallel, sequential, atomic). It consults the `TaskAnalyzer` heuristics and honours manual overrides or the `atomic` flag before falling back to the atomic strategy (`src/core/strategies/ExecutionStrategyResolver.js`).
5. **Execution** – Strategies run the task using Legion tooling. They emit structured progress events through `TaskProgressStream`, append audit entries to `TaskExecutionLog`, and hand results back to the agent.
6. **Result aggregation** – `ROMAAgent` aggregates task results, updates execution statistics/history, and returns a success/error payload. Failures are processed through `ErrorHandler` and `ErrorRecovery` to decide whether retries or remediation steps are possible.

## Core Modules

### ROMAAgent (`src/ROMAAgent.js`)
- Extends `EventEmitter` and owns lifecycle, dependency wiring, statistics, and active execution tracking.
- Exposes `execute(task, options)`, optional `onProgress` callback, `getStatistics()`, `getExecutionHistory()`, `getActiveExecutions()`, and `shutdown()`.
- Creates the per-run infrastructure: `ExecutionContext`, `TaskQueue`, `TaskProgressStream`, and `TaskExecutionLog`.
- Handles composite vs atomic tasks, manages dependency resolution, and supervises TaskQueue execution to ensure dependencies complete before downstream tasks run.
- Records structured progress (`handleProgressEvent`) and aggregates task outcomes (`aggregateExecutionResults`).

### ExecutionContext (`src/core/ExecutionContext.js`)
- Immutable object capturing depth, session identifiers, breadcrumbs, shared state, prior results, and deadlines.
- Supports cloning helpers (`withResult`, `withSharedState`, `withMetadata`, `createChild`, `createSibling`) so nested tasks inherit state without mutation.
- Produces summaries and serialized representations for logging, diagnostics, and persistence.

### DependencyResolver (`src/core/DependencyResolver.js`)
- Builds a dependency graph from arrays or task containers (`tasks`, `subtasks`, `operations`).
- Detects malformed entries, optional circular dependencies, and generates a topological execution order with optional parallel groups.
- Calculates scheduling metadata (critical path, estimated time, resource hints) and returns consistent failure objects when resolution fails.
- Uses the Legion `SimplePromptClient` (via `@legion/llm-client`) on demand for more advanced dependency analysis.

### TaskQueue (`src/core/TaskQueue.js`)
- Priority-aware concurrency controller with retry/back-off support and timeout handling.
- Emits lifecycle events (`queued`, `started`, `completed`, `retrying`, `failed`) that feed into the agent statistics and progress stream.
- Ensures the queue drains gracefully and supports pause/resume if future features require it.

### TaskProgressStream (`src/core/TaskProgressStream.js`)
- Observable bus for progress events with history replay, wildcard or prefix subscriptions, and automatic pruning.
- Supplies scoped emitters so strategies can publish consistent status changes (started, evaluating, decomposing, executing, completed, failed, etc.).

### TaskExecutionLog (`src/core/TaskExecutionLog.js`)
- Event-sourced log tracking every state transition for each task.
- Provides projections for individual tasks, snapshotting for performance, and subscriber notifications for observability tooling.

### ExecutionStrategyResolver & Strategies
- **ExecutionStrategyResolver** registers available strategies with priorities, validates them, and selects the best match. It supports manual overrides (`task.strategy`), the `atomic` hint, and falls back to atomic execution if nothing else applies.
- **AtomicExecutionStrategy (`src/core/strategies/AtomicExecutionStrategy.js`)** – Direct execution path for simple tasks. It validates tool calls with `ResponseValidator` (`@legion/output-schema`), uses `RetryHandler` (`@legion/prompting-manager`) and `RetryManager` for fault tolerance, and delegates to Legion tools or LLM prompts.
- **SequentialExecutionStrategy** – Runs groups of tasks in a defined order, preserving dependency outputs and emitting progress between steps.
- **ParallelExecutionStrategy** – Executes tasks concurrently up to configured limits (default `MAX_PARALLEL_CONCURRENCY`) while aggregating shared state safely.
- **RecursiveExecutionStrategy** – Applies heuristics (complexity, dependencies, text size, explicit `decompose` flags) to decide when to break a task down. It leverages `SimplePromptClient` to request structured decompositions from an LLM, caches results when enabled, and recursively invokes the agent for each subtask.

### TaskAnalyzer (`src/analysis/TaskAnalyzer.js`)
- Provides heuristic analysis for tasks (structural complexity, dependency count, resource implications, parallelism potential).
- Recommends execution strategies with confidence scores and alternatives to guide `ExecutionStrategyResolver`.
- Learns basic performance metrics over time to improve recommendations.

### Error Handling (`src/errors`)
- `ErrorHandler` and `ErrorRecovery` coordinate retry logic, severity classification, and optional recovery actions around task strategies.
- Custom error hierarchy (`ROMAErrors.js`) distinguishes validation, execution, timeout, dependency, and strategy failures so callers receive actionable responses.

## Task Model
- A task may be a single object or an array of task objects. IDs (`id` or `taskId`) are required; the agent will generate one if absent.
- Atomic tasks typically specify `tool`/`toolName` plus `params`, or `prompt`/`description` for LLM execution. Custom functions can be supplied via `fn`/`execute`.
- Composite submissions can provide `subtasks`, `tasks`, `operations`, `sequence`, or an array. Optional `dependencies` arrays express edges between tasks.
- Additional hints: `strategy`, `atomic`, `parallel`, `sequential`, `decompose`, `recursive`, priority, timeouts, and metadata fields. The agent preserves arbitrary metadata through contexts and logs.
- Callers can supply `onProgress` to receive live progress events and `userContext` to propagate end-user information into child contexts.

## Observability & Telemetry
- Progress events flow through `TaskProgressStream`, the EventEmitter interface (`agent.on('progress')`), and optional callbacks provided to `execute`.
- `TaskExecutionLog` captures every state mutation for auditing and debugging.
- `ROMAAgent` maintains execution statistics (counts, success rate, average duration) and an execution history list that powers dashboards or monitoring (`getStatistics`, `getExecutionHistory`).

## Server & Actor Integration
- **ROMAServerActor (`src/actors/server/ROMAServerActor.js`)** wraps `ROMAAgent` inside Legion's actor protocol. It forwards progress updates to a connected client actor and exposes commands for execution, status, statistics, history, and cancellation hooks.
- **ROMAClientActor (`src/actors/client/ROMAClientActor.js`)** extends the shared `ProtocolActor` used by Legion UIs. It builds the browser interface, keeps client-side state (connection, readiness, statistics, executions), and relays user commands to the server actor.
- **Web server (`src/server.js`)** hosts the front-end shell over Express, upgrades WebSocket connections with `ws`, and instantiates `ROMAServerActor` once the `ResourceManager` singleton is available.

## External Dependencies
- `@legion/resource-manager` – global configuration, environment values, and runtime singletons (LLM client, tool registry, handles).
- `@legion/tools-registry` – discovery and invocation of Legion tool implementations.
- `@legion/llm-client` – provides `SimplePromptClient` for LLM interactions used by strategies and the dependency resolver.
- `@legion/output-schema` – JSON schema validation for structured LLM/tool responses.
- `@legion/prompting-manager` – retry orchestration around prompt execution.
- `express` + `ws` – lightweight web server and WebSocket transport for the UI actor.

## Testing
- **Unit tests (`__tests__/unit`)** exercise core utilities: execution context immutability, dependency resolution edge cases, logging, progress tracking, retry logic, and actor protocol helpers.
- **Integration tests (`__tests__/integration`)** instantiate `ROMAAgent` with the real Legion singletons, execute calculator-tool scenarios, verify dependency-aware execution orders, assess progress emissions, and confirm statistics/history updates.
- **System smoke tests** target the actor/front-end integration to ensure WebSocket message flows remain stable.
- Tests are run with Jest configured for ES modules (`jest.config.js`) and rely on `NODE_OPTIONS='--experimental-vm-modules'` per package scripts.

## Known Limitations & Follow-Ups
- The MECE THINK/WRITE/SEARCH phases described in earlier drafts are not implemented; strategy choice is currently heuristic-driven and tool-oriented.
- UI HTML is inlined inside `server.js` for the MVP; migrating to reusable MVVM components will simplify maintenance.
- End-to-end coverage for full system workflows is planned but not yet located in `__tests__/e2e`.
- Additional concrete strategy types (domain-specific planners, data pipelines, etc.) can be registered via `ExecutionStrategyResolver.registerStrategy` as the system evolves.

This document reflects the current implementation so new contributors can map features directly back to the source modules and tests listed above.
