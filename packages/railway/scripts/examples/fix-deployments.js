#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔧 Fixing Existing Deployments\n');

async function fixDeployments() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // For Caddy to work properly on Railway, we need to:
    // 1. Make sure it's configured to serve on the right port
    // 2. Trigger a redeploy
    
    const services = [
      {
        projectId: '2818aaab-210f-48eb-8654-8061eddee05a',
        serviceId: 'cf60d995-6af2-479c-b567-f1c655044c2c',
        environmentId: '7fc3f135-46a3-49bb-bb21-9bc9c4d0a32c',
        name: 'my-live-website'
      },
      {
        projectId: '40575eaf-f727-4955-9f5f-7ff4108e0123',
        serviceId: '119c4c5c-f560-43f9-8ff3-5c7a94dec6e9',
        environmentId: '0ee310d0-7e86-4819-9d4a-79bc1bbe9e05',
        name: 'my-public-website'
      }
    ];
    
    for (const service of services) {
      console.log(`\n📦 Fixing ${service.name}...`);
      
      // Update the service to use a working configuration
      // Let's switch to a simple static file server that works
      const updateMutation = `
        mutation {
          serviceUpdate(
            id: "${service.serviceId}"
            input: {
              source: {
                image: "halverneus/static-file-server:latest"
              }
            }
          ) {
            id
          }
        }
      `;
      
      let response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: updateMutation })
      });
      
      let data = await response.json();
      
      if (data.errors) {
        console.log('Service update failed, trying different approach...');
        
        // Set environment variables to configure the server
        const varMutation = `
          mutation {
            variableUpsert(input: {
              environmentId: "${service.environmentId}"
              projectId: "${service.projectId}"
              serviceId: "${service.serviceId}"
              name: "PORT"
              value: "8080"
            }) {
              name
            }
          }
        `;
        
        response = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: varMutation })
        });
        
        console.log('✅ Environment variable set');
      }
      
      // Trigger a redeploy
      console.log('🔄 Triggering redeploy...');
      
      const redeployMutation = `
        mutation {
          serviceRedeploy(id: "${service.serviceId}")
        }
      `;
      
      response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: redeployMutation })
      });
      
      data = await response.json();
      
      if (data.data?.serviceRedeploy) {
        console.log('✅ Redeploy triggered');
      } else {
        console.log('⚠️  Redeploy may have failed:', data.errors);
      }
    }
    
    console.log('\n⏳ Deployments are being updated...');
    console.log('Wait 1-2 minutes then check these URLs:');
    console.log('  - https://web-production-77d64.up.railway.app');
    console.log('  - https://my-public-website-production-54d3.up.railway.app');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

fixDeployments();