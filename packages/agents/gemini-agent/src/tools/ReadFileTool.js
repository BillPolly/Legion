import { ResourceManager } from '../utils/ResourceAccess.js';

class ReadFileTool {
  constructor() {
    this.name = 'read_file';
    this.schema = {
      type: 'object',
      properties: {
        absolute_path: { type: 'string' },
        offset: { type: 'number', optional: true },
        limit: { type: 'number', optional: true }
      },
      required: ['absolute_path']
    };
  }

  async execute(params, signal, updateOutput) {
    const { absolute_path, offset, limit } = params;
    const resourceManager = await ResourceManager.getInstance();

    try {
      const result = await resourceManager.readFile(absolute_path, offset, limit);
      return {
        content: result.content,
        path: absolute_path,
        lines: result.content.split('\n').length,
        truncated: result.truncated || false
      };
    } catch (error) {
      throw new Error(`Failed to read file ${absolute_path}: ${error.message}`);
    }
  }
}

export default ReadFileTool;
