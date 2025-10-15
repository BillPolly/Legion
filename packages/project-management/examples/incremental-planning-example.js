/**
 * Example: Incremental Planning with Claude Sub-Agents
 *
 * This example demonstrates how a Claude sub-agent (Planning Agent)
 * would use pm_update_plan and pm_get_plan to create and evolve
 * a plan incrementally as work progresses.
 */

import { ResourceManager } from '@legion/resource-manager';
import { createPlan, updatePlan, getPlan, listPlans } from '../src/plan-operations.js';
import { getNeo4j } from '../src/neo4j.js';

async function demonstrateIncrementalPlanning() {
  console.log('🤖 Planning Agent: Demonstrating Incremental Planning\n');
  console.log('═'.repeat(70));

  const resourceManager = await ResourceManager.getInstance();
  const neo4j = await resourceManager.getNeo4jServer();

  // Clean up
  await neo4j.run(`
    MATCH (n)
    WHERE n.id STARTS WITH 'DEMO-'
    DETACH DELETE n
  `);

  // Setup: Create project and agent
  await neo4j.run(`
    CREATE (p:Project {
      id: 'DEMO-PROJECT',
      name: 'E-commerce Platform',
      description: 'Build a production e-commerce platform',
      status: 'active',
      created: datetime(),
      updated: datetime()
    })
    CREATE (a:Agent {
      name: 'planning-agent',
      type: 'planner',
      capabilities: ['planning', 'architecture'],
      status: 'idle',
      lastActive: datetime()
    })
  `);

  // ========================================================================
  // STEP 1: Planning Agent Creates Initial Plan
  // ========================================================================
  console.log('\n📋 STEP 1: Creating Initial Plan');
  console.log('─'.repeat(70));

  const initialPlan = await createPlan({
    planId: 'DEMO-PLAN-ECOM',
    projectId: 'DEMO-PROJECT',
    title: 'E-commerce Platform Implementation Plan',
    createdBy: 'planning-agent',
    content: `# E-commerce Platform Implementation Plan

## Overview
Build a scalable e-commerce platform with user authentication, product catalog, shopping cart, and payment processing.

## Phases

### Phase 1: Foundation (Week 1-2)
- Setup development environment
- Database design (PostgreSQL)
- Authentication system (JWT)
- User management API

### Phase 2: Product Catalog (Week 3-4)
- Product model and API
- Category management
- Search functionality
- Image upload system

### Phase 3: Shopping Experience (Week 5-6)
- Shopping cart
- Checkout flow
- Order management
- Email notifications

### Phase 4: Payment & Deployment (Week 7-8)
- Payment gateway integration (Stripe)
- Admin dashboard
- Deployment pipeline
- Performance optimization

## Success Criteria
- Users can browse products
- Users can checkout and pay
- Admin can manage inventory
- 99.9% uptime SLA
`
  });

  console.log(`✅ Created plan: ${initialPlan.planId}`);
  console.log(`   Version: ${initialPlan.version}`);
  console.log(`   Content length: ${initialPlan.contentLength} characters`);

  // ========================================================================
  // STEP 2: Security Agent Reviews and Appends Security Requirements
  // ========================================================================
  console.log('\n🔒 STEP 2: Security Agent Adds Security Requirements');
  console.log('─'.repeat(70));

  await neo4j.run(`
    CREATE (a:Agent {
      name: 'security-agent',
      type: 'security-analyst',
      capabilities: ['security-review'],
      status: 'idle',
      lastActive: datetime()
    })
  `);

  const securityUpdate = await updatePlan({
    planId: 'DEMO-PLAN-ECOM',
    updateType: 'append',
    updatedBy: 'security-agent',
    content: `

## Security Requirements (Added by Security Agent)

### Authentication & Authorization
- **Password Security**: Bcrypt with 12 rounds minimum
- **JWT Tokens**: 1-hour expiration, refresh token rotation
- **Rate Limiting**: 10 requests/minute for auth endpoints
- **Session Management**: Redis-backed sessions with 24h timeout

### Data Protection
- **PCI DSS Compliance**: Never store full card numbers
- **Data Encryption**: TLS 1.3 for transport, AES-256 for sensitive data at rest
- **Input Validation**: Sanitize all user inputs, parameterized queries only
- **GDPR Compliance**: User data export/delete functionality

### API Security
- **CORS**: Whitelist only production domains
- **CSRF Protection**: Double-submit cookie pattern
- **API Keys**: Rotate every 90 days
- **Logging**: Audit all authentication events

### Infrastructure
- **Container Security**: Scan images for vulnerabilities
- **Secrets Management**: AWS Secrets Manager or HashiCorp Vault
- **Network Security**: Private subnets for database, public for load balancer
- **DDoS Protection**: CloudFlare or AWS Shield

**Risk Assessment**: Medium-High (handles payments, customer PII)
**Compliance**: PCI DSS Level 1, GDPR, CCPA
`
  });

  console.log(`✅ Updated to version: ${securityUpdate.version}`);
  console.log(`   Update type: ${securityUpdate.updateType}`);
  console.log(`   Previous version: ${securityUpdate.previousVersion}`);

  // ========================================================================
  // STEP 3: Development Starts - Update Phase 1 Status
  // ========================================================================
  console.log('\n🔨 STEP 3: Orchestrator Updates Phase 1 Progress');
  console.log('─'.repeat(70));

  await neo4j.run(`
    CREATE (a:Agent {
      name: 'orchestrator',
      type: 'orchestrator',
      capabilities: ['orchestration', 'task-management'],
      status: 'idle',
      lastActive: datetime()
    })
  `);

  const phaseUpdate = await updatePlan({
    planId: 'DEMO-PLAN-ECOM',
    updateType: 'update_section',
    section: 'Phase 1: Foundation (Week 1-2)',
    updatedBy: 'orchestrator',
    content: `### Phase 1: Foundation (Week 1-2) ✅ COMPLETED

- ✅ Setup development environment (Docker compose with PostgreSQL, Redis)
- ✅ Database design (PostgreSQL) - 15 tables, normalized schema
- ✅ Authentication system (JWT) - Access + refresh tokens implemented
- ✅ User management API - CRUD operations, password reset

**Completed**: March 15, 2025
**Duration**: 10 days (2 days under estimate)
**Blockers**: None
**Next**: Start Phase 2 - Product Catalog
`
  });

  console.log(`✅ Updated section to version: ${phaseUpdate.version}`);

  // ========================================================================
  // STEP 4: Architect Discovers Database Performance Issue
  // ========================================================================
  console.log('\n⚠️  STEP 4: Architect Adds Performance Optimization Notes');
  console.log('─'.repeat(70));

  await neo4j.run(`
    CREATE (a:Agent {
      name: 'architect',
      type: 'architect',
      capabilities: ['architecture', 'performance'],
      status: 'idle',
      lastActive: datetime()
    })
  `);

  const perfUpdate = await updatePlan({
    planId: 'DEMO-PLAN-ECOM',
    updateType: 'append',
    updatedBy: 'architect',
    content: `

## Performance Optimization Strategy (Added by Architect)

### Database Layer
- **Indexes**: Add composite indexes on (user_id, created_at) for orders table
- **Query Optimization**: Use EXPLAIN ANALYZE to identify slow queries
- **Connection Pooling**: pg pool max 20 connections
- **Read Replicas**: Setup for product catalog reads (90% of traffic)

### Caching Strategy
- **Redis Cache**:
  - Product catalog: 1-hour TTL
  - User sessions: Until logout
  - Shopping carts: 7-day TTL
- **CDN**: CloudFront for static assets (images, CSS, JS)
- **API Response Caching**: ETag-based caching for GET endpoints

### Monitoring
- **APM**: New Relic or DataDog for transaction tracing
- **Metrics**: Prometheus + Grafana
- **Alerts**:
  - Response time > 200ms (p95)
  - Error rate > 1%
  - Database connection pool > 80%

**Target Performance**:
- Homepage load: < 1s
- Search results: < 500ms
- Checkout flow: < 2s end-to-end
`
  });

  console.log(`✅ Added performance notes - version: ${perfUpdate.version}`);

  // ========================================================================
  // STEP 5: Retrieve Current Plan
  // ========================================================================
  console.log('\n📖 STEP 5: Retrieving Current Plan');
  console.log('─'.repeat(70));

  const currentPlan = await getPlan({ planId: 'DEMO-PLAN-ECOM' });

  console.log(`\nCurrent Plan Details:`);
  console.log(`  Plan ID: ${currentPlan.planId}`);
  console.log(`  Title: ${currentPlan.title}`);
  console.log(`  Version: ${currentPlan.version}`);
  console.log(`  Created by: ${currentPlan.createdBy}`);
  console.log(`  Last updated: ${currentPlan.updated}`);
  console.log(`  Previous versions: ${currentPlan.previousVersions.join(', ')}`);
  console.log(`  Content length: ${currentPlan.content.length} characters`);

  console.log(`\n📄 Plan Content Preview (first 500 characters):`);
  console.log('─'.repeat(70));
  console.log(currentPlan.content.substring(0, 500) + '...\n');

  // ========================================================================
  // STEP 6: View Version History
  // ========================================================================
  console.log('\n📚 STEP 6: Viewing Version History');
  console.log('─'.repeat(70));

  for (const version of [1, 2, 3, 4]) {
    const versionedPlan = await getPlan({
      planId: 'DEMO-PLAN-ECOM',
      version
    });

    console.log(`\nVersion ${version}:`);
    console.log(`  Content length: ${versionedPlan.content.length} characters`);
    console.log(`  Created: ${versionedPlan.created}`);
    console.log(`  Status: ${versionedPlan.status}`);
  }

  // ========================================================================
  // STEP 7: List All Plans for Project
  // ========================================================================
  console.log('\n\n📋 STEP 7: Listing All Plans for Project');
  console.log('─'.repeat(70));

  const allPlans = await listPlans('DEMO-PROJECT');

  console.log(`\nFound ${allPlans.length} active plan(s):`);
  for (const plan of allPlans) {
    console.log(`\n  ${plan.title}`);
    console.log(`    Plan ID: ${plan.planId}`);
    console.log(`    Version: ${plan.version}`);
    console.log(`    Created by: ${plan.createdBy}`);
    console.log(`    Last updated: ${plan.updated}`);
    console.log(`    Size: ${plan.contentLength} characters`);
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n\n' + '═'.repeat(70));
  console.log('                         ✅ DEMONSTRATION COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n💡 Key Takeaways:');
  console.log('   1. Plans are created by Planning Agent with initial structure');
  console.log('   2. Multiple agents can incrementally update the same plan');
  console.log('   3. Version history is automatically maintained');
  console.log('   4. Sections can be updated independently');
  console.log('   5. All changes are tracked with timestamps and agent attribution');
  console.log('   6. Previous versions remain accessible for audit/comparison');

  console.log('\n📊 Plan Evolution:');
  console.log(`   Version 1: Initial plan created by planning-agent`);
  console.log(`   Version 2: Security requirements added by security-agent`);
  console.log(`   Version 3: Phase 1 status updated by orchestrator`);
  console.log(`   Version 4: Performance notes added by architect`);

  console.log('\n🚀 Next Steps for Real Usage:');
  console.log('   1. Start project-server: npm start --workspace=@legion/project-server');
  console.log('   2. Create Planning Agent via HTTP: POST /api/agents');
  console.log('   3. Agent analyzes requirements and creates initial plan via POST /api/plans');
  console.log('   4. As work progresses, agents update relevant sections');
  console.log('   5. Orchestrator monitors plan vs actual progress');
  console.log('   6. Plans evolve organically with project knowledge\n');
}

// Run the demonstration
demonstrateIncrementalPlanning()
  .then(() => {
    console.log('✅ Demo completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
