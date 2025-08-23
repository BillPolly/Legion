# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Never use .sh files, we only use javasrcipt or jest to run things


## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

ALWAYS use the resoruce manager singleton for any access to environment variables!

All pakcages as far as possible should be self configureing with defaults that just work.

Everything must all ways be done in a TDD way with all tests passing.

All tests must use Jest and work with npm test .... tests to run

For integration tests NO Mocks must be used unless unavoidable for particular situations if you are testing one part with live components. and the use of mocks must be fully commenteted.

No fallbacks in tests or skipping, just FAIL the test if resoruce are not there.

In implementation code THERE MUST NEVER be any mock implementations or fallbacks, just fail fast.

All tests must be under the __tests__ directories and all results and such should go under there as well, but they should be in directores and added to gitignore. 
if a test is producing files and such it is better to clean up before rather than after as then the results can be viewed

There must only every be one .env in the monorepo and it must only ever be accessed by the ResourceManager singleton
The resouorce manager should supply anything needed, nothing should be set on it or registered with it. 

We are making an MVP we dont care about NFRs or future extensions we just need to get it working

Always keep package root directories as clean as possible! NEVER put scripts there. if scripts are temporary they must be put in a /tmp directory and cleaned up when finished with.


DO NOT recreate functionality, this is a monorepo whereeveer possible use existing packages. if it follows good design principles extend or enhance them as requried.


## Methedology
Always use TDD methodolgy but without the refactor phase, try and get it right first time.
All tests must be passing before moving on to next phase. 
Always follow uncle Bob's CLEAN architecture principles
Alwasy follow uncle Bob's CLEAN code principles