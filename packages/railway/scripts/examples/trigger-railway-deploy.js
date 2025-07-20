#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚀 Triggering Railway Deployment\n');

async function triggerDeploy() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    const serviceId = '71e5f115-ef0a-476a-b022-f557bd645e7c';
    
    // Railway expects deployments to be triggered via GitHub or Docker image
    // For now, let's deploy from a public GitHub repo that works
    console.log('📦 Deploying from Railway\'s example Node.js app...\n');
    
    const mutation = `
      mutation ServiceConnect($id: String!, $input: ServiceConnectInput!) {
        serviceConnect(id: $id, input: $input) {
          id
        }
      }
    `;
    
    const variables = {
      id: serviceId,
      input: {
        source: {
          repo: "railwayapp/examples",
          branch: "master"
        }
      }
    };
    
    console.log('🔧 Connecting service to GitHub repo...');
    let response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables })
    });
    
    let data = await response.json();
    console.log('Connect response:', JSON.stringify(data, null, 2));
    
    // Now trigger deployment
    const deployMutation = `
      mutation ServiceDeploy($id: String!, $environmentId: String) {
        serviceDeploy(id: $id, environmentId: $environmentId)
      }
    `;
    
    // Get environment ID first
    const envQuery = `
      query {
        project(id: "cd5bd7fc-e59e-43f5-8fcd-2c7ed42a9119") {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;
    
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: envQuery })
    });
    
    data = await response.json();
    console.log('\nEnvironments:', JSON.stringify(data, null, 2));
    
    if (data.data?.project?.environments?.edges?.[0]) {
      const envId = data.data.project.environments.edges[0].node.id;
      console.log(`\n🚀 Triggering deployment in environment: ${envId}`);
      
      response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: deployMutation, 
          variables: { 
            id: serviceId,
            environmentId: envId
          } 
        })
      });
      
      data = await response.json();
      console.log('\nDeploy response:', JSON.stringify(data, null, 2));
      
      if (!data.errors) {
        console.log('\n✅ Deployment triggered successfully!');
        console.log('⏳ Check your Railway dashboard in a minute or two');
        console.log('🌐 https://railway.app');
        
        // Wait and check for URL
        console.log('\n⏳ Waiting for deployment to process...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check deployment status
        const statusQuery = `
          query {
            service(id: "${serviceId}") {
              deployments(first: 1) {
                edges {
                  node {
                    id
                    status
                    url
                    staticUrl
                  }
                }
              }
            }
          }
        `;
        
        response = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: statusQuery })
        });
        
        data = await response.json();
        console.log('\nDeployment status:', JSON.stringify(data, null, 2));
        
        if (data.data?.service?.deployments?.edges?.[0]?.node?.url) {
          const url = data.data.service.deployments.edges[0].node.url;
          console.log('\n🎉 YOUR APP IS LIVE!');
          console.log(`🌐 Visit: ${url}`);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

triggerDeploy();