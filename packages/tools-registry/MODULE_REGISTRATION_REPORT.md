# Module Registration Report

Date: 2025-08-18

## Summary

### Discovery
- Files scanned: 26
- Modules discovered: 26
- New registrations: 25
- Updates: 1
- Failures: 0

### Loading
- Modules attempted: 25
- Modules loaded: 15
- Modules failed: 10
- Tools added: 35

#### Failed Modules
- **SD**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/sd/src/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/sd/src.js. Primary error: Cannot find package '/Users/maxximus/Documents/max/pocs/LegionCopy/node_modules/@legion/llm/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/sd/src/SDModule.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/sd/src.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **picture-analysis**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/picture-analysis/src/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/picture-analysis/src.js. Primary error: Cannot find package '/Users/maxximus/Documents/max/pocs/LegionCopy/node_modules/@legion/llm/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/picture-analysis/src/PictureAnalysisModule.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/picture-analysis/src.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **Gmail**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/gmail/src/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/gmail/src.js. Primary error: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "user"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "password"
    ],
    "message": "Required"
  }
]. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/gmail/src.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **DynamicJson**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading.js. Primary error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- ****: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/node-runner/src/base/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/node-runner/src/base.js. Primary error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/node-runner/src/base/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/node-runner/src/base.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **FileAnalysisModule**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/file-analysis/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/file-analysis.js. Primary error: Cannot find package '/Users/maxximus/Documents/max/pocs/LegionCopy/node_modules/@legion/llm/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/file-analysis/FileAnalysisModule.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/file-analysis.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **AIGenerationModule**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/ai-generation/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/ai-generation.js. Primary error: Cannot find package '/Users/maxximus/Documents/max/pocs/LegionCopy/node_modules/@legion/llm/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/ai-generation/AIGenerationModule.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-collection/src/ai-generation.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **JSGeneratorModule**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/js-generator/src/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/js-generator/src.js. Primary error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/js-generator/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/js-generator/src.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **CodeAnalysisModule**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/code-analysis/src/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/code-analysis/src.js. Primary error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/code-analysis/src/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/code-gen/code-analysis/src.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js
- **mcp_search_servers**: Failed to load module from both /Users/maxximus/Documents/max/pocs/LegionCopy/packages/aiur/src/modules/index.js and /Users/maxximus/Documents/max/pocs/LegionCopy/packages/aiur/src/modules.js. Primary error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/aiur/src/modules/index.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js. Alternative error: Cannot find module '/Users/maxximus/Documents/max/pocs/LegionCopy/packages/aiur/src/modules.js' imported from /Users/maxximus/Documents/max/pocs/LegionCopy/packages/tools-registry/src/loading/ModuleLoader.js

### Validation
- Modules validated: 30
- Modules with warnings: 0
- Modules failed: 10
- Tools checked: 70
- Tools executable: 4
- Tools with valid schemas: 4

## Performance
- Total execution time: 1.11 seconds

## Recommendations
1. Fix any failed modules before using in production
2. Review modules with warnings
3. Run validation regularly to catch issues early
4. Consider adding tests for tools that don't have them

## Next Steps
- Run `npm run test:tools` to test tool execution
- Check individual module logs for detailed error information
- Update module documentation as needed
