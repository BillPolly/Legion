# Legion Framework - New Machine Setup Checklist

This document tracks everything needed to get the Legion project working on a new machine.

## ✅ Completed Setup Steps

### 1. Repository and Dependencies
- [x] **Cloned repository** from GitHub
- [x] **Pulled latest changes** using `git pull origin main` 
- [x] **Updated npm to latest version** (`npm install -g npm@latest`) - required for workspace support
- [x] **Installed dependencies** with `npm install` (with some dependency conflicts noted)

### 2. Environment Configuration
- [x] **Created `.env` file** in project root with required variables:
  ```
  MONOREPO_ROOT=/Users/williampearson/Documents/p/agents/Legion
  NODE_ENV=development
  ```
  
### 3. Package Structure Fixes
- [x] **Removed CLI package** - needs complete rewrite due to import issues
- [x] **Fixed workspace dependency issue** - removed `workspace:*` syntax from `packages/tools-collection/package.json`
- [x] **Renamed Aiur package** - Changed from `"aiur-minimal"` to `"@legion/aiur"` 
- [x] **Fixed Aiur package.json** - Added proper scripts, main entry point, and bin configuration
- [x] **Created missing directory** - `packages/aiur/src/agents-bt/core/`
- [x] **Copied missing BTAgentBase.js** from `packages/sd/src/core/` to fix import errors

### 4. Testing and Verification
- [x] **Ran test suite** - Tests run but many fail due to missing `.env` initially, then missing API keys
- [x] **Checked linting** - ESLint needs configuration (no config file found)
- [x] **Verified basic functionality** - Core packages install and basic structure works
- [x] **Tested MCP monitor server** - Successfully starts and runs on ws://localhost:9901

## ⚠️ Known Issues and Partial Fixes

### Dependency Issues
- **ajv-formats missing** - Required by codec package but not installed
- **Invalid package versions** - Some packages have version conflicts (ajv@6.12.6 vs ^8.12.0)
- **Workspace dependencies** - Some packages still reference workspace syntax that doesn't work

### Missing Files/Components
- **CLI package deleted** - Needs complete rewrite due to import structure changes
- **ESLint configuration** - No .eslintrc or eslint.config.js found
- **Some test dependencies** - Tests fail due to missing API keys and configuration

### Aiur Server Issues
- **Missing dependencies** - ajv-formats and other packages needed
- **Module loading** - Some import paths may need updates
- **Configuration** - May need additional environment variables for full functionality

## 📋 Still Needed for Full Functionality

### High Priority
- [ ] **Install missing dependencies** 
  ```bash
  npm install ajv-formats
  # May need to clear node_modules and reinstall if conflicts persist
  ```
- [ ] **Add API keys to .env** (for live integration tests)
  ```
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  GITHUB_PAT=ghp_...
  SERPER_API_KEY=...
  RAILWAY_API_TOKEN=...
  ```
- [ ] **Create ESLint configuration** or remove linting from scripts

### Medium Priority  
- [ ] **Fix remaining dependency conflicts** - May require npm workspaces cleanup
- [ ] **Test Aiur server startup** - Verify all modules load correctly
- [ ] **Review and fix import paths** - Some packages may have outdated imports
- [ ] **Rebuild CLI package** - Create new CLI with proper module structure

### Low Priority
- [ ] **Review and update package versions** - Ensure consistency across workspaces
- [ ] **Update documentation** - Reflect current package structure
- [ ] **Test polyrepo scripts** - Ensure git subtree management still works

## 🛠️ Commands for Quick Setup

```bash
# 1. Install and update npm
npm install -g npm@latest

# 2. Install dependencies (handle conflicts as needed)
npm install
# If issues: rm -rf node_modules && npm install

# 3. Create .env file
cat > .env << 'EOF'
MONOREPO_ROOT=/Users/williampearson/Documents/p/agents/Legion
NODE_ENV=development
# Add API keys as available
EOF

# 4. Try basic functionality
npm run test:tools  # Will show some failures but basic structure works
npm run aiur       # May fail due to missing dependencies

# 5. Test MCP server (this works!)
cd packages/mcps/mcp-monitor && npm start
# Should show: ✅ Agent WebSocket server started on ws://localhost:9901

# 6. Install missing packages as needed
npm install ajv-formats
```

## 📝 Architecture Notes

- **Monorepo structure** with npm workspaces
- **ES modules** throughout (`"type": "module"`)
- **Git subtrees** for polyrepo management  
- **ResourceManager pattern** for API key management
- **Module-based architecture** with dependency injection

## 🔧 Development Workflow

Once fully set up:
- `npm run test` - Run all tests
- `npm run aiur` - Start AI coordination server  
- `npm run subtree:pull` - Pull from all subtree remotes
- `npm run subtree:push` - Push to all subtree remotes

## 🤖 Claude Code Integration

### MCP Server Setup
- [x] **MCP server properly configured** using `claude mcp add` command
- [x] **Legion monitor registered** as `legion-monitor` server with ✓ Connected status
- [x] **Tested connection** with `claude mcp list` - shows connected

### Using MCP Tools in Claude Code:
1. **Restart Claude Code** after MCP configuration
2. **Use `/mcp` command** to see server status 
3. **Use `/` to see all commands** - MCP tools appear as `/mcp__legion-monitor__toolname`
4. **Server provides** monitoring tools for Node.js/TypeScript applications

### Correct MCP Configuration Commands:
```bash
# Add MCP server (correct way)
claude mcp add legion-monitor --scope user node /path/to/mcp-server.js

# List servers and check connection
claude mcp list

# Remove server if needed
claude mcp remove legion-monitor
```

## 💡 Key Learnings

1. **npm version matters** - Workspace syntax requires newer npm versions
2. **Environment variables critical** - ResourceManager expects specific .env structure
3. **Dependency resolution complex** - Monorepo with ES modules has specific requirements
4. **Missing files common** - Large refactor left some files in wrong locations
5. **API keys required** - Many integration tests expect real API credentials