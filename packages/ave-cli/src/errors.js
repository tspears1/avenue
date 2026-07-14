import * as p from "@clack/prompts";
import kleur from "kleur";

/**
 * Handle errors consistently across scripts.
 */
export function handleError(error, spinner = null) {
  if (spinner) {
    spinner.stop("Failed", 1);
  }

  p.log.error(error.message);

  if (error.stack) {
    console.error(kleur.dim(error.stack));
  }

  p.outro(kleur.red("Operation failed"));
  process.exit(1);
}
