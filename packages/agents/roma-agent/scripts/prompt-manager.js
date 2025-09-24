#!/usr/bin/env node

/**
 * Prompt Manager CLI
 * 
 * Commands:
 * - list: List all available prompts
 * - search <query>: Search prompts by metadata
 * - validate: Validate all prompt files
 * - stats: Show prompt usage statistics
 * - test <path>: Test a specific prompt with sample data
 */

import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.resolve(__dirname, '../prompts');

class PromptManagerCLI {
  constructor() {
    this.registry = new EnhancedPromptRegistry(promptsDir);
  }

  async run() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    try {
      switch (command) {
        case 'list':
          await this.listPrompts();
          break;
        case 'search':
          await this.searchPrompts(args[0]);
          break;
        case 'validate':
          await this.validatePrompts();
          break;
        case 'stats':
          await this.showStats();
          break;
        case 'test':
          await this.testPrompt(args[0]);
          break;
        case 'help':
        default:
          this.showHelp();
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async listPrompts() {
    console.log('📋 Available Prompts\n');
    const prompts = await this.registry.list();
    
    // Group by category
    const grouped = {};
    for (const promptPath of prompts) {
      const metadata = await this.registry.getMetadata(promptPath);
      const category = metadata.category || 'uncategorized';
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      grouped[category].push({
        path: promptPath,
        name: metadata.name,
        description: metadata.description
      });
    }
    
    // Display grouped prompts
    for (const [category, items] of Object.entries(grouped)) {
      console.log(`\n📁 ${category.toUpperCase()}`);
      console.log('─'.repeat(50));
      
      for (const item of items) {
        console.log(`  • ${item.path}`);
        console.log(`    Name: ${item.name}`);
        console.log(`    Desc: ${item.description}`);
      }
    }
    
    console.log(`\n✅ Total: ${prompts.length} prompts`);
  }

  async searchPrompts(query) {
    if (!query) {
      console.error('❌ Please provide a search query');
      return;
    }
    
    console.log(`🔍 Searching for: "${query}"\n`);
    
    const allPrompts = await this.registry.list();
    const matches = [];
    
    for (const promptPath of allPrompts) {
      const metadata = await this.registry.getMetadata(promptPath);
      const template = await this.registry.load(promptPath);
      
      // Search in various fields
      const searchText = [
        promptPath,
        metadata.name,
        metadata.description,
        ...(metadata.tags || []),
        template.content.substring(0, 200)
      ].join(' ').toLowerCase();
      
      if (searchText.includes(query.toLowerCase())) {
        matches.push({
          path: promptPath,
          metadata,
          relevance: this.calculateRelevance(searchText, query)
        });
      }
    }
    
    // Sort by relevance
    matches.sort((a, b) => b.relevance - a.relevance);
    
    // Display results
    if (matches.length === 0) {
      console.log('No matches found');
    } else {
      console.log(`Found ${matches.length} matches:\n`);
      
      for (const match of matches) {
        console.log(`📄 ${match.path}`);
        console.log(`   Name: ${match.metadata.name}`);
        console.log(`   Tags: ${(match.metadata.tags || []).join(', ')}`);
        console.log(`   Relevance: ${Math.round(match.relevance * 100)}%`);
        console.log();
      }
    }
  }

  async validatePrompts() {
    console.log('🔍 Validating All Prompts\n');
    
    const prompts = await this.registry.list();
    let valid = 0;
    let invalid = 0;
    const issues = [];
    
    for (const promptPath of prompts) {
      try {
        const template = await this.registry.load(promptPath);
        const metadata = template.metadata;
        
        // Validation checks
        const errors = [];
        
        if (!metadata.name) {
          errors.push('Missing name in metadata');
        }
        
        if (!metadata.description) {
          errors.push('Missing description in metadata');
        }
        
        if (!metadata.category) {
          errors.push('Missing category in metadata');
        }
        
        if (metadata.variables) {
          // Check if all declared variables are used
          for (const variable of metadata.variables) {
            if (!template.content.includes(`{{${variable}}}`)) {
              errors.push(`Declared variable '${variable}' not used in template`);
            }
          }
        }
        
        // Check for undeclared variables
        const variablePattern = /\{\{([^}]+)\}\}/g;
        let match;
        const foundVars = [];
        
        while ((match = variablePattern.exec(template.content)) !== null) {
          const varName = match[1].trim();
          if (!foundVars.includes(varName)) {
            foundVars.push(varName);
          }
        }
        
        for (const foundVar of foundVars) {
          if (!metadata.variables || !metadata.variables.includes(foundVar)) {
            errors.push(`Variable '${foundVar}' used but not declared in metadata`);
          }
        }
        
        if (errors.length > 0) {
          invalid++;
          issues.push({
            path: promptPath,
            errors
          });
        } else {
          valid++;
          console.log(`✅ ${promptPath}`);
        }
        
      } catch (error) {
        invalid++;
        issues.push({
          path: promptPath,
          errors: [`Failed to load: ${error.message}`]
        });
      }
    }
    
    // Display issues
    if (issues.length > 0) {
      console.log('\n❌ Validation Issues:\n');
      
      for (const issue of issues) {
        console.log(`📄 ${issue.path}`);
        for (const error of issue.errors) {
          console.log(`   • ${error}`);
        }
        console.log();
      }
    }
    
    // Summary
    console.log('─'.repeat(50));
    console.log(`✅ Valid: ${valid}`);
    console.log(`❌ Invalid: ${invalid}`);
    console.log(`📊 Total: ${prompts.length}`);
  }

  async showStats() {
    console.log('📊 Prompt Statistics\n');
    
    const stats = await this.registry.getStats();
    const prompts = await this.registry.list();
    
    // Count by category
    const categories = {};
    const responseFormats = {};
    let totalVariables = 0;
    let totalLines = 0;
    let totalWords = 0;
    
    for (const promptPath of prompts) {
      const metadata = await this.registry.getMetadata(promptPath);
      
      // Category stats
      const category = metadata.category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
      
      // Response format stats
      const format = metadata.responseFormat || 'text';
      responseFormats[format] = (responseFormats[format] || 0) + 1;
      
      // Variable stats
      if (metadata.variables) {
        totalVariables += metadata.variables.length;
      }
      
      // Content stats
      totalLines += metadata.lineCount || 0;
      totalWords += metadata.wordCount || 0;
    }
    
    // Display stats
    console.log('📁 Categories:');
    for (const [category, count] of Object.entries(categories)) {
      console.log(`  • ${category}: ${count} prompts`);
    }
    
    console.log('\n📝 Response Formats:');
    for (const [format, count] of Object.entries(responseFormats)) {
      console.log(`  • ${format}: ${count} prompts`);
    }
    
    console.log('\n📊 Content Statistics:');
    console.log(`  • Total prompts: ${prompts.length}`);
    console.log(`  • Total variables: ${totalVariables}`);
    console.log(`  • Average lines: ${Math.round(totalLines / prompts.length)}`);
    console.log(`  • Average words: ${Math.round(totalWords / prompts.length)}`);
    
    console.log('\n🔄 Runtime Statistics:');
    console.log(`  • Cache hits: ${stats.hits}`);
    console.log(`  • Cache misses: ${stats.misses}`);
    console.log(`  • Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`  • Cache size: ${stats.cacheSize}`);
    console.log(`  • Total loads: ${stats.loads}`);
    console.log(`  • Total errors: ${stats.errors}`);
  }

  async testPrompt(promptPath) {
    if (!promptPath) {
      console.error('❌ Please provide a prompt path');
      return;
    }
    
    console.log(`🧪 Testing Prompt: ${promptPath}\n`);
    
    try {
      // Load prompt
      const template = await this.registry.load(promptPath);
      const metadata = template.metadata;
      
      console.log('📋 Metadata:');
      console.log(`  Name: ${metadata.name}`);
      console.log(`  Description: ${metadata.description}`);
      console.log(`  Category: ${metadata.category}`);
      console.log(`  Tags: ${(metadata.tags || []).join(', ')}`);
      console.log(`  Variables: ${(metadata.variables || []).join(', ')}`);
      console.log(`  Response Format: ${metadata.responseFormat || 'text'}`);
      
      console.log('\n📝 Template Content:');
      console.log('─'.repeat(50));
      console.log(template.content.substring(0, 500));
      if (template.content.length > 500) {
        console.log('... [truncated]');
      }
      console.log('─'.repeat(50));
      
      // Test with sample variables
      if (metadata.variables && metadata.variables.length > 0) {
        console.log('\n🔧 Testing Variable Substitution:');
        
        const testVars = {};
        for (const varName of metadata.variables) {
          testVars[varName] = `[SAMPLE_${varName.toUpperCase()}]`;
        }
        
        const filled = await this.registry.fill(promptPath, testVars);
        
        console.log('\n📄 Filled Template (first 500 chars):');
        console.log('─'.repeat(50));
        console.log(filled.substring(0, 500));
        if (filled.length > 500) {
          console.log('... [truncated]');
        }
        console.log('─'.repeat(50));
        
        // Verify substitution
        let allSubstituted = true;
        for (const varName of metadata.variables) {
          if (filled.includes(`{{${varName}}}`)) {
            console.log(`❌ Variable '${varName}' was not substituted`);
            allSubstituted = false;
          }
        }
        
        if (allSubstituted) {
          console.log('\n✅ All variables substituted successfully');
        }
      }
      
      // Test with LLM if requested
      if (process.argv.includes('--llm')) {
        console.log('\n🤖 Testing with LLM...');
        
        const resourceManager = await ResourceManager.getInstance();
        const llmClient = await resourceManager.get('llmClient');
        
        // Fill with sample data
        const sampleVars = {};
        if (metadata.variables) {
          for (const varName of metadata.variables) {
            sampleVars[varName] = this.getSampleValue(varName);
          }
        }
        
        const filledTemplate = await this.registry.fill(promptPath, sampleVars);
        
        // Create a simple TemplatedPrompt for testing
        const { TemplatedPrompt } = await import('@legion/prompting-manager');
        const testPrompt = new TemplatedPrompt({
          prompt: filledTemplate,
          responseSchema: { type: 'string' }, // Simple string response for testing
          examples: ['Sample response text'],
          llmClient,
          maxRetries: 1
        });
        
        const result = await testPrompt.execute({});
        const response = result.success ? result.data : `Error: ${result.errors?.join(', ')}`;
        
        console.log('\n📤 LLM Response:');
        console.log('─'.repeat(50));
        console.log(response.substring(0, 1000));
        if (response.length > 1000) {
          console.log('... [truncated]');
        }
        console.log('─'.repeat(50));
      }
      
    } catch (error) {
      console.error(`❌ Failed to test prompt: ${error.message}`);
    }
  }

  calculateRelevance(text, query) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower.includes(queryLower)) {
      return 1.0;
    }
    
    // Word match
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    
    let matches = 0;
    for (const qWord of queryWords) {
      if (textWords.some(tWord => tWord.includes(qWord))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  getSampleValue(varName) {
    // Provide sensible sample values based on variable name
    const samples = {
      requirements: 'Create a simple REST API with user authentication',
      taskDescription: 'Build a file processing utility',
      code: 'function example() { return "test"; }',
      error: 'TypeError: Cannot read property "x" of undefined',
      context: 'Working on a Node.js project',
      minDescriptions: '5',
      maxDescriptions: '10'
    };
    
    return samples[varName] || `[SAMPLE_${varName.toUpperCase()}]`;
  }

  showHelp() {
    console.log(`
📚 Prompt Manager CLI

Usage: node prompt-manager.js <command> [options]

Commands:
  list              List all available prompts grouped by category
  search <query>    Search prompts by name, tags, or content
  validate          Validate all prompt files for correctness
  stats             Show prompt usage and cache statistics
  test <path>       Test a specific prompt with sample data
                    Add --llm flag to test with actual LLM
  help              Show this help message

Examples:
  node prompt-manager.js list
  node prompt-manager.js search "requirements"
  node prompt-manager.js validate
  node prompt-manager.js test coding/requirements/analyze
  node prompt-manager.js test coding/requirements/analyze --llm
`);
  }
}

// Run CLI
const cli = new PromptManagerCLI();
cli.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});