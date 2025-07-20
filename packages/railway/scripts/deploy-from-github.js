#!/usr/bin/env node

/**
 * Deploy a GitHub repository to Railway
 * 
 * Usage: node deploy-from-github.js <github-repo> [project-name]
 * Example: node deploy-from-github.js AgentResults/test-express-railway my-app
 */

import { ResourceManager } from '@jsenvoy/module-loader';
import { RailwayProvider } from '../src/index.js';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node deploy-from-github.js <github-repo> [project-name]');
  console.error('Example: node deploy-from-github.js AgentResults/test-express-railway my-app');
  process.exit(1);
}

const githubRepo = args[0];
const projectName = args[1] || githubRepo.split('/')[1];

async function deployFromGitHub() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY') || resourceManager.get('env.RAILWAY_API_KEY');
    const railwayProvider = new RailwayProvider(apiKey);
    
    console.log(`🚂 Deploying ${githubRepo} to Railway\n`);
    
    // Deploy directly (will create project if needed)
    const deployConfig = {
      name: projectName,
      source: 'github',
      githubRepo: githubRepo,
      branch: 'main',
      environment: {
        NODE_ENV: 'production'
      }
    };
    
    console.log('Deploying...');
    const result = await railwayProvider.deploy(deployConfig);
    
    if (result.success) {
      console.log('\n✅ Deployment initiated successfully!');
      console.log(`Project ID: ${result.projectId}`);
      console.log(`Service ID: ${result.serviceId}`);
      
      // Wait for deployment
      console.log('\nWaiting for deployment to complete...');
      await new Promise(resolve => setTimeout(resolve, 45000));
      
      // Generate domain if needed
      if (!result.url && result.serviceId) {
        const projectDetails = await railwayProvider.getProjectDetails(result.projectId);
        if (projectDetails.success && projectDetails.project.environments?.edges?.[0]) {
          const environmentId = projectDetails.project.environments.edges[0].node.id;
          
          console.log('\nGenerating Railway domain...');
          const domainResult = await railwayProvider.generateDomain(result.serviceId, environmentId);
          
          if (domainResult.success) {
            console.log(`\n🎉 Your app is deployed at: https://${domainResult.domain}`);
          }
        }
      } else if (result.url) {
        console.log(`\n🎉 Your app is deployed at: ${result.url}`);
      }
    } else {
      console.error('\n❌ Deployment failed:', result.error);
    }
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  }
}

deployFromGitHub();