#!/usr/bin/env node

import {
    prompts as p,
    utils,
} from 'ave-cli'
import { existsSync } from 'node:fs'
import {
    mkdir,
    readdir,
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
const generatedRoot = path.join(sourceRoot, 'generated')

const metadataOutput = path.join(
    generatedRoot,
    'components.php'
)

const {
    bold,
    dim,
    error,
    formatPath,
    intro,
    logBorderedSection,
    outroError,
    outroSuccess,
    success,
    warning,
} = utils

async function main() {
    intro('Build Component Registry', '◆')

    const spinner = p.spinner()

    try {
        spinner.start('Loading component manifests')

        const loaded = await loadManifests()

        spinner.stop(
            `Loaded ${success(loaded.manifests.size)} valid component` +
                `${loaded.manifests.size === 1 ? '' : 's'}`
        )

        logSkipped(loaded.skipped)

        if (loaded.manifests.size === 0) {
            p.log.warn(
                'No valid components found; generated files were not changed.'
            )

            p.outro(warning('Nothing to build'))

            return
        }

        spinner.start('Resolving ACF field dependencies')

        const dependencyResult = resolveDependencies(
            loaded.manifests
        )

        spinner.stop(
            `Resolved dependencies for ` +
                `${success(dependencyResult.manifests.size)} ` +
                `component` +
                `${
                    dependencyResult.manifests.size === 1
                        ? ''
                        : 's'
                }`
        )

        logSkipped(dependencyResult.skipped)

        spinner.start('Checking dependency graph')

        const cycleResult = removeDependencyCycles(
            dependencyResult.manifests
        )

        spinner.stop(
            cycleResult.skipped.length === 0
                ? 'Dependency graph valid • No circular dependencies'
                : `Dependency graph checked • ` +
                      `${warning(cycleResult.skipped.length)} skipped`
        )

        logSkipped(cycleResult.skipped)

        const manifests = cycleResult.manifests

        const skipped = [
            ...loaded.skipped,
            ...dependencyResult.skipped,
            ...cycleResult.skipped,
        ]

        if (manifests.size === 0) {
            p.log.warn(
                'No buildable components remain; generated files were not changed.'
            )

            p.outro(warning('Nothing to build'))

            return
        }

        spinner.start('Normalizing component metadata')

        const registry = Object.fromEntries(
            [...manifests.entries()]
                .sort(([left], [right]) =>
                    left.localeCompare(right)
                )
                .map(([name, record]) => [
                    name,
                    normalizeManifest(record),
                ])
        )

        spinner.stop(
            `Normalized ` +
                `${success(Object.keys(registry).length)} ` +
                `component` +
                `${
                    Object.keys(registry).length === 1
                        ? ''
                        : 's'
                }`
        )

        await mkdir(generatedRoot, {
            recursive: true,
        })

        spinner.start('Generating component metadata')

        await writeFile(
            metadataOutput,
            renderMetadataFile(registry)
        )

        spinner.stop('Generated component metadata')

        logBorderedSection(
            'Build Summary',
            formatSummary(registry, skipped)
        )

        outroSuccess(`${success('✔')} ${bold('Build complete!')}`)
    } catch (error) {
        spinner.stop('Build failed')

        p.log.error(
            error instanceof Error
                ? error.message
                : String(error)
        )

        outroError(error('Registry build failed'))

        process.exitCode = 1
    }
}

/**
 * Load and validate each component independently.
 *
 * Invalid components are reported and skipped without stopping
 * the rest of the registry build.
 *
 * @returns {Promise<{
 *     manifests: Map<string, {
 *         manifest: Record<string, any>,
 *         file: string,
 *         directory: string
 *     }>,
 *     skipped: Array<{
 *         name: string,
 *         reason: string
 *     }>
 * }>}
 */
async function loadManifests() {
    const entries = await readdir(componentsRoot, {
        withFileTypes: true,
    })

    const manifests = new Map()
    const skipped = []

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue
        }

        const directory = path.join(
            componentsRoot,
            entry.name
        )

        const files = await readdir(directory)

        const manifestFiles = files.filter((file) =>
            file.endsWith('.component.json')
        )

        if (manifestFiles.length === 0) {
            skipped.push({
                name: entry.name,
                reason: 'No *.component.json manifest found',
            })

            continue
        }

        if (manifestFiles.length > 1) {
            skipped.push({
                name: entry.name,
                reason:
                    'Multiple manifests found: ' +
                    manifestFiles.join(', '),
            })

            continue
        }

        const file = path.join(
            directory,
            manifestFiles[0]
        )

        try {
            const manifest = JSON.parse(
                await readFile(file, 'utf8')
            )

            validateManifest(
                manifest,
                file,
                entry.name
            )

            if (manifests.has(manifest.name)) {
                throw new Error(
                    `Duplicate component name "${manifest.name}"`
                )
            }

            manifests.set(manifest.name, {
                manifest,
                file,
                directory,
            })
        } catch (error) {
            skipped.push({
                name: entry.name,
                reason:
                    error instanceof Error
                        ? error.message
                        : String(error),
            })
        }
    }

    return {
        manifests,
        skipped,
    }
}

/**
 * Validate one component manifest.
 *
 * Errors thrown here are caught by loadManifests(), causing only
 * the current component to be skipped.
 *
 * @param {Record<string, any>} manifest
 * @param {string} file
 * @param {string} directoryName
 */
function validateManifest(
    manifest,
    file,
    directoryName
) {
    assertObject(
        manifest,
        `Manifest ${relative(file)}`
    )

    for (const key of [
        'name',
        'displayName',
        'version',
        'schema',
    ]) {
        assertNonEmptyString(
            manifest[key],
            `"${key}" in ${relative(file)}`
        )
    }

    if (manifest.name !== directoryName) {
        throw new Error(
            `Manifest name "${manifest.name}" ` +
                `does not match directory "${directoryName}"`
        )
    }

    if (
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
            manifest.version
        )
    ) {
        throw new Error(
            `"version" in ${relative(file)} ` +
                'must use semantic versioning'
        )
    }

    assertLocalFile(
        path.resolve(
            path.dirname(file),
            manifest.schema
        ),
        `"schema" in ${relative(file)}`
    )

    const wordpress =
        manifest.integrations?.wordpress

    if (wordpress === undefined) {
        return
    }

    assertObject(
        wordpress,
        `"integrations.wordpress" in ${relative(file)}`
    )

    if (wordpress.acfFields !== undefined) {
        validateFieldsIntegration(
            wordpress.acfFields,
            file
        )
    }

    if (wordpress.acfBlock !== undefined) {
        validateBlockIntegration(
            wordpress.acfBlock,
            wordpress.acfFields,
            file
        )
    }
}

/**
 * Validate a WordPress ACF field integration.
 *
 * @param {Record<string, any>} fields
 * @param {string} manifestFile
 */
function validateFieldsIntegration(
    fields,
    manifestFile
) {
    assertObject(
        fields,
        `"integrations.wordpress.acfFields" in ` +
            relative(manifestFile)
    )

    assertBoolean(
        fields.supported,
        `"acfFields.supported" in ` +
            relative(manifestFile)
    )

    if (!fields.supported) {
        return
    }

    assertNonEmptyString(
        fields.file,
        `"acfFields.file" in ` +
            relative(manifestFile)
    )

    assertNonEmptyString(
        fields.groupKey,
        `"acfFields.groupKey" in ` +
            relative(manifestFile)
    )

    if (!Array.isArray(fields.dependencies)) {
        throw new Error(
            `"acfFields.dependencies" in ` +
                `${relative(manifestFile)} ` +
                'must be an array'
        )
    }

    for (const dependency of fields.dependencies) {
        assertNonEmptyString(
            dependency,
            `ACF dependency in ${relative(manifestFile)}`
        )
    }

    assertLocalFile(
        path.resolve(
            path.dirname(manifestFile),
            fields.file
        ),
        `"acfFields.file" in ${relative(manifestFile)}`
    )
}

/**
 * Validate a WordPress ACF block integration.
 *
 * An ACF block cannot be supported unless its ACF fields are
 * supported as well.
 *
 * @param {Record<string, any>} block
 * @param {Record<string, any>|undefined} fields
 * @param {string} manifestFile
 */
function validateBlockIntegration(
    block,
    fields,
    manifestFile
) {
    assertObject(
        block,
        `"integrations.wordpress.acfBlock" in ` +
            relative(manifestFile)
    )

    assertBoolean(
        block.supported,
        `"acfBlock.supported" in ` +
            relative(manifestFile)
    )

    if (!block.supported) {
        return
    }

    if (!fields?.supported) {
        throw new Error(
            'ACF block support requires ACF field support ' +
                `in ${relative(manifestFile)}`
        )
    }

    assertNonEmptyString(
        block.file,
        `"acfBlock.file" in ` +
            relative(manifestFile)
    )

    assertNonEmptyString(
        block.name,
        `"acfBlock.name" in ` +
            relative(manifestFile)
    )

    assertLocalFile(
        path.resolve(
            path.dirname(manifestFile),
            block.file
        ),
        `"acfBlock.file" in ${relative(manifestFile)}`
    )
}

/**
 * Remove components whose required ACF field dependencies are
 * unavailable or invalid.
 *
 * The check repeats until stable. This ensures that skipping one
 * component also skips anything whose ACF fields depend on it.
 *
 * @param {Map<string, {
 *     manifest: Record<string, any>,
 *     file: string,
 *     directory: string
 * }>} manifests
 *
 * @returns {{
 *     manifests: Map<string, {
 *         manifest: Record<string, any>,
 *         file: string,
 *         directory: string
 *     }>,
 *     skipped: Array<{
 *         name: string,
 *         reason: string
 *     }>
 * }}
 */
function resolveDependencies(manifests) {
    const available = new Map(manifests)
    const skipped = []

    let changed = true

    while (changed) {
        changed = false

        for (
            const [name, record]
            of [...available.entries()]
        ) {
            const fields = getFields(
                record.manifest
            )

            if (!fields?.supported) {
                continue
            }

            const unavailable =
                fields.dependencies.find(
                    (dependency) => {
                        const target =
                            available.get(dependency)

                        return (
                            !target ||
                            !getFields(
                                target.manifest
                            )?.supported
                        )
                    }
                )

            if (!unavailable) {
                continue
            }

            available.delete(name)

            skipped.push({
                name,
                reason:
                    `Required ACF field dependency ` +
                    `"${unavailable}" is unavailable or invalid`,
            })

            changed = true
        }
    }

    return {
        manifests: available,
        skipped,
    }
}

/**
 * Remove components participating in circular ACF field
 * dependencies.
 *
 * Components depending on a removed cycle are then removed through
 * the normal dependency resolution process.
 *
 * @param {Map<string, {
 *     manifest: Record<string, any>,
 *     file: string,
 *     directory: string
 * }>} manifests
 *
 * @returns {{
 *     manifests: Map<string, {
 *         manifest: Record<string, any>,
 *         file: string,
 *         directory: string
 *     }>,
 *     skipped: Array<{
 *         name: string,
 *         reason: string
 *     }>
 * }}
 */
function removeDependencyCycles(manifests) {
    const members = findCycleMembers(manifests)

    if (members.size === 0) {
        return {
            manifests,
            skipped: [],
        }
    }

    const available = new Map(manifests)
    const skipped = []

    for (const name of members) {
        available.delete(name)

        skipped.push({
            name,
            reason:
                'Circular ACF field dependency',
        })
    }

    const dependents =
        resolveDependencies(available)

    return {
        manifests: dependents.manifests,
        skipped: [
            ...skipped,
            ...dependents.skipped,
        ],
    }
}

/**
 * Find components participating directly in dependency cycles.
 *
 * @param {Map<string, {
 *     manifest: Record<string, any>,
 *     file: string,
 *     directory: string
 * }>} manifests
 *
 * @returns {Set<string>}
 */
function findCycleMembers(manifests) {
    const visited = new Set()
    const active = []
    const activeSet = new Set()
    const members = new Set()

    function visit(name) {
        if (activeSet.has(name)) {
            const start = active.indexOf(name)

            for (
                const member
                of active.slice(start)
            ) {
                members.add(member)
            }

            members.add(name)

            return
        }

        if (visited.has(name)) {
            return
        }

        active.push(name)
        activeSet.add(name)

        const fields = getFields(
            manifests.get(name)?.manifest
        )

        for (
            const dependency
            of fields?.dependencies ?? []
        ) {
            if (manifests.has(dependency)) {
                visit(dependency)
            }
        }

        active.pop()
        activeSet.delete(name)
        visited.add(name)
    }

    for (const name of manifests.keys()) {
        visit(name)
    }

    return members
}

/**
 * Normalize a component manifest into generated PHP metadata.
 *
 * File paths are made relative to src/ so the PHP registry can
 * resolve them from one common base path.
 *
 * @param {{
 *     manifest: Record<string, any>,
 *     file: string,
 *     directory: string
 * }} record
 *
 * @returns {Record<string, any>}
 */
function normalizeManifest(record) {
    const {
        manifest,
        directory,
    } = record

    const wordpress =
        manifest.integrations?.wordpress

    const fields =
        wordpress?.acfFields

    const block =
        wordpress?.acfBlock

    const normalized = {
        name: manifest.name,
        displayName: manifest.displayName,
        description:
            manifest.description ?? '',
        version: manifest.version,
        tag: manifest.tag ?? null,
        schema: toSourceRelativePath(
            path.resolve(
                directory,
                manifest.schema
            )
        ),
        integrations: {},
    }

    if (wordpress) {
        normalized.integrations.wordpress = {
            acfFields: normalizeFields(
                fields,
                directory
            ),
            acfBlock: normalizeBlock(
                block,
                directory
            ),
        }
    }

    return normalized
}

/**
 * @param {Record<string, any>|undefined} fields
 * @param {string} directory
 *
 * @returns {Record<string, any>}
 */
function normalizeFields(
    fields,
    directory
) {
    if (!fields?.supported) {
        return {
            supported: false,
        }
    }

    return {
        supported: true,
        file: toSourceRelativePath(
            path.resolve(
                directory,
                fields.file
            )
        ),
        groupKey: fields.groupKey,
        dependencies: [
            ...fields.dependencies,
        ],
    }
}

/**
 * @param {Record<string, any>|undefined} block
 * @param {string} directory
 *
 * @returns {Record<string, any>}
 */
function normalizeBlock(
    block,
    directory
) {
    if (!block?.supported) {
        return {
            supported: false,
        }
    }

    return {
        supported: true,
        file: toSourceRelativePath(
            path.resolve(
                directory,
                block.file
            )
        ),
        name: block.name,
    }
}

/**
 * Render the generated component metadata PHP file.
 *
 * @param {Record<string, any>} registry
 *
 * @returns {string}
 */
function renderMetadataFile(registry) {
    return `<?php

declare(strict_types=1);

/**
 * AUTO-GENERATED Component Metadata
 *
 * DO NOT EDIT MANUALLY.
 * Generated by bin/build-registry.js.
 */

return ${toPhp(registry)};
`
}

/**
 * Convert a JavaScript value to formatted PHP array syntax.
 *
 * @param {*} value
 * @param {number} depth
 *
 * @returns {string}
 */
function toPhp(value, depth = 0) {
    const indent =
        '    '.repeat(depth)

    const childIndent =
        '    '.repeat(depth + 1)

    if (value === null) {
        return 'null'
    }

    if (typeof value === 'boolean') {
        return value
            ? 'true'
            : 'false'
    }

    if (typeof value === 'number') {
        return String(value)
    }

    if (typeof value === 'string') {
        return `'${value
            .replaceAll('\\', '\\\\')
            .replaceAll("'", "\\'")}'`
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]'
        }

        const entries = value
            .map(
                (item) =>
                    `${childIndent}` +
                    `${toPhp(item, depth + 1)},`
            )
            .join('\n')

        return `[\n${entries}\n${indent}]`
    }

    const entries =
        Object.entries(value)

    if (entries.length === 0) {
        return '[]'
    }

    const rendered = entries
        .map(
            ([key, item]) =>
                `${childIndent}` +
                `${toPhp(key)} => ` +
                `${toPhp(item, depth + 1)},`
        )
        .join('\n')

    return `[\n${rendered}\n${indent}]`
}

/**
 * Format the final Clack build summary.
 *
 * @param {Record<string, any>} registry
 * @param {Array<{
 *     name: string,
 *     reason: string
 * }>} skipped
 *
 * @returns {string}
 */
function formatSummary(
    registry,
    skipped
) {
    const summaryWidth = getSummaryContentWidth()

    const files = [
        relative(metadataOutput),
    ]
        .map(
            (file) =>
                `${success('•')} ${file}`
        )
        .join('\n')

    const components =
        Object.values(registry)
            .map(
                (component) =>
                    formatComponent(component)
            )
            .join('\n')

    const skippedSection =
        skipped.length === 0
            ? ''
            : `\n\n` +
              `${bold('Skipped:')} ` +
              `${dim(`(${skipped.length})`)}\n` +
              skipped
                  .map(
                      ({ name, reason }) =>
                          `${warning('•')} ` +
                          `${bold(name)}\n` +
                          formatWrappedReason(
                              reason,
                              summaryWidth
                          )
                  )
                  .join('\n')

    return (
        `${bold('Generated Files:')}\n` +
        `${files}\n\n` +
        `${bold('Components:')} ` +
        `${dim(
            `(${Object.keys(registry).length})`
        )}\n` +
        components +
        skippedSection
    )
}

/**
 * Format a skipped reason with wrapping for narrow terminals.
 *
 * @param {string} reason
 * @param {number} width
 *
 * @returns {string}
 */
function formatWrappedReason(reason, width) {
    const prefix = '  '
    const wrapped = wrapText(
        `— ${reason}`,
        Math.max(24, width - prefix.length)
    )

    return wrapped
        .map((line) => `${prefix}${dim(line)}`)
        .join('\n')
}

/**
 * Estimate usable content width in the active terminal.
 *
 * @returns {number}
 */
function getSummaryContentWidth() {
    const terminalWidth =
        process.stdout.columns ?? 80

    return Math.max(40, terminalWidth - 3)
}

/**
 * Wrap plain text on word boundaries.
 *
 * @param {string} text
 * @param {number} width
 *
 * @returns {string[]}
 */
function wrapText(text, width) {
    const words = text.split(/\s+/).filter(Boolean)

    if (words.length === 0) {
        return ['']
    }

    const lines = []
    let current = ''

    for (const word of words) {
        const candidate =
            current === ''
                ? word
                : `${current} ${word}`

        if (candidate.length <= width) {
            current = candidate
            continue
        }

        if (current !== '') {
            lines.push(current)
            current = word
            continue
        }

        // Hard-wrap oversized single words.
        let remaining = word

        while (remaining.length > width) {
            lines.push(remaining.slice(0, width))
            remaining = remaining.slice(width)
        }

        current = remaining
    }

    if (current !== '') {
        lines.push(current)
    }

    return lines
}

/**
 * Format one generated component for the build summary.
 *
 * @param {Record<string, any>} component
 *
 * @returns {string}
 */
function formatComponent(component) {
    const fields =
        component
            .integrations
            ?.wordpress
            ?.acfFields
            ?.supported

    const block =
        component
            .integrations
            ?.wordpress
            ?.acfBlock
            ?.supported

    const dependencies =
        component
            .integrations
            ?.wordpress
            ?.acfFields
            ?.dependencies ?? []

    const capabilities = [
        fields
            ? 'fields'
            : null,
        block
            ? 'block'
            : null,
    ]
        .filter(Boolean)
        .join(' + ')

    const dependencyText =
        dependencies.length === 0
            ? ''
            : ` ${dim(
                `→ ${dependencies.join(', ')}`
            )}`

    return (
        `${success('•')} ` +
        `${bold(component.displayName)} ` +
        `${dim(`v${component.version}`)} ` +
        `${formatPath(
            `[${capabilities || 'component'}]`
        )}` +
        dependencyText
    )
}

/**
 * Print component-level validation warnings.
 *
 * @param {Array<{
 *     name: string,
 *     reason: string
 * }>} skipped
 */
function logSkipped(skipped) {
    for (const {
        name,
        reason,
    } of skipped) {
        const prefix = `${name} skipped `
        const warningWidth = Math.max(
            24,
            (process.stdout.columns ?? 80) -
                prefix.length -
                8
        )

        const lines = wrapText(
            `— ${reason}`,
            warningWidth
        )

        const [first, ...rest] = lines

        p.log.warn(
            `${bold(name)} skipped ` +
                `${dim(first)}` +
                rest
                    .map(
                        (line) =>
                            `\n${dim(`  ${line}`)}`
                    )
                    .join('')
        )
    }
}

/**
 * @param {Record<string, any>} manifest
 *
 * @returns {Record<string, any>|undefined}
 */
function getFields(manifest) {
    return manifest
        .integrations
        ?.wordpress
        ?.acfFields
}

/**
 * Validate that a referenced integration file exists and remains
 * inside src/.
 *
 * @param {string} file
 * @param {string} label
 */
function assertLocalFile(
    file,
    label
) {
    if (!existsSync(file)) {
        throw new Error(
            `${label} does not exist: ${relative(file)}`
        )
    }

    toSourceRelativePath(file)
}

/**
 * @param {*} value
 * @param {string} label
 */
function assertObject(
    value,
    label
) {
    if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        throw new Error(
            `${label} must be an object`
        )
    }
}

/**
 * @param {*} value
 * @param {string} label
 */
function assertNonEmptyString(
    value,
    label
) {
    if (
        typeof value !== 'string' ||
        value.trim() === ''
    ) {
        throw new Error(
            `${label} must be a non-empty string`
        )
    }
}

/**
 * @param {*} value
 * @param {string} label
 */
function assertBoolean(
    value,
    label
) {
    if (typeof value !== 'boolean') {
        throw new Error(
            `${label} must be a boolean`
        )
    }
}

/**
 * Convert an absolute file path to a forward-slash path relative
 * to src/.
 *
 * @param {string} file
 *
 * @returns {string}
 */
function toSourceRelativePath(file) {
    const relativePath =
        path.relative(sourceRoot, file)

    if (
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(
            `File must live under ` +
                `${relative(sourceRoot)}: ` +
                relative(file)
        )
    }

    return relativePath
        .split(path.sep)
        .join('/')
}

/**
 * Convert an absolute file path to a forward-slash path relative
 * to the package root.
 *
 * @param {string} file
 *
 * @returns {string}
 */
function relative(file) {
    return path
        .relative(packageRoot, file)
        .split(path.sep)
        .join('/')
}

main()