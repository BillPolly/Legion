/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Type declarations for @legion/actors
 * TODO: Move these to the actors package itself
 */

declare module '@legion/actors' {
  export class ActorSpace {
    constructor(id: string);
    register(actor: any, id: string): void;
    addChannel(ws: any, actor: any): any;
    destroy(): Promise<void>;
  }
}
