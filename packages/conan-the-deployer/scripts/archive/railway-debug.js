#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Railway Debug - Finding all resources\n');

async function debugRailway() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    console.log('🔑 API Key:', apiKey.slice(0, 8) + '...');

    // Try different queries to find resources
    console.log('\n📋 Query 1: User teams and all accessible projects');
    const teamQuery = `
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
      body: JSON.stringify({ query: teamQuery })
    });

    let data = await response.json();
    console.log('Teams Response:', JSON.stringify(data, null, 2));

    // Try to list ALL projects with different query
    console.log('\n📋 Query 2: All projects (no filter)');
    const allProjectsQuery = `
      query {
        projects {
          edges {
            node {
              id
              name
              createdAt
              deletedAt
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
      body: JSON.stringify({ query: allProjectsQuery })
    });

    data = await response.json();
    console.log('All Projects Response:', JSON.stringify(data, null, 2));

    // Try viewer query
    console.log('\n📋 Query 3: Viewer query');
    const viewerQuery = `
      query {
        viewer {
          ... on User {
            id
            email
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
      body: JSON.stringify({ query: viewerQuery })
    });

    data = await response.json();
    console.log('Viewer Response:', JSON.stringify(data, null, 2));

    // Check account limits
    console.log('\n📋 Query 4: Check if there are usage/limit fields');
    const introspectionQuery = `
      query {
        __type(name: "User") {
          name
          fields {
            name
            type {
              name
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
      body: JSON.stringify({ query: introspectionQuery })
    });

    data = await response.json();
    console.log('\nUser type fields:', JSON.stringify(data.data?.__type?.fields?.map(f => f.name), null, 2));

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

debugRailway();