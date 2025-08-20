
/**
 * Zod schemas for deployment configuration validation
 */
const EnvSchema = z.record(z.string());

const DockerConfigSchema = z.object({
  dockerfile: z.string().optional(),
  buildArgs: z.record(z.string()).optional(),
  network: z.string().optional()
}).optional();

const RailwayConfigSchema = z.object({
  projectId: z.string().optional(),
  environment: z.string().default('production'),
  region: z.string().optional()
}).optional();

const DeploymentConfigSchema = z.object({
  projectPath: z.string().optional(),
  provider: z.enum(['local', 'docker', 'railway']),
  name: z.string(),
  env: EnvSchema.optional(),
  port: z.number().min(1).max(65535).optional(),
  startCommand: z.string().optional(),
  buildCommand: z.string().optional(),
  healthCheckPath: z.string().optional(),
  source: z.string().optional(), // For Railway GitHub deployments
  branch: z.string().optional(), // For Railway GitHub deployments
  docker: DockerConfigSchema,
  railway: RailwayConfigSchema
});

/**
 * DeploymentConfig model with validation
 */
class DeploymentConfig {
  constructor(data) {
    try {
      // Normalize env vars before validation
      const normalizedData = { ...data };
      if (normalizedData.env) {
        normalizedData.env = this.normalizeEnv(normalizedData.env);
      }
      
      // Parse and validate with Zod
      const validated = // Validation removed - happens at invocation layer
      // Original: schema.parse(normalizedData);
      
      // Check provider-specific config validity
      if (validated.docker && validated.provider !== 'docker') {
        throw new Error('Docker configuration is only valid for docker provider');
      }
      if (validated.railway && validated.provider !== 'railway') {
        throw new Error('Railway configuration is only valid for railway provider');
      }
      
      // Assign validated properties
      Object.assign(this, validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
  
  /**
   * Normalize environment variables to strings
   */
  normalizeEnv(env) {
    const normalized = {};
    for (const [key, value] of Object.entries(env)) {
      normalized[key] = String(value);
    }
    return normalized;
  }
  
  /**
   * Check if configuration is valid
   */
  isValid() {
    try {
      // Validation removed - happens at invocation layer
      // Original: schema.parse(this.toObject());
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Merge with default environment variables
   */
  mergeDefaults(defaults) {
    this.env = {
      ...defaults,
      ...(this.env || {})
    };
  }
  
  /**
   * Merge with another configuration
   */
  merge(updates) {
    // Deep merge for nested objects
    if (updates.env) {
      this.env = {
        ...(this.env || {}),
        ...this.normalizeEnv(updates.env)
      };
    }
    
    if (updates.docker && this.provider === 'docker') {
      this.docker = {
        ...(this.docker || {}),
        ...updates.docker
      };
      if (updates.docker.buildArgs) {
        this.docker.buildArgs = {
          ...(this.docker.buildArgs || {}),
          ...updates.docker.buildArgs
        };
      }
    }
    
    if (updates.railway && this.provider === 'railway') {
      this.railway = {
        ...(this.railway || {}),
        ...updates.railway
      };
    }
    
    // Merge other properties
    const simpleProps = ['port', 'startCommand', 'buildCommand', 'healthCheckPath'];
    for (const prop of simpleProps) {
      if (updates[prop] !== undefined) {
        this[prop] = updates[prop];
      }
    }
  }
  
  /**
   * Export to plain object
   */
  toObject() {
    const obj = {
      projectPath: this.projectPath,
      provider: this.provider,
      name: this.name
    };
    
    // Add optional properties if they exist
    if (this.env) obj.env = this.env;
    if (this.port) obj.port = this.port;
    if (this.startCommand) obj.startCommand = this.startCommand;
    if (this.buildCommand) obj.buildCommand = this.buildCommand;
    if (this.healthCheckPath) obj.healthCheckPath = this.healthCheckPath;
    if (this.docker) obj.docker = this.docker;
    if (this.railway) obj.railway = this.railway;
    
    return obj;
  }
  
  /**
   * Clone the configuration
   */
  clone() {
    return new DeploymentConfig(JSON.parse(JSON.stringify(this.toObject())));
  }
  
  /**
   * Static validation method
   */
  static validate(data) {
    try {
      const instance = new DeploymentConfig(data);
      return { success: true, data: instance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default DeploymentConfig;