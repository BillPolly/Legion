#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('📊 Checking Deployment Status\n');

async function checkStatus() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Get ALL projects and their deployment status
  const query = `
    query {
      me {
        projects {
          edges {
            node {
              id
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
                          error
                          staticUrl
                          url
                        }
                      }
                    }
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
  
  if (data.data?.me?.projects?.edges) {
    for (const projectEdge of data.data.me.projects.edges) {
      const project = projectEdge.node;
      console.log(`\n📁 ${project.name} (${project.id})`);
      
      for (const serviceEdge of project.services.edges) {
        const service = serviceEdge.node;
        console.log(`  └─ ${service.name}`);
        
        const deployment = service.deployments.edges[0]?.node;
        if (deployment) {
          console.log(`     Status: ${deployment.status}`);
          if (deployment.error) console.log(`     Error: ${deployment.error}`);
          if (deployment.url) console.log(`     URL: ${deployment.url}`);
          if (deployment.staticUrl) console.log(`     Static URL: ${deployment.staticUrl}`);
        } else {
          console.log(`     No deployments`);
        }
      }
    }
  }
}

checkStatus();