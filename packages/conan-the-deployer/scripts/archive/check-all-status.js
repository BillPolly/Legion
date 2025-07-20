#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

async function checkAllStatus() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Check specific known projects
  const projectIds = [
    '2818aaab-210f-48eb-8654-8061eddee05a',
    '40575eaf-f727-4955-9f5f-7ff4108e0123',
    '68970e34-0bfc-44ce-bd80-444f47b5d6b5'
  ];
  
  console.log('📊 Checking Known Projects\n');
  
  for (const projectId of projectIds) {
    const query = `
      query {
        project(id: "${projectId}") {
          id
          name
          services {
            edges {
              node {
                id
                name
                serviceInstances {
                  edges {
                    node {
                      id
                      environmentId
                      domains {
                        serviceDomains {
                          domain
                        }
                      }
                      latestDeployment {
                        id
                        status
                        canRedeploy
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
    
    if (data.data?.project) {
      const project = data.data.project;
      console.log(`\n📁 ${project.name}`);
      
      for (const serviceEdge of project.services.edges) {
        const service = serviceEdge.node;
        console.log(`  └─ ${service.name} (${service.id})`);
        
        for (const siEdge of service.serviceInstances.edges) {
          const si = siEdge.node;
          const domains = si.domains?.serviceDomains || [];
          const deployment = si.latestDeployment;
          
          if (domains.length > 0) {
            domains.forEach(d => console.log(`     🌐 https://${d.domain}`));
          }
          
          if (deployment) {
            console.log(`     Status: ${deployment.status}`);
            console.log(`     Can redeploy: ${deployment.canRedeploy}`);
            
            // If CRASHED, let's curl the domain
            if (deployment.status === 'CRASHED' && domains.length > 0) {
              const url = `https://${domains[0].domain}`;
              console.log(`     Testing URL...`);
              try {
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
                console.log(`     HTTP ${res.status}`);
              } catch (e) {
                console.log(`     Error: ${e.message}`);
              }
            }
          }
        }
      }
    } else {
      console.log(`Project ${projectId} not found`);
    }
  }
}

checkAllStatus();