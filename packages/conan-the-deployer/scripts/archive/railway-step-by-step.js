#!/usr/bin/env node

import { ResourceManager } from '../../../module-loader/src/index.js';

const resourceManager = await ResourceManager.getResourceManager();
const RAILWAY_API_TOKEN = resourceManager.env.RAILWAY_API_TOKEN;

async function makeRequest(query, variables = {}) {
  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  
  const result = await response.json();
  return result;
}

async function stepByStepDeployment() {
  console.log('🚂 Railway Step-by-Step Deployment Test\n');
  
  const githubRepo = 'Bill234/test-app-1753011902617'; // Use existing repo
  
  try {
    // Step 1: Create project
    console.log('1️⃣ Creating project...');
    const projectResult = await makeRequest(`
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
        }
      }
    `, {
      input: {
        name: `step-test-${Date.now()}`,
        description: 'Step by step test'
      }
    });
    
    if (projectResult.errors) {
      console.error('Failed to create project:', projectResult.errors);
      return;
    }
    
    const projectId = projectResult.data.projectCreate.id;
    console.log(`✅ Project created: ${projectId}\n`);
    
    // Step 2: Create service without source
    console.log('2️⃣ Creating service (empty)...');
    const serviceResult = await makeRequest(`
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `, {
      input: {
        projectId,
        name: 'web'
      }
    });
    
    if (serviceResult.errors) {
      console.error('Failed to create service:', serviceResult.errors);
      return;
    }
    
    const serviceId = serviceResult.data.serviceCreate.id;
    console.log(`✅ Service created: ${serviceId}\n`);
    
    // Step 3: Connect GitHub repo
    console.log('3️⃣ Connecting GitHub repository...');
    const connectResult = await makeRequest(`
      mutation ServiceConnect($id: String!, $repo: String!) {
        serviceConnect(id: $id, repo: $repo) {
          id
        }
      }
    `, {
      id: serviceId,
      repo: githubRepo
    });
    
    if (connectResult.errors) {
      console.error('Failed to connect repo:', connectResult.errors);
      
      // Try alternative: update service
      console.log('Trying service update instead...');
      const updateResult = await makeRequest(`
        mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
          serviceUpdate(id: $id, input: $input) {
            id
          }
        }
      `, {
        id: serviceId,
        input: {
          source: {
            repo: githubRepo
          }
        }
      });
      
      if (updateResult.errors) {
        console.error('Failed to update service:', updateResult.errors);
      } else {
        console.log('✅ Service updated with repo\n');
      }
    } else {
      console.log('✅ Repository connected\n');
    }
    
    // Step 4: Get environment
    console.log('4️⃣ Getting environment ID...');
    const envResult = await makeRequest(`
      query Project($id: String!) {
        project(id: $id) {
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
    `, { id: projectId });
    
    const environmentId = envResult.data?.project?.environments?.edges?.[0]?.node?.id;
    console.log(`✅ Environment ID: ${environmentId}\n`);
    
    // Step 5: Trigger deployment
    console.log('5️⃣ Triggering deployment...');
    const deployResult = await makeRequest(`
      mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId) {
          id
          status
          url
        }
      }
    `, {
      serviceId,
      environmentId
    });
    
    if (deployResult.errors) {
      console.error('Failed to trigger deployment:', deployResult.errors);
    } else {
      console.log('✅ Deployment triggered:', deployResult.data.serviceInstanceDeploy);
      
      // Step 6: Generate domain
      console.log('\n6️⃣ Generating domain...');
      const domainResult = await makeRequest(`
        mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
          serviceDomainCreate(input: $input) {
            domain
          }
        }
      `, {
        input: {
          serviceId,
          environmentId
        }
      });
      
      if (domainResult.errors) {
        console.error('Failed to generate domain:', domainResult.errors);
      } else {
        const domain = domainResult.data.serviceDomainCreate.domain;
        console.log(`✅ Domain generated: https://${domain}`);
      }
    }
    
    // Cleanup
    console.log('\n🗑️  Cleaning up...');
    await makeRequest(`
      mutation ProjectDelete($id: String!) {
        projectDelete(id: $id)
      }
    `, { id: projectId });
    
    console.log('✅ Project deleted');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

stepByStepDeployment().catch(console.error);