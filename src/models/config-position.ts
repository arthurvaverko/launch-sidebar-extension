import * as vscode from 'vscode';

/**
 * Interface to track position of a configuration in a document
 * Used for navigating to the exact position of a configuration when editing
 */
export interface ConfigPosition {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  uri: vscode.Uri;
}
