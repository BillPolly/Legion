---
name: analyze-dependencies
description: Identify external dependencies, packages, and integrations needed
variables:
  - projectType
  - components
  - features
responseSchema:
  type: object
  required: [dependencies, integrations, devDependencies]
  properties:
    dependencies:
      type: array
      items:
        type: object
        required: [name, purpose, category]
        properties:
          name:
            type: string
            description: Package or library name
          purpose:
            type: string
            description: What this dependency is for
          category:
            type: string
            enum: [framework, database, auth, utility, validation, testing, logging]
    integrations:
      type: array
      items:
        type: object
        required: [service, purpose, required]
        properties:
          service:
            type: string
            description: External service name (e.g., "Stripe", "SendGrid", "AWS S3")
          purpose:
            type: string
            description: What this integration provides
          required:
            type: boolean
            description: Whether this is essential or optional
    devDependencies:
      type: array
      items:
        type: string
        description: Development tool or testing library
---

# Analyze Dependencies

Based on the project components and features, identify required dependencies:

**Project Type:** {{projectType}}

**Components:**
{{#each components}}
- {{name}} ({{type}}): {{purpose}}
{{/each}}

**Features:**
{{#each features}}
- {{name}}: {{description}}
{{/each}}

## Dependency Analysis:

### Runtime Dependencies:
Identify packages needed for the application to run:

1. **Framework Dependencies**:
   - For API: Express, Fastify, or Koa?
   - For webapp: React, Vue, or vanilla?
   - For CLI: Commander, Yargs?

2. **Database Dependencies**:
   - If database component exists: mongoose, pg, mysql2?
   - ORM needs: Prisma, TypeORM, Sequelize?

3. **Authentication Dependencies**:
   - If auth component: passport, jsonwebtoken, bcrypt?
   - OAuth: passport strategies?

4. **Utility Dependencies**:
   - Validation: joi, zod, yup?
   - Date handling: date-fns, moment?
   - HTTP client: axios, node-fetch?

### External Integrations:
Identify third-party services needed:

- Payment processing → Stripe, PayPal
- Email sending → SendGrid, AWS SES  
- File storage → AWS S3, Cloudinary
- Search → Elasticsearch, Algolia
- Analytics → Google Analytics, Mixpanel
- Monitoring → Sentry, DataDog

### Development Dependencies:
Tools needed for development and testing:

- Testing: jest, mocha, chai
- Linting: eslint, prettier
- Build tools: webpack, vite, esbuild
- Type checking: typescript
- Documentation: jsdoc, swagger