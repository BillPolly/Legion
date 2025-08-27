#!/usr/bin/env node

/**
 * Tool Description Bridge Runner
 * 
 * This script processes a bottom-level task through the tool description bridge
 * to discover and unify tools for the formal planner.
 * 
 * Usage: node scripts/run-bridge.js "task description"
 * Output: Markdown file in results/ directory with full instrumentation
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import { ToolFeasibilityChecker } from '../src/core/informal/ToolFeasibilityChecker.js';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processTaskThroughBridge(taskDescription) {
    console.log('🚀 Tool Description Bridge Runner');
    console.log('=' + '='.repeat(60));
    
    const startTime = Date.now();
    const results = {
        task: taskDescription,
        timestamp: new Date().toISOString(),
        toolDescriptions: null,
        searchResults: [],
        unifiedTools: [],
        processingTime: 0,
        events: []
    };

    try {
        // Initialize dependencies
        console.log('\n📋 Initializing components...');
        const resourceManager = await ResourceManager.getResourceManager();
        
        // Initialize LLM client (prefer Anthropic)
        let llmClient = null;
        const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
        const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
        
        if (anthropicKey) {
            console.log('  Using Anthropic Claude 3.5 Sonnet');
            const anthropic = new Anthropic({ apiKey: anthropicKey });
            llmClient = {
                complete: async (prompt) => {
                    const response = await anthropic.messages.create({
                        model: 'claude-3-5-sonnet-20241022',
                        max_tokens: 2000,
                        temperature: 0.2,
                        messages: [{ role: 'user', content: prompt }]
                    });
                    return response.content[0].text;
                }
            };
        } else if (openaiKey) {
            console.log('  Using OpenAI GPT-4');
            const openai = new OpenAI({ apiKey: openaiKey });
            llmClient = {
                complete: async (prompt) => {
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4-turbo-preview',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.2,
                        max_tokens: 2000
                    });
                    return response.choices[0].message.content;
                }
            };
        } else {
            throw new Error('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
        }
        
        // Initialize ToolRegistry with semantic search
        console.log('  Initializing ToolRegistry...');
        const toolRegistry = await getToolRegistry();
        
        // Test if tools are available
        try {
            const testSearch = await toolRegistry.searchTools('file', { limit: 5 });
            console.log(`  ToolRegistry ready (found ${testSearch.length} file tools)`);
        } catch (error) {
            console.log('  ⚠️  ToolRegistry semantic search not fully configured:', error.message);
        }
        
        // Create ToolFeasibilityChecker with instrumentation
        const checker = new ToolFeasibilityChecker(toolRegistry, llmClient);
        
        // Set up event listeners to capture intermediate results
        checker.on('toolDescriptionsGenerated', (data) => {
            console.log('\n🔧 Tool descriptions generated:');
            data.descriptions.forEach((desc, i) => {
                console.log(`  ${i + 1}. ${desc}`);
            });
            results.toolDescriptions = data.descriptions;
            results.events.push({
                type: 'toolDescriptionsGenerated',
                timestamp: Date.now() - startTime,
                data
            });
        });
        
        checker.on('searchStarted', (query) => {
            console.log(`\n🔍 Searching for: "${query}"`);
            results.events.push({
                type: 'searchStarted',
                timestamp: Date.now() - startTime,
                query
            });
        });
        
        checker.on('searchCompleted', (data) => {
            console.log(`  Found ${data.tools.length} tools (confidence: ${data.maxConfidence?.toFixed(3) || 'N/A'})`);
            results.searchResults.push({
                query: data.query,
                tools: data.tools,
                maxConfidence: data.maxConfidence
            });
            results.events.push({
                type: 'searchCompleted',
                timestamp: Date.now() - startTime,
                data
            });
        });
        
        checker.on('unificationCompleted', (data) => {
            console.log(`\n✅ Unified ${data.unifiedTools.length} unique tools`);
            results.unifiedTools = data.unifiedTools;
            results.events.push({
                type: 'unificationCompleted',
                timestamp: Date.now() - startTime,
                data
            });
        });
        
        // Process the task
        console.log('\n📝 Processing task:');
        console.log(`   "${taskDescription}"`);
        
        const discoveredTools = await checker.discoverToolsWithDescriptions(taskDescription);
        
        results.processingTime = Date.now() - startTime;
        
        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const shortTask = taskDescription.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
        const filename = `bridge-results-${shortTask}-${timestamp}.md`;
        const filepath = path.join(__dirname, '..', 'results', filename);
        
        // Generate markdown report
        const markdown = generateMarkdownReport(results, discoveredTools);
        
        // Save report
        await fs.writeFile(filepath, markdown);
        
        console.log('\n📄 Report saved to:');
        console.log(`   ${filepath}`);
        
        return { filepath, results };
        
    } catch (error) {
        console.error('\n❌ Error processing task:', error.message);
        results.error = error.message;
        throw error;
    }
}

function generateMarkdownReport(results, finalTools) {
    const lines = [];
    
    lines.push('# Tool Description Bridge Results');
    lines.push('');
    lines.push(`**Task:** ${results.task}`);
    lines.push(`**Timestamp:** ${results.timestamp}`);
    lines.push(`**Processing Time:** ${results.processingTime}ms`);
    lines.push('');
    
    // Tool Descriptions Section
    lines.push('## 1. Tool Descriptions Generated');
    lines.push('');
    lines.push('The LLM generated the following tool-focused descriptions from the task:');
    lines.push('');
    if (results.toolDescriptions) {
        results.toolDescriptions.forEach((desc, i) => {
            lines.push(`${i + 1}. ${desc}`);
        });
    } else {
        lines.push('*No descriptions generated*');
    }
    lines.push('');
    
    // Search Results Section
    lines.push('## 2. Semantic Search Results');
    lines.push('');
    lines.push('Each description was used to search for relevant tools:');
    lines.push('');
    
    results.searchResults.forEach((search, i) => {
        lines.push(`### Search ${i + 1}: "${search.query}"`);
        lines.push('');
        
        if (search.tools.length > 0) {
            lines.push('| Tool | Module | Confidence | Description |');
            lines.push('|------|---------|------------|-------------|');
            
            search.tools.slice(0, 5).forEach(tool => {
                const desc = (tool.description || '').slice(0, 60);
                lines.push(`| ${tool.name} | ${tool.module || 'N/A'} | ${tool.confidence?.toFixed(3) || 'N/A'} | ${desc}... |`);
            });
            
            if (search.tools.length > 5) {
                lines.push(`| *...and ${search.tools.length - 5} more* | | | |`);
            }
        } else {
            lines.push('*No tools found for this query*');
        }
        lines.push('');
    });
    
    // Unified Tools Section
    lines.push('## 3. Unified Tool Set');
    lines.push('');
    lines.push('After deduplication and ranking by confidence:');
    lines.push('');
    
    if (finalTools && finalTools.length > 0) {
        lines.push('| Tool | Module | Confidence | Purpose |');
        lines.push('|------|---------|------------|---------|');
        
        finalTools.forEach(tool => {
            const purpose = (tool.description || '').slice(0, 80);
            lines.push(`| **${tool.name}** | ${tool.module || 'N/A'} | ${tool.confidence?.toFixed(3) || 'N/A'} | ${purpose}... |`);
        });
    } else {
        lines.push('*No tools in final set*');
    }
    lines.push('');
    
    // Processing Timeline
    lines.push('## 4. Processing Timeline');
    lines.push('');
    lines.push('| Time (ms) | Event | Details |');
    lines.push('|-----------|-------|---------|');
    
    results.events.forEach(event => {
        let details = '';
        switch(event.type) {
            case 'toolDescriptionsGenerated':
                details = `Generated ${event.data.descriptions.length} descriptions`;
                break;
            case 'searchStarted':
                details = `Query: "${event.query.slice(0, 50)}..."`;
                break;
            case 'searchCompleted':
                details = `Found ${event.data.tools.length} tools`;
                break;
            case 'unificationCompleted':
                details = `Unified to ${event.data.unifiedTools.length} unique tools`;
                break;
            default:
                details = event.type;
        }
        lines.push(`| ${event.timestamp} | ${event.type} | ${details} |`);
    });
    lines.push('');
    
    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Input Task:** ${results.task}`);
    lines.push(`- **Tool Descriptions Generated:** ${results.toolDescriptions ? results.toolDescriptions.length : 0}`);
    lines.push(`- **Total Tools Discovered:** ${results.searchResults.reduce((sum, r) => sum + r.tools.length, 0)}`);
    lines.push(`- **Final Unified Tools:** ${finalTools ? finalTools.length : 0}`);
    lines.push(`- **Processing Time:** ${results.processingTime}ms`);
    
    return lines.join('\n');
}

// Main execution
if (process.argv.length < 3) {
    console.error('Usage: node scripts/run-bridge.js "task description"');
    process.exit(1);
}

const task = process.argv.slice(2).join(' ');
processTaskThroughBridge(task)
    .then(() => {
        console.log('\n✅ Processing complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });