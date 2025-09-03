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