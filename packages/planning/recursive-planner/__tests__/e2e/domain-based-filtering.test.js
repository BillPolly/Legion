/**
 * Domain-Based Tool Filtering Tests
 * 
 * Tests the simple domain-based tool filtering system to ensure it correctly
 * maps goals to domains and selects relevant tools.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/domain-based-filtering.test.js --verbose
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
// Import from tool-architecture package
import { 
  ToolRegistry, 
  FileSystemModuleDefinition,
  HTTPModuleDefinition,
  GitModuleDefinition
} from '@legion/tool-architecture';

// ModuleProvider for compatibility
class ModuleProvider {
  constructor(metadata, instance) {
    this.metadata = metadata;
    this.instance = instance;
  }
}

describe('Domain-Based Tool Filtering', () => {
  let toolRegistry;

  beforeAll(async () => {
    toolRegistry = new ToolRegistry();
    
    // Register the tool modules for testing
    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'FileSystemModule',
      definition: FileSystemModuleDefinition,
      config: {
        basePath: '/tmp/test-workspace',
        allowWrite: true,
        allowDelete: true
      },
      lazy: false
    }));

    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'HTTPModule', 
      definition: HTTPModuleDefinition,
      config: {
        timeout: 10000
      },
      lazy: false
    }));

    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'GitModule',
      definition: GitModuleDefinition,
      config: {
        timeout: 30000
      },
      lazy: false
    }));

    console.log('✅ Tool registry initialized with modules');
  });

  describe('Domain Detection from Goals', () => {
    test('should detect web domain from website-related goals', () => {
      const testCases = [
        'Create a simple website for my portfolio',
        'Build a web application with HTML and CSS',
        'Design a frontend for my project',
        'Make a webpage with a contact form'
      ];

      for (const goal of testCases) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        console.log(`Goal: "${goal}" → Domains: ${domains.join(', ')}`);
        
        expect(domains).toContain('web');
      }
    });

    test('should detect file domain from file-related goals', () => {
      const testCases = [
        'Create a file with some content',
        'Write documentation to a file',
        'Read the configuration file',
        'Delete old documents'
      ];

      for (const goal of testCases) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        console.log(`Goal: "${goal}" → Domains: ${domains.join(', ')}`);
        
        expect(domains).toContain('files');
      }
    });

    test('should detect git domain from version control goals', () => {
      const testCases = [
        'Commit my changes to the repository',
        'Clone the git repo and make updates',
        'Push code to the remote branch',
        'Check git status and add files'
      ];

      for (const goal of testCases) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        console.log(`Goal: "${goal}" → Domains: ${domains.join(', ')}`);
        
        expect(domains).toContain('git');
      }
    });

    test('should detect multiple domains from complex goals', () => {
      const testCases = [
        'Create a website and deploy it using git', // should detect: web, deploy, git
        'Build a web API and document it in files', // should detect: web, api, files
        'Set up a development project with git repository' // should detect: development, project, git
      ];

      for (const goal of testCases) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        console.log(`Goal: "${goal}" → Domains: ${domains.join(', ')}`);
        
        expect(domains.length).toBeGreaterThanOrEqual(2);
      }
    });

    test('should provide fallback domain for unclear goals', () => {
      const testCases = [
        'Do something useful',
        'Help me with my task',
        'Process the data'
      ];

      for (const goal of testCases) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        console.log(`Goal: "${goal}" → Domains: ${domains.join(', ')}`);
        
        expect(domains.length).toBeGreaterThan(0);
        expect(domains).toContain('files'); // Default fallback
      }
    });
  });

  describe('Tool Selection by Domain', () => {
    test('should return correct tools for web domain', async () => {
      const webTools = await toolRegistry.getToolsForDomains(['web']);
      
      console.log(`Web domain tools: ${webTools.join(', ')}`);
      
      expect(webTools).toContain('FileSystemModule.writeFile');
      expect(webTools).toContain('FileSystemModule.readFile');
      expect(webTools).toContain('HTTPModule.get');
      expect(webTools.length).toBeGreaterThan(3);
    });

    test('should return correct tools for files domain', async () => {
      const fileTools = await toolRegistry.getToolsForDomains(['files']);
      
      console.log(`Files domain tools: ${fileTools.join(', ')}`);
      
      expect(fileTools).toContain('FileSystemModule.readFile');
      expect(fileTools).toContain('FileSystemModule.writeFile');
      expect(fileTools).toContain('FileSystemModule.deleteFile');
      expect(fileTools).toContain('FileSystemModule.mkdir');
    });

    test('should return correct tools for git domain', async () => {
      const gitTools = await toolRegistry.getToolsForDomains(['git']);
      
      console.log(`Git domain tools: ${gitTools.join(', ')}`);
      
      expect(gitTools).toContain('GitModule.clone');
      expect(gitTools).toContain('GitModule.commit');
      expect(gitTools).toContain('GitModule.push');
      expect(gitTools).toContain('GitModule.status');
    });

    test('should merge tools from multiple domains without duplicates', async () => {
      const multiTools = await toolRegistry.getToolsForDomains(['web', 'files']);
      
      console.log(`Web + Files domain tools (${multiTools.length}): ${multiTools.join(', ')}`);
      
      // Should contain tools from both domains
      expect(multiTools).toContain('FileSystemModule.writeFile');
      expect(multiTools).toContain('HTTPModule.get');
      
      // Should not have duplicates
      const uniqueTools = new Set(multiTools);
      expect(multiTools.length).toBe(uniqueTools.size);
    });

    test('should only return tools that are actually available', async () => {
      // Test with a domain that includes non-existent tools
      const availableTools = await toolRegistry.listTools();
      const domainTools = await toolRegistry.getToolsForDomains(['web']);
      
      console.log(`Available tools: ${availableTools.length}`);
      console.log(`Web domain tools: ${domainTools.length}`);
      
      // All returned tools should be in the available tools list
      for (const tool of domainTools) {
        expect(availableTools).toContain(tool);
      }
    });
  });

  describe('End-to-End Goal to Tools', () => {
    test('should get relevant tools for website creation goal', async () => {
      const goal = 'Create a simple portfolio website with HTML and CSS files';
      const tools = await toolRegistry.getRelevantToolsForGoal(goal);
      
      console.log(`\nWebsite goal: "${goal}"`);
      console.log(`Selected tools: ${tools.map(t => t.name).join(', ')}`);
      
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include file operations for creating HTML/CSS files
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('writeFile');
      expect(toolNames).toContain('readFile');
      expect(toolNames).toContain('mkdir');
    });

    test('should get relevant tools for file management goal', async () => {
      const goal = 'Read configuration files and create backup copies';
      const tools = await toolRegistry.getRelevantToolsForGoal(goal);
      
      console.log(`\nFile management goal: "${goal}"`);
      console.log(`Selected tools: ${tools.map(t => t.name).join(', ')}`);
      
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include file operations
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('readFile');
      expect(toolNames).toContain('writeFile');
    });

    test('should get relevant tools for deployment goal', async () => {
      const goal = 'Deploy my application to production server using git';
      const tools = await toolRegistry.getRelevantToolsForGoal(goal);
      
      console.log(`\nDeployment goal: "${goal}"`);
      console.log(`Selected tools: ${tools.map(t => t.name).join(', ')}`);
      
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include git and deployment tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames.some(name => name.includes('push') || name.includes('git'))).toBe(true);
    });

    test('should handle complex multi-domain goal', async () => {
      const goal = 'Create a web API, document it in markdown files, and commit everything to git repository';
      const tools = await toolRegistry.getRelevantToolsForGoal(goal);
      
      console.log(`\nMulti-domain goal: "${goal}"`);
      console.log(`Selected tools: ${tools.map(t => t.name).join(', ')}`);
      
      expect(tools.length).toBeGreaterThan(5); // Should have tools from multiple domains
      
      const toolNames = tools.map(t => t.name);
      
      // Should include API tools (HTTP operations)
      expect(toolNames.some(name => name.includes('get') || name.includes('post'))).toBe(true);
      
      // Should include file operations for documentation
      expect(toolNames).toContain('writeFile');
      
      // Should include git operations
      expect(toolNames.some(name => name.includes('commit') || name.includes('git'))).toBe(true);
    });
  });

  describe('Domain Information', () => {
    test('should provide information about available domains', () => {
      const domains = toolRegistry.getAvailableDomains();
      
      console.log(`Available domains: ${domains.join(', ')}`);
      
      expect(domains).toContain('web');
      expect(domains).toContain('files');
      expect(domains).toContain('git');
      expect(domains).toContain('api');
      expect(domains.length).toBeGreaterThan(5);
    });

    test('should provide detailed domain information', () => {
      const webDomain = toolRegistry.getDomainInfo('web');
      
      console.log(`Web domain info:`, webDomain);
      
      expect(webDomain.name).toBe('web');
      expect(webDomain.keywords).toContain('website');
      expect(webDomain.keywords).toContain('html');
      expect(webDomain.tools.length).toBeGreaterThan(0);
      expect(webDomain.available).toBe(true);
    });

    test('should handle unknown domain gracefully', () => {
      const unknownDomain = toolRegistry.getDomainInfo('nonexistent');
      
      expect(unknownDomain.name).toBe('nonexistent');
      expect(unknownDomain.keywords).toEqual([]);
      expect(unknownDomain.tools).toEqual([]);
      expect(unknownDomain.available).toBe(false);
    });
  });

  describe('Performance and Efficiency', () => {
    test('should significantly reduce tool count vs all available tools', async () => {
      const allTools = await toolRegistry.listTools();
      const webTools = await toolRegistry.getToolsForDomains(['web']);
      const fileTools = await toolRegistry.getToolsForDomains(['files']);
      
      console.log(`\nTool count comparison:`);
      console.log(`All available tools: ${allTools.length}`);
      console.log(`Web domain tools: ${webTools.length}`);
      console.log(`Files domain tools: ${fileTools.length}`);
      
      // Domain-specific tools should be significantly fewer than all tools
      expect(webTools.length).toBeLessThan(allTools.length * 0.7); // At least 30% reduction
      expect(fileTools.length).toBeLessThan(allTools.length * 0.7);
      
      // But should still have useful tools
      expect(webTools.length).toBeGreaterThan(0);
      expect(fileTools.length).toBeGreaterThan(0);
    });

    test('should be fast for goal analysis', () => {
      const goals = [
        'Create a website',
        'Process files',
        'Deploy with git',
        'Build API endpoints',
        'Write documentation'
      ];

      const startTime = Date.now();
      
      for (const goal of goals) {
        const domains = toolRegistry.extractDomainsFromGoal(goal);
        expect(domains.length).toBeGreaterThan(0);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`Goal analysis performance: ${totalTime}ms for ${goals.length} goals`);
      console.log(`Average: ${(totalTime / goals.length).toFixed(2)}ms per goal`);
      
      // Should be very fast (under 10ms per goal on average)
      expect(totalTime / goals.length).toBeLessThan(10);
    });
  });
});