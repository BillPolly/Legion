#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import https from 'https';

async function listAgentResultRepos() {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const token = resourceManager.get('env.GITHUB_PAT');
    if (!token) {
        console.error('❌ GITHUB_PAT not found in environment');
        return;
    }
    
    console.log('📚 Listing repositories in agentresult organization...\n');
    
    const options = {
        hostname: 'api.github.com',
        path: '/orgs/agentresult/repos?per_page=100&sort=created',
        method: 'GET',
        headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'jsEnvoy-Script',
            'Accept': 'application/vnd.github.v3+json'
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const repos = JSON.parse(data);
                    console.log(`Found ${repos.length} repositories in agentresult:\n`);
                    
                    // Sort by creation date (newest first)
                    repos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    
                    // Display all repos
                    for (const repo of repos) {
                        const visibility = repo.private ? '🔒 private' : '🌐 public';
                        const date = new Date(repo.created_at).toLocaleDateString();
                        console.log(`  ${repo.name} (${visibility})`);
                        console.log(`     Created: ${date}`);
                        if (repo.description) {
                            console.log(`     Description: ${repo.description}`);
                        }
                        console.log(`     URL: ${repo.html_url}`);
                        console.log('');
                    }
                    
                    // Summary
                    console.log(`\n📊 Summary:`);
                    console.log(`   Total repositories: ${repos.length}`);
                    const privateRepos = repos.filter(r => r.private).length;
                    const publicRepos = repos.length - privateRepos;
                    console.log(`   Public: ${publicRepos}`);
                    console.log(`   Private: ${privateRepos}`);
                } else if (res.statusCode === 404) {
                    console.log('❌ Organization not found or you don\'t have access to it');
                } else {
                    console.error(`❌ Error: HTTP ${res.statusCode}`);
                    console.error(data);
                }
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error.message);
            resolve();
        });
        
        req.end();
    });
}

listAgentResultRepos().catch(console.error);