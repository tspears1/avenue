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
