# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Legion is a modular framework for building AI agent tools with consistent interfaces. It's organized as a monorepo using npm workspaces with packages for core infrastructure, AI/LLM services, tool collections, and applications.

ALWAYS use the resoruce manager singleton for any access to environment variables!

All pakcages as far as possible should be self configureing with defaults that just work.

Everything must all ways be done in a TDD way with all tests passing.

All tests must use Jest and work with npm test .... tests to run

For integration tests NO Mocks must be used unless unavoidable for particular situations if you are testing one part with live components. and the use of mocks must be fully commenteted.

No fallbacks in tests or skipping, just FAIL the test if resoruce are not there.

In implementation code THERE MUST NEVER be any mock implementations or fallbacks, just fail fast.

