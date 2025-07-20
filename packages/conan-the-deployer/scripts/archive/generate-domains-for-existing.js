#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🌐 Generating Domains for Existing Services\n');

async function generateDomainsForExisting() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Known deployments from previous runs
    const deployments = [
      {
        projectId: '2818aaab-210f-48eb-8654-8061eddee05a',
        projectName: 'my-live-website',
        serviceId: 'cf60d995-6af2-479c-b567-f1c655044c2c',
        serviceName: 'web',
        environmentId: '7fc3f135-46a3-49bb-bb21-9bc9c4d0a32c'
      },
      {
        projectId: '40575eaf-f727-4955-9f5f-7ff4108e0123',
        projectName: 'my-public-website',
        serviceId: '119c4c5c-f560-43f9-8ff3-5c7a94dec6e9',
        serviceName: 'my-public-website',
        environmentId: '0ee310d0-7e86-4819-9d4a-79bc1bbe9e05'
      }
    ];
    
    for (const deployment of deployments) {
      console.log(`\n📦 Project: ${deployment.projectName}`);
      console.log(`   Service: ${deployment.serviceName}`);
      
      // Check if domain already exists
      const domainsResult = await railwayProvider.getServiceDomains(
        deployment.serviceId, 
        deployment.environmentId
      );
      
      if (domainsResult.success && domainsResult.domains.length > 0) {
        console.log(`   ✅ Domain already exists:`);
        domainsResult.domains.forEach(domain => {
          console.log(`      🌐 https://${domain}`);
        });
      } else {
        // Generate domain
        console.log(`   🔄 Generating domain...`);
        const domainResult = await railwayProvider.generateDomain(
          deployment.serviceId,
          deployment.environmentId
        );
        
        if (domainResult.success) {
          const url = `https://${domainResult.domain}`;
          console.log(`   ✅ Domain generated successfully!`);
          console.log(`      🌐 ${url}`);
          console.log(`\n   🎯 Your website is now accessible at: ${url}`);
        } else {
          console.log(`   ❌ Failed to generate domain:`, domainResult.error);
        }
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('✨ Domain generation complete!');
    console.log('Visit the URLs above to see your deployed applications.');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

generateDomainsForExisting();