/**
 * CodeMirror Bundle Mock for JSDOM Tests
 *
 * This mock replicates the browser bundle that combines all CodeMirror modules
 * into a single export. In the browser, /lib/codemirror/view serves a bundled
 * file with all modules. In JSDOM, we recreate this structure using the actual
 * CodeMirror npm packages.
 */

// Import all CodeMirror modules
import * as view from '@codemirror/view';
import * as state from '@codemirror/state';
import * as commands from '@codemirror/commands';
import * as language from '@codemirror/language';
import * as search from '@codemirror/search';
import * as autocomplete from '@codemirror/autocomplete';
import * as langJavascript from '@codemirror/lang-javascript';
import * as langPython from '@codemirror/lang-python';
import * as langHtml from '@codemirror/lang-html';
import * as langCss from '@codemirror/lang-css';
import * as langJson from '@codemirror/lang-json';
import * as themeOneDark from '@codemirror/theme-one-dark';
import fastDiffFn from 'fast-diff';

// Re-export everything from all modules in a single object
// This matches the structure of the browser bundle
export const EditorView = view.EditorView;
export const keymap = view.keymap;
export const lineNumbers = view.lineNumbers;
export const drawSelection = view.drawSelection;
export const dropCursor = view.dropCursor;
export const highlightActiveLineGutter = view.highlightActiveLineGutter;
export const highlightSpecialChars = view.highlightSpecialChars;
export const rectangularSelection = view.rectangularSelection;
export const crosshairCursor = view.crosshairCursor;
export const highlightActiveLine = view.highlightActiveLine;
export const Decoration = view.Decoration;

export const EditorState = state.EditorState;
export const EditorSelection = state.EditorSelection;
export const StateEffect = state.StateEffect;
export const StateField = state.StateField;

export const defaultKeymap = commands.defaultKeymap;
export const historyKeymap = commands.historyKeymap;
export const foldKeymap = commands.foldKeymap;
export const undo = commands.undo;
export const redo = commands.redo;
export const undoDepth = commands.undoDepth;
export const redoDepth = commands.redoDepth;
export const history = commands.history;

export const foldGutter = language.foldGutter;
export const syntaxHighlighting = language.syntaxHighlighting;
export const defaultHighlightStyle = language.defaultHighlightStyle;
export const bracketMatching = language.bracketMatching;

export const openSearchPanel = search.openSearchPanel;
export const searchKeymap = search.searchKeymap;

export const autocompletion = autocomplete.autocompletion;
export const completionKeymap = autocomplete.completionKeymap;
export const closeBrackets = autocomplete.closeBrackets;
export const closeBracketsKeymap = autocomplete.closeBracketsKeymap;

export const javascript = langJavascript.javascript;
export const python = langPython.python;
export const html = langHtml.html;
export const css = langCss.css;
export const json = langJson.json;

export const oneDark = themeOneDark.oneDark;

// fastDiff is imported as default export from 'fast-diff'
export const fastDiff = fastDiffFn;

// Default export containing everything (matches browser bundle)
export default {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  dropCursor,
  highlightActiveLineGutter,
  highlightSpecialChars,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  Decoration,
  EditorState,
  EditorSelection,
  StateEffect,
  StateField,
  defaultKeymap,
  historyKeymap,
  foldKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
  history,
  foldGutter,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  openSearchPanel,
  searchKeymap,
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  javascript,
  python,
  html,
  css,
  json,
  oneDark,
  fastDiff
};
