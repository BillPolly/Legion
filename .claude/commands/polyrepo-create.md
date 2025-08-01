# PolyRepo Package Creator

Create a new package in the Legion polyrepo structure with automatic GitHub repository creation and subtree configuration.

## Usage

Use natural language to describe the package you want to create:

- "Create a new package called 'validators' for input validation utilities"
- "Create a shared package called 'crypto' under packages/shared/"
- "Create an app package called 'dashboard' for monitoring Legion services"

## What This Command Does

I will automatically:

1. **📋 Analyze Requirements** - Parse package name, location, and purpose
2. **🏗️ Create Package Structure** - Generate Legion-compliant package with:
   - Proper `package.json` with `@legion/` namespace
   - `src/index.js` with placeholder implementation  
   - `__tests__/` directory with test setup
   - Comprehensive `README.md` documentation
3. **📦 Create GitHub Repository** - Create repo in BillPolly organization
4. **🌳 Configure Subtree** - Update gitsubtree.config and setup remotes
5. **✅ Verify Everything** - Run tests and ensure everything works

## Arguments

$ARGUMENTS - Description of the package to create (e.g., "validators package for input validation")

## Implementation

You are the PolyRepo Package Creator agent. Your mission is to automate the complete workflow of adding new packages to the Legion polyrepo structure.

### Core Workflow

1. **Requirements Analysis**
   - Extract package name from user description
   - Determine package location (packages/, packages/shared/, packages/apps/, etc.)
   - Identify package type and purpose

2. **Package Structure Creation**
   - Create directory structure under appropriate location
   - Generate `package.json` with Legion conventions:
     ```json
     {
       "name": "@legion/PACKAGE_NAME",
       "version": "1.0.0",
       "description": "DESCRIPTION",
       "type": "module",
       "main": "src/index.js",
       "scripts": {
         "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
         "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch",
         "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage"
       },
       "keywords": ["PACKAGE_NAME", "legion-framework"],
       "author": "Legion Framework",
       "license": "MIT",
       "dependencies": {},
       "devDependencies": {"jest": "^29.7.0"},
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

3. **GitHub Repository Creation**
   - Initialize git in package directory
   - Stage and commit initial files
   - Use GitHub CLI to create repository in BillPolly organization:
     ```bash
     export GH_TOKEN=$(grep GITHUB_PAT .env | cut -d'=' -f2)
     gh repo create BillPolly/PACKAGE_NAME --public --description "DESCRIPTION" --source=. --push
     ```

4. **Subtree Configuration**
   - Add entry to `scripts/config/gitsubtree.config`:
     ```
     packages/PACKAGE_PATH https://github.com/BillPolly/REPO_NAME.git main
     ```
   - Run `npm run subtree:setup` to configure remotes
   - Remove package `.git` directory for subtree management
   - Commit changes to Legion polyrepo

5. **Verification and Cleanup**
   - Run `npm test` in package directory
   - Verify GitHub repository exists
   - Confirm subtree remote configuration
   - Provide success summary with links

### Critical Requirements

**ALWAYS:**
- Use `@legion/` namespace in package.json name
- Include comprehensive test structure with Jest configuration
- Create detailed README with usage examples
- Use ResourceManager patterns (never direct process.env access)
- Follow Legion framework conventions exactly
- Verify everything works before declaring success

**NEVER:**
- Skip test structure creation
- Leave incomplete packages
- Access environment variables directly
- Create repositories without proper descriptions
- Skip verification steps

### Error Handling

If any step fails:
1. Stop immediately and diagnose the issue
2. Clean up any partially created files/repositories  
3. Report specific error with troubleshooting steps
4. Offer to retry with corrected parameters

### Success Response Format

Provide clear status updates and final summary:

```
🚀 Creating new Legion package: @legion/PACKAGE_NAME

✅ Step 1: Package structure created at packages/PACKAGE_PATH/
✅ Step 2: GitHub repository created: https://github.com/BillPolly/REPO_NAME
✅ Step 3: Subtree configuration updated and remotes set up
✅ Step 4: Initial tests pass (X/X tests passing)
✅ Step 5: Documentation complete

📍 Repository: https://github.com/BillPolly/REPO_NAME
📁 Local Path: packages/PACKAGE_PATH/
🎯 Ready for development!

Next steps:
- Run: cd packages/PACKAGE_PATH && npm test
- Start implementing: Edit src/index.js
- Push changes: npm run subtree:push
```

Begin by analyzing the user's request: "$ARGUMENTS"