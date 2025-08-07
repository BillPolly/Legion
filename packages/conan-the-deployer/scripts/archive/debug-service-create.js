#!/usr/bin/env node

import { ResourceManager } from '../../../module-loader/src/index.js';

const resourceManager = new ResourceManager();
await resourceManager.initialize();
const RAILWAY_API_TOKEN = resourceManager.env.RAILWAY_API_TOKEN;

async function debugServiceCreate() {
  console.log('🔍 Debugging Railway service creation...\n');
  
  // Get the project that was just created
  const projectId = 'b5535d8b-0301-4b0f-a618-5648878ac5dc';
  
  // Try different service creation approaches
  console.log('Testing service creation with different configurations:\n');
  
  const configs = [
    {
      name: 'Config 1: Simple repo',
      variables: {
        input: {
          projectId,
          name: 'test-service-1',
          source: {
            repo: 'Bill234/test-app-1753011764812'
          }
        }
      }
    },
    {
      name: 'Config 2: With branch',
      variables: {
        input: {
          projectId,
          name: 'test-service-2',
          source: {
            repo: 'Bill234/test-app-1753011764812',
            branch: 'main'
          }
        }
      }
    },
    {
      name: 'Config 3: GitHub nested',
      variables: {
        input: {
          projectId,
          name: 'test-service-3',
          source: {
            github: {
              repo: 'Bill234/test-app-1753011764812',
              branch: 'main'
            }
          }
        }
      }
    },
    {
      name: 'Config 4: Empty source',
      variables: {
        input: {
          projectId,
          name: 'test-service-4'
        }
      }
    }
  ];
  
  for (const config of configs) {
    console.log(`\nTesting ${config.name}:`);
    console.log('Variables:', JSON.stringify(config.variables, null, 2));
    
    const mutation = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;
    
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: config.variables
      })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.log('❌ Failed:', result.errors[0].message);
      if (result.errors[0].traceId) {
        console.log('   Trace ID:', result.errors[0].traceId);
      }
    } else if (result.data?.serviceCreate) {
      console.log('✅ Success! Service created:', result.data.serviceCreate);
      
      // If successful, delete it to keep things clean
      const deleteMutation = `
        mutation ServiceDelete($id: String!) {
          serviceDelete(id: $id)
        }
      `;
      
      await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: deleteMutation,
          variables: { id: result.data.serviceCreate.id }
        })
      });
      
      console.log('   (Service deleted for cleanup)');
    }
  }
  
  // Clean up the test project
  console.log('\n🗑️  Cleaning up test project...');
  const deleteMutation = `
    mutation ProjectDelete($id: String!) {
      projectDelete(id: $id)
    }
  `;
  
  await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: deleteMutation,
      variables: { id: projectId }
    })
  });
  
  console.log('✅ Project cleaned up');
}

debugServiceCreate().catch(console.error);