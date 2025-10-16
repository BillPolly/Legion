import * as vscode from 'vscode';
import type { FlashcardArgs } from '../types.js';

let flashcardPanel: vscode.WebviewPanel | null = null;
let closeTimeout: NodeJS.Timeout | null = null;

export async function showFlashcard(args: FlashcardArgs): Promise<any> {
  const column = args.column ?? vscode.ViewColumn.Three;
  const title = args.title || '';
  const subtitle = args.subtitle || '';
  const durationMs = 2000; // 2 seconds

  // Clear any existing timeout
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }

  // Create panel if it doesn't exist
  if (!flashcardPanel) {
    flashcardPanel = vscode.window.createWebviewPanel(
      'orchestratorFlashcard',
      'Demo Progress',
      column as vscode.ViewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Clear panel reference when disposed
    flashcardPanel.onDidDispose(() => {
      flashcardPanel = null;
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
    });
  }

  // Update the webview content
  flashcardPanel.webview.html = getFlashcardHtml(title, subtitle, durationMs);

  // Reveal the panel in case it was hidden
  flashcardPanel.reveal(column as vscode.ViewColumn, true);

  // Auto-close after duration
  closeTimeout = setTimeout(() => {
    if (flashcardPanel) {
      flashcardPanel.dispose();
      flashcardPanel = null;
    }
    closeTimeout = null;
  }, durationMs);

  return {
    title,
    subtitle,
    column,
    duration: durationMs
  };
}

export async function closeFlashcard(): Promise<any> {
  if (flashcardPanel) {
    flashcardPanel.dispose();
    flashcardPanel = null;
    return { closed: true };
  }
  return { closed: false, message: 'No flashcard panel open' };
}

function getFlashcardHtml(title: string, subtitle: string, durationMs: number): string {
  const fadeOutStart = durationMs - 500; // Start fade 500ms before close
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flashcard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes fadeOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.95);
      }
    }

    body.fade-out {
      animation: fadeOut 0.5s ease-out forwards;
    }

    .card {
      text-align: center;
      padding: 48px;
      max-width: 800px;
    }

    h1 {
      color: white;
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 24px;
      text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      line-height: 1.2;
    }

    p {
      color: rgba(255, 255, 255, 0.95);
      font-size: 28px;
      font-weight: 300;
      line-height: 1.6;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .subtitle {
      margin-top: 16px;
      font-size: 24px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  </div>
  <script>
    // Start fade out before close
    setTimeout(() => {
      document.body.classList.add('fade-out');
    }, ${fadeOutStart});
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
