#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import cli from "ave-cli";
import {
  TokenTransformError,
  transformFigmaTokens,
} from "../src/figma-transformer.js";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultConfigPath = path.join(
  packageDirectory,
  "schemas",
  "figma-transform.json",
);

function usage() {
  return [
    "Usage: ave-tokens [options]",
    "",
    "Options:",
    "  --config <path>  Transformation schema (default: schemas/figma-transform.json)",
    "  --source <path>  Override the source token file",
    "  --output <path>  Override the generated artifact path",
    "  --check          Fail when the generated artifact is missing or stale",
    "  --quiet          Suppress interactive CLI presentation",
    "  --help           Show this help message",
  ].join("\n");
}

function parseArguments(argumentsList) {
  const options = {
    configPath: defaultConfigPath,
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

    if (["--config", "--source", "--output"].includes(argument)) {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new TokenTransformError(`${argument} requires a path.`);
      }

      const key = {
        "--config": "configPath",
        "--source": "sourcePath",
        "--output": "outputPath",
      }[argument];
      options[key] = path.resolve(value);
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
      cli.prompts.intro(cli.kleur.cyan("Avenue Tokens · Figma"));
      spinner = cli.prompts.spinner();
      spinner.start(options.check ? "Checking Figma variables" : "Building Figma variables");
    }

    const result = await transformFigmaTokens(options);
    const { summary } = result.artifact;

    if (spinner) {
      spinner.stop(
        options.check
          ? "Figma token artifact is current"
          : `Generated ${path.relative(process.cwd(), result.outputPath)}`,
      );
    }

    if (!options.quiet) {
      cli.prompts.note(
        [
          `${cli.kleur.bold("Source tokens:")} ${summary.sourceTokens}`,
          `${cli.kleur.bold("Figma variables:")} ${summary.variables}`,
          `${cli.kleur.bold("Effect styles:")} ${summary.effectStyles}`,
          `${cli.kleur.bold("Excluded:")} ${summary.excluded}`,
          `${cli.kleur.bold("Collections:")} ${result.artifact.collections.length}`,
        ].join("\n"),
        "Build summary",
      );
      cli.prompts.outro(
        cli.kleur.green(options.check ? "Figma tokens current" : "Figma tokens built"),
      );
    }
  } catch (error) {
    if (spinner) {
      spinner.stop("Build failed", 1);
    }

    const message =
      error instanceof TokenTransformError ? error.message : String(error);

    if (options.quiet) {
      console.error(message);
    } else {
      cli.prompts.log.error(cli.kleur.red(message));
      cli.prompts.outro(cli.kleur.red("Figma token build failed"));
    }

    process.exitCode = 1;
  }
}

await main();
