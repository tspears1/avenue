#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import cli from "ave-cli";
import { TokenTransformError } from "../src/figma-transformer.js";
import { compileSourceTokens } from "../src/source-compiler.js";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultSchemaPath = path.join(
  packageDirectory,
  "schemas",
  "source-transform.json",
);

function usage() {
  return [
    "Usage: ave-tokens-source [options]",
    "",
    "Options:",
    "  --schema <path>  Source transformation schema",
    "  --output <path>  Override canonical tokens.json output",
    "  --check          Fail when tokens.json differs from the YAML sources",
    "  --quiet          Suppress interactive CLI presentation",
    "  --help           Show this help message",
  ].join("\n");
}

function parseArguments(argumentsList) {
  const options = {
    schemaPath: defaultSchemaPath,
    write: true,
    check: false,
    quiet: false,
    help: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--") {
      const positional = argumentsList[index + 1];

      if (positional !== undefined) {
        throw new TokenTransformError(`Unexpected positional argument "${positional}".`);
      }

      break;
    }

    if (argument === "--check") {
      options.check = true;
      options.write = false;
      continue;
    }

    if (argument === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (argument === "--help") {
      options.help = true;
      continue;
    }

    if (["--schema", "--output"].includes(argument)) {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new TokenTransformError(`${argument} requires a path.`);
      }

      options[argument === "--schema" ? "schemaPath" : "outputPath"] =
        path.resolve(value);
      index += 1;
      continue;
    }

    if (!argument.startsWith("-")) {
      throw new TokenTransformError(`Unexpected positional argument "${argument}".`);
    }

    throw new TokenTransformError(`Unknown option "${argument}".`);
  }

  return options;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const separatorIndex = argumentsList.indexOf("--");
  let options = {
    quiet: argumentsList
      .slice(0, separatorIndex === -1 ? argumentsList.length : separatorIndex)
      .includes("--quiet"),
  };
  let spinner;

  try {
    options = parseArguments(argumentsList);

    if (options.help) {
      console.log(usage());
      return;
    }

    if (!options.quiet) {
      cli.prompts.intro(cli.kleur.cyan("Avenue Tokens · Source"));
      spinner = cli.prompts.spinner();
      spinner.start(options.check ? "Checking canonical tokens" : "Compiling designer tokens");
    }

    const result = await compileSourceTokens(options);

    if (spinner) {
      spinner.stop(
        options.check
          ? "Canonical tokens are current"
          : `Generated ${path.relative(process.cwd(), result.outputPath)}`,
      );
    }

    if (!options.quiet) {
      cli.prompts.note(
        [
          `${cli.kleur.bold("YAML sources:")} ${result.sourceCount}`,
          `${cli.kleur.bold("Canonical tokens:")} ${result.tokenCount}`,
          `${cli.kleur.bold("Output:")} ${path.relative(process.cwd(), result.outputPath)}`,
        ].join("\n"),
        "Compile summary",
      );
      cli.prompts.outro(
        cli.kleur.green(options.check ? "Designer tokens valid" : "Designer tokens compiled"),
      );
    }
  } catch (error) {
    if (spinner) {
      spinner.stop("Compile failed", 1);
    }

    const message =
      error instanceof TokenTransformError ? error.message : String(error);

    if (options.quiet) {
      console.error(message);
    } else {
      cli.prompts.log.error(cli.kleur.red(message));
      cli.prompts.outro(cli.kleur.red("Designer token compile failed"));
    }

    process.exitCode = 1;
  }
}

await main();
