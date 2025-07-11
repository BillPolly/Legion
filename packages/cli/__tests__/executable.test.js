import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../bin/jsenvoy');

describe('jsenvoy executable', () => {
  it('should exist and be executable', () => {
    expect(fs.existsSync(binPath)).toBe(true);
    
    const stats = fs.statSync(binPath);
    // Check if the file has execute permissions (owner)
    expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
  });

  it('should run without errors when called with no arguments', async () => {
    const { stdout, stderr } = await execAsync(`node ${binPath}`);
    expect(stderr).toBe('');
    expect(process.exitCode).not.toBe(1);
  });

  it('should use ES modules correctly', async () => {
    // Check that the executable contains ES module syntax
    const content = fs.readFileSync(binPath, 'utf8');
    expect(content).toContain('import CLI from');
    expect(content).toContain('#!/usr/bin/env node');
  });
});