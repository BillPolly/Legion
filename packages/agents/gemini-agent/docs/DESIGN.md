# Gemini-Compatible Agent Design Document

## Executive Summary

The Gemini-Compatible Agent is a simplified MVP that provides conversational AI with tool execution capabilities, built entirely with Legion framework patterns. This agent enables natural language interaction with file operations, shell commands, and code assistance through a clean web interface.

## Architecture

### Core Components

**ConversationManager**
- Handles user input processing with real LLM integration
- Manages conversation history and context
- Supports tool calling through Legion's tool registry
- Input validation with fail-fast error handling

**Actor Framework**
- GeminiRootServerActor: Backend coordination
- GeminiRootClientActor: Frontend interface
- WebSocket-based real-time communication
- Clean separation of client/server concerns

**Tool Integration**
- Uses @legion/gemini-tools for file operations
- Real tool execution (read_file, write_file, shell_command, etc.)
- Proper ResourceManager integration throughout

## Key Features

### Conversational AI
- Natural language processing for coding questions
- Real-time response streaming with tool execution
- Context-aware conversation management

### Tool Execution
- File operations (read, write, edit, search)
- Shell command execution with security controls
- Real-time tool result integration into conversation

### Web Interface
- Clean chat interface with real-time updates
- Tool execution visualization
- Actor framework communication

## Technology Stack

- **Backend**: Node.js with Legion framework patterns
- **Agent Core**: Extends Legion's ConfigurableAgent
- **LLM**: Real Anthropic API integration through ResourceManager
- **Tools**: Legion's native tool registry
- **Frontend**: Actor-based WebSocket communication
- **Testing**: Jest with 100% pass rate using real LLM integration

## Configuration

All configuration through Legion's ResourceManager singleton:
- LLM API credentials
- Working directory and environment variables
- Tool permissions and security settings

## Success Criteria

✅ **Achieved:**
- Natural language conversations with real LLM
- Tool calling with actual file operations
- 100% test pass rate (155/155 tests)
- Real LLM integration in all integration tests
- Clean Legion architecture patterns
- Actor framework for frontend-backend communication

The agent provides a working Gemini-CLI compatible experience while following Legion's clean architecture principles and CLAUDE.md requirements.