# Multi-Agent Research System

LangChain/LangGraph multi-agent system for automated web research with verified sources.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Run the system
python main.py "Latest developments in AI agents"

# 4. View dashboard
# Open dashboard.html in browser to see real-time progress
```

## Architecture

See [DESIGN.md](DESIGN.md) for complete architecture documentation.

### Agents:
1. **Supervisor** - Routes tasks and maintains conversation memory
2. **Query Planner** - Formulates effective search queries using LLM
3. **Web Search** - Executes searches via Serper API
4. **Link Checker** - Verifies URL accessibility
5. **Analyst** - Generates final research report

### Key Features:
- ✅ LangChain MessagesState for conversation memory
- ✅ Structured output with Pydantic models
- ✅ Automatic retries with exponential backoff
- ✅ LangSmith observability
- ✅ Real-time dashboard updates via WebSocket
- ✅ VSCode flashcard integration

## Testing

```bash
# Unit tests
pytest tests/unit/

# Integration tests
pytest tests/integration/

# E2E tests (requires API keys)
pytest tests/e2e/

# All tests
pytest
```

## Project Status

Implementation in progress - following LangChain best practices from DESIGN.md.

Current completion:
- [x] Design document
- [x] State schemas with Pydantic
- [x] Query Planner agent
- [ ] Remaining agents (in progress)
- [ ] LangGraph workflow
- [ ] Full test suite
