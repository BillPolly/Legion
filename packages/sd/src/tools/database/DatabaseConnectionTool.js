/**
 * DatabaseConnectionTool - Manages MongoDB connection for design database
 */

import { Tool, ToolResult } from '@legion/tools';
import { z } from 'zod';
import { MongoClient } from 'mongodb';

export class DatabaseConnectionTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'database_connect',
      description: 'Connect to the design database',
      inputSchema: z.object({
        uri: z.string().optional().describe('MongoDB connection URI'),
        options: z.object({
          dbName: z.string().optional()
        }).optional()
      })
    });
    
    this.resourceManager = dependencies.resourceManager;
    this.connection = null;
    this.db = null;
  }

  async execute(args) {
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
      
      return ToolResult.success({
        connected: true,
        uri: uri.replace(/\/\/.*@/, '//***@'), // Hide credentials
        database: dbName
      });
      
    } catch (error) {
      return ToolResult.failure(`Failed to connect to database: ${error.message}`);
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