// Debug script to trace CLI write command execution
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function debugCLI() {
  console.log('Starting CLI in debug mode...\n');
  
  const cli = spawn('node', ['packages/cli/src/index.js', 'interactive'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  cli.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data);
  });
  
  cli.stderr.on('data', (data) => {
    errorOutput += data.toString();
    process.stderr.write(data);
  });
  
  // Wait for CLI to start
  await setTimeout(1000);
  
  // Send write command
  console.log('\n>>> Sending: write debug-test.txt hello world\n');
  cli.stdin.write('write debug-test.txt hello world\n');
  
  // Wait for processing
  await setTimeout(1000);
  
  // Try to read the file
  console.log('\n>>> Sending: read debug-test.txt\n');
  cli.stdin.write('read debug-test.txt\n');
  
  // Wait and exit
  await setTimeout(1000);
  cli.stdin.write('exit\n');
  
  // Wait for CLI to exit
  await new Promise((resolve) => {
    cli.on('close', resolve);
  });
  
  console.log('\n=== Full output ===');
  console.log(output);
  
  if (errorOutput) {
    console.log('\n=== Error output ===');
    console.log(errorOutput);
  }
  
  // Check if file exists
  const fs = await import('fs/promises');
  try {
    const content = await fs.readFile('debug-test.txt', 'utf-8');
    console.log('\n✓ File exists with content:', content);
    await fs.unlink('debug-test.txt');
  } catch (e) {
    console.log('\n✗ File was not created');
  }
}

debugCLI().catch(console.error);