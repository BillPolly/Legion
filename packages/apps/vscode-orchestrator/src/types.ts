export interface CommandEnvelope {
  id: string | number;
  cmd: string;
  args: any;
}

export interface ResponseEnvelope {
  id: string | number;
  ok: boolean;
  data?: any;
  error?: string;
  code?: string;
}

export interface OpenArgs {
  file: string;
  create?: boolean;
  language?: string;
  column?: number;
}

export interface TypeArgs {
  text: string;
  cps?: number;
}

export interface ChunkedInsertArgs {
  text: string;
  chunkSize?: number;
  intervalMs?: number;
}

export interface ReplaceAllArgs {
  text: string;
}

export interface SetCursorArgs {
  line: number;
  ch: number;
}

export interface RevealArgs {
  line: number;
  ch: number;
  strategy?: 'center' | 'top' | 'default';
}

export interface HighlightArgs {
  start: { line: number; ch: number };
  end: { line: number; ch: number };
  ms?: number;
}

export interface OpenUrlArgs {
  url: string;
  column?: number;
}

export interface SleepArgs {
  ms: number;
}

export interface BatchArgs {
  ops: Array<{ cmd: string; args: any }>;
}

export type CommandHandler = (args: any) => Promise<any>;
