import { ProjectManagerCLI } from './project-manager';
import { createInterface } from 'readline';

// Import a real LLM provider (this would be your actual provider)
// For demo purposes, we'll use the mock provider with the test helper
import { MockLLMProvider } from '../../src/core/providers/MockLLMProvider';
import { setupProjectManagerMock } from './test-helpers';

// Initialize the CLI
const mockProvider = new MockLLMProvider();
setupProjectManagerMock(mockProvider);
const cli = new ProjectManagerCLI({ llmProvider: mockProvider });

// Create readline interface for interactive mode
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'project-manager> '
});

// Welcome message
console.log('\n🗂️  Welcome to the Project Manager CLI!');
console.log('\nI can help you manage projects, tasks, and team members.');
console.log('\nTry commands like:');
console.log('  • "Create a new project called Website Redesign"');
console.log('  • "Add task \"Design homepage\""');
console.log('  • "Show all tasks"');
console.log('  • "Assign task to Alice"');
console.log('  • "Show project status"');
console.log('\nType "help" for more commands or "exit" to quit.\n');

// Show prompt
rl.prompt();

// Handle user input
rl.on('line', async (input: string) => {
  const trimmedInput = input.trim();
  
  if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
    console.log('\nGoodbye! 👋\n');
    rl.close();
    process.exit(0);
  }
  
  if (trimmedInput === '') {
    rl.prompt();
    return;
  }
  
  try {
    // Process the input
    const result = await cli.process(trimmedInput);
    console.log('\n' + result.response + '\n');
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    console.log('');
  }
  
  rl.prompt();
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nGoodbye! 👋\n');
  process.exit(0);
});

// Run from command line arguments if provided
if (process.argv.length > 2) {
  const command = process.argv.slice(2).join(' ');
  console.log(`\nExecuting: ${command}\n`);
  
  cli.process(command).then(result => {
    console.log(result.response);
    process.exit(0);
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}