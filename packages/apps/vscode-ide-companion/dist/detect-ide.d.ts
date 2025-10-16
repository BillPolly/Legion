/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */
export declare const IDE_DEFINITIONS: {
    readonly cursor: {
        readonly name: "cursor";
        readonly displayName: "Cursor";
    };
    readonly cloudshell: {
        readonly name: "cloudshell";
        readonly displayName: "Cloud Shell";
    };
    readonly codespaces: {
        readonly name: "codespaces";
        readonly displayName: "GitHub Codespaces";
    };
    readonly vscode: {
        readonly name: "vscode";
        readonly displayName: "VS Code";
    };
    readonly vscodefork: {
        readonly name: "vscodefork";
        readonly displayName: "IDE";
    };
};
export interface IdeInfo {
    name: string;
    displayName: string;
}
export declare function isCloudShell(): boolean;
export declare function detectIdeFromEnv(): IdeInfo;
export declare function detectIde(ideProcessInfo: {
    pid: number;
    command: string;
}, ideInfoFromFile?: {
    name?: string;
    displayName?: string;
}): IdeInfo | undefined;
