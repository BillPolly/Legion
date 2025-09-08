/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * DatabaseConnectionTool - Manages MongoDB connection for design database
 */

import { Tool } from '@legion/tools-registry';
import { MongoClient } from 'mongodb';

// Input schema as plain JSON Schema
const databaseConnectionToolInputSchema = {
  type: 'object',
  properties: {
    uri: {
      type: 'string',
      description: 'MongoDB connection URI'
    },
    options: {
      type: 'object',
      properties: {
        dbName: {
          type: 'string',
          description: 'Database name'
        }
      }
    }
  }
};

// Output schema as plain JSON Schema
const databaseConnectionToolOutputSchema = {
  type: 'object',
  properties: {
    connected: {
      type: 'boolean',
      description: 'Connection status'
    },
    uri: {
      type: 'string',
      description: 'MongoDB URI (with credentials hidden)'
    },
    database: {
      type: 'string',
      description: 'Database name'
    }
  },
  required: ['connected', 'uri', 'database']
};

export class DatabaseConnectionTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'database_connect',
      description: 'Connect to the design database',
      inputSchema: databaseConnectionToolInputSchema,
      outputSchema: databaseConnectionToolOutputSchema
    });
    
    this.resourceManager = dependencies.resourceManager;
    this.connection = null;
    this.db = null;
  }

  async _execute(args) {
    try {
      this.emit('progress', { percentage: 0, status: 'Connecting to database...' });
      
      const uri = args.uri || this.resourceManager?.get('env.MONGODB_URI') || 
                  'mongodb://localhost:27017/sd-design';
      
      // Create connection
      this.connection = new MongoClient(uri);
      await this.connection.connect();
      
      // Get database
      const dbName = args.options?.dbName || 'sd-design';
      this.db = this.connection.db(dbName);
      
      // Test connection
      await this.db.admin().ping();
      
      this.emit('progress', { percentage: 100, status: 'Connected to database' });
      
      return {
        connected: true,
        uri: uri.replace(/\/\/.*@/, '//***@'), // Hide credentials
        database: dbName
      };
      
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }
  
  getDatabase() {
    return this.db;
  }
  
  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}