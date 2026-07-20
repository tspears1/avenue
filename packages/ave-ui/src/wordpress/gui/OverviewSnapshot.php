<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\GUI;

use AvenueUI\WordPress\ComponentRegistry;

final class OverviewSnapshot
{
    /**
     * @return array<string, mixed>
     */
    public static function build(string $componentsFile, string $sourceBasePath): array
    {
        $componentMap = self::loadComponentMap($componentsFile);
        $available = array_keys($componentMap);
        $requested = ComponentRegistry::getRequested();
        $registered = ComponentRegistry::getRegistered();
        $errors = DiagnosticsStore::getRegistrationErrors();
        $loaderUrl = self::resolveDiagnosticsLoaderUrl();

        $errorByComponent = [];
        foreach ($errors as $error) {
            $component = $error['component'];
            $errorByComponent[$component] = true;
        }

        $rows = [];
        $warnings = [];

        foreach ($componentMap as $name => $metadata) {
            $fieldsIntegration = $metadata['integrations']['wordpress']['acfFields'] ?? null;
            $blockIntegration = $metadata['integrations']['wordpress']['acfBlock'] ?? null;

            $fieldsFileRelative = is_array($fieldsIntegration)
                ? self::integrationFile($fieldsIntegration)
                : null;
            $blockFileRelative = is_array($blockIntegration)
                ? self::integrationFile($blockIntegration)
                : null;

            $fieldsFilePath = self::resolvePath($sourceBasePath, $fieldsFileRelative);
            $blockFilePath = self::resolvePath($sourceBasePath, $blockFileRelative);

            $fieldsSupported = is_array($fieldsIntegration)
                && (bool) ($fieldsIntegration['supported'] ?? false);
            $blockSupported = is_array($blockIntegration)
                && (bool) ($blockIntegration['supported'] ?? false);

            $fieldsRegistered = (bool) ($registered[$name]['fields'] ?? false);
            $blockRegistered = (bool) ($registered[$name]['block'] ?? false);
            $requestedMode = $requested[$name] ?? null;
            $discovered = true;
            $registeredOk = self::isRegisteredForRequestedMode(
                $requestedMode,
                $fieldsRegistered,
                $blockRegistered
            );
            $enqueued = $requestedMode !== null && $loaderUrl !== null;

            if ($fieldsSupported && $fieldsFilePath !== null && !is_file($fieldsFilePath)) {
                $warnings[] = sprintf(
                    'Missing ACF fields file for %s: %s',
                    $name,
                    $fieldsFilePath
                );
            }

            if ($blockSupported && $blockFilePath !== null && !is_file($blockFilePath)) {
                $warnings[] = sprintf(
                    'Missing ACF block file for %s: %s',
                    $name,
                    $blockFilePath
                );
            }

            $state = self::summarizeState(
                $discovered,
                $requestedMode,
                $registeredOk,
                $enqueued,
                isset($errorByComponent[$name])
            );

            $rows[] = [
                'name' => $name,
                'displayName' => (string) ($metadata['displayName'] ?? $name),
                'tag' => (string) ($metadata['tag'] ?? ''),
                'version' => (string) ($metadata['version'] ?? ''),
                'storybookUrl' => self::storybookUrl($metadata),
                'requestedMode' => $requestedMode,
                'discovered' => $discovered,
                'registered' => $registeredOk,
                'enqueued' => $enqueued,
                'fieldsSupported' => $fieldsSupported,
                'fieldsRegistered' => $fieldsRegistered,
                'blockSupported' => $blockSupported,
                'blockRegistered' => $blockRegistered,
                'status' => $state,
                'hasError' => isset($errorByComponent[$name]),
                'schema' => (string) ($metadata['schema'] ?? ''),
                'fieldsFile' => [
                    'relative' => $fieldsFileRelative,
                    'path' => $fieldsFilePath,
                    'exists' => $fieldsFilePath !== null ? is_file($fieldsFilePath) : null,
                ],
                'blockFile' => [
                    'relative' => $blockFileRelative,
                    'path' => $blockFilePath,
                    'exists' => $blockFilePath !== null ? is_file($blockFilePath) : null,
                ],
            ];
        }

        if (!is_file($componentsFile)) {
            $warnings[] = sprintf('Generated components metadata file is missing: %s', $componentsFile);
        }

        $version = self::packageVersion();

        return [
            'environment' => [
                'avenueUiVersion' => $version,
                'wordPressVersion' => self::wordpressVersion(),
                'phpVersion' => PHP_VERSION,
                'componentsFile' => $componentsFile,
                'sourceBasePath' => $sourceBasePath,
                'requestContext' => is_admin() ? 'wp-admin' : 'frontend',
                'diagnosticsLoaderUrl' => $loaderUrl,
                'diagnosticsLoaderAvailable' => $loaderUrl !== null,
            ],
            'counts' => [
                'available' => count($available),
                'requested' => count($requested),
                'registeredFields' => count(array_filter($registered, static fn (array $entry): bool => (bool) ($entry['fields'] ?? false))),
                'registeredBlocks' => count(array_filter($registered, static fn (array $entry): bool => (bool) ($entry['block'] ?? false))),
                'errors' => count($errors),
                'warnings' => count($warnings),
            ],
            'warnings' => $warnings,
            'errors' => $errors,
            'components' => $rows,
        ];
    }

    private static function packageVersion(): string
    {
        if (class_exists('\\Composer\\InstalledVersions')) {
            try {
                /** @phpstan-ignore-next-line */
                $pretty = \Composer\InstalledVersions::getPrettyVersion('bostonuniversity/ave-ui');
                if (is_string($pretty) && $pretty !== '') {
                    return $pretty;
                }
            } catch (\Throwable) {
                // Fall through to unknown.
            }
        }

        return 'unknown';
    }

    private static function wordpressVersion(): string
    {
        global $wp_version;

        return is_string($wp_version) ? $wp_version : 'unknown';
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function loadComponentMap(string $componentsFile): array
    {
        if (!is_file($componentsFile)) {
            return [];
        }

        $components = require $componentsFile;

        return is_array($components)
            ? $components
            : [];
    }

    /**
     * @param array<string, mixed> $integration
     */
    private static function integrationFile(array $integration): ?string
    {
        $file = $integration['file'] ?? null;

        return is_string($file) && $file !== ''
            ? $file
            : null;
    }

    private static function resolvePath(string $basePath, ?string $relativePath): ?string
    {
        if ($relativePath === null) {
            return null;
        }

        return rtrim($basePath, '/\\') . '/' . ltrim($relativePath, '/\\');
    }

    private static function summarizeState(
        bool $discovered,
        ?string $requestedMode,
        bool $registered,
        bool $enqueued,
        bool $hasError
    ): string {
        if (!$discovered) {
            return 'Unavailable';
        }

        if ($hasError) {
            return 'Misconfigured';
        }

        if ($requestedMode === null) {
            return 'Unsupported in current context';
        }

        if (!$registered || !$enqueued) {
            return 'Partially loaded';
        }

        return 'Healthy';
    }

    private static function isRegisteredForRequestedMode(
        ?string $requestedMode,
        bool $fieldsRegistered,
        bool $blockRegistered
    ): bool {
        if ($requestedMode === null) {
            return false;
        }

        if ($requestedMode === ComponentRegistry::MODE_BLOCK) {
            return $fieldsRegistered && $blockRegistered;
        }

        return $fieldsRegistered;
    }

    private static function resolveDiagnosticsLoaderUrl(): ?string
    {
        if (!function_exists('get_theme_file_path') || !function_exists('get_theme_file_uri')) {
            return null;
        }

        foreach ([
            'vendor/bostonuniversity/ave-ui/dist/wordpress/editor-content.js',
            'vendor/bostonuniversity/ave-ui/dist/wordpress/editor-ui.js',
        ] as $relativeThemePath) {
            $themeModulePath = get_theme_file_path($relativeThemePath);

            if (!is_string($themeModulePath) || $themeModulePath === '' || !is_file($themeModulePath)) {
                continue;
            }

            $url = get_theme_file_uri($relativeThemePath);

            if (is_string($url) && $url !== '') {
                return $url;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private static function storybookUrl(array $metadata): ?string
    {
        $docs = $metadata['docs'] ?? null;

        if (!is_array($docs)) {
            return null;
        }

        $storybook = $docs['storybook'] ?? null;

        return is_string($storybook) && $storybook !== ''
            ? $storybook
            : null;
    }
}