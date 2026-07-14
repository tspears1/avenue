import kleur from "kleur";

/**
 * Formatting helpers for CLI output.
 */

export function formatPath(path) {
  return kleur.cyan(path);
}

export function success(message) {
  return kleur.green(message);
}

export function error(message) {
  return kleur.red(message);
}

export function warning(message) {
  return kleur.yellow(message);
}

export function dim(message) {
  return kleur.dim(message);
}

export function bold(message) {
  return kleur.bold(message);
}

export function formatFileList(files) {
  return files.map((f) => `  ${kleur.cyan("•")} ${f}`).join("\n");
}

export function formatComponent(name, version, dependencies = []) {
  const depCount = dependencies.length;

  if (depCount === 0) {
    return `  ${name} ${kleur.gray(`v${version}`)}`;
  }

  if (depCount === 1) {
    const depName = dependencies[0].charAt(0).toUpperCase() + dependencies[0].slice(1);
    return `  ${name} ${kleur.gray(`v${version}`)} ${kleur.dim("→")} ${kleur.cyan(depName)}`;
  }

  const depLines = dependencies.map((dep, index) => {
    const isLast = index === dependencies.length - 1;
    const branch = isLast ? "└─" : "├─";
    const depName = dep.charAt(0).toUpperCase() + dep.slice(1);
    return `    ${kleur.dim(branch)} ${kleur.cyan(depName)}`;
  });

  return `  ${name} ${kleur.gray(`v${version}`)}\n${depLines.join("\n")}`;
}

export function progress(current, total, item = "") {
  const percent = Math.round((current / total) * 100);
  return `${current}/${total} ${kleur.dim(`(${percent}%)`)}${item ? ` • ${item}` : ""}`;
}

export function bulletList(items, color = "cyan") {
  const bullet = kleur[color]("•");
  return items.map((item) => `  ${bullet} ${item}`).join("\n");
}

export function keyValue(key, value) {
  return `${kleur.bold(key)}: ${value}`;
}
