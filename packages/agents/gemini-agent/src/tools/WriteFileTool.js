import { ResourceManager } from '../utils/ResourceAccess.js';

class WriteFileTool {
  constructor() {
    this.name = 'write_file';
    this.schema = {
      type: 'object',
      properties: {
        absolute_path: { type: 'string' },
        content: { type: 'string' },
        encoding: { type: 'string', optional: true }
      },
      required: ['absolute_path', 'content']
    };
  }

  async execute(params, signal, updateOutput) {
    const { absolute_path, content, encoding = 'utf8' } = params;
    const resourceManager = await ResourceManager.getInstance();

    try {
      await resourceManager.writeFile(absolute_path, content, encoding);
      return {
        success: true,
        path: absolute_path,
        bytes_written: Buffer.byteLength(content, encoding)
      };
    } catch (error) {
      throw new Error(`Failed to write file ${absolute_path}: ${error.message}`);
    }
  }
}

export default WriteFileTool;
