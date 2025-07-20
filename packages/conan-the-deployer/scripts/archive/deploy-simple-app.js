#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚀 DEPLOYING SIMPLE NODE.JS APP\n');

async function deploySimpleApp() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Step 1: Create project
  console.log('📦 Creating project...');
  
  const createProjectMutation = `
    mutation {
      projectCreate(input: {
        name: "simple-node-app"
        description: "Simple Node.js app"
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
  
  if (!data.data?.projectCreate) {
    console.error('Failed to create project:', data.errors);
    return;
  }
  
  const projectId = data.data.projectCreate.id;
  console.log(`✅ Project created: ${projectId}\n`);
  
  // Step 2: Create service with Node.js image
  console.log('📦 Creating service...');
  
  const createServiceMutation = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}"
        name: "web"
        source: {
          image: "node:18-alpine"
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
  
  if (!data.data?.serviceCreate) {
    console.error('Failed to create service:', data.errors);
    return;
  }
  
  const serviceId = data.data.serviceCreate.id;
  console.log(`✅ Service created: ${serviceId}\n`);
  
  // Step 3: Get environment ID
  console.log('📦 Getting environment...');
  
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
  console.log(`✅ Environment: ${environmentId}\n`);
  
  // Step 4: Set a simple Node.js command
  console.log('📦 Setting start command...');
  
  const setCommandMutation = `
    mutation {
      variableUpsert(input: {
        projectId: "${projectId}"
        environmentId: "${environmentId}"
        serviceId: "${serviceId}"
        name: "RAILWAY_RUN_COMMAND"
        value: "node -e 'require(\\"http\\").createServer((req, res) => res.end(\\"Hello from Railway!\\")).listen(process.env.PORT || 3000)'"
      }) {
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
    body: JSON.stringify({ query: setCommandMutation })
  });
  
  console.log('✅ Start command set\n');
  
  // Step 5: Generate domain
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
  
  if (data.data?.serviceDomainCreate?.domain) {
    const domain = data.data.serviceDomainCreate.domain;
    const url = `https://${domain}`;
    console.log(`✅ Domain generated: ${url}\n`);
    
    console.log('━'.repeat(60));
    console.log('📊 DEPLOYMENT COMPLETE:');
    console.log(`Project: simple-node-app (${projectId})`);
    console.log(`Service: web (${serviceId})`);
    console.log(`URL: ${url}`);
    console.log('━'.repeat(60));
    
    console.log('\n⏳ Waiting 30 seconds for deployment...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('\n🧪 Testing the URL...');
    try {
      const testResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`Status: ${testResponse.status}`);
      
      if (testResponse.ok) {
        const text = await testResponse.text();
        console.log(`Response: ${text}`);
        console.log('\n✅ SUCCESS! Your app is working!');
      } else {
        console.log('App may still be deploying...');
      }
    } catch (error) {
      console.log('Error:', error.message);
    }
    
    console.log(`\n🌐 Your app: ${url}`);
  } else {
    console.error('Failed to generate domain:', data.errors);
  }
}

deploySimpleApp();