#!/usr/bin/env node

import { ResourceManager } from '@legion/module-loader';
import https from 'https';

async function createOrgRepo(orgName, repoName, description = '', isPrivate = false) {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const token = resourceManager.get('env.GITHUB_PAT');
    if (!token) {
        throw new Error('GITHUB_PAT not found in environment');
    }
    
    console.log(`🏗️  Creating repository ${repoName} in organization ${orgName}...`);
    
    const data = JSON.stringify({
        name: repoName,
        description: description,
        private: isPrivate,
        auto_init: false
    });
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/orgs/${orgName}/repos`,
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'jsEnvoy-Script',
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const parsed = JSON.parse(responseData);
                    console.log('✅ Repository created successfully!');
                    console.log(`   URL: ${parsed.html_url}`);
                    console.log(`   Clone URL: ${parsed.clone_url}`);
                    resolve({
                        success: true,
                        name: parsed.name,
                        url: parsed.html_url,
                        cloneUrl: parsed.clone_url,
                        sshUrl: parsed.ssh_url,
                        private: parsed.private
                    });
                } else {
                    const error = responseData ? JSON.parse(responseData) : {};
                    console.error(`❌ Failed to create repository: ${error.message || res.statusCode}`);
                    reject(new Error(error.message || `Failed with status ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error.message);
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
}

// Export for use in other scripts
export { createOrgRepo };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node create-org-repo.js <org-name> <repo-name> [description] [private]');
        process.exit(1);
    }
    
    const [orgName, repoName, description = '', isPrivate = false] = args;
    
    createOrgRepo(orgName, repoName, description, isPrivate === 'true')
        .then(() => console.log('\n✅ Done!'))
        .catch(error => {
            console.error('\n❌ Error:', error.message);
            process.exit(1);
        });
}