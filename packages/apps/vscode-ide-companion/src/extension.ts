/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import semver from 'semver';
import { DiffContentProvider, DiffManager } from './diff-manager.js';
import { createLogger } from './utils/logger.js';
import {
  detectIdeFromEnv,
  IDE_DEFINITIONS,
  type IdeInfo,
} from './detect-ide.js';

const CLI_IDE_COMPANION_IDENTIFIER = 'legion.vscode-ide-companion';
const INFO_MESSAGE_SHOWN_KEY = 'legionCliInfoMessageShown';
export const DIFF_SCHEME = 'legion-diff';

/**
 * In these environments the companion extension is installed and managed by the IDE instead of the user.
 */
const MANAGED_EXTENSION_SURFACES: ReadonlySet<IdeInfo['name']> = new Set([
  IDE_DEFINITIONS.cloudshell.name,
]);

let logger: vscode.OutputChannel;

let log: (message: string) => void = () => {};

async function checkForUpdates(
  context: vscode.ExtensionContext,
  log: (message: string) => void,
  isManagedExtensionSurface: boolean,
) {
  try {
    const packageJSON = context.extension.packageJSON as { version: string };
    const currentVersion = packageJSON.version;

    // Fetch extension details from the VSCode Marketplace.
    const response = await fetch(
      'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json;api-version=7.1-preview.1',
        },
        body: JSON.stringify({
          filters: [
            {
              criteria: [
                {
                  filterType: 7, // Corresponds to ExtensionName
                  value: CLI_IDE_COMPANION_IDENTIFIER,
                },
              ],
            },
          ],
          // See: https://learn.microsoft.com/en-us/azure/devops/extend/gallery/apis/hyper-linking?view=azure-devops
          // 946 = IncludeVersions | IncludeFiles | IncludeCategoryAndTags |
          //       IncludeShortDescription | IncludePublisher | IncludeStatistics
          flags: 946,
        }),
      },
    );

    if (!response.ok) {
      log(
        `Failed to fetch latest version info from marketplace: ${response.statusText}`,
      );
      return;
    }

    const data = (await response.json()) as {
      results?: Array<{
        extensions?: Array<{
          versions?: Array<{ version: string }>;
        }>;
      }>;
    };
    const extension = data?.results?.[0]?.extensions?.[0];
    // The versions are sorted by date, so the first one is the latest.
    const latestVersion = extension?.versions?.[0]?.version;

    if (
      !isManagedExtensionSurface &&
      latestVersion &&
      semver.gt(latestVersion, currentVersion)
    ) {
      const selection = await vscode.window.showInformationMessage(
        `A new version (${latestVersion}) of the Legion IDE Companion extension is available.`,
        'Update to latest version',
      );
      if (selection === 'Update to latest version') {
        // The install command will update the extension if a newer version is found.
        await vscode.commands.executeCommand(
          'workbench.extensions.installExtension',
          CLI_IDE_COMPANION_IDENTIFIER,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error checking for extension updates: ${message}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  logger = vscode.window.createOutputChannel('Legion IDE Companion');
  log = createLogger(context, logger);
  log('Extension activated');

  const isManagedExtensionSurface = MANAGED_EXTENSION_SURFACES.has(
    detectIdeFromEnv().name,
  );

  void checkForUpdates(context, log, isManagedExtensionSurface);

  const diffContentProvider = new DiffContentProvider();
  const diffManager = new DiffManager(log, diffContentProvider);

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.scheme === DIFF_SCHEME) {
        void diffManager.cancelDiff(doc.uri);
      }
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      DIFF_SCHEME,
      diffContentProvider,
    ),
    vscode.commands.registerCommand(
      'legion.diff.accept',
      (uri?: vscode.Uri) => {
        const docUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (docUri && docUri.scheme === DIFF_SCHEME) {
          void diffManager.acceptDiff(docUri);
        }
      },
    ),
    vscode.commands.registerCommand(
      'legion.diff.cancel',
      (uri?: vscode.Uri) => {
        const docUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (docUri && docUri.scheme === DIFF_SCHEME) {
          void diffManager.cancelDiff(docUri);
        }
      },
    ),
  );

  if (
    !context.globalState.get(INFO_MESSAGE_SHOWN_KEY) &&
    !isManagedExtensionSurface
  ) {
    void vscode.window.showInformationMessage(
      'Legion IDE Companion extension successfully installed.',
    );
    context.globalState.update(INFO_MESSAGE_SHOWN_KEY, true);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('legion.runCLI', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showInformationMessage(
          'No folder open. Please open a folder to run Legion CLI.',
        );
        return;
      }

      let selectedFolder: vscode.WorkspaceFolder | undefined;
      if (workspaceFolders.length === 1) {
        selectedFolder = workspaceFolders[0];
      } else {
        selectedFolder = await vscode.window.showWorkspaceFolderPick({
          placeHolder: 'Select a folder to run Legion CLI in',
        });
      }

      if (selectedFolder) {
        const legionCmd = 'legion';
        const terminal = vscode.window.createTerminal({
          name: `Legion CLI (${selectedFolder.name})`,
          cwd: selectedFolder.uri.fsPath,
        });
        terminal.show();
        terminal.sendText(legionCmd);
      }
    }),
    vscode.commands.registerCommand('legion.showNotices', async () => {
      const noticePath = vscode.Uri.joinPath(
        context.extensionUri,
        'NOTICES.txt',
      );
      await vscode.window.showTextDocument(noticePath);
    }),
  );
}

export function deactivate(): void {
  log('Extension deactivated');
  if (logger) {
    logger.dispose();
  }
}
