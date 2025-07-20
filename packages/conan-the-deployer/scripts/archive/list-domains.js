#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🌐 Listing All Railway Domains\n');

async function listDomains() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Get account overview
    console.log('📊 Fetching account overview...\n');
    const overview = await railwayProvider.getAccountOverview();
    
    if (!overview.success) {
      console.error('❌ Failed to get account overview:', overview.error);
      return;
    }
    
    console.log(`Account: ${overview.account.name} (${overview.account.email})`);
    console.log('━'.repeat(60));
    console.log(`Total Projects: ${overview.stats.totalProjects}`);
    console.log(`Total Services: ${overview.stats.totalServices}`);
    console.log(`Active Deployments: ${overview.stats.activeDeployments}`);
    console.log('━'.repeat(60));
    
    if (overview.liveUrls.length > 0) {
      console.log('\n🌐 Live URLs:');
      overview.liveUrls.forEach(({ projectName, serviceName, url }) => {
        console.log(`\n📦 ${projectName} / ${serviceName}`);
        console.log(`   🔗 ${url}`);
      });
    } else {
      console.log('\n⚠️  No live URLs found. Deploy some services first!');
    }
    
    // Check each project for domains
    console.log('\n\n🔍 Checking domains for each project...\n');
    
    for (const project of overview.projects) {
      if (project.services.edges.length === 0) continue;
      
      console.log(`\n📁 Project: ${project.name}`);
      console.log('─'.repeat(40));
      
      const environmentId = project.environments.edges[0]?.node.id;
      
      for (const serviceEdge of project.services.edges) {
        const service = serviceEdge.node;
        console.log(`\n  📦 Service: ${service.name}`);
        
        if (environmentId) {
          const domainsResult = await railwayProvider.getServiceDomains(service.id, environmentId);
          
          if (domainsResult.success && domainsResult.domains.length > 0) {
            console.log(`     Domains:`);
            domainsResult.domains.forEach(domain => {
              console.log(`     - https://${domain}`);
            });
          } else {
            console.log(`     No domains generated yet`);
          }
        }
        
        // Check latest deployment
        const deployment = service.deployments.edges[0]?.node;
        if (deployment) {
          console.log(`     Status: ${deployment.status}`);
          if (deployment.url) {
            console.log(`     URL: ${deployment.url}`);
          }
        }
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n✨ Use deploy-with-domain.js to deploy apps with auto-generated domains!');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

listDomains();