#!/usr/bin/env node

import { ResourceManager } from '@legion/tool-system';

console.log('🚂 COMPREHENSIVE RAILWAY RESOURCES CHECK\n');

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

async function checkAllRailwayResources() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.env.RAILWAY_API_TOKEN || 
                 resourceManager.env.RAILWAY;
  
  if (!apiKey) {
    console.error('❌ No Railway API key found! Set RAILWAY_API_TOKEN or RAILWAY environment variable.');
    process.exit(1);
  }
  
  console.log('✅ Railway API key found\n');
  
  // 1. Get user info and teams
  console.log('1️⃣ CHECKING USER AND TEAMS\n');
  
  const userQuery = `
    query {
      me {
        id
        name
        email
        teams {
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
  `;
  
  const { error: userError, data: userData } = await makeGraphQLRequest(apiKey, userQuery);
  
  if (userError) {
    console.error('❌ Failed to get user info:', userError);
    return;
  }
  
  const user = userData.me;
  console.log(`👤 User: ${user.name} (${user.email})`);
  console.log(`🏢 Teams: ${user.teams.edges.length}\n`);
  
  const teams = user.teams.edges.map(edge => edge.node);
  if (teams.length > 0) {
    console.log('Teams:');
    teams.forEach(team => {
      console.log(`  - ${team.name} (${team.id})`);
    });
  }
  
  // 2. Get all projects (personal and team)
  console.log('\n\n2️⃣ CHECKING ALL PROJECTS\n');
  
  // First, get personal projects
  const personalProjectsQuery = `
    query {
      projects {
        edges {
          node {
            id
            name
            description
            createdAt
            updatedAt
            team {
              id
              name
            }
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
                  deployments(first: 5) {
                    edges {
                      node {
                        id
                        status
                        createdAt
                        staticUrl
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
  
  const { error: projectsError, data: projectsData } = await makeGraphQLRequest(apiKey, personalProjectsQuery);
  
  if (projectsError) {
    console.error('❌ Failed to get projects:', projectsError);
    return;
  }
  
  const allProjects = projectsData.projects.edges.map(edge => edge.node);
  console.log(`📦 Total projects found: ${allProjects.length}\n`);
  
  // Also check team projects explicitly
  for (const team of teams) {
    console.log(`\n🔍 Checking projects for team: ${team.name}`);
    
    const teamProjectsQuery = `
      query($teamId: String!) {
        team(id: $teamId) {
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                services {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const { error: teamError, data: teamData } = await makeGraphQLRequest(
      apiKey, 
      teamProjectsQuery, 
      { teamId: team.id }
    );
    
    if (!teamError && teamData?.team?.projects?.edges) {
      const teamProjects = teamData.team.projects.edges.map(edge => edge.node);
      console.log(`  Found ${teamProjects.length} projects in ${team.name}`);
    }
  }
  
  // 3. Detailed analysis of each project
  console.log('\n\n3️⃣ DETAILED PROJECT ANALYSIS\n');
  
  for (const project of allProjects) {
    const location = project.team ? `Team: ${project.team.name}` : 'Personal';
    console.log(`\n📂 Project: ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Location: ${location}`);
    console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
    
    const services = project.services.edges.map(edge => edge.node);
    console.log(`   Services: ${services.length}`);
    
    if (services.length > 0) {
      for (const service of services) {
        console.log(`\n   🔧 Service: ${service.name} (${service.id})`);
        console.log(`      Created: ${new Date(service.createdAt).toLocaleString()}`);
        
        const deployments = service.deployments.edges.map(edge => edge.node);
        console.log(`      Deployments: ${deployments.length}`);
        
        if (deployments.length > 0) {
          // Get the latest deployment
          const latestDeployment = deployments[0];
          console.log(`      Latest deployment:`);
          console.log(`        - ID: ${latestDeployment.id}`);
          console.log(`        - Status: ${latestDeployment.status}`);
          console.log(`        - Created: ${new Date(latestDeployment.createdAt).toLocaleString()}`);
          if (latestDeployment.staticUrl) {
            console.log(`        - URL: ${latestDeployment.staticUrl}`);
          }
        }
        
        // Check for domains
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
        
        // Get the first environment ID
        const environmentId = project.environments.edges[0]?.node.id;
        
        if (environmentId) {
          const { error: domainError, data: domainData } = await makeGraphQLRequest(
            apiKey,
            domainsQuery,
            { serviceId: service.id, environmentId }
          );
          
          if (!domainError && domainData?.domains) {
            const serviceDomains = domainData.domains.serviceDomains || [];
            const customDomains = domainData.domains.customDomains || [];
            
            if (serviceDomains.length > 0) {
              console.log(`      Railway domains:`);
              serviceDomains.forEach(d => {
                console.log(`        - https://${d.domain}`);
              });
            }
            
            if (customDomains.length > 0) {
              console.log(`      Custom domains:`);
              customDomains.forEach(d => {
                console.log(`        - ${d.domain} (${d.status})`);
              });
            }
          }
        }
      }
    }
  }
  
  // 4. Summary
  console.log('\n\n4️⃣ SUMMARY\n');
  
  let totalServices = 0;
  let totalDeployments = 0;
  let activeDeployments = 0;
  let deploymentsByStatus = {};
  
  allProjects.forEach(project => {
    project.services.edges.forEach(serviceEdge => {
      totalServices++;
      serviceEdge.node.deployments.edges.forEach(deploymentEdge => {
        totalDeployments++;
        const status = deploymentEdge.node.status;
        deploymentsByStatus[status] = (deploymentsByStatus[status] || 0) + 1;
        if (status === 'SUCCESS') {
          activeDeployments++;
        }
      });
    });
  });
  
  console.log(`📊 Total Statistics:`);
  console.log(`   - Teams: ${teams.length}`);
  console.log(`   - Projects: ${allProjects.length}`);
  console.log(`   - Services: ${totalServices}`);
  console.log(`   - Total Deployments: ${totalDeployments}`);
  console.log(`   - Active Deployments: ${activeDeployments}`);
  console.log(`\n   Deployments by Status:`);
  Object.entries(deploymentsByStatus).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });
  
  // 5. List all live URLs
  console.log('\n\n5️⃣ LIVE URLS\n');
  
  let liveUrlCount = 0;
  allProjects.forEach(project => {
    project.services.edges.forEach(serviceEdge => {
      const service = serviceEdge.node;
      service.deployments.edges.forEach(deploymentEdge => {
        const deployment = deploymentEdge.node;
        if (deployment.status === 'SUCCESS' && deployment.staticUrl) {
          liveUrlCount++;
          console.log(`🌐 ${project.name} / ${service.name}:`);
          console.log(`   ${deployment.staticUrl}`);
        }
      });
    });
  });
  
  if (liveUrlCount === 0) {
    console.log('No live deployments found.');
  }
}

// Run the check
checkAllRailwayResources().catch(console.error);