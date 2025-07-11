/**
 * Simple script to check GitHub repository via API
 */

const https = require('https');

const REPO_URL = 'https://github.com/Bill234/jsEnvoy-openai-tools';

function checkPublicRepo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    console.error('Invalid GitHub URL');
    return;
  }
  
  const [, owner, repo] = match;
  
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}`,
    method: 'GET',
    headers: {
      'User-Agent': 'jsEnvoy-Check',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const repoInfo = JSON.parse(data);
        console.log('✅ Repository is publicly accessible!\n');
        console.log('Repository Information:');
        console.log('======================');
        console.log(`Name: ${repoInfo.name}`);
        console.log(`Owner: ${repoInfo.owner.login}`);
        console.log(`Description: ${repoInfo.description}`);
        console.log(`URL: ${repoInfo.html_url}`);
        console.log(`Clone URL: ${repoInfo.clone_url}`);
        console.log(`Stars: ${repoInfo.stargazers_count}`);
        console.log(`Forks: ${repoInfo.forks_count}`);
        console.log(`Language: ${repoInfo.language}`);
        console.log(`Created: ${new Date(repoInfo.created_at).toLocaleString()}`);
        console.log(`Last Updated: ${new Date(repoInfo.updated_at).toLocaleString()}`);
        console.log('\nQuick Actions:');
        console.log(`- View: ${repoInfo.html_url}`);
        console.log(`- Clone: git clone ${repoInfo.clone_url}`);
        console.log(`- Download ZIP: ${repoInfo.html_url}/archive/refs/heads/${repoInfo.default_branch}.zip`);
      } else if (res.statusCode === 404) {
        console.log('❌ Repository not found or is private');
      } else {
        console.log(`❌ Error: ${res.statusCode} - ${res.statusMessage}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
  });

  req.end();
}

console.log('Checking GitHub repository...\n');
checkPublicRepo(REPO_URL);