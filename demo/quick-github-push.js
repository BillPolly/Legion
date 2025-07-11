/**
 * Quick example: Create a GitHub repo and push jsEnvoy to it
 */

const { openAITools } = require('../src/tools');

async function quickPush() {
  console.log('=== Quick GitHub Push Example ===\n');
  
  // Configuration - modify these as needed
  const config = {
    repoName: 'jsEnvoy-openai-tools',  // Change this to your desired repo name
    description: 'JavaScript Environment with OpenAI-compatible tools for LLM integration',
    private: false,  // Set to true for private repo
    branch: 'main'
  };

  console.log('This will create a new GitHub repository and push the jsEnvoy project.');
  console.log(`Repository name: ${config.repoName}`);
  console.log(`Description: ${config.description}`);
  console.log(`Private: ${config.private}`);
  console.log('\nMake sure you have committed all your changes before proceeding.\n');

  // Create the tool call in OpenAI format
  const toolCall = {
    id: 'quick_push_1',
    type: 'function',
    function: {
      name: 'github_create_and_push',
      arguments: JSON.stringify(config)
    }
  };

  try {
    console.log('Creating repository and pushing code...\n');
    
    // Invoke the tool
    const result = await openAITools.github.invoke(toolCall);
    const response = JSON.parse(result.content);
    
    if (response.error) {
      console.error('❌ Error:', response.error);
      console.log('\nTroubleshooting tips:');
      console.log('1. Make sure your GITHUB_PAT in .env is valid');
      console.log('2. Check that the repository name is available');
      console.log('3. Ensure you have committed all changes');
    } else {
      console.log('✅ Success!\n');
      console.log('Repository created at:', response.repository.url);
      console.log('Clone URL:', response.repository.cloneUrl);
      console.log(`\nCode has been pushed to the ${response.push.targetBranch} branch.`);
      console.log('\nNext steps:');
      console.log('1. Visit your repository:', response.repository.url);
      console.log('2. Add a README.md if needed');
      console.log('3. Configure repository settings as desired');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Alternative: Use specific functions
async function alternativeExample() {
  console.log('\n\n=== Alternative: Step-by-step Example ===\n');
  console.log(`
// 1. First create the repository
const createResult = await openAITools.github.invoke({
  id: 'create_1',
  type: 'function',
  function: {
    name: 'github_create_repo',
    arguments: JSON.stringify({
      repoName: 'my-project',
      description: 'My awesome project',
      private: false
    })
  }
});

// 2. Then push your code
const pushResult = await openAITools.github.invoke({
  id: 'push_1',
  type: 'function',
  function: {
    name: 'github_push_to_repo',
    arguments: JSON.stringify({
      repoUrl: 'https://github.com/username/my-project.git',
      branch: 'main'
    })
  }
});
`);
}

// Run if called directly
if (require.main === module) {
  quickPush()
    .then(() => alternativeExample())
    .catch(console.error);
}

module.exports = { quickPush };