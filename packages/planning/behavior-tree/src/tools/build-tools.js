/**
 * Build and Runtime Management Tools
 * Handles npm operations, server management, and process control
 */

import fs from 'fs/promises';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BuildTools {
  constructor(workingDirectory = './generated-webapp') {
    this.workingDir = workingDirectory;
    this.processes = new Map(); // Track running processes
    this.buildHistory = [];
    this.serverStatus = new Map(); // Track server instances
  }

  /**
   * Create npm installer tool
   */
  createNpmInstaller() {
    const self = this;
    return {
      name: 'npmInstaller',
      async execute(params) {
        const {
          packageManager = 'npm', // npm, yarn, pnpm
          forceClean = false,
          timeout = 300000 // 5 minutes
        } = params;

        // Check if package.json exists
        const packageJsonPath = path.join(self.workingDir, 'package.json');
        try {
          await fs.access(packageJsonPath);
        } catch {
          return {
            success: false,
            data: { error: 'package.json not found. Generate it first.' }
          };
        }

        // Clean node_modules if requested
        if (forceClean) {
          try {
            await fs.rm(path.join(self.workingDir, 'node_modules'), { recursive: true, force: true });
            await fs.rm(path.join(self.workingDir, 'package-lock.json'), { force: true });
            await fs.rm(path.join(self.workingDir, 'yarn.lock'), { force: true });
          } catch {
            // Ignore if files don't exist
          }
        }

        const commands = {
          npm: 'npm install',
          yarn: 'yarn install',
          pnpm: 'pnpm install'
        };

        const command = commands[packageManager] || commands.npm;

        try {
          const startTime = Date.now();
          const { stdout, stderr } = await execAsync(command, {
            cwd: self.workingDir,
            timeout
          });

          const executionTime = Date.now() - startTime;
          
          // Check if node_modules was created
          const nodeModulesExists = await fs.access(path.join(self.workingDir, 'node_modules'))
            .then(() => true)
            .catch(() => false);

          return {
            success: true,
            data: {
              packageManager,
              command,
              output: stdout,
              stderr: stderr || null,
              executionTime,
              nodeModulesExists,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          return {
            success: false,
            data: {
              error: `Installation failed: ${error.message}`,
              packageManager,
              command,
              stderr: error.stderr,
              timeout: error.code === 'SIGKILL' ? timeout : null
            }
          };
        }
      },
      getMetadata() {
        return {
          name: 'npmInstaller',
          description: 'Installs npm dependencies for web applications',
          input: {
            packageManager: { type: 'string', required: false },
            forceClean: { type: 'boolean', required: false },
            timeout: { type: 'number', required: false }
          },
          output: {
            packageManager: { type: 'string' },
            command: { type: 'string' },
            executionTime: { type: 'number' },
            nodeModulesExists: { type: 'boolean' }
          }
        };
      }
    };
  }

  /**
   * Create build runner tool
   */
  createBuildRunner() {
    const self = this;
    return {
      name: 'buildRunner',
      async execute(params) {
        const {
          command = 'build', // build, dev, start, test
          packageManager = 'npm',
          timeout = 120000, // 2 minutes for builds
          env = {}
        } = params;

        const buildCommands = {
          npm: {
            build: 'npm run build',
            dev: 'npm run dev',
            start: 'npm start',
            test: 'npm test',
            lint: 'npm run lint'
          },
          yarn: {
            build: 'yarn build',
            dev: 'yarn dev',
            start: 'yarn start',
            test: 'yarn test',
            lint: 'yarn lint'
          }
        };

        const fullCommand = buildCommands[packageManager]?.[command] || `${packageManager} run ${command}`;

        try {
          const startTime = Date.now();
          
          const { stdout, stderr } = await execAsync(fullCommand, {
            cwd: self.workingDir,
            timeout,
            env: { ...process.env, ...env }
          });

          const executionTime = Date.now() - startTime;

          // Check for common build outputs
          let buildOutput = null;
          if (command === 'build') {
            const commonBuildDirs = ['dist', 'build', '.next', 'out'];
            for (const dir of commonBuildDirs) {
              const buildPath = path.join(self.workingDir, dir);
              const exists = await fs.access(buildPath).then(() => true).catch(() => false);
              if (exists) {
                buildOutput = {
                  directory: dir,
                  path: buildPath,
                  exists: true
                };
                break;
              }
            }
          }

          // Log build history
          const buildRecord = {
            command: fullCommand,
            executionTime,
            success: true,
            buildOutput,
            timestamp: Date.now()
          };
          self.buildHistory.push(buildRecord);

          return {
            success: true,
            data: {
              command: fullCommand,
              output: stdout,
              stderr: stderr || null,
              executionTime,
              buildOutput,
              timestamp: Date.now()
            }
          };
        } catch (error) {
          const buildRecord = {
            command: fullCommand,
            success: false,
            error: error.message,
            timestamp: Date.now()
          };
          self.buildHistory.push(buildRecord);

          return {
            success: false,
            data: {
              error: `Build failed: ${error.message}`,
              command: fullCommand,
              stderr: error.stderr,
              code: error.code
            }
          };
        }
      },
      getMetadata() {
        return {
          name: 'buildRunner',
          description: 'Runs build commands for web applications',
          input: {
            command: { type: 'string', required: false },
            packageManager: { type: 'string', required: false },
            timeout: { type: 'number', required: false },
            env: { type: 'object', required: false }
          },
          output: {
            command: { type: 'string' },
            executionTime: { type: 'number' },
            buildOutput: { type: 'object' }
          }
        };
      }
    };
  }

  /**
   * Create server manager tool
   */
  createServerManager() {
    const self = this;
    return {
      name: 'serverManager',
      async execute(params) {
        const {
          action, // start, stop, restart, status
          command = 'dev',
          port = 3000,
          packageManager = 'npm',
          serverName = 'default',
          detached = true,
          waitForReady = true,
          readyTimeout = 30000
        } = params;

        if (!action) {
          return {
            success: false,
            data: { error: 'action is required (start, stop, restart, status)' }
          };
        }

        switch (action) {
          case 'start':
            return await this.startServer();
          case 'stop':
            return await this.stopServer();
          case 'restart':
            return await this.restartServer();
          case 'status':
            return await this.getServerStatus();
          default:
            return {
              success: false,
              data: { error: `Unknown action: ${action}` }
            };
        }

        async function startServer() {
          // Check if server is already running
          if (self.processes.has(serverName)) {
            const existingProcess = self.processes.get(serverName);
            if (!existingProcess.killed) {
              return {
                success: false,
                data: { error: `Server ${serverName} is already running`, pid: existingProcess.pid }
              };
            }
          }

          const serverCommands = {
            npm: `npm run ${command}`,
            yarn: `yarn ${command}`
          };

          const fullCommand = serverCommands[packageManager] || `${packageManager} run ${command}`;
          const [cmd, ...args] = fullCommand.split(' ');

          return new Promise((resolve) => {
            const serverProcess = spawn(cmd, args, {
              cwd: self.workingDir,
              detached,
              stdio: detached ? 'pipe' : 'inherit',
              env: { ...process.env, PORT: port.toString() }
            });

            let output = '';
            let serverReady = false;

            if (detached) {
              serverProcess.unref();
            }

            // Capture output to detect when server is ready
            if (serverProcess.stdout) {
              serverProcess.stdout.on('data', (data) => {
                output += data.toString();
                const text = data.toString().toLowerCase();
                
                // Common server ready indicators
                if (text.includes('server running') || 
                    text.includes('local:') ||
                    text.includes(`localhost:${port}`) ||
                    text.includes('development server') ||
                    text.includes('compiled successfully')) {
                  serverReady = true;
                }
              });
            }

            serverProcess.on('error', (error) => {
              resolve({
                success: false,
                data: { error: `Failed to start server: ${error.message}` }
              });
            });

            // Store process reference
            self.processes.set(serverName, serverProcess);
            self.serverStatus.set(serverName, {
              status: 'starting',
              pid: serverProcess.pid,
              port,
              command: fullCommand,
              startTime: Date.now()
            });

            if (waitForReady) {
              // Wait for server to be ready or timeout
              const readyCheck = setInterval(() => {
                if (serverReady) {
                  clearInterval(readyCheck);
                  self.serverStatus.set(serverName, {
                    status: 'running',
                    pid: serverProcess.pid,
                    port,
                    command: fullCommand,
                    startTime: Date.now(),
                    url: `http://localhost:${port}`
                  });

                  resolve({
                    success: true,
                    data: {
                      serverName,
                      pid: serverProcess.pid,
                      port,
                      command: fullCommand,
                      status: 'running',
                      url: `http://localhost:${port}`,
                      output: output.substring(0, 1000), // Truncate long output
                      timestamp: Date.now()
                    }
                  });
                }
              }, 500);

              setTimeout(() => {
                if (!serverReady) {
                  clearInterval(readyCheck);
                  resolve({
                    success: true, // Server started but we're not sure if it's ready
                    data: {
                      serverName,
                      pid: serverProcess.pid,
                      port,
                      command: fullCommand,
                      status: 'unknown',
                      warning: `Server started but ready status uncertain after ${readyTimeout}ms`,
                      output: output.substring(0, 1000),
                      timestamp: Date.now()
                    }
                  });
                }
              }, readyTimeout);
            } else {
              // Return immediately
              setTimeout(() => {
                resolve({
                  success: true,
                  data: {
                    serverName,
                    pid: serverProcess.pid,
                    port,
                    command: fullCommand,
                    status: 'started',
                    timestamp: Date.now()
                  }
                });
              }, 1000);
            }
          });
        }

        async function stopServer() {
          const process = self.processes.get(serverName);
          if (!process) {
            return {
              success: false,
              data: { error: `No server process found for ${serverName}` }
            };
          }

          try {
            process.kill('SIGTERM');
            
            // Wait a bit then force kill if needed
            setTimeout(() => {
              if (!process.killed) {
                process.kill('SIGKILL');
              }
            }, 5000);

            self.processes.delete(serverName);
            self.serverStatus.delete(serverName);

            return {
              success: true,
              data: {
                serverName,
                action: 'stopped',
                pid: process.pid,
                timestamp: Date.now()
              }
            };
          } catch (error) {
            return {
              success: false,
              data: { error: `Failed to stop server: ${error.message}` }
            };
          }
        }

        async function restartServer() {
          const stopResult = await stopServer();
          if (!stopResult.success) {
            return stopResult;
          }

          // Wait a moment before restarting
          await new Promise(resolve => setTimeout(resolve, 2000));

          return await startServer();
        }

        async function getServerStatus() {
          const status = self.serverStatus.get(serverName);
          const process = self.processes.get(serverName);

          if (!status && !process) {
            return {
              success: true,
              data: {
                serverName,
                status: 'not_running',
                timestamp: Date.now()
              }
            };
          }

          return {
            success: true,
            data: {
              serverName,
              ...status,
              processExists: !!process,
              processKilled: process ? process.killed : null,
              timestamp: Date.now()
            }
          };
        }
      },
      getMetadata() {
        return {
          name: 'serverManager',
          description: 'Manages development servers (start, stop, restart)',
          input: {
            action: { type: 'string', required: true },
            command: { type: 'string', required: false },
            port: { type: 'number', required: false },
            packageManager: { type: 'string', required: false },
            serverName: { type: 'string', required: false },
            detached: { type: 'boolean', required: false },
            waitForReady: { type: 'boolean', required: false },
            readyTimeout: { type: 'number', required: false }
          },
          output: {
            serverName: { type: 'string' },
            pid: { type: 'number' },
            port: { type: 'number' },
            status: { type: 'string' },
            url: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Create port manager tool
   */
  createPortManager() {
    const self = this;
    return {
      name: 'portManager',
      async execute(params) {
        const {
          action, // find, check, kill
          port,
          startPort = 3000,
          endPort = 4000
        } = params;

        if (!action) {
          return {
            success: false,
            data: { error: 'action is required (find, check, kill)' }
          };
        }

        const findAvailablePort = async () => {
          const net = await import('net');
          
          for (let testPort = startPort; testPort <= endPort; testPort++) {
            const available = await new Promise((resolve) => {
              const server = net.createServer();
              server.listen(testPort, (err) => {
                if (err) {
                  resolve(false);
                } else {
                  server.close(() => resolve(true));
                }
              });
              server.on('error', () => resolve(false));
            });

            if (available) {
              return {
                success: true,
                data: {
                  port: testPort,
                  available: true,
                  range: `${startPort}-${endPort}`,
                  timestamp: Date.now()
                }
              };
            }
          }

          return {
            success: false,
            data: { error: `No available ports found in range ${startPort}-${endPort}` }
          };
        };

        const checkPortAvailable = async () => {
          if (!port) {
            return {
              success: false,
              data: { error: 'port is required for check action' }
            };
          }

          const net = await import('net');
          
          const available = await new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, (err) => {
              if (err) {
                resolve(false);
              } else {
                server.close(() => resolve(true));
              }
            });
            server.on('error', () => resolve(false));
          });

          return {
            success: true,
            data: {
              port,
              available,
              timestamp: Date.now()
            }
          };
        };

        const killProcessOnPort = async () => {
          if (!port) {
            return {
              success: false,
              data: { error: 'port is required for kill action' }
            };
          }

          try {
            // Try to find and kill process on port (Unix-like systems)
            const { stdout } = await execAsync(`lsof -ti:${port}`, { timeout: 5000 });
            const pids = stdout.trim().split('\n').filter(Boolean);

            if (pids.length === 0) {
              return {
                success: true,
                data: {
                  port,
                  message: 'No processes found on port',
                  killed: [],
                  timestamp: Date.now()
                }
              };
            }

            const killed = [];
            for (const pid of pids) {
              try {
                await execAsync(`kill -9 ${pid}`);
                killed.push(parseInt(pid));
              } catch (error) {
                // Process might already be dead
              }
            }

            return {
              success: true,
              data: {
                port,
                killed,
                message: `Killed ${killed.length} process(es)`,
                timestamp: Date.now()
              }
            };
          } catch (error) {
            return {
              success: false,
              data: { error: `Failed to kill processes on port ${port}: ${error.message}` }
            };
          }
        };

        switch (action) {
          case 'find':
            return await findAvailablePort();
          case 'check':
            return await checkPortAvailable();
          case 'kill':
            return await killProcessOnPort();
          default:
            return {
              success: false,
              data: { error: `Unknown action: ${action}` }
            };
        }
      },
      getMetadata() {
        return {
          name: 'portManager',
          description: 'Manages ports (find available, check, kill processes)',
          input: {
            action: { type: 'string', required: true },
            port: { type: 'number', required: false },
            startPort: { type: 'number', required: false },
            endPort: { type: 'number', required: false }
          },
          output: {
            port: { type: 'number' },
            available: { type: 'boolean' },
            killed: { type: 'array' }
          }
        };
      }
    };
  }

  /**
   * Get build history
   */
  getBuildHistory() {
    return this.buildHistory;
  }

  /**
   * Get all running processes
   */
  getRunningProcesses() {
    const processes = {};
    for (const [name, process] of this.processes) {
      processes[name] = {
        pid: process.pid,
        killed: process.killed
      };
    }
    return processes;
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses() {
    return Object.fromEntries(this.serverStatus);
  }

  /**
   * Stop all running processes
   */
  stopAllProcesses() {
    let stopped = 0;
    for (const [name, process] of this.processes) {
      try {
        if (!process.killed) {
          process.kill('SIGTERM');
          stopped++;
        }
      } catch (error) {
        // Process might already be dead
      }
    }
    
    this.processes.clear();
    this.serverStatus.clear();
    
    return stopped;
  }
}