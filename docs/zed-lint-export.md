# Zed lint export for avenue

This repository currently has no dedicated ESLint, Stylelint, Prettier, or PHPCS config file.
The checks that are actually configured in-repo are:

- TypeScript compiler diagnostics from packages/ave-ui/tsconfig.base.json and packages/ave-ui/tsconfig.json
- PHP static analysis tooling via app/themes/loom/composer.json (phpstan dependencies)

Use the snippets below in Zed so lint behavior is driven by the same tools.

## 0) VS Code parity (IDE-level settings)

Your current VS Code behavior is mostly IDE-level, not repo-level. Relevant user settings currently in effect include:

- editor.formatOnSave: false
- editor.formatOnType: false
- files.trimTrailingWhitespace: true
- editor.tabSize: 3
- eslint.enable: true
- eslint.validate: [javascript, vue]
- eslint.probe: [javascript, javascriptreact, typescript, typescriptreact, html, vue, markdown, php, twig]
- phpcs.standard: WordPress
- prettier.tabWidth: 3
- prettier.useTabs: true

Installed VS Code extensions that influence diagnostics/formatting:

- dbaeumer.vscode-eslint
- esbenp.prettier-vscode
- bmewburn.vscode-intelephense-client
- denoland.vscode-deno

Closest Zed settings export for parity:

```json
{
  "tab_size": 3,
  "format_on_save": "off",
  "use_on_type_format": false,
  "remove_trailing_whitespace_on_save": true,
  "diagnostics": {
    "include_warnings": true
  },
  "languages": {
    "JavaScript": {
      "format_on_save": "off"
    },
    "TypeScript": {
      "format_on_save": "off"
    },
    "CSS": {
      "format_on_save": "off"
    },
    "SCSS": {
      "format_on_save": "off"
    },
    "PHP": {
      "format_on_save": "off"
    },
    "HTML": {
      "format_on_save": "off"
    }
  }
}
```

Notes:
- Zed does not mirror VS Code extension settings 1:1. The biggest source of differences is extension/LSP behavior.
- Keep lint checks task-driven for consistency across editors.

## 1) Project tasks for lint checks

Create this file in your project as .zed/tasks.json:

```json
[
  {
    "label": "lint: eslint (if available)",
    "command": "pnpm",
    "args": ["exec", "eslint", "."],
    "cwd": "$ZED_WORKTREE_ROOT",
    "reveal": "always",
    "hide": "never",
    "use_new_terminal": false,
    "allow_concurrent_runs": false
  },
  {
    "label": "lint: phpcs wordpress (if available)",
    "command": "phpcs",
    "args": ["--standard=WordPress", "app/themes/loom"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "reveal": "always",
    "hide": "never",
    "use_new_terminal": false,
    "allow_concurrent_runs": false
  },
  {
    "label": "lint: ave-ui typescript",
    "command": "pnpm",
    "args": ["--filter", "ave-ui", "exec", "tsc", "-p", "tsconfig.json", "--noEmit"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "reveal": "always",
    "hide": "never",
    "use_new_terminal": false,
    "allow_concurrent_runs": false
  },
  {
    "label": "lint: loom phpstan",
    "command": "./vendor/bin/phpstan",
    "args": ["analyse"],
    "cwd": "$ZED_WORKTREE_ROOT/app/themes/loom",
    "reveal": "always",
    "hide": "never",
    "use_new_terminal": false,
    "allow_concurrent_runs": false
  }
]
```

Notes:
- The ESLint task requires eslint to be installed in the workspace or available globally.
- The PHPCS task requires phpcs and the WordPress standard to be installed on your machine.

## 2) Optional Zed settings to reduce editor-only differences

Add this to your Zed settings.json (user or project):

```json
{
  "diagnostics_max_severity": "warning",
  "languages": {
    "TypeScript": {
      "format_on_save": "off",
      "formatter": "language_server"
    },
    "JavaScript": {
      "format_on_save": "off",
      "formatter": "language_server"
    },
    "PHP": {
      "format_on_save": "off",
      "formatter": "language_server"
    }
  }
}
```

Notes:
- Keep format_on_save off if you want to separate linting from formatting.
- If you prefer auto-format, set format_on_save to on and configure a formatter explicitly for each language.

## 3) TypeScript rules that currently drive diagnostics

From packages/ave-ui/tsconfig.base.json:

- strict: true
- noUnusedLocals: true
- noUnusedParameters: true
- noImplicitReturns: true
- noFallthroughCasesInSwitch: true
- useUnknownInCatchVariables: true
- isolatedModules: true
- verbatimModuleSyntax: true

From packages/ave-ui/tsconfig.json:

- erasableSyntaxOnly: true
- noEmit: true
