require('dotenv').config();
const { GitHubOpenAI } = require('./src/tools/openai/github');

const github = new GitHubOpenAI({
  pat: process.env.GITHUB_PAT,
  username: 'maxximus-dev'
});

github.push_to_repo('jsEnvoy', '.', 'Implement modular architecture with dependency injection and robust response parsing', 'refactor')
  .then(result => console.log('✅ Pushed to GitHub:', result))
  .catch(err => console.error('❌ Error:', err.message));