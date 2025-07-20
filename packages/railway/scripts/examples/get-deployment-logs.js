#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

async function getDeploymentLogs() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  const services = [
    { name: 'my-live-website', serviceId: 'cf60d995-6af2-479c-b567-f1c655044c2c' },
    { name: 'my-public-website', serviceId: '119c4c5c-f560-43f9-8ff3-5c7a94dec6e9' }
  ];
  
  for (const service of services) {
    console.log(`\n📦 ${service.name}\n`);
    
    // Get deployment logs
    const query = `
      query {
        deploymentLogs(
          serviceId: "${service.serviceId}"
          limit: 20
        ) {
          message
        }
      }
    `;
    
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    
    if (data.data?.deploymentLogs) {
      console.log('Deployment logs:');
      data.data.deploymentLogs.forEach(log => {
        console.log(`  ${log.message}`);
      });
    } else {
      console.log('No logs available');
    }
  }
}

getDeploymentLogs();