#!/usr/bin/env node

/**
 * Enhanced Tool Description Bridge Runner with Relevance Judgment
 * 
 * This script processes a bottom-level task through the tool description bridge,
 * discovers tools, and then judges their relevance using LLM.
 * 
 * Usage: node scripts/run-bridge-with-judgment.js "task description"
 * Output: Enhanced markdown file with judgment results
 */

import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import { ToolFeasibilityChecker } from '../src/core/informal/ToolFeasibilityChecker.js';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processTaskWithJudgment(taskDescription) {
    console.log('🚀 Enhanced Tool Description Bridge Runner');
    console.log('=' + '='.repeat(60));
    
    const startTime = Date.now();
    const results = {
        task: taskDescription,
        timestamp: new Date().toISOString(),
        toolDescriptions: null,
        searchResults: [],
        allTools: [],
        relevantTools: [],
        irrelevantTools: [],
        judgment: null,
        processingTime: 0,
        events: []
    };

    try {
        // Initialize dependencies
        console.log('\n📋 Initializing components...');
        const resourceManager = await ResourceManager.getResourceManager();
        
        // Initialize LLM client
        let llmClient = null;
        const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
        const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
        
        if (anthropicKey) {
            console.log('  Using Anthropic Claude 3.5 Sonnet');
            // Use ResourceManager to create LLM client
            llmClient = await resourceManager.get('llmClient');
        } else if (openaiKey) {
            console.log('  Using OpenAI GPT-4');
            llmClient = await resourceManager.createLLMClient({
                provider: 'openai',
                model: 'gpt-4',
                maxTokens: 2000,
                temperature: 0.2
            });
        } else {
            throw new Error('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
        }
        
        // Initialize ToolRegistry
        console.log('  Initializing ToolRegistry...');
        const toolRegistry = await getToolRegistry();
        
        // Create ToolFeasibilityChecker with instrumentation
        const checker = new ToolFeasibilityChecker(toolRegistry, llmClient);
        
        // Set up event listeners
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
            results.allTools = data.unifiedTools;
            results.events.push({
                type: 'unificationCompleted',
                timestamp: Date.now() - startTime,
                data
            });
        });
        
        checker.on('toolsJudged', (data) => {
            console.log(`\n⚖️  Judgment complete:`);
            console.log(`  Relevant: ${data.relevant.length} tools`);
            console.log(`  Irrelevant: ${data.irrelevant.length} tools`);
            if (data.judgment.suggestedApproach) {
                console.log(`  💡 Suggested: ${data.judgment.suggestedApproach}`);
            }
            results.events.push({
                type: 'toolsJudged',
                timestamp: Date.now() - startTime,
                data
            });
        });
        
        // Process the task with judgment
        console.log('\n📝 Processing task:');
        console.log(`   "${taskDescription}"`);
        
        const discoveryResult = await checker.discoverToolsWithDescriptions(taskDescription, true);
        
        results.allTools = discoveryResult.allTools;
        results.relevantTools = discoveryResult.relevant;
        results.irrelevantTools = discoveryResult.irrelevant;
        results.judgment = {
            feedback: discoveryResult.feedback,
            suggestedApproach: discoveryResult.suggestedApproach,
            needsCodeGeneration: discoveryResult.needsCodeGeneration
        };
        
        results.processingTime = Date.now() - startTime;
        
        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const shortTask = taskDescription.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
        const filename = `bridge-judgment-${shortTask}-${timestamp}.md`;
        const filepath = path.join(__dirname, '..', 'results', filename);
        
        // Generate enhanced markdown report
        const markdown = generateEnhancedReport(results);
        
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

function generateEnhancedReport(results) {
    const lines = [];
    
    lines.push('# Enhanced Tool Description Bridge Results with Judgment');
    lines.push('');
    lines.push(`**Task:** ${results.task}`);
    lines.push(`**Timestamp:** ${results.timestamp}`);
    lines.push(`**Processing Time:** ${results.processingTime}ms`);
    lines.push('');
    
    // Tool Descriptions Section
    lines.push('## 1. Tool Descriptions Generated');
    lines.push('');
    lines.push('The LLM generated the following tool-focused descriptions:');
    lines.push('');
    if (results.toolDescriptions) {
        results.toolDescriptions.forEach((desc, i) => {
            lines.push(`${i + 1}. ${desc}`);
        });
    }
    lines.push('');
    
    // All Discovered Tools
    lines.push('## 2. All Discovered Tools');
    lines.push('');
    if (results.allTools && results.allTools.length > 0) {
        lines.push('| Tool | Confidence | Description |');
        lines.push('|------|------------|-------------|');
        results.allTools.forEach(tool => {
            const desc = (tool.description || '').slice(0, 80);
            lines.push(`| ${tool.name} | ${tool.confidence?.toFixed(3) || 'N/A'} | ${desc}... |`);
        });
    } else {
        lines.push('*No tools discovered*');
    }
    lines.push('');
    
    // Relevance Judgment Section
    lines.push('## 3. Relevance Judgment');
    lines.push('');
    
    if (results.judgment) {
        // Suggested Approach
        if (results.judgment.suggestedApproach) {
            lines.push('### 💡 Suggested Approach');
            lines.push('');
            lines.push(results.judgment.suggestedApproach);
            lines.push('');
        }
        
        if (results.judgment.needsCodeGeneration) {
            lines.push('### ⚠️ Code Generation Required');
            lines.push('');
            lines.push('This task requires generating code using libraries rather than using existing tools.');
            lines.push('');
        }
        
        // Relevant Tools
        lines.push('### ✅ Relevant Tools');
        lines.push('');
        if (results.relevantTools && results.relevantTools.length > 0) {
            lines.push('| Tool | Purpose |');
            lines.push('|------|---------|');
            results.relevantTools.forEach(tool => {
                lines.push(`| **${tool.name}** | ${tool.description} |`);
            });
        } else {
            lines.push('*No tools deemed relevant for this task*');
        }
        lines.push('');
        
        // Irrelevant Tools
        lines.push('### ❌ Irrelevant Tools');
        lines.push('');
        if (results.irrelevantTools && results.irrelevantTools.length > 0) {
            lines.push('| Tool | Reason |');
            lines.push('|------|--------|');
            results.irrelevantTools.forEach(tool => {
                const reason = results.judgment.feedback[tool.name] || 'Not suitable for task';
                lines.push(`| ${tool.name} | ${reason} |`);
            });
        } else {
            lines.push('*All discovered tools are relevant*');
        }
        lines.push('');
    }
    
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
                details = `Query: "${event.query.slice(0, 40)}..."`;
                break;
            case 'searchCompleted':
                details = `Found ${event.data.tools.length} tools`;
                break;
            case 'unificationCompleted':
                details = `Unified to ${event.data.unifiedTools.length} unique tools`;
                break;
            case 'toolsJudged':
                details = `${event.data.relevant.length} relevant, ${event.data.irrelevant.length} irrelevant`;
                break;
            default:
                details = event.type;
        }
        lines.push(`| ${event.timestamp} | ${event.type} | ${details} |`);
    });
    lines.push('');
    
    // Summary and Recommendations
    lines.push('## Summary and Recommendations');
    lines.push('');
    lines.push(`- **Input Task:** ${results.task}`);
    lines.push(`- **Tool Descriptions Generated:** ${results.toolDescriptions ? results.toolDescriptions.length : 0}`);
    lines.push(`- **Total Tools Discovered:** ${results.allTools ? results.allTools.length : 0}`);
    lines.push(`- **Relevant Tools:** ${results.relevantTools ? results.relevantTools.length : 0}`);
    lines.push(`- **Irrelevant Tools:** ${results.irrelevantTools ? results.irrelevantTools.length : 0}`);
    
    if (results.judgment?.needsCodeGeneration) {
        lines.push('');
        lines.push('### 🔧 Recommendation');
        lines.push('');
        lines.push('This task requires a **code generation tool** that can:');
        lines.push('- Generate JavaScript/TypeScript code');
        lines.push('- Use appropriate libraries (Express, bcrypt, jsonwebtoken, etc.)');
        lines.push('- Follow best practices and patterns');
        lines.push('- Handle the specific requirements of the task');
    }
    
    return lines.join('\n');
}

// Main execution
if (process.argv.length < 3) {
    console.error('Usage: node scripts/run-bridge-with-judgment.js "task description"');
    process.exit(1);
}

const task = process.argv.slice(2).join(' ');
processTaskWithJudgment(task)
    .then(() => {
        console.log('\n✅ Processing complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });