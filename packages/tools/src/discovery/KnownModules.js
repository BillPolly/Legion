/**
 * Known Modules Registry
 * 
 * A comprehensive list of all modules in the Legion framework.
 * Modules are either class-based (extending Module) or JSON-based (with module.json).
 * Paths are relative to the monorepo root (obtained from MONOREPO_ROOT env var).
 */

import path from 'path';

export const KNOWN_MODULES = [
  // ===== TOOLS COLLECTION MODULES (class-based) =====
  {
    name: 'File',
    type: 'class',
    path: 'packages/tools-collection/src/file/index.js',
    className: 'FileModule',
    package: '@legion/tools-collection',
    description: 'File system operations including read, write, and directory management'
  },
  {
    name: 'Calculator',
    type: 'class',
    path: 'packages/tools-collection/src/calculator/index.js',
    className: 'CalculatorModule',
    package: '@legion/tools-collection',
    description: 'Mathematical calculations and operations'
  },
  {
    name: 'Json',
    type: 'class',
    path: 'packages/tools-collection/src/json/index.js',
    className: 'JsonModule',
    package: '@legion/tools-collection',
    description: 'JSON parsing, stringifying, and manipulation'
  },
  {
    name: 'AIGeneration',
    type: 'class',
    path: 'packages/tools-collection/src/ai-generation/index.js',
    className: 'AIGenerationModule',
    package: '@legion/tools-collection',
    description: 'AI-powered code and content generation'
  },
  {
    name: 'Github',
    type: 'class',
    path: 'packages/tools-collection/src/github/index.js',
    className: 'GitHubModule',
    package: '@legion/tools-collection',
    description: 'GitHub API integration for repos, issues, PRs'
  },
  {
    name: 'Serper',
    type: 'class',
    path: 'packages/tools-collection/src/serper/index.js',
    className: 'SerperModule',
    package: '@legion/tools-collection',
    description: 'Web search using Serper API'
  },
  {
    name: 'System',
    type: 'class',
    path: 'packages/tools-collection/src/system/index.js',
    className: 'SystemModule',
    package: '@legion/tools-collection',
    description: 'System information and operations'
  },
  {
    name: 'FileAnalysis',
    type: 'class',
    path: 'packages/tools-collection/src/file-analysis/index.js',
    className: 'FileAnalysisModule',
    package: '@legion/tools-collection',
    description: 'Analyze files for patterns, dependencies, etc.'
  },
  {
    name: 'CommandExecutor',
    type: 'class',
    path: 'packages/tools-collection/src/command-executor/index.js',
    className: 'CommandExecutorModule',
    package: '@legion/tools-collection',
    description: 'Execute system commands and scripts'
  },
  {
    name: 'Crawler',
    type: 'class',
    path: 'packages/tools-collection/src/crawler/index.js',
    className: 'CrawlerModule',
    package: '@legion/tools-collection',
    description: 'Web crawling and scraping capabilities'
  },
  {
    name: 'Encode',
    type: 'class',
    path: 'packages/tools-collection/src/encode/index.js',
    className: 'EncodeModule',
    package: '@legion/tools-collection',
    description: 'Encoding and decoding utilities'
  },
  {
    name: 'PageScreenshoter',
    type: 'class',
    path: 'packages/tools-collection/src/page-screenshoter/index.js',
    className: 'PageScreenshoterModule',
    package: '@legion/tools-collection',
    description: 'Capture screenshots of web pages'
  },
  {
    name: 'ServerStarter',
    type: 'class',
    path: 'packages/tools-collection/src/server-starter/index.js',
    className: 'ServerStarterModule',
    package: '@legion/tools-collection',
    description: 'Start and manage development servers'
  },
  {
    name: 'WebpageToMarkdown',
    type: 'class',
    path: 'packages/tools-collection/src/webpage-to-markdown/index.js',
    className: 'WebpageToMarkdownModule',
    package: '@legion/tools-collection',
    description: 'Convert web pages to markdown format'
  },
  {
    name: 'YoutubeTranscript',
    type: 'class',
    path: 'packages/tools-collection/src/youtube-transcript/index.js',
    className: 'YoutubeTranscriptModule',
    package: '@legion/tools-collection',
    description: 'Extract transcripts from YouTube videos'
  },

  // ===== STANDALONE PACKAGE MODULES (class-based) =====
  {
    name: 'Railway',
    type: 'class',
    path: 'packages/railway/src/index.js',
    className: 'RailwayModule',
    package: '@legion/railway',
    description: 'Railway deployment and management'
  },
  {
    name: 'Voice',
    type: 'class',
    path: 'packages/voice/src/index.js',
    className: 'VoiceModule',
    package: '@legion/voice',
    description: 'Voice recognition and synthesis'
  },
  {
    name: 'SD',
    type: 'class',
    path: 'packages/sd/src/index.js',
    className: 'SDModule',
    package: '@legion/sd',
    description: 'Software development tools and utilities'
  },
  {
    name: 'NodeRunner',
    type: 'class',
    path: 'packages/node-runner/src/index.js',
    className: 'NodeRunnerModule',
    package: '@legion/node-runner',
    description: 'Execute and manage Node.js processes'
  },
  {
    name: 'ConanTheDeployer',
    type: 'class',
    path: 'packages/conan-the-deployer/src/index.js',
    className: 'ConanTheDeployer',
    package: '@legion/conan-the-deployer',
    description: 'Deploy applications to various platforms'
  },
  {
    name: 'BrowserMonitor',
    type: 'class',
    path: 'packages/browser-monitor/src/index.js',
    className: 'BrowserMonitorModule',
    package: '@legion/browser-monitor',
    description: 'Monitor browser performance and events'
  },
  {
    name: 'LogManager',
    type: 'class',
    path: 'packages/log-manager/src/index.js',
    className: 'LogManagerModule',
    package: '@legion/log-manager',
    description: 'Centralized logging and log management'
  },
  {
    name: 'Playwright',
    type: 'class',
    path: 'packages/playwright/src/index.js',
    className: 'PlaywrightModule',
    package: '@legion/playwright',
    description: 'Browser automation with Playwright'
  },

  // ===== CODE GENERATION MODULES (class-based) =====
  {
    name: 'Jester',
    type: 'class',
    path: 'packages/code-gen/jester/src/index.js',
    className: 'JesterModule',
    package: '@legion/jester',
    description: 'Jest test generation and management'
  },
  {
    name: 'JSGenerator',
    type: 'class',
    path: 'packages/code-gen/js-generator/src/index.js',
    className: 'JSGeneratorModule',
    package: '@legion/js-generator',
    description: 'JavaScript code generation utilities'
  },
  {
    name: 'CodeAnalysis',
    type: 'class',
    path: 'packages/code-gen/code-analysis/src/index.js',
    className: 'CodeAnalysisModule',
    package: '@legion/code-analysis',
    description: 'Analyze and understand code structure'
  },
  {
    name: 'CodeAgent',
    type: 'class',
    path: 'packages/code-gen/code-agent/src/index.js',
    className: 'CodeAgentModule',
    package: '@legion/code-agent',
    description: 'AI-powered code generation agent'
  },

  // ===== JSON-BASED MODULES =====
  {
    name: 'TestJsonModule',
    type: 'json',
    path: 'packages/test-json-module',
    moduleJsonPath: 'packages/test-json-module/module.json',
    package: '@legion/test-json-module',
    description: 'Test module using JSON configuration'
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
    (m.className && m.className.toLowerCase() === name.toLowerCase())
  );
}

/**
 * Get modules by package
 */
export function getModulesByPackage(packageName) {
  return KNOWN_MODULES.filter(m => m.package === packageName);
}

/**
 * Get modules by type (class or json)
 */
export function getModulesByType(type) {
  return KNOWN_MODULES.filter(m => m.type === type);
}

/**
 * Check if a path is a known module
 */
export function isKnownModule(path) {
  const normalizedPath = path.replace(/\\/g, '/');
  return KNOWN_MODULES.some(m => normalizedPath.includes(m.path));
}

/**
 * Get the full path to a module given the monorepo root
 */
export function getModuleFullPath(module, monorepoRoot) {
  // For JSON modules, use the moduleJsonPath if available
  if (module.type === 'json' && module.moduleJsonPath) {
    return path.join(monorepoRoot, module.moduleJsonPath);
  }
  
  // For class modules or JSON modules with just a directory path
  return path.join(monorepoRoot, module.path);
}