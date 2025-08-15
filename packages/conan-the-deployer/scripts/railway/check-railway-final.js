#!/usr/bin/env node

import { ResourceManager } from '@legion/tools-registry';

console.log('🚂 COMPLETE RAILWAY DEPLOYMENT STATUS\n');

async function makeGraphQLRequest(apiKey, query, variables = {}) {
  try {
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return { error: data.errors[0]?.message || 'GraphQL error', data: null };
    }
    
    return { error: null, data: data.data };
  } catch (error) {
    return { error: error.message, data: null };
  }
}

async function checkRailwayDeployments() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.env.RAILWAY_API_TOKEN || 
                 resourceManager.env.RAILWAY;
  
  if (!apiKey) {
    console.error('❌ No Railway API key found!');
    process.exit(1);
  }
  
  console.log('✅ Railway API key found\n');
  
  // 1. Get user info and teams with projects
  console.log('📋 ACCOUNT OVERVIEW\n');
  
  const userQuery = `
    query {
      me {
        id
        email
        teams {
          edges {
            node {
              id
              name
              projects {
                edges {
                  node {
                    id
                    name
                    description
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const { error: userError, data: userData } = await makeGraphQLRequest(apiKey, userQuery);
  
  if (userError) {
    console.error('❌ Failed to get user info:', userError);
    return;
  }
  
  const user = userData.me;
  console.log(`👤 User: ${user.email}`);
  console.log(`   ID: ${user.id}\n`);
  
  const teams = user.teams.edges.map(edge => edge.node);
  console.log(`🏢 Teams: ${teams.length}`);
  
  let allProjects = [];
  
  for (const team of teams) {
    console.log(`\n📂 Team: ${team.name} (${team.id})`);
    const teamProjects = team.projects.edges.map(edge => edge.node);
    console.log(`   Projects: ${teamProjects.length}`);
    
    teamProjects.forEach(project => {
      console.log(`   - ${project.name} (${project.id})`);
      allProjects.push({ ...project, teamId: team.id, teamName: team.name });
    });
  }
  
  // 2. Get detailed information for each project
  console.log('\n\n📊 DETAILED PROJECT AND DEPLOYMENT STATUS\n');
  
  for (const project of allProjects) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 PROJECT: ${project.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Team: ${project.teamName}`);
    console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
    console.log(`   Updated: ${new Date(project.updatedAt).toLocaleString()}`);
    
    // Get project details with services and deployments
    const projectQuery = `
      query($projectId: String!) {
        project(id: $projectId) {
          id
          name
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
          services {
            edges {
              node {
                id
                name
                createdAt
                updatedAt
                source {
                  repo
                  image
                }
                deployments(first: 20) {
                  edges {
                    node {
                      id
                      status
                      createdAt
                      completedAt
                      url
                      staticUrl
                      meta {
                        serviceId
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
    
    const { error: projectError, data: projectData } = await makeGraphQLRequest(
      apiKey, 
      projectQuery, 
      { projectId: project.id }
    );
    
    if (projectError) {
      console.error(`   ❌ Failed to get project details: ${projectError}`);
      continue;
    }
    
    const projectDetails = projectData.project;
    const environments = projectDetails.environments.edges.map(e => e.node);
    const services = projectDetails.services.edges.map(e => e.node);
    
    console.log(`\n   Environments: ${environments.length}`);
    environments.forEach(env => {
      console.log(`   - ${env.name} (${env.id})`);
    });
    
    console.log(`\n   Services: ${services.length}`);
    
    if (services.length === 0) {
      console.log('   ⚠️  No services found in this project');
      continue;
    }
    
    for (const service of services) {
      console.log(`\n   ${'─'.repeat(50)}`);
      console.log(`   🔧 SERVICE: ${service.name}`);
      console.log(`   ${'─'.repeat(50)}`);
      console.log(`      ID: ${service.id}`);
      console.log(`      Created: ${new Date(service.createdAt).toLocaleString()}`);
      
      if (service.source) {
        if (service.source.repo) {
          console.log(`      Source: GitHub - ${service.source.repo}`);
        } else if (service.source.image) {
          console.log(`      Source: Docker - ${service.source.image}`);
        }
      }
      
      const deployments = service.deployments.edges.map(e => e.node);
      console.log(`\n      Deployments: ${deployments.length}`);
      
      if (deployments.length > 0) {
        // Latest deployment
        const latest = deployments[0];
        console.log(`\n      📌 LATEST DEPLOYMENT:`);
        console.log(`         ID: ${latest.id}`);
        console.log(`         Status: ${latest.status}`);
        console.log(`         Created: ${new Date(latest.createdAt).toLocaleString()}`);
        if (latest.completedAt) {
          console.log(`         Completed: ${new Date(latest.completedAt).toLocaleString()}`);
        }
        
        // Check for URLs
        if (latest.url || latest.staticUrl) {
          console.log(`         🌐 URL: ${latest.url || latest.staticUrl}`);
        }
        
        // Check for domains using the service and environment
        if (environments.length > 0) {
          const environmentId = environments[0].id;
          const domainsQuery = `
            query($serviceId: String!, $environmentId: String!) {
              domains(serviceId: $serviceId, environmentId: $environmentId) {
                serviceDomains {
                  domain
                }
                customDomains {
                  id
                  domain
                  status
                }
              }
            }
          `;
          
          const { error: domainError, data: domainData } = await makeGraphQLRequest(
            apiKey,
            domainsQuery,
            { serviceId: service.id, environmentId }
          );
          
          if (!domainError && domainData?.domains) {
            const serviceDomains = domainData.domains.serviceDomains || [];
            const customDomains = domainData.domains.customDomains || [];
            
            if (serviceDomains.length > 0) {
              console.log(`\n         🌐 RAILWAY DOMAINS:`);
              serviceDomains.forEach(d => {
                console.log(`            https://${d.domain}`);
              });
            }
            
            if (customDomains.length > 0) {
              console.log(`\n         🌐 CUSTOM DOMAINS:`);
              customDomains.forEach(d => {
                console.log(`            ${d.domain} (${d.status})`);
              });
            }
          }
        }
        
        // Deployment history
        if (deployments.length > 1) {
          console.log(`\n      📜 DEPLOYMENT HISTORY:`);
          const statusCounts = {};
          deployments.forEach(dep => {
            statusCounts[dep.status] = (statusCounts[dep.status] || 0) + 1;
          });
          
          Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`         ${status}: ${count}`);
          });
          
          console.log(`\n      Recent deployments:`);
          deployments.slice(0, 5).forEach((dep, idx) => {
            const time = new Date(dep.createdAt).toLocaleString();
            console.log(`         ${idx + 1}. ${dep.status} - ${time}`);
          });
        }
      } else {
        console.log('      ⚠️  No deployments found for this service');
      }
    }
  }
  
  // 3. Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  
  let totalServices = 0;
  let totalDeployments = 0;
  let successfulDeployments = 0;
  let liveServices = [];
  
  // Recount from the detailed data we collected
  for (const project of allProjects) {
    const projectQuery = `
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                deployments(first: 1) {
                  edges {
                    node {
                      status
                      url
                      staticUrl
                    }
                  }
                }
              }
            }
          }
          environments {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    
    const { data: summaryData } = await makeGraphQLRequest(
      apiKey, 
      projectQuery, 
      { projectId: project.id }
    );
    
    if (summaryData?.project) {
      const services = summaryData.project.services.edges.map(e => e.node);
      const environmentId = summaryData.project.environments.edges[0]?.node.id;
      
      totalServices += services.length;
      
      for (const service of services) {
        if (service.deployments.edges.length > 0) {
          totalDeployments++;
          const deployment = service.deployments.edges[0].node;
          
          if (deployment.status === 'SUCCESS') {
            successfulDeployments++;
            
            // Get domains for live services
            if (environmentId) {
              const domainsQuery = `
                query($serviceId: String!, $environmentId: String!) {
                  domains(serviceId: $serviceId, environmentId: $environmentId) {
                    serviceDomains {
                      domain
                    }
                  }
                }
              `;
              
              const { data: domainData } = await makeGraphQLRequest(
                apiKey,
                domainsQuery,
                { serviceId: service.id, environmentId }
              );
              
              if (domainData?.domains?.serviceDomains?.length > 0) {
                const domain = domainData.domains.serviceDomains[0].domain;
                liveServices.push({
                  project: project.name,
                  service: service.name,
                  url: `https://${domain}`
                });
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`\nTotal Projects: ${allProjects.length}`);
  console.log(`Total Services: ${totalServices}`);
  console.log(`Total Deployments: ${totalDeployments}`);
  console.log(`Successful Deployments: ${successfulDeployments}`);
  console.log(`Live Services: ${liveServices.length}`);
  
  if (liveServices.length > 0) {
    console.log('\n🌐 LIVE SERVICES:');
    liveServices.forEach((service, idx) => {
      console.log(`\n${idx + 1}. ${service.project} / ${service.service}`);
      console.log(`   ${service.url}`);
    });
  }
  
  console.log('\n✨ Railway check complete!');
}

// Run the check
checkRailwayDeployments().catch(console.error);