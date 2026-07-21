#!/usr/bin/env node

import { prompts as p, utils } from 'ave-cli'
import { existsSync } from 'node:fs'
import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const binDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(binDirectory, '..')
const sourceRoot = path.join(packageRoot, 'src')
const componentsRoot = path.join(sourceRoot, 'components')
const componentsIndexFile = path.join(componentsRoot, 'index.ts')

const {
    bold,
    dim,
    formatFileList,
    handleError,
    intro,
    noteBox,
    outroSuccess,
    success,
} = utils

function toKebabCase(value) {
    return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[_\s]+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
}

function toPascalCase(value) {
    return value
        .split('-')
        .filter(Boolean)
        .map((segment) =>
            segment.charAt(0).toUpperCase() + segment.slice(1)
        )
        .join('')
}

function toTitleCase(value) {
    return value
        .split('-')
        .filter(Boolean)
        .map((segment) =>
            segment.charAt(0).toUpperCase() + segment.slice(1)
        )
        .join(' ')
}

function toSlug(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-{2,}/g, '-')
}

function splitCsv(value, mapper = (entry) => entry) {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(mapper)
}

function createManifest({
    componentName,
    displayName,
    description,
    tag,
    category,
    includeAcf,
    includeBlock,
    acfDependencies,
}) {
    const manifest = {
        $schema:
            'https://github.com/bostonuniversity/avenue/schemas/component-manifest.schema.json',
        name: componentName,
        displayName,
        description,
        version: '1.0.0',
        tag,
        schema: `./${componentName}.schema.json`,
        docs: {
            storybook: `http://localhost:6006/?path=/docs/${toSlug(category)}-${componentName}--docs`,
        },
        exports: {
            php: [`${componentName}.class.php`],
            ...(includeAcf
                ? {
                      acf: [`${componentName}.acf.php`],
                  }
                : {}),
        },
        ...(includeAcf
            ? {
                  integrations: {
                      wordpress: {
                          acfFields: {
                              supported: true,
                              file: `${componentName}.acf.php`,
                              groupKey: `group_${componentName.replace(/-/g, '_')}_component`,
                              dependencies: acfDependencies,
                          },
                          ...(includeBlock
                              ? {
                                    acfBlock: {
                                        supported: true,
                                        file: `${componentName}.block.php`,
                                        name: `avenue/${componentName}`,
                                    },
                                }
                              : {}),
                      },
                  },
              }
            : {}),
    }

    return `${JSON.stringify(manifest, null, 3)}\n`
}

function createLitTemplate({
    componentName,
    className,
    tag,
}) {
    return `// Lit ===============================================================
import { unsafeCSS } from 'lit'
import { html } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'

// Avenue ============================================================
import AvenueElement from '../../internal/avenue-element'

// Component =========================================================
import rawStyles from './${componentName}.styles.css?inline'

/**
 * @component ${tag}
 * @since 0.0.1
 *
 * @slot - Optional slotted content that replaces the label.
 *
 * @property {string} label - Fallback content shown when no slot content is provided.
 *
 * @csspart root - The root wrapper element.
 */

@customElement('${tag}')
export class ${className} extends AvenueElement {
   static css = [unsafeCSS(rawStyles)]

   @property() label: string = ''

   render() {
        return html\`
         <div part="root">
            <slot>${'${this.label}'}</slot>
         </div>
        \`
   }
}
`
}

function createStylesTemplate({ componentName }) {
    return `@layer component {

   :host {
      display: block;
   }

   [part="root"] {
      display: block;
   }

   .${componentName} {
      display: contents;
   }
}
`
}

function createTypesTemplate({ className }) {
    return `/**
 * ${className} Component Types
 * Shared between TypeScript and PHP
 */

export interface ${className}Props {
   label?: string
}

export interface ${className}ACFField {
   label?: string
}
`
}

function createStoriesTemplate({
    componentName,
    className,
    displayName,
    tag,
    storybookCategory,
}) {
    return `// Storybook ============================================================
import type { Meta, StoryObj } from '@storybook/web-components-vite'

// Component ===========================================================
import type { ${className}Props } from './${componentName}.types.ts'
import './${componentName}.lit.ts'

const meta = {
   title: '${storybookCategory}/${displayName}',
   tags: ['autodocs'],
   render: (args) => {
      const component = document.createElement('${tag}')
      Object.assign(component, args)
      return component
   },
   argTypes: {
      label: {
         description: 'Fallback text rendered when no slot content is provided.',
      },
   },
   args: {
      label: '${displayName}',
   },
} satisfies Meta<${className}Props>

export default meta
type Story = StoryObj<${className}Props>

export const Default: Story = {
   args: {
      label: '${displayName}',
   },
}
`
}

function createSchemaTemplate({ componentName, displayName }) {
    const schema = {
        $schema:
            'https://github.com/bostonuniversity/avenue/schemas/component.schema.json',
        $id: `https://github.com/bostonuniversity/avenue/packages/ave-ui/src/components/${componentName}/${componentName}.schema.json`,
        title: displayName,
        type: 'component',
        props: {
            root: {
                label: {
                    type: 'string',
                    required: true,
                },
            },
        },
        attributes: {
            root: {
                allowGlobal: true,
                allowData: true,
                allowAria: true,
            },
        },
        slots: {
            root: {
                default: {
                    allowed: ['html'],
                    optional: true,
                },
            },
        },
        classes: {
            root: {
                allow: true,
            },
        },
    }

    return `${JSON.stringify(schema, null, 3)}\n`
}

function createPhpClassTemplate({
    componentName,
    className,
    tag,
}) {
    return `<?php

declare(strict_types=1);

namespace AvenueUI\\Components;

use AvenueUI\\Core\\AvenueElement;

final class ${className} extends AvenueElement
{
   protected static string $name = '${componentName}';

   protected static string $tag = '${tag}';

   protected static string $schema = __DIR__ . '/${componentName}.schema.json';
}
`
}

function createAcfTemplate({ componentName, displayName }) {
    return `<?php

declare(strict_types=1);

namespace AvenueUI\\ACF;

use Avenue\\ACF\\FieldBuilder as Field;

if (!function_exists('acf_add_local_field_group')) {
   return;
}

$component_name = '${componentName}';

$fields = [
   Field::build_field($component_name, 'label', [
      'label' => 'Label',
      'type' => 'text',
      'required' => 1,
      'instructions' => 'The text displayed in the component',
   ]),
];

$field_group = Field::build_field_group($component_name, $fields, [
   'title' => '${displayName}',
   'location' => [],
   'style' => 'seamless',
   'wrap' => false,
]);

acf_add_local_field_group($field_group);
`
}

function createBlockTemplate({
    componentName,
    className,
    displayName,
    description,
    icon,
    keywords,
}) {
    return `<?php

declare(strict_types=1);

namespace AvenueUI\\Blocks;

use Avenue\\ACF\\FieldBuilder;
use AvenueUI\\Components\\${className};

return [
\t'name' => '${componentName}',
\t'title' => '${displayName}',
\t'description' => '${description}',
\t'field_group_key' => FieldBuilder::build_group_key('${componentName}', 'component'),
\t'category' => 'ave-components',
\t'icon' => '${icon}',
\t'keywords' => [${keywords.map((keyword) => `'${keyword}'`).join(', ')}],
\t'component' => ${className}::class,
\t'preview_props' => [
\t\t'label' => '${displayName}',
\t],
\t'supports' => [
\t\t'align' => true,
\t\t'anchor' => true,
\t\t'mode' => true,
\t\t'jsx' => false,
\t\t'html' => false,
\t\t'customClassName' => true,
\t\t'className' => true,
\t],
];
`
}

async function updateComponentsIndex({
    componentName,
    className,
}) {
    const importLine = `import './${componentName}/${componentName}.lit'`
    const exportLine = `export { ${className} } from './${componentName}/${componentName}.lit'`

    let content = ''

    if (existsSync(componentsIndexFile)) {
        content = await readFile(componentsIndexFile, 'utf8')

        if (content.includes(importLine) || content.includes(exportLine)) {
            return
        }

        content = content.trimEnd()
        content += `\n${importLine}\n\n${exportLine}\n`
    } else {
        content = `${importLine}\n\n${exportLine}\n`
    }

    await writeFile(componentsIndexFile, content)
}

async function main() {
    intro('Create ave-ui Component', '◆')

    const answers = await p.group(
        {
            componentName: () =>
                p.text({
                    message: 'Component name (kebab-case)',
                    placeholder: 'alert-banner',
                    validate: (value) => {
                        if (!value) {
                            return 'Component name is required'
                        }

                        const normalized = toKebabCase(value)

                        if (normalized !== value) {
                            return 'Use lowercase kebab-case only'
                        }

                        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
                            return 'Use letters, numbers, and single hyphens'
                        }
                    },
                }),

            displayName: ({ results }) =>
                p.text({
                    message: 'Display name',
                    initialValue: toTitleCase(results.componentName),
                    validate: (value) => {
                        if (!value) {
                            return 'Display name is required'
                        }
                    },
                }),

            description: ({ results }) =>
                p.text({
                    message: 'Description',
                    initialValue: `${results.displayName} component`,
                    validate: (value) => {
                        if (!value) {
                            return 'Description is required'
                        }
                    },
                }),

            category: () =>
                p.select({
                    message: 'Storybook category',
                    options: [
                        {
                            value: 'Atoms',
                            label: 'Atoms',
                        },
                        {
                            value: 'Molecules',
                            label: 'Molecules',
                        },
                        {
                            value: 'Organisms',
                            label: 'Organisms',
                        },
                        {
                            value: '__custom__',
                            label: 'Custom',
                        },
                    ],
                }),

            customCategory: ({ results }) =>
                results.category === '__custom__'
                    ? p.text({
                          message: 'Custom Storybook category',
                          placeholder: 'Layout',
                          validate: (value) => {
                              if (!value) {
                                  return 'Category is required'
                              }
                          },
                      })
                    : undefined,

            includeAcf: () =>
                p.confirm({
                    message: 'Include WordPress ACF field integration?',
                    initialValue: true,
                }),

            includeBlock: ({ results }) =>
                results.includeAcf
                    ? p.confirm({
                          message: 'Include WordPress ACF block registration?',
                          initialValue: true,
                      })
                    : false,

            acfDependencies: ({ results }) =>
                results.includeAcf
                    ? p.text({
                          message: 'ACF dependencies (comma-separated component names)',
                          placeholder: 'button, card',
                          initialValue: '',
                      })
                    : '',

            keywords: ({ results }) =>
                results.includeBlock
                    ? p.text({
                          message: 'Block keywords (comma-separated)',
                          initialValue: results.componentName,
                      })
                    : '',

            blockIcon: ({ results }) =>
                results.includeBlock
                    ? p.text({
                          message: 'WordPress dashicon',
                          initialValue: 'admin-generic',
                          validate: (value) => {
                              if (!value) {
                                  return 'Icon is required for block registration'
                              }
                          },
                      })
                    : '',
        },
        {
            onCancel: () => {
                p.cancel('Component generation canceled')
                process.exit(0)
            },
        }
    )

    const componentName = answers.componentName
    const className = toPascalCase(componentName)
    const tag = `ave-${componentName}`
    const componentDirectory = path.join(
        componentsRoot,
        componentName
    )

    const storybookCategory =
        answers.category === '__custom__'
            ? answers.customCategory
            : answers.category

    const includeAcf = answers.includeAcf
    const includeBlock = Boolean(answers.includeBlock)

    const acfDependencies = includeAcf
        ? splitCsv(
              answers.acfDependencies,
              toKebabCase
          )
        : []

    const blockKeywords = includeBlock
        ? splitCsv(answers.keywords).map((entry) =>
              entry.toLowerCase()
          )
        : []

    const spinner = p.spinner()
    spinner.start('Generating component files')

    try {
        if (existsSync(componentDirectory)) {
            throw new Error(
                `Component directory already exists: ${componentName}`
            )
        }

        await mkdir(componentDirectory, {
            recursive: true,
        })

        const files = [
            {
                name: `${componentName}.component.json`,
                content: createManifest({
                    componentName,
                    displayName: answers.displayName,
                    description: answers.description,
                    tag,
                    category: storybookCategory,
                    includeAcf,
                    includeBlock,
                    acfDependencies,
                }),
            },
            {
                name: `${componentName}.lit.ts`,
                content: createLitTemplate({
                    componentName,
                    className,
                    tag,
                }),
            },
            {
                name: `${componentName}.styles.css`,
                content: createStylesTemplate({
                    componentName,
                }),
            },
            {
                name: `${componentName}.types.ts`,
                content: createTypesTemplate({
                    className,
                }),
            },
            {
                name: `${componentName}.stories.ts`,
                content: createStoriesTemplate({
                    componentName,
                    className,
                    displayName: answers.displayName,
                    tag,
                    storybookCategory,
                }),
            },
            {
                name: `${componentName}.schema.json`,
                content: createSchemaTemplate({
                    componentName,
                    displayName: answers.displayName,
                }),
            },
            {
                name: `${componentName}.class.php`,
                content: createPhpClassTemplate({
                    componentName,
                    className,
                    tag,
                }),
            },
        ]

        if (includeAcf) {
            files.push({
                name: `${componentName}.acf.php`,
                content: createAcfTemplate({
                    componentName,
                    displayName: answers.displayName,
                }),
            })
        }

        if (includeBlock) {
            files.push({
                name: `${componentName}.block.php`,
                content: createBlockTemplate({
                    componentName,
                    className,
                    displayName: answers.displayName,
                    description: answers.description,
                    icon: answers.blockIcon,
                    keywords:
                        blockKeywords.length > 0
                            ? blockKeywords
                            : [componentName],
                }),
            })
        }

        for (const file of files) {
            await writeFile(
                path.join(componentDirectory, file.name),
                file.content
            )
        }

        await updateComponentsIndex({
            componentName,
            className,
        })

        spinner.stop(
            `Created ${success(files.length)} files for ${success(componentName)}`
        )

        noteBox(
            'Component created',
            `${bold('Location:')} ${dim(`src/components/${componentName}/`)}\n\n` +
                `${bold('Files:')}\n` +
                `${formatFileList(files.map((file) => file.name))}\n\n` +
                `${bold('Next:')}\n` +
                `  1. Run ${dim('pnpm run build:registry')}\n` +
                `  2. Run ${dim('pnpm build')}\n` +
                `  3. Implement component behavior in ${dim(`${componentName}.lit.ts`)}`
        )

        outroSuccess('Component scaffold complete')
    } catch (error) {
        handleError(error, spinner)
    }
}

main().catch((error) => {
    p.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
