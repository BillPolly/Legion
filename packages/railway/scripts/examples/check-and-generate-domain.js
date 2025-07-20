#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Finding deployed services and generating domains\n');

async function checkAndGenerateDomain() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // First, let's find all projects and services
    const query = `
      query {
        me {
          projects {
            edges {
              node {
                id
                name
                createdAt
                environments {
                  edges {
                    node {
                      id
                      name
                      serviceInstances {
                        edges {
                          node {
                            id
                            serviceId
                            domains {
                              serviceDomains {
                                domain
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
                services {
                  edges {
                    node {
                      id
                      name
                      createdAt
                    }
                  }
                }
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
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.data?.me?.projects?.edges?.length > 0) {
      console.log(`\nFound ${data.data.me.projects.edges.length} project(s)\n`);
      
      for (const projectEdge of data.data.me.projects.edges) {
        const project = projectEdge.node;
        console.log(`📁 Project: ${project.name} (${project.id})`);
        console.log(`   Created: ${project.createdAt}`);
        
        // Check services
        if (project.services?.edges?.length > 0) {
          for (const serviceEdge of project.services.edges) {
            const service = serviceEdge.node;
            console.log(`   📦 Service: ${service.name} (${service.id})`);
            
            // Check environments for this service
            for (const envEdge of project.environments.edges) {
              const env = envEdge.node;
              console.log(`      🌍 Environment: ${env.name} (${env.id})`);
              
              // Find service instance for this environment
              const serviceInstance = env.serviceInstances.edges.find(
                si => si.node.serviceId === service.id
              );
              
              if (serviceInstance) {
                const domains = serviceInstance.node.domains?.serviceDomains || [];
                
                if (domains.length > 0) {
                  console.log(`      ✅ Domain already exists:`);
                  domains.forEach(d => console.log(`         https://${d.domain}`));
                } else {
                  console.log(`      ⚠️  No domain found. Generating one now...`);
                  
                  // Generate domain
                  const mutation = `
                    mutation {
                      serviceDomainCreate(input: {
                        serviceId: "${service.id}"
                        environmentId: "${env.id}"
                      }) {
                        domain
                      }
                    }
                  `;
                  
                  const domainResponse = await fetch('https://backboard.railway.app/graphql/v2', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: mutation })
                  });
                  
                  const domainData = await domainResponse.json();
                  
                  if (domainData.data?.serviceDomainCreate?.domain) {
                    console.log(`      ✅ Domain generated: https://${domainData.data.serviceDomainCreate.domain}`);
                  } else {
                    console.log(`      ❌ Failed to generate domain:`, domainData.errors || 'Unknown error');
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log('No projects found under personal account.');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkAndGenerateDomain();