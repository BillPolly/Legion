#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚀 DEPLOYING STATIC WEBSITE WITH NGINX\n');

async function deployStaticSite() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Clean up first
  console.log('🧹 Cleaning up...');
  const deleteQuery = `
    mutation {
      projectDelete(id: "89f1d985-2938-4c57-87ad-60b060e134b5")
    }
  `;
  
  await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: deleteQuery })
  });
  
  console.log('✅ Cleaned\n');
  
  // Create new project
  console.log('📦 Creating project...');
  
  const createProjectMutation = `
    mutation {
      projectCreate(input: {
        name: "static-website"
        description: "Static website served by nginx"
      }) {
        id
        name
      }
    }
  `;
  
  let response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: createProjectMutation })
  });
  
  let data = await response.json();
  const projectId = data.data.projectCreate.id;
  console.log(`✅ Project created: ${projectId}\n`);
  
  // Create service with official nginx image
  console.log('📦 Creating nginx service...');
  
  const createServiceMutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}"
        name: "web"
        source: {
          image: "nginx:stable-alpine"
        }
      }) {
        id
        name
      }
    }
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: createServiceMutation })
  });
  
  data = await response.json();
  const serviceId = data.data.serviceCreate.id;
  console.log(`✅ Service created: ${serviceId}\n`);
  
  // Get environment
  const envQuery = `
    query {
      project(id: "${projectId}") {
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
  const environmentId = data.data.project.environments.edges[0].node.id;
  
  // Set PORT environment variable
  console.log('📦 Configuring nginx...');
  
  // Set environment variables for nginx
  const vars = [
    { name: 'PORT', value: '80' },
    { name: 'NGINX_PORT', value: '80' }
  ];
  
  for (const v of vars) {
    const varMutation = `
      mutation {
        variableUpsert(input: {
          projectId: "${projectId}"
          environmentId: "${environmentId}"
          serviceId: "${serviceId}"
          name: "${v.name}"
          value: "${v.value}"
        }) {
          name
        }
      }
    `;
    
    await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: varMutation })
    });
  }
  
  console.log('✅ Nginx configured\n');
  
  // Generate domain
  console.log('📦 Generating domain...');
  
  const generateDomainMutation = `
    mutation {
      serviceDomainCreate(input: {
        serviceId: "${serviceId}"
        environmentId: "${environmentId}"
      }) {
        domain
      }
    }
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: generateDomainMutation })
  });
  
  data = await response.json();
  const domain = data.data.serviceDomainCreate.domain;
  const url = `https://${domain}`;
  
  console.log(`✅ Domain: ${url}\n`);
  
  console.log('━'.repeat(60));
  console.log('📊 DEPLOYMENT COMPLETE');
  console.log(`URL: ${url}`);
  console.log('━'.repeat(60));
  
  // Wait and test
  console.log('\n⏳ Waiting 60 seconds for deployment...');
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  console.log('\n🧪 Testing with curl...');
  try {
    const { execSync } = await import('child_process');
    const curlResult = execSync(`curl -sS -I "${url}" --max-time 10`, { encoding: 'utf8' });
    console.log(curlResult);
  } catch (error) {
    console.log('Curl error:', error.message);
  }
  
  console.log(`\n🌐 Website: ${url}`);
}

deployStaticSite();