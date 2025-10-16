/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';

export function createLogger(
  context: vscode.ExtensionContext,
  logger: vscode.OutputChannel,
) {
  return (message: string) => {
    const isDevMode =
      context.extensionMode === vscode.ExtensionMode.Development;
    const isLoggingEnabled = vscode.workspace
      .getConfiguration('legion.debug')
      .get('logging.enabled');

    if (isDevMode || isLoggingEnabled) {
      logger.appendLine(message);
    }
  };
}
