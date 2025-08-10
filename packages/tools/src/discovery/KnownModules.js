/**
 * Known Modules Registry
 * 
 * A curated list of all legitimate modules in the Legion framework.
 * This provides a direct, fast way to discover modules without filesystem scanning.
 */

export const KNOWN_MODULES = [
  // File operations
  {
    name: 'File',
    path: 'file/index.js',
    className: 'FileModule',
    package: '@legion/tools-collection',
    description: 'File system operations including read, write, and directory management'
  },
  
  // Calculator
  {
    name: 'Calculator',
    path: 'calculator/index.js',
    className: 'CalculatorModule',
    package: '@legion/tools-collection',
    description: 'Mathematical calculations and operations'
  },
  
  // JSON operations
  {
    name: 'Json',
    path: 'json/index.js',
    className: 'JsonModule',
    package: '@legion/tools-collection',
    description: 'JSON parsing, stringifying, and manipulation'
  },
  
  // AI Generation
  {
    name: 'AIGeneration',
    path: 'ai-generation/AIGenerationModule.js',
    className: 'AIGenerationModule',
    package: '@legion/tools-collection',
    description: 'AI-powered code and content generation'
  },
  
  // GitHub integration
  {
    name: 'Github',
    path: 'github/GitHubModule.js',
    className: 'GitHubModule',
    package: '@legion/tools-collection',
    description: 'GitHub API integration for repos, issues, PRs'
  },
  
  // Serper search
  {
    name: 'Serper',
    path: 'serper/SerperModule.js',
    className: 'SerperModule',
    package: '@legion/tools-collection',
    description: 'Web search using Serper API'
  },
  
  // System operations
  {
    name: 'System',
    path: 'system/index.js',
    className: 'SystemModule',
    package: '@legion/tools-collection',
    description: 'System information and operations'
  },
  
  // File analysis
  {
    name: 'FileAnalysis',
    path: 'file-analysis/index.js',
    className: 'FileAnalysisModule',
    package: '@legion/tools-collection',
    description: 'Analyze files for patterns, dependencies, etc.'
  }
];

/**
 * Get all known modules
 */
export function getKnownModules() {
  return KNOWN_MODULES;
}

/**
 * Find a module by name
 */
export function findModuleByName(name) {
  return KNOWN_MODULES.find(m => 
    m.name.toLowerCase() === name.toLowerCase() ||
    m.className.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get modules by package
 */
export function getModulesByPackage(packageName) {
  return KNOWN_MODULES.filter(m => m.package === packageName);
}

/**
 * Check if a path is a known module
 */
export function isKnownModule(path) {
  const normalizedPath = path.replace(/\\/g, '/');
  return KNOWN_MODULES.some(m => normalizedPath.includes(m.path));
}