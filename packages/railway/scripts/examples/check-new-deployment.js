#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

async function checkDeployment() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  const projectId = '03cc8eca-6675-4671-a25d-9b6cf57268a9';
  
  const query = `
    query CheckDeployment {
      project(id: "${projectId}") {
        name
        services {
          edges {
            node {
              id
              name
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
        }
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
  console.log('Deployment status:', JSON.stringify(data, null, 2));
  
  const deployment = data.data?.project?.services?.edges?.[0]?.node?.deployments?.edges?.[0]?.node;
  if (deployment?.url) {
    console.log(`\n🎉 YOUR APP IS LIVE AT: ${deployment.url}`);
  }
}

checkDeployment();