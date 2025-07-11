/**
 * Demonstration of the GitHub OpenAI tool
 * This will create a new repository and push the jsEnvoy project to it
 */

const { openAITools } = require('../src/tools');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function demonstrateGitHubTool() {
  console.log('=== GitHub Tool Demonstration ===\n');
  
  console.log('This demo will show you how to use the GitHub tool to:');
  console.log('1. Create a new GitHub repository');
  console.log('2. Push your current code to GitHub');
  console.log('3. Or do both in one operation\n');

  try {
    // Show available functions
    const githubTool = openAITools.github;
    const functions = githubTool.getAllToolDescriptions();
    
    console.log('Available GitHub functions:');
    functions.forEach(func => {
      console.log(`\n- ${func.function.name}: ${func.function.description}`);
      console.log('  Parameters:', JSON.stringify(func.function.parameters.properties, null, 2));
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // Ask user what they want to do
    console.log('What would you like to do?');
    console.log('1. Create a new repository only');
    console.log('2. Push to an existing repository');
    console.log('3. Create a new repository and push code to it');
    console.log('4. Exit\n');

    const choice = await question('Enter your choice (1-4): ');

    switch (choice.trim()) {
      case '1':
        await demoCreateRepo();
        break;
      case '2':
        await demoPushToRepo();
        break;
      case '3':
        await demoCreateAndPush();
        break;
      case '4':
        console.log('Exiting...');
        break;
      default:
        console.log('Invalid choice');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

async function demoCreateRepo() {
  console.log('\n=== Create Repository Demo ===\n');
  
  const repoName = await question('Enter repository name: ');
  const description = await question('Enter repository description (optional): ');
  const isPrivate = (await question('Make repository private? (y/n): ')).toLowerCase() === 'y';

  const toolCall = {
    id: 'demo_create_repo',
    type: 'function',
    function: {
      name: 'github_create_repo',
      arguments: JSON.stringify({
        repoName: repoName.trim(),
        description: description.trim(),
        private: isPrivate
      })
    }
  };

  console.log('\nCreating repository...');
  const result = await openAITools.github.invoke(toolCall);
  const response = JSON.parse(result.content);
  
  if (response.error) {
    console.error('Error:', response.error);
  } else {
    console.log('\nRepository created successfully!');
    console.log('URL:', response.url);
    console.log('Clone URL:', response.cloneUrl);
  }
}

async function demoPushToRepo() {
  console.log('\n=== Push to Repository Demo ===\n');
  
  const repoUrl = await question('Enter repository URL (e.g., https://github.com/username/repo.git): ');
  const branch = await question('Enter branch name (default: main): ') || 'main';
  const force = (await question('Force push? (y/n): ')).toLowerCase() === 'y';

  const toolCall = {
    id: 'demo_push_repo',
    type: 'function',
    function: {
      name: 'github_push_to_repo',
      arguments: JSON.stringify({
        repoUrl: repoUrl.trim(),
        branch: branch.trim(),
        force: force
      })
    }
  };

  console.log('\nPushing to repository...');
  const result = await openAITools.github.invoke(toolCall);
  const response = JSON.parse(result.content);
  
  if (response.error) {
    console.error('Error:', response.error);
  } else {
    console.log('\nPush completed successfully!');
    console.log(`Pushed ${response.sourceBranch} to ${response.targetBranch}`);
  }
}

async function demoCreateAndPush() {
  console.log('\n=== Create and Push Demo ===\n');
  
  const repoName = await question('Enter repository name for jsEnvoy: ');
  const description = await question('Enter repository description (default: "jsEnvoy - JavaScript Environment with OpenAI Tools"): ') 
    || 'jsEnvoy - JavaScript Environment with OpenAI Tools';
  const isPrivate = (await question('Make repository private? (y/n): ')).toLowerCase() === 'y';
  const branch = await question('Enter branch name (default: main): ') || 'main';

  console.log('\nThis will:');
  console.log(`1. Create a new repository: ${repoName}`);
  console.log('2. Push all current code to the new repository');
  const confirm = await question('\nProceed? (y/n): ');

  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  const toolCall = {
    id: 'demo_create_and_push',
    type: 'function',
    function: {
      name: 'github_create_and_push',
      arguments: JSON.stringify({
        repoName: repoName.trim(),
        description: description.trim(),
        private: isPrivate,
        branch: branch.trim()
      })
    }
  };

  console.log('\nCreating repository and pushing code...');
  const result = await openAITools.github.invoke(toolCall);
  const response = JSON.parse(result.content);
  
  if (response.error) {
    console.error('Error:', response.error);
  } else {
    console.log('\n✅ Success!');
    console.log('Repository URL:', response.repository.url);
    console.log(`Code pushed to ${response.push.targetBranch} branch`);
    console.log('\nYou can now visit your repository at:', response.repository.url);
  }
}

// Example of using the tool programmatically
async function programmaticExample() {
  console.log('\n=== Programmatic Usage Example ===\n');
  console.log(`
// Example: Create a repository and push code

const { openAITools } = require('./src/tools');

const toolCall = {
  id: 'create_jsenvoy_repo',
  type: 'function',
  function: {
    name: 'github_create_and_push',
    arguments: JSON.stringify({
      repoName: 'jsEnvoy-demo',
      description: 'JavaScript Environment with OpenAI-compatible tools',
      private: false,
      branch: 'main'
    })
  }
};

const result = await openAITools.github.invoke(toolCall);
const response = JSON.parse(result.content);

if (response.success) {
  console.log('Repository created:', response.repository.url);
} else {
  console.error('Failed:', response.error);
}
`);
}

// Run the demonstration
if (require.main === module) {
  demonstrateGitHubTool()
    .then(() => programmaticExample())
    .catch(console.error);
}

module.exports = { demonstrateGitHubTool };