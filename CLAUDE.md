# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Never use .sh files, we only use javasrcipt or jest to run things

## ResourceManager Usage (CRITICAL)

**THE ResourceManager is a singleton that MUST be used for ALL environment variables and configuration!**

### How to use ResourceManager:
```javascript
// ALWAYS get ResourceManager like this (it auto-initializes):
const resourceManager = await ResourceManager.getInstance();

// Get environment variables:
const apiKey = resourceManager.get('env.API_KEY');
const mongoUri = resourceManager.get('env.MONGO_URI');

// Get LLM client:
const llmClient = await resourceManager.get('llmClient');
```

### NEVER DO THIS:
```javascript
// ❌ NEVER use process.env directly
const apiKey = process.env.API_KEY;  // WRONG!

// ❌ NEVER create new ResourceManager instances
const rm = new ResourceManager();  // WRONG!

// ❌ NEVER use dotenv directly
require('dotenv').config();  // WRONG!
```

**ALL environment values MUST ALWAYS come from ResourceManager and NOWHERE ELSE!**
- ResourceManager automatically loads the .env file from the monorepo root
- It is a singleton - only ONE instance exists across the entire application
- It self-initializes on first access - no manual initialization needed

NO tests must ever skip, they must fail!

ALL resources are available, real llm, mon

ALL UI components must be MVVM and work with the actor framework only. 
HTML must be dynamically generated and have incremental 2 way mapping to the state for easy updating and event dispatch.
Whenever possible use and improve generic compoents.

When running webapp clients and servers prefere the MCP tool as that enables you to look at all logs and interact with the web page and really debug it.



## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

All packages as far as possible should be self configuring with defaults that just work.

Everything must all ways be done in a TDD way with all tests passing.

All tests must use Jest and work with npm test .... tests to run

For integration tests NO Mocks must be used unless unavoidable for particular situations if you are testing one part with live components. and the use of mocks must be fully commenteted.

No fallbacks in tests or skipping, just FAIL the test if resoruce are not there.

In implementation code THERE MUST NEVER be any mock implementations or fallbacks, just fail fast.

All tests must be under the __tests__ directories and all results and such should go under there as well, but they should be in directores and added to gitignore. 
if a test is producing files and such it is better to clean up before rather than after as then the results can be viewed

There must only ever be one .env file in the monorepo root and it must ONLY EVER be accessed through the ResourceManager singleton.
The ResourceManager should supply everything needed - NEVER access environment variables directly from process.env or dotenv! 

We are making an MVP we dont care about NFRs or future extensions we just need to get it working

Always keep package root directories as clean as possible! NEVER put scripts there. if scripts are temporary they must be put in a /tmp directory and cleaned up when finished with.


DO NOT recreate functionality, this is a monorepo whereeveer possible use existing packages. if it follows good design principles extend or enhance them as requried.


## Methedology
Always use TDD methodolgy but without the refactor phase, try and get it right first time.
All tests must be passing before moving on to next phase. 
Always follow uncle Bob's CLEAN architecture principles
Alwasy follow uncle Bob's CLEAN code principles

All json schemas mus be check using the Schema package only, THERE MUST be no use of zod outside of this package.


all temporary things that should not form part of the project like screenshots or script files or  debugging tests, or tool outputs MUST be put in /tmp or /scratch directories, these are in gitignore and will be cleaned up automatically


ONLY the schema package must be used for json validation! now zod 

NO fallbacks! FAIL FAST! raise an error

WHEN you make changes you MUST fix up any tests and run full REGRESSION

## Handle/Proxy Pattern (CRITICAL)

**Handles are the universal proxy pattern providing a consistent interface for any resource type.**

### Key Handle Concepts:
- **NEVER create Handles directly** - Only ResourceManagers or parent Handles create them via projection
- **Handles appear as local objects** but properly transact through ResourceManager hierarchy
- **All Handle types extend from `@legion/handle`** - The universal base class
- **Prototypes provide rich interfaces** - Dynamic properties based on resource schemas

### Handle Usage:
```javascript
// ❌ WRONG - Never create directly
const handle = new Handle(resourceManager);

// ✅ CORRECT - Created by ResourceManager or projection
const dataStore = resourceManager.createDataStore();
const entity = dataStore.entity(123);  // Projection from parent
entity.name = 'New Name';  // Appears local but routes through ResourceManager
```

### ResourceManager Interface for Handles:
All ResourceManagers MUST implement these synchronous methods:
- `query(querySpec)` - Execute queries (MUST be synchronous!)
- `subscribe(querySpec, callback)` - Setup subscriptions (MUST be synchronous!)
- `getSchema()` - Get resource schema for introspection

See `/docs/HANDLES.md` for complete architectural documentation.

## Testing
FOR tests there must be NO skipping and NO fallback under any circumstance, they must just FAIL in thoes circumstances.

unless you are speicifically testing their functionality Resource manager and tool registry singletons should be got onece at the beginning of the test suite with no timeout and then just reused.

NOTHING should be setting anything on resoruce mangeer! it provides values it does nothing else


ALWAYS run tests with nmp test ....selection to run


THERE is no problem getting real llm clients for testing!!!! always use them in integration tests when required.

ALL temporary scripts must go in tmp/ directories

ALL ways use the fullstack tool to debug a server front end and back end

when we make changes THERE MUST NEVER BE ANY CODE FOR BACKWARDS COMPATIBILIT! there must only ever be one way of doing anything, and we will fix everything to use it

We do not use APIs in legion, all communications to frontend is done with websockets

ALL TESTS MUST PASS. no execuses like timing, or that it doesnt matter. if the tests dont matter they should not be there!

NEVER Under any circumstances add mocks to implementation code, you do it all the time and it makes NO SENSE WHATSOEVER! there are no circumstances where it is justified.

THERE MUST be no fallbacks, FAIL FAST

NO INLINE CSS style under ANY circustances, use classes and css-variables

WE ALWAYS NEED 100% pass rate

NO BASH Scripts, theis javascript ES6 project! if you need scritps they must be written in javascript and go in the script directory and get called from package.json

LIVE TESTS MUST PASS, all the resoruces required are availble, if it didnt have to pass it would not be there!!!!

where apropriate you must use the proper workspace improts ALWAYS so "@legion/ .... not relative imports to outside your package!

ALL inter package imports should use "@legion/...  never relative imports outside a package.

Jest must always be configured for ES6 modules.

In general always run jest tests sequentially unless you absolutley know that they can run in parallel.

Only ever use Jest for tests. no node test runner, no plain js scripts used as tests.

If you do need to right js scripts for testing or debuging then always put them in a /tmp directory and remeber to clear them up

NEVER pollute package root directories or monorepo root! they must be kept as clean as possible! any scripts must go in scripts directory. and test artifacts should go under /tmp in __tests__

all tests go in __tests__ in the package root, not in src

NEVER skip tests under any circumstances, either the tests is not needed in which case it must be deleted or it must pass.

NEVER mock in integration tests unless it is for incidental things.

NEVER EVER HAVE FALLBACKS IN TESTS OR IMPLEMENTATION code, FAIL FAST!

WE NEVER WANT BACKWARDS COMPATABILITY, WE ALWAYS WNNT JUST ONE WAY OF DOING THINGS!

FIX TEST FAILURES ONE BY ONE.

IF you are having difficulty debugging a test, then write in depth debug scripts and tests in a /tmp direcotry and really drill into the problem with a detailed breakdown and step by step testing and logging.

when tests are timing out, check with console logs that they are rerally not just hanging or looping

if tests are taking a long time, try to simplify them, but make sure they have enough time to run in the configuration! we need to fix it so that nmp test always works!
