/**
 * @legion/computer-use types and schemas
 */

import { z } from '@legion/schema';

/**
 * Browser agent configuration options
 */
export const ComputerUseOptionsSchema = z.object({
  headless: z.boolean().optional().default(false),
  width: z.number().optional().default(1440),
  height: z.number().optional().default(900),
  startUrl: z.string().optional().default('https://www.google.com'),
  maxTurns: z.number().optional().default(30),
  excludedActions: z.array(z.string()).optional().default([]),
  allowlistHosts: z.array(z.string()).optional(),
  outDir: z.string().optional().default('output_agent_runs'),
  stepTimeBudgetMs: z.number().optional().default(60000),
  totalTimeBudgetMs: z.number().optional().default(600000),
  redact: z.function().optional()
});

/**
 * Function call schema from LLM
 */
export const FunctionCallSchema = z.object({
  name: z.string(),
  args: z.any()
});

/**
 * Accessibility node (pruned)
 */
export const AXNodeLiteSchema = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ]).optional(),
  disabled: z.boolean().optional(),
  checked: z.boolean().optional(),
  focused: z.boolean().optional(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).nullable().optional()
});

/**
 * Page state snapshot
 */
export const StateSnapshotSchema = z.object({
  url: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number()
  }),
  ax: z.array(AXNodeLiteSchema),
  dom: z.object({
    nodes: z.array(z.object({
      tag: z.string(),
      id: z.string().optional(),
      name: z.string().optional(),
      role: z.string().optional(),
      aria: z.string().optional(),
      text: z.string().optional()
    }))
  }),
  recentRequests: z.array(z.object({
    method: z.string(),
    url: z.string(),
    status: z.number().optional()
  }))
});

/**
 * Action result
 */
export const ActionResultSchema = z.object({
  name: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  url: z.string().optional()
});

/**
 * Task execution result
 */
export const TaskResultSchema = z.object({
  ok: z.boolean(),
  resultText: z.string().optional(),
  error: z.string().optional(),
  outDir: z.string()
});
