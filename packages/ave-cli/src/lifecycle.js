import * as p from "@clack/prompts";
import kleur from "kleur";

/**
 * Prompt lifecycle helpers for consistent script UX.
 */

export function intro(title, icon = "🚀") {
  console.clear();
  p.intro(kleur.cyan(`${icon} ${title}`));
}

export function outroSuccess(message = "✨ Done!") {
  p.outro(kleur.green(message));
}

export function outroError(message = "Operation failed") {
  p.outro(kleur.red(message));
}

export function noteBox(title, content) {
  p.note(content, title);
}

/**
 * Print a bordered CLI section with a heading and body lines.
 *
 * @param {string} title
 * @param {string} content
 * @param {{
 *   icon?: string,
 *   indent?: string,
 *   spacingBefore?: number,
 *   spacingAfterTitle?: number,
 *   trailingBlankLine?: boolean,
 *   borderStyle?: (value: string) => string,
 *   iconStyle?: (value: string) => string,
 *   titleStyle?: (value: string) => string,
 * }} [options]
 */
export function logBorderedSection(title, content, options = {}) {
  const {
    icon = "◇",
    indent = "  ",
    spacingBefore = 1,
    spacingAfterTitle = 1,
    trailingBlankLine = true,
    borderStyle = (value) => kleur.dim(value),
    iconStyle = (value) => kleur.green(value),
    titleStyle = (value) => kleur.bold(value),
  } = options;

  const border = borderStyle("│");
  const lines = content.split("\n");

  if (trailingBlankLine) {
    lines.push("");
  }

  for (let index = 0; index < spacingBefore; index += 1) {
    console.log(border);
  }

  console.log(`${iconStyle(icon)}  ${titleStyle(title)}`);

  for (let index = 0; index < spacingAfterTitle; index += 1) {
    console.log(border);
  }

  for (const line of lines) {
    console.log(line === "" ? border : `${border}${indent}${line}`);
  }
}
