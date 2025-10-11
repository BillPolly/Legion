# Legion Framework - Complete Setup Guide

This guide provides step-by-step instructions for setting up the Legion framework on a new machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Docker Services Setup](#docker-services-setup)
4. [Environment Configuration](#environment-configuration)
5. [Embedding Models](#embedding-models)
6. [Verification & Testing](#verification--testing)
7. [Troubleshooting](#troubleshooting)
8. [Architecture Overview](#architecture-overview)

---

## Prerequisites

### Required Software

- **Node.js** v18+ (v20+ recommended)
- **npm** v9+ (v10+ recommended for workspace support)
- **Docker Desktop** (for MongoDB, Qdrant, Neo4j)
- **Git**

### Installation Commands

```bash
# macOS
brew install node
brew install --cask docker

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install docker.io docker-compose

# Verify installations
node --version    # Should be v18+
npm --version     # Should be v9+
docker --version  # Should be installed
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/maxximus-dev/Legion.git
cd Legion
```

### 2. Install Dependencies

```bash
# Update npm to latest version (important for workspaces)
npm install -g npm@latest

# Install all workspace dependencies
npm install
```

### 3. Start Docker Services

```bash
# Start required services (MongoDB + Qdrant)
npm run docker:setup

# OR manually with docker-compose
docker-compose up -d mongodb qdrant

# Verify services are running
docker ps | grep legion
curl http://localhost:6333/collections  # Qdrant health check
```

### 4. Configure Environment

```bash
# Copy example .env or create new one
cat > .env << 'EOF'
# Monorepo Root (required by ResourceManager)
MONOREPO_ROOT=/path/to/your/Legion

# Docker Services
QDRANT_URL=http://localhost:6333
MONGODB_URL=mongodb://localhost:27017
NEO4J_URI=bolt://localhost:7687

# LLM Provider Configuration
LLM_PROVIDER=claude

# Anthropic API (if using Claude)
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# OpenAI API (if using OpenAI)
OPENAI_API_KEY=your_api_key_here

# ZAI API (alternative provider)
ZAI_API_KEY=your_zai_key_here
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
EOF

# Update MONOREPO_ROOT to your actual path
sed -i '' "s|/path/to/your/Legion|$(pwd)|g" .env
```

### 5. Download Embedding Models

```bash
# Download Nomic embedding model (required for semantic search)
cd packages/nomic
node scripts/download-model.js
cd ../..
```

### 6. Verify Installation

```bash
# Run semantic search tests
npm test --workspace=@legion/semantic-search

# All 22 tests should pass
```

---

## Docker Services Setup

### Services Overview

Legion uses three Docker services:

1. **MongoDB** (required) - Primary database for tool metadata, analytics
2. **Qdrant** (required) - Vector database for semantic search
3. **Neo4j** (optional) - Graph database for future features

### Starting Services

```bash
# Start all required services
npm run docker:setup

# OR start individual services
docker-compose up -d mongodb    # MongoDB only
docker-compose up -d qdrant     # Qdrant only
docker-compose up -d --profile graph neo4j  # Neo4j (optional)

# View logs
npm run docker:logs

# Stop services
npm run docker:stop

# Restart services
npm run docker:restart
```

### Service Endpoints

| Service  | Port | URL                         | Purpose              |
|----------|------|-----------------------------|----------------------|
| MongoDB  | 27017| mongodb://localhost:27017   | Primary database     |
| Qdrant   | 6333 | http://localhost:6333       | Vector search (HTTP) |
| Qdrant   | 6334 | http://localhost:6334       | Vector search (gRPC) |
| Neo4j    | 7474 | http://localhost:7474       | Graph DB web UI      |
| Neo4j    | 7687 | bolt://localhost:7687       | Graph DB Bolt API    |

### Data Persistence

All Docker services use named volumes for data persistence:

```bash
# View volumes
docker volume ls | grep legion

# Backup data
docker run --rm -v legion_mongodb_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongodb-backup.tar.gz /data

# Clean up all data (WARNING: destructive)
docker-compose down -v
```

---

## Environment Configuration

### Required Variables

```bash
# Monorepo configuration
MONOREPO_ROOT=/absolute/path/to/Legion  # REQUIRED

# Database connections
MONGODB_URL=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333

# LLM Provider selection
LLM_PROVIDER=claude  # Options: claude, openai, gemini
```

### LLM Provider Configuration

#### Option 1: Anthropic Claude

```bash
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

#### Option 2: OpenAI

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4-turbo-preview
```

#### Option 3: Google Gemini

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
```

#### Option 4: ZAI (OpenAI/Anthropic compatible)

```bash
# ZAI as OpenAI-compatible
LLM_PROVIDER=openai
OPENAI_API_KEY=your_zai_key
OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
OPENAI_MODEL=glm-4.6

# ZAI as Anthropic-compatible
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=your_zai_key
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_MODEL=glm-4-plus
```

### Optional Variables

```bash
# Semantic Search Settings
SEMANTIC_SEARCH_CACHE_TTL=3600
SEMANTIC_SEARCH_ENABLE_CACHE=true
SEMANTIC_SEARCH_BATCH_SIZE=100

# Neo4j (if using graph features)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Development
NODE_ENV=development
DEBUG=legion:*
```

---

## Embedding Models

### Nomic Embeddings (Default)

Legion uses **Nomic Embed v1.5** (GGUF format) for local semantic search:

- **Dimensions**: 768
- **Model Size**: ~80MB (Q4_K_M quantization)
- **Performance**: Fast local embeddings via node-llama-cpp

#### Download Model

```bash
cd packages/nomic
node scripts/download-model.js
cd ../..
```

This downloads:
- `packages/nomic/models/nomic-embed-text-v1.5.Q4_K_M.gguf`

#### Manual Download (if script fails)

```bash
cd packages/nomic/models
curl -L -o nomic-embed-text-v1.5.Q4_K_M.gguf \
  https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf
cd ../../..
```

### Model Selection

The Nomic package will automatically use the best available model:

1. `nomic-embed-text-v1.5.f32.gguf` (full precision, largest)
2. `nomic-embed-text-v1.5.f16.gguf` (half precision)
3. `nomic-embed-text-v1.5.Q8_0.gguf` (8-bit quantization)
4. `nomic-embed-text-v1.5.Q4_K_M.gguf` (4-bit quantization, **recommended**)
5. `nomic-embed-text-v1.5.Q2_K.gguf` (2-bit quantization, smallest)

---

## Verification & Testing

### 1. Check Docker Services

```bash
# Verify all services are running
docker ps | grep legion

# Should show:
# - legion-mongodb
# - legion-qdrant
# (- legion-neo4j if started)

# Test Qdrant connection
curl http://localhost:6333/collections
# Should return: {"result":{"collections":[]},"status":"ok",...}

# Test MongoDB connection
docker exec legion-mongodb mongosh --eval "db.runCommand({connectionStatus: 1})"
# Should show: "ok": 1
```

### 2. Run Package Tests

```bash
# Test Nomic embeddings (9 tests)
npm test --workspace=@legion/nomic

# Test semantic search (22 tests)
npm test --workspace=@legion/semantic-search

# Test resource manager
npm test --workspace=@legion/resource-manager

# Test Docker services integration
npm test --workspace=@legion/resource-manager -- __tests__/integration/DockerServices.test.js

# Run all tests (may take several minutes)
npm test
```

### 3. Verify Embedding Generation

```bash
# Quick embedding test
node -e "
import { NomicEmbeddings } from './packages/nomic/src/NomicEmbeddings.js';
const embeddings = new NomicEmbeddings();
await embeddings.initialize();
const result = await embeddings.embed('Hello world');
console.log('✓ Generated embedding:', result.length, 'dimensions');
process.exit(0);
" --input-type=module
```

### 4. Test Semantic Search End-to-End

```bash
# Create test script
cat > test-semantic-search.js << 'EOF'
import { ResourceManager } from './packages/resource-manager/src/ResourceManager.js';

const rm = await ResourceManager.getInstance();
const semanticSearch = await rm.get('semanticSearch');

// Create test collection
const collection = 'test-' + Date.now();
await semanticSearch.createCollection(collection, { dimension: 768 });

// Insert documents
await semanticSearch.insert(collection, [
  { id: 'doc1', text: 'The capital of France is Paris', metadata: { type: 'geography' } },
  { id: 'doc2', text: 'Python is a programming language', metadata: { type: 'technology' } }
]);

// Search
const results = await semanticSearch.semanticSearch(collection, 'Tell me about France', { limit: 5 });
console.log('✓ Found', results.length, 'results');
console.log('✓ Top result:', results[0].document.text);

// Cleanup
const qdrant = await rm.get('qdrantClient');
await qdrant.deleteCollection(collection);

const mongo = await rm.get('mongoClient');
await mongo.close();

console.log('✓ Semantic search working correctly!');
process.exit(0);
EOF

node test-semantic-search.js
rm test-semantic-search.js
```

---

## Troubleshooting

### Docker Issues

#### Docker daemon not running
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

#### Port already in use
```bash
# Check what's using the port
lsof -i :6333  # Qdrant
lsof -i :27017 # MongoDB

# Kill process or stop conflicting service
docker-compose down
```

#### Container fails to start
```bash
# View container logs
docker logs legion-qdrant
docker logs legion-mongodb

# Restart specific container
docker restart legion-qdrant
```

### MongoDB Issues

#### Connection refused
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Start if not running
docker-compose up -d mongodb

# Test connection
docker exec legion-mongodb mongosh --eval "db.runCommand({ping: 1})"
```

### Qdrant Issues

#### Collections not persisting
```bash
# Check volume exists
docker volume ls | grep qdrant_storage

# Verify volume is mounted
docker inspect legion-qdrant | grep -A 5 Mounts
```

#### HTTP 400 Bad Request
- Qdrant expects specific filter format
- Check filter conversion in `QdrantVectorStore.js`
- Common issue: MongoDB-style filters won't work

### Embedding Model Issues

#### Model not found
```bash
# Check if model file exists
ls -lh packages/nomic/models/*.gguf

# Re-download if missing
cd packages/nomic
node scripts/download-model.js
```

#### Out of memory
- Q4_K_M model uses ~500MB RAM
- Switch to Q2_K model for lower memory usage
- Or use larger quantization (Q8_0, f16) if memory available

### Test Failures

#### "Cannot find module" errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### "ResourceManager not initialized"
```bash
# Check .env file exists
cat .env | grep MONOREPO_ROOT

# Verify MONOREPO_ROOT is correct absolute path
echo $PWD
```

#### Tests timing out
```bash
# Increase Jest timeout in test file
test('my test', async () => {
  // ...
}, 60000);  // 60 second timeout

# Or run with longer timeout
npm test -- --testTimeout=120000
```

---

## Architecture Overview

### Component Stack

```
┌─────────────────────────────────────────────┐
│           Legion Application Layer          │
│  (Agents, Tools, Planning, Code Analysis)   │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│         Semantic Search Provider            │
│   (Query Processing, Hybrid Search)         │
└─────────────────────────────────────────────┘
                     ↓
        ┌────────────┴────────────┐
        ↓                         ↓
┌──────────────┐          ┌──────────────┐
│   Nomic      │          │   Qdrant     │
│  Embeddings  │──────────│Vector Store  │
│  (Local)     │  768-dim │  (Docker)    │
└──────────────┘          └──────────────┘
                                 ↓
┌─────────────────────────────────────────────┐
│            MongoDB (Primary DB)             │
│  (Metadata, Analytics, Tool Registry)       │
└─────────────────────────────────────────────┘
```

### Key Packages

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@legion/resource-manager` | Singleton config & service manager | None |
| `@legion/semantic-search` | Semantic search provider | Qdrant, Nomic |
| `@legion/nomic` | Local GGUF embeddings | node-llama-cpp |
| `@legion/llm-client` | Multi-provider LLM client | OpenAI/Anthropic SDKs |
| `@legion/tools-registry` | Tool discovery & execution | MongoDB, Semantic Search |

### Data Flow

1. **Initialization**: ResourceManager loads `.env`, creates singletons
2. **Embedding Service**: Nomic loads GGUF model, provides 768-dim embeddings
3. **Vector Store**: Qdrant stores embeddings, provides similarity search
4. **Semantic Search**: Combines embeddings + Qdrant for NL queries
5. **Tool Registry**: Uses semantic search for intelligent tool discovery

### Performance Characteristics

| Component | Operation | Performance |
|-----------|-----------|-------------|
| Nomic Embeddings | Generate embedding | ~5-20ms |
| Nomic Embeddings | Batch (100) | ~500ms-2s |
| Qdrant | Insert vectors | <10ms |
| Qdrant | Search (1000 vectors) | <20ms |
| MongoDB | Query metadata | <5ms |
| Semantic Search | Full pipeline | ~50-100ms |

---

## Development Workflow

### Common Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific workspace tests
npm test --workspace=@legion/semantic-search

# Build all packages
npm run build

# Lint code
npm run lint

# Start Docker services
npm run docker:start

# Stop Docker services
npm run docker:stop

# View Docker logs
npm run docker:logs

# Check Docker status
npm run docker:status
```

### Testing Strategy

1. **Unit Tests**: Test individual functions/classes
2. **Integration Tests**: Test with real services (MongoDB, Qdrant)
3. **End-to-End Tests**: Test full user workflows

**Important**: Integration tests require Docker services running!

### Package Scripts

Each package has its own scripts:

```bash
# Run tests for specific package
cd packages/semantic-search
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

---

## Additional Resources

- **Main Repository**: https://github.com/maxximus-dev/Legion
- **Qdrant Docs**: https://qdrant.tech/documentation/
- **Nomic Embeddings**: https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF
- **ResourceManager Pattern**: See `packages/resource-manager/README.md`

---

## Getting Help

If you encounter issues:

1. Check this troubleshooting section
2. Search existing GitHub issues
3. Run diagnostic: `npm run docker:status && docker ps`
4. Collect logs: `npm run docker:logs > logs.txt`
5. Create GitHub issue with logs and error messages

---

**Last Updated**: 2025-10-11
**Legion Version**: 0.0.1
**Tested On**: macOS (Apple Silicon), Ubuntu 22.04
