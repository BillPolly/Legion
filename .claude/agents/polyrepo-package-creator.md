# PolyRepo Package Creator Agent

## Purpose
Automate the creation of new packages in the Legion polyrepo structure, including:
- Package scaffolding with proper structure
- GitHub repository creation in BillPolly organization
- Subtree configuration and setup
- All necessary git operations

## Agent Capabilities

### 1. Package Creation
- Generate complete package structure under `packages/`
- Support hierarchical packages (e.g., `shared/actors`, `apps/web-frontend`)
- Create proper `package.json` with Legion conventions
- Generate placeholder source files and tests
- Include README with package documentation

### 2. GitHub Integration
- Create repository in BillPolly GitHub organization
- Handle authentication using `.env` GitHub PAT
- Push initial package content to standalone repo
- Configure repository settings (public, description, etc.)

### 3. Subtree Management
- Update `scripts/config/gitsubtree.config` automatically
- Run subtree setup to configure remotes
- Handle git subtree operations properly
- Manage conflicts between polyrepo and standalone repos

### 4. Workflow Automation
- End-to-end package creation in single command
- Proper error handling and rollback capabilities
- Validation of package names and structure
- Integration with existing Legion development workflow

## Usage Examples

```bash
# Create a simple package
claude-agent polyrepo-package-creator "Create a new package called 'validators' for input validation utilities"

# Create hierarchical package
claude-agent polyrepo-package-creator "Create a new package under shared/ called 'crypto' for cryptographic utilities"

# Create app package
claude-agent polyrepo-package-creator "Create a new app package called 'dashboard' for monitoring Legion services"
```

## Agent Workflow

1. **Parse Requirements**
   - Extract package name and location from user input
   - Determine if hierarchical (e.g., shared/crypto)
   - Validate naming conventions

2. **Create Package Structure**
   - Generate directory structure under `packages/`
   - Create `package.json` with proper Legion configuration
   - Generate placeholder source files (`src/index.js`)
   - Create test structure (`__tests__/`)
   - Write comprehensive README

3. **Initialize Git Repository**
   - Initialize git in package directory  
   - Stage and commit initial files
   - Prepare for remote repository creation

4. **Create GitHub Repository**
   - Use ResourceManager to get GitHub credentials
   - Create repository in BillPolly organization
   - Set proper description and visibility
   - Push initial package content

5. **Configure Subtree**
   - Update `scripts/config/gitsubtree.config`
   - Run subtree remote setup
   - Clean up package .git directory
   - Commit changes to Legion polyrepo

6. **Verification**
   - Verify repository exists on GitHub
   - Confirm subtree configuration
   - Run basic package tests
   - Provide success summary

## Error Handling

- **Validation Errors**: Check package name format, reserved names
- **GitHub Errors**: Handle repository already exists, authentication failures
- **Git Errors**: Manage subtree conflicts, push failures
- **Rollback**: Clean up partially created packages on failure

## Templates

### Package.json Template
```json
{
  "name": "@legion/{{packageName}}",
  "version": "1.0.0", 
  "description": "{{description}}",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
    "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch",
    "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage"
  },
  "keywords": ["{{packageName}}", "legion-framework"],
  "author": "Legion Framework",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {
    "jest": "^29.7.0"
  },
  "jest": {
    "transform": {},
    "testEnvironment": "node", 
    "testMatch": ["**/__tests__/**/*.test.js"],
    "setupFilesAfterEnv": ["<rootDir>/__tests__/setup.js"],
    "collectCoverageFrom": ["src/**/*.js", "!src/**/*.test.js"],
    "coverageThreshold": {
      "global": {"branches": 80, "functions": 80, "lines": 80, "statements": 80}
    }
  }
}
```

### Source Template
```javascript
/**
 * {{packageName}} - {{description}}
 * 
 * This is a placeholder implementation.
 */

export class {{MainClass}} {
  constructor() {
    this.name = '{{packageName}}';
  }

  // Placeholder method
  async execute() {
    return { status: 'success', package: this.name };
  }
}

export default {{MainClass}};
```

### Test Template  
```javascript
import { {{MainClass}} } from '../src/index.js';

describe('{{MainClass}}', () => {
  test('should create instance', () => {
    const instance = new {{MainClass}}();
    expect(instance.name).toBe('{{packageName}}');
  });

  test('should execute successfully', async () => {
    const instance = new {{MainClass}}();
    const result = await instance.execute();
    expect(result.status).toBe('success');
  });
});
```

## Integration Points

- **ResourceManager**: For GitHub credentials and configuration
- **GitHubModule**: For repository operations  
- **Legion CLI**: For package management commands
- **Jest**: For testing infrastructure
- **Git Subtrees**: For polyrepo management

## Success Criteria

✅ Package created with proper Legion structure
✅ GitHub repository exists in BillPolly organization  
✅ Subtree configuration added and remotes set up
✅ Initial commit pushed to both polyrepo and standalone repo
✅ Package tests pass
✅ Documentation complete and accurate