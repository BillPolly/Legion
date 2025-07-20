#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 FINDING ALL REMAINING PROJECTS\n');

async function findAllRemaining() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const apiKey = resourceManager.get('env.RAILWAY');
  
  // Try multiple queries to find projects
  console.log('1️⃣ Checking with me query...');
  let query = `
    query {
      me {
        id
        email
        projects {
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
  
  let response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  let data = await response.json();
  console.log('Me query result:', JSON.stringify(data, null, 2));
  
  // Check viewer query
  console.log('\n2️⃣ Checking with viewer query...');
  query = `
    query {
      viewer {
        ... on User {
          id
          projects {
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
  `;
  
  response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  data = await response.json();
  console.log('Viewer query result:', JSON.stringify(data, null, 2));
  
  // Check all environments
  console.log('\n3️⃣ Checking environments...');
  query = `
    query {
      environments {
        edges {
          node {
            id
            name
            projectId
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
    body: JSON.stringify({ query })
  });
  
  data = await response.json();
  console.log('Environments result:', JSON.stringify(data, null, 2));
}

findAllRemaining();