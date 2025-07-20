#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

async function checkAndRedeploy() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  const serviceId = '381e48c1-ce9b-46a9-9e6e-197a74e7b632';
  
  // Check deployment status
  console.log('📊 Checking deployment status...\n');
  
  const query = `
    query {
      service(id: "${serviceId}") {
        id
        name
        deployments(first: 1) {
          edges {
            node {
              id
              status
              error
              createdAt
            }
          }
        }
      }
    }
  `;
  
  let response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  let data = await response.json();
  
  if (data.data?.service) {
    const deployment = data.data.service.deployments.edges[0]?.node;
    if (deployment) {
      console.log(`Deployment Status: ${deployment.status}`);
      if (deployment.error) console.log(`Error: ${deployment.error}`);
    }
  }
  
  // Trigger redeploy
  console.log('\n🔄 Triggering redeploy...');
  
  const redeployMutation = `
    mutation {
      serviceRedeploy(id: "${serviceId}")
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
    
    console.log('\n⏳ Waiting 45 seconds...');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
    console.log('\n🧪 Testing URL again...');
    const url = 'https://web-production-19f0e.up.railway.app';
    
    try {
      const testResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`Status: ${testResponse.status}`);
      
      if (testResponse.ok) {
        const text = await testResponse.text();
        console.log(`Response: ${text}`);
        console.log('\n✅ SUCCESS!');
      } else {
        console.log('\nStill not working. Let me check the logs...');
        
        // Get logs
        const logsQuery = `
          query {
            deploymentLogs(
              serviceId: "${serviceId}"
              limit: 20
            ) {
              message
            }
          }
        `;
        
        response = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: logsQuery })
        });
        
        data = await response.json();
        
        if (data.data?.deploymentLogs) {
          console.log('\nDeployment logs:');
          data.data.deploymentLogs.forEach(log => {
            console.log(`  ${log.message}`);
          });
        }
      }
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

checkAndRedeploy();