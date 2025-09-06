#!/usr/bin/env node

/**
 * Simple Demo Runner for Knowledge Graph System
 * 
 * This script provides a command-line interface to run all available examples
 * without external dependencies, using only built-in Node.js modules.
 */

import { createInterface } from 'readline';
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
    id: '1',
    name: 'Comprehensive System Demo',
    description: 'Complete demonstration of all KG features including relationships, beliefs, tools, and exports',
    category: 'Complete',
    difficulty: 'Advanced',
    estimatedTime: '2-3 minutes',
    function: comprehensiveExample
  },
  {
    id: '2',
    name: 'Full Round-Trip Example',
    description: 'JavaScript objects → KG → RDF → KG → JavaScript objects',
    category: 'Core',
    difficulty: 'Intermediate',
    estimatedTime: '1-2 minutes',
    function: fullRoundTripExample
  },
  {
    id: '3',
    name: 'Relationship Reification Demo',
    description: 'Advanced relationship modeling with metadata and temporal information',
    category: 'Relationships',
    difficulty: 'Intermediate',
    estimatedTime: '30 seconds',
    function: relationshipReificationExample
  },
  {
    id: '4',
    name: 'Agent Belief System Demo',
    description: 'Multi-agent knowledge representation with confidence and provenance',
    category: 'Beliefs',
    difficulty: 'Advanced',
    estimatedTime: '30 seconds',
    function: beliefSystemExample
  },
  {
    id: '5',
    name: 'RDF Import/Export Demo',
    description: 'Parse Turtle, N-Triples, JSON-LD and other RDF formats',
    category: 'RDF',
    difficulty: 'Beginner',
    estimatedTime: '30 seconds',
    function: testRDFParsing
  },
  {
    id: '6',
    name: 'Storage Abstraction Demo',
    description: 'Pluggable storage backends and async/sync API compatibility',
    category: 'Storage',
    difficulty: 'Intermediate',
    estimatedTime: '1 minute',
    function: storageAbstractionExample
  },
  {
    id: '7',
    name: 'Storage Configuration Demo',
    description: 'Storage provider configuration and validation',
    category: 'Storage',
    difficulty: 'Beginner',
    estimatedTime: '30 seconds',
    function: demonstrateStorageConfiguration
  }
];

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Utility functions
function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function printHeader() {
  console.clear();
  console.log(colorize('╔══════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║           JavaScript Knowledge Graph System                  ║', 'cyan'));
  console.log(colorize('║                    Demo Runner                               ║', 'cyan'));
  console.log(colorize('╚══════════════════════════════════════════════════════════════╝', 'cyan'));
  console.log();
}

function printDemoInfo(demo) {
  console.log(colorize(`\n📋 ${demo.name}`, 'yellow'));
  console.log(colorize(`   ${demo.description}`, 'gray'));
  console.log(colorize(`   Category: ${demo.category} | Difficulty: ${demo.difficulty} | Time: ${demo.estimatedTime}`, 'blue'));
  console.log(colorize('   ─'.repeat(60), 'gray'));
}

function printSeparator() {
  console.log(colorize('\n' + '═'.repeat(60) + '\n', 'gray'));
}

async function runDemo(demo) {
  printDemoInfo(demo);
  
  const startTime = performance.now();
  
  try {
    console.log(colorize('🚀 Starting demo...\n', 'green'));
    
    const result = await demo.function();
    
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(colorize(`\n✅ Demo completed successfully in ${duration}s`, 'green'));
    
    if (result && typeof result === 'object') {
      console.log(colorize('\n📊 Demo Results Summary:', 'gray'));
      if (result.kg && typeof result.kg.size === 'function') {
        try {
          const size = await result.kg.size();
          console.log(colorize(`   • Total triples: ${size}`, 'gray'));
        } catch (e) {
          // Ignore size errors
        }
      }
      if (result.objects) {
        console.log(colorize(`   • Objects created: ${Object.keys(result.objects).length}`, 'gray'));
      }
      if (result.relationships) {
        console.log(colorize(`   • Relationships: ${Object.keys(result.relationships).length}`, 'gray'));
      }
      if (result.exports) {
        console.log(colorize(`   • Export formats: ${Object.keys(result.exports).length}`, 'gray'));
      }
    }
    
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(colorize(`\n❌ Demo failed after ${duration}s`, 'red'));
    console.log(colorize(`Error: ${error.message}`, 'red'));
    
    if (process.env.DEBUG) {
      console.log(colorize('\nStack trace:', 'gray'));
      console.log(colorize(error.stack, 'gray'));
    }
  }
  
  printSeparator();
}

async function runAllDemos() {
  console.log(colorize('🎯 Running all demos in sequence...\n', 'yellow'));
  
  const totalStartTime = performance.now();
  let successCount = 0;
  let failureCount = 0;
  
  for (const demo of DEMOS) {
    console.log(colorize(`\n[${successCount + failureCount + 1}/${DEMOS.length}] ${demo.name}`, 'cyan'));
    
    try {
      await runDemo(demo);
      successCount++;
    } catch (error) {
      failureCount++;
      console.log(colorize(`Failed: ${error.message}`, 'red'));
    }
    
    // Small delay between demos for readability
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const totalEndTime = performance.now();
  const totalDuration = ((totalEndTime - totalStartTime) / 1000).toFixed(2);
  
  console.log(colorize('\n📈 All Demos Summary:', 'yellow'));
  console.log(colorize(`✅ Successful: ${successCount}`, 'green'));
  console.log(colorize(`❌ Failed: ${failureCount}`, 'red'));
  console.log(colorize(`⏱️  Total time: ${totalDuration}s`, 'blue'));
  
  printSeparator();
}

function printDemoList() {
  console.log(colorize('📚 Available Demos:\n', 'yellow'));
  
  const categories = {};
  DEMOS.forEach(demo => {
    if (!categories[demo.category]) {
      categories[demo.category] = [];
    }
    categories[demo.category].push(demo);
  });
  
  Object.entries(categories).forEach(([category, demos]) => {
    console.log(colorize(`${category}:`, 'cyan'));
    demos.forEach((demo) => {
      const difficultyColor = demo.difficulty === 'Beginner' ? 'green' : 
                             demo.difficulty === 'Intermediate' ? 'yellow' : 'red';
      console.log(`  ${demo.id}. ${colorize(demo.name, 'white')} ${colorize(`[${demo.difficulty}]`, difficultyColor)}`);
      console.log(`     ${colorize(demo.description, 'gray')}`);
      console.log(`     ${colorize(`⏱️  ${demo.estimatedTime}`, 'blue')}`);
    });
    console.log();
  });
}

function printMenu() {
  console.log(colorize('Choose an option:', 'yellow'));
  console.log(colorize('  a) Run All Demos', 'white'));
  console.log(colorize('  1-7) Run Individual Demo', 'white'));
  console.log(colorize('  d) Show Demo Details', 'white'));
  console.log(colorize('  h) Show Help', 'white'));
  console.log(colorize('  q) Quit', 'white'));
  console.log();
}

function showHelp() {
  console.log(colorize('\n📖 Help:', 'yellow'));
  console.log(colorize('  • Enter a number (1-7) to run a specific demo', 'gray'));
  console.log(colorize('  • Enter "a" to run all demos sequentially', 'gray'));
  console.log(colorize('  • Enter "d" to see detailed information about all demos', 'gray'));
  console.log(colorize('  • Enter "h" to show this help message', 'gray'));
  console.log(colorize('  • Enter "q" to quit the demo runner', 'gray'));
  console.log(colorize('  • Use Ctrl+C to exit at any time', 'gray'));
  console.log();
}

function showDemoDetails() {
  console.log(colorize('\n📋 Demo Details:\n', 'yellow'));
  
  DEMOS.forEach((demo, index) => {
    console.log(colorize(`${demo.id}. ${demo.name}`, 'cyan'));
    console.log(`   ${colorize('Description:', 'gray')} ${demo.description}`);
    console.log(`   ${colorize('Category:', 'gray')} ${demo.category}`);
    console.log(`   ${colorize('Difficulty:', 'gray')} ${demo.difficulty}`);
    console.log(`   ${colorize('Estimated Time:', 'gray')} ${demo.estimatedTime}`);
    console.log();
  });
}

async function getUserInput(prompt) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function confirmRunAll() {
  const answer = await getUserInput(colorize(`This will run all ${DEMOS.length} demos sequentially. This may take several minutes. Continue? (y/N): `, 'yellow'));
  return answer === 'y' || answer === 'yes';
}

async function main() {
  console.log(colorize('Welcome to the Knowledge Graph System Demo Runner!\n', 'green'));
  
  while (true) {
    try {
      printHeader();
      printDemoList();
      printMenu();
      
      const choice = await getUserInput(colorize('Enter your choice: ', 'cyan'));
      
      if (choice === 'q' || choice === 'quit' || choice === 'exit') {
        console.log(colorize('\n👋 Thanks for exploring the Knowledge Graph System!', 'green'));
        console.log(colorize('Visit our documentation for more information.', 'gray'));
        break;
      }
      
      if (choice === 'a' || choice === 'all') {
        const confirmed = await confirmRunAll();
        if (confirmed) {
          await runAllDemos();
          const continueChoice = await getUserInput(colorize('Press Enter to return to menu or "q" to quit: ', 'cyan'));
          if (continueChoice === 'q') break;
        }
        continue;
      }
      
      if (choice === 'd' || choice === 'details') {
        showDemoDetails();
        await getUserInput(colorize('Press Enter to return to menu: ', 'cyan'));
        continue;
      }
      
      if (choice === 'h' || choice === 'help') {
        showHelp();
        await getUserInput(colorize('Press Enter to return to menu: ', 'cyan'));
        continue;
      }
      
      // Check if it's a demo number
      const demo = DEMOS.find(d => d.id === choice);
      if (demo) {
        await runDemo(demo);
        
        const runAnother = await getUserInput(colorize('Run another demo? (Y/n): ', 'cyan'));
        if (runAnother === 'n' || runAnother === 'no') {
          console.log(colorize('\n👋 Thanks for exploring the Knowledge Graph System!', 'green'));
          break;
        }
        continue;
      }
      
      console.log(colorize(`\n❌ Invalid choice: "${choice}". Please try again.`, 'red'));
      await getUserInput(colorize('Press Enter to continue: ', 'cyan'));
      
    } catch (error) {
      if (error.code === 'SIGINT') {
        console.log(colorize('\n\n👋 Demo runner interrupted. Goodbye!', 'yellow'));
        break;
      }
      
      console.log(colorize('\n❌ An error occurred:', 'red'), error.message);
      
      const retry = await getUserInput(colorize('Try again? (Y/n): ', 'cyan'));
      if (retry === 'n' || retry === 'no') {
        break;
      }
    }
  }
  
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Demo runner interrupted. Goodbye!', 'yellow'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n👋 Demo runner terminated. Goodbye!', 'yellow'));
  process.exit(0);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(colorize('\n❌ Fatal error:', 'red'), error);
    process.exit(1);
  });
}

export { main as runSimpleDemoRunner, DEMOS };
