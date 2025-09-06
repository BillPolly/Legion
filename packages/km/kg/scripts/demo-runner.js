#!/usr/bin/env node

/**
 * Interactive Demo Runner for Knowledge Graph System
 * 
 * This script provides a menu-driven interface to run all available examples
 * and demonstrations of the Knowledge Graph system capabilities.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Import all available examples
import {
  fullRoundTripExample,
  testRDFParsing,
  comprehensiveExample,
  relationshipReificationExample,
  beliefSystemExample
} from '../src/examples/usage-examples.js';

import {
  storageAbstractionExample,
  demonstrateStorageConfiguration
} from '../src/examples/storage-example.js';

// Demo configuration
const DEMOS = [
  {
    id: 'comprehensive',
    name: 'Comprehensive System Demo',
    description: 'Complete demonstration of all KG features including relationships, beliefs, tools, and exports',
    category: 'Complete',
    difficulty: 'Advanced',
    estimatedTime: '2-3 minutes',
    function: comprehensiveExample
  },
  {
    id: 'roundtrip',
    name: 'Full Round-Trip Example',
    description: 'JavaScript objects → KG → RDF → KG → JavaScript objects',
    category: 'Core',
    difficulty: 'Intermediate',
    estimatedTime: '1-2 minutes',
    function: fullRoundTripExample
  },
  {
    id: 'relationships',
    name: 'Relationship Reification Demo',
    description: 'Advanced relationship modeling with metadata and temporal information',
    category: 'Relationships',
    difficulty: 'Intermediate',
    estimatedTime: '30 seconds',
    function: relationshipReificationExample
  },
  {
    id: 'beliefs',
    name: 'Agent Belief System Demo',
    description: 'Multi-agent knowledge representation with confidence and provenance',
    category: 'Beliefs',
    difficulty: 'Advanced',
    estimatedTime: '30 seconds',
    function: beliefSystemExample
  },
  {
    id: 'rdf-parsing',
    name: 'RDF Import/Export Demo',
    description: 'Parse Turtle, N-Triples, JSON-LD and other RDF formats',
    category: 'RDF',
    difficulty: 'Beginner',
    estimatedTime: '30 seconds',
    function: testRDFParsing
  },
  {
    id: 'storage',
    name: 'Storage Abstraction Demo',
    description: 'Pluggable storage backends and async/sync API compatibility',
    category: 'Storage',
    difficulty: 'Intermediate',
    estimatedTime: '1 minute',
    function: storageAbstractionExample
  },
  {
    id: 'storage-config',
    name: 'Storage Configuration Demo',
    description: 'Storage provider configuration and validation',
    category: 'Storage',
    difficulty: 'Beginner',
    estimatedTime: '30 seconds',
    function: demonstrateStorageConfiguration
  }
];

// Utility functions
function printHeader() {
  console.clear();
  console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║           JavaScript Knowledge Graph System                  ║'));
  console.log(chalk.cyan.bold('║                    Demo Runner                               ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
  console.log();
}

function printDemoInfo(demo) {
  console.log(chalk.yellow.bold(`\n📋 ${demo.name}`));
  console.log(chalk.gray(`   ${demo.description}`));
  console.log(chalk.blue(`   Category: ${demo.category} | Difficulty: ${demo.difficulty} | Time: ${demo.estimatedTime}`));
  console.log(chalk.gray('   ─'.repeat(60)));
}

function printSeparator() {
  console.log(chalk.gray('\n' + '═'.repeat(60) + '\n'));
}

async function runDemo(demo) {
  printDemoInfo(demo);
  
  const startTime = performance.now();
  
  try {
    console.log(chalk.green('🚀 Starting demo...\n'));
    
    const result = await demo.function();
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(chalk.green.bold(`\n✅ Demo completed successfully in ${duration}s`));
    
    if (result && typeof result === 'object') {
      console.log(chalk.gray('\n📊 Demo Results Summary:'));
      if (result.kg) {
        const size = await result.kg.size();
        console.log(chalk.gray(`   • Total triples: ${size}`));
      }
      if (result.objects) {
        console.log(chalk.gray(`   • Objects created: ${Object.keys(result.objects).length}`));
      }
      if (result.relationships) {
        console.log(chalk.gray(`   • Relationships: ${Object.keys(result.relationships).length}`));
      }
      if (result.exports) {
        console.log(chalk.gray(`   • Export formats: ${Object.keys(result.exports).length}`));
      }
    }
    
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(chalk.red.bold(`\n❌ Demo failed after ${duration}s`));
    console.log(chalk.red(`Error: ${error.message}`));
    
    if (error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }
  }
  
  printSeparator();
}

async function runAllDemos() {
  console.log(chalk.yellow.bold('🎯 Running all demos in sequence...\n'));
  
  const totalStartTime = performance.now();
  let successCount = 0;
  let failureCount = 0;
  
  for (const demo of DEMOS) {
    console.log(chalk.cyan(`\n[${successCount + failureCount + 1}/${DEMOS.length}] ${demo.name}`));
    
    try {
      await runDemo(demo);
      successCount++;
    } catch (error) {
      failureCount++;
      console.log(chalk.red(`Failed: ${error.message}`));
    }
    
    // Small delay between demos for readability
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const totalEndTime = performance.now();
  const totalDuration = ((totalEndTime - totalStartTime) / 1000).toFixed(2);
  
  console.log(chalk.yellow.bold('\n📈 All Demos Summary:'));
  console.log(chalk.green(`✅ Successful: ${successCount}`));
  console.log(chalk.red(`❌ Failed: ${failureCount}`));
  console.log(chalk.blue(`⏱️  Total time: ${totalDuration}s`));
  
  printSeparator();
}

function getDemosByCategory() {
  const categories = {};
  DEMOS.forEach(demo => {
    if (!categories[demo.category]) {
      categories[demo.category] = [];
    }
    categories[demo.category].push(demo);
  });
  return categories;
}

function printDemoList() {
  console.log(chalk.yellow.bold('📚 Available Demos:\n'));
  
  const categories = getDemosByCategory();
  
  Object.entries(categories).forEach(([category, demos]) => {
    console.log(chalk.cyan.bold(`${category}:`));
    demos.forEach((demo, index) => {
      const difficultyColor = demo.difficulty === 'Beginner' ? chalk.green : 
                             demo.difficulty === 'Intermediate' ? chalk.yellow : chalk.red;
      console.log(`  ${index + 1}. ${chalk.white.bold(demo.name)} ${difficultyColor(`[${demo.difficulty}]`)}`);
      console.log(`     ${chalk.gray(demo.description)}`);
      console.log(`     ${chalk.blue(`⏱️  ${demo.estimatedTime}`)}`);
    });
    console.log();
  });
}

async function showMainMenu() {
  printHeader();
  printDemoList();
  
  const choices = [
    { name: '🎯 Run All Demos', value: 'all' },
    new inquirer.Separator('─── Individual Demos ───'),
    ...DEMOS.map(demo => ({
      name: `${demo.name} ${chalk.gray(`[${demo.difficulty}]`)}`,
      value: demo.id,
      short: demo.name
    })),
    new inquirer.Separator('─── Other Options ───'),
    { name: '📋 Show Demo Details', value: 'details' },
    { name: '🚪 Exit', value: 'exit' }
  ];
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      pageSize: 15
    }
  ]);
  
  return action;
}

async function showDemoDetails() {
  console.log(chalk.yellow.bold('\n📋 Demo Details:\n'));
  
  DEMOS.forEach((demo, index) => {
    console.log(chalk.cyan.bold(`${index + 1}. ${demo.name}`));
    console.log(`   ${chalk.gray('Description:')} ${demo.description}`);
    console.log(`   ${chalk.gray('Category:')} ${demo.category}`);
    console.log(`   ${chalk.gray('Difficulty:')} ${demo.difficulty}`);
    console.log(`   ${chalk.gray('Estimated Time:')} ${demo.estimatedTime}`);
    console.log();
  });
  
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to return to main menu...'
    }
  ]);
}

async function confirmRunAll() {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `This will run all ${DEMOS.length} demos sequentially. This may take several minutes. Continue?`,
      default: true
    }
  ]);
  
  return confirm;
}

async function main() {
  console.log(chalk.green('Welcome to the Knowledge Graph System Demo Runner!\n'));
  
  while (true) {
    try {
      const action = await showMainMenu();
      
      if (action === 'exit') {
        console.log(chalk.green('\n👋 Thanks for exploring the Knowledge Graph System!'));
        console.log(chalk.gray('Visit our documentation for more information.'));
        break;
      }
      
      if (action === 'all') {
        const confirmed = await confirmRunAll();
        if (confirmed) {
          await runAllDemos();
        }
        continue;
      }
      
      if (action === 'details') {
        await showDemoDetails();
        continue;
      }
      
      // Run individual demo
      const demo = DEMOS.find(d => d.id === action);
      if (demo) {
        await runDemo(demo);
        
        const { runAnother } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'runAnother',
            message: 'Would you like to run another demo?',
            default: true
          }
        ]);
        
        if (!runAnother) {
          console.log(chalk.green('\n👋 Thanks for exploring the Knowledge Graph System!'));
          break;
        }
      }
      
    } catch (error) {
      if (error.name === 'ExitPromptError') {
        console.log(chalk.yellow('\n👋 Demo runner interrupted. Goodbye!'));
        break;
      }
      
      console.log(chalk.red('\n❌ An error occurred:'), error.message);
      
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to try again?',
          default: true
        }
      ]);
      
      if (!retry) {
        break;
      }
    }
  }
  
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Demo runner interrupted. Goodbye!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n👋 Demo runner terminated. Goodbye!'));
  process.exit(0);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  });
}

export { main as runDemoRunner, DEMOS };
