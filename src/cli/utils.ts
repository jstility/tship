/**
 * CLI helper utilities for consistent logging and error handling.
 * @module cli/utils
 */

import pc from "picocolors";

/**
 * Extract a human‑readable message from an unknown error value.
 *
 * @param {unknown} error - The error to extract a message from
 * @returns {string} The error message, or a string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Print a success message with a green checkmark.
 *
 * @param {string} message - The message to display
 * @returns {void}
 */
export function logSuccess(message: string): void {
  console.log(pc.green("✔"), message);
}

/**
 * Print an informational message with a blue info symbol.
 *
 * @param {string} message - The message to display
 * @returns {void}
 */
export function logInfo(message: string): void {
  console.log(pc.blue("ℹ"), message);
}

/**
 * Print a warning message with a yellow warning symbol.
 *
 * @param {string} message - The message to display
 * @returns {void}
 */
export function logWarning(message: string): void {
  console.warn(pc.yellow("⚠"), message);
}

/**
 * Print an error message with a red cross and exit the process.
 *
 * @param {string} message - The error message to display
 * @returns {never}
 */
export function logError(message: string): never {
  console.error(pc.red("✖"), message);
  process.exit(1);
}
