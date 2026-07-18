<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

use InvalidArgumentException;
use LogicException;
use RuntimeException;

final class ComponentRegistry
{
    public const MODE_FIELDS = 'fields';
    public const MODE_BLOCK = 'block';

    /**
     * @var array<string, array<string, mixed>>
     */
    private static array $components = [];

    /**
     * @var array<string, self::MODE_*>
     */
    private static array $requested = [];

    /**
     * @var array<string, array{fields: bool, block: bool}>
     */
    private static array $registered = [];

    /**
     * Components currently being resolved.
     *
     * @var array<string, true>
     */
    private static array $resolving = [];

    private static string $basePath = '';

    private static bool $booted = false;

    /**
     * Supply generated component metadata.
     *
     * @param array<string, array<string, mixed>> $components
     */
    public static function configure(array $components, string $basePath): void
    {
        if (self::$booted) {
            throw new LogicException(
                'ComponentRegistry must be configured before it is booted.'
            );
        }

        self::$components = $components;
        self::$basePath = rtrim($basePath, '/\\');
    }

    /**
     * Attach the WordPress registration lifecycle.
     */
    public static function boot(): void
    {
        if (self::$booted) {
            return;
        }

        if (self::$components === [] || self::$basePath === '') {
            throw new LogicException(
                'ComponentRegistry must be configured before it is booted.'
            );
        }

        self::$booted = true;

        if (did_action('acf/init')) {
            self::flush();
            return;
        }

        add_action('acf/init', [self::class, 'flush'], 5);
    }

    /**
     * Request ACF fields or a complete ACF block integration.
     *
     * Supported forms:
     *
     * ComponentRegistry::register('button');
     *
     * ComponentRegistry::register([
     *     'button',
     *     'card' => 'block',
     *     'image' => ['mode' => 'block'],
     * ]);
     *
     * Numeric entries default to the "fields" mode.
     *
     * @param string|array<int|string, string|array{mode?: string}> $components
     */
    public static function register(string|array $components): void
    {
        $components = is_string($components) ? [$components] : $components;

        foreach ($components as $key => $value) {
            if (is_int($key)) {
                if (!is_string($value)) {
                    throw new InvalidArgumentException(
                        'Numeric registry entries must contain a component name.'
                    );
                }

                $name = $value;
                $mode = self::MODE_FIELDS;
            } else {
                $name = $key;
                $mode = is_array($value)
                    ? ($value['mode'] ?? self::MODE_FIELDS)
                    : $value;
            }

            self::assertComponentExists($name);
            self::assertMode($mode);

            self::$requested[$name] = self::higherMode(
                self::$requested[$name] ?? null,
                $mode
            );
        }

        // Permit late registration by plugins or themes.
        if (self::$booted && did_action('acf/init')) {
            self::flush();
        }
    }

    /**
     * Register all currently requested integrations.
     *
     * This method is public only so WordPress can call it as a hook callback.
     */
    public static function flush(): void
    {
        foreach (self::$requested as $name => $mode) {
            try {
                self::registerFields($name);

                if ($mode === self::MODE_BLOCK) {
                    self::registerBlock($name);
                }
            } catch (\Throwable $exception) {
                self::reportRegistrationError(
                    $name,
                    $mode,
                    $exception
                );

                if (self::shouldThrowRegistrationErrors()) {
                    throw $exception;
                }
            }
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function getMetadata(string $name): ?array
    {
        return self::$components[$name] ?? null;
    }

    /**
     * @return array<string, array{fields: bool, block: bool}>
     */
    public static function getRegistered(): array
    {
        return self::$registered;
    }

    /**
     * @return array<string, self::MODE_*>
     */
    public static function getRequested(): array
    {
        return self::$requested;
    }

    /**
     * @return list<string>
     */
    public static function getAvailable(): array
    {
        return array_keys(self::$components);
    }

    private static function registerFields(string $name): void
    {
        if (self::$registered[$name]['fields'] ?? false) {
            return;
        }

        self::beginResolution($name);

        try {
            $metadata = self::$components[$name];
            $fields = $metadata['integrations']['wordpress']['acfFields'] ?? null;

            if (!is_array($fields) || !($fields['supported'] ?? false)) {
                throw new LogicException(
                    sprintf(
                        'Component "%s" does not support ACF field registration.',
                        $name
                    )
                );
            }

            foreach ($fields['dependencies'] ?? [] as $dependency) {
                if (!is_string($dependency)) {
                    throw new RuntimeException(
                        sprintf(
                            'Component "%s" contains an invalid ACF dependency.',
                            $name
                        )
                    );
                }

                self::assertComponentExists($dependency);
                self::registerFields($dependency);
            }

            self::requireIntegrationFile($name, $fields, 'ACF fields');

            self::$registered[$name] ??= [
                'fields' => false,
                'block' => false,
            ];
            self::$registered[$name]['fields'] = true;

            do_action(
                'avenue_component_fields_registered',
                $name,
                $metadata
            );
        } finally {
            self::endResolution($name);
        }
    }

    private static function registerBlock(string $name): void
    {
        if (self::$registered[$name]['block'] ?? false) {
            return;
        }

        // ACF blocks always require their field group first.
        self::registerFields($name);

        $metadata = self::$components[$name];
        $block = $metadata['integrations']['wordpress']['acfBlock'] ?? null;

        if (!is_array($block) || !($block['supported'] ?? false)) {
            throw new LogicException(
                sprintf(
                    'Component "%s" does not support ACF block registration.',
                    $name
                )
            );
        }

        self::requireIntegrationFile($name, $block, 'ACF block');

        self::$registered[$name]['block'] = true;

        do_action(
            'avenue_component_block_registered',
            $name,
            $metadata
        );
    }

    /**
     * @param array<string, mixed> $integration
     */
    private static function requireIntegrationFile(
        string $name,
        array $integration,
        string $label
    ): void {
        $relativePath = $integration['file'] ?? null;

        if (!is_string($relativePath) || $relativePath === '') {
            throw new RuntimeException(
                sprintf(
                    '%s integration for "%s" does not define a file.',
                    $label,
                    $name
                )
            );
        }

        $path = self::$basePath . '/' . ltrim($relativePath, '/\\');

        if (!is_file($path)) {
            throw new RuntimeException(
                sprintf(
                    '%s file for "%s" was not found: %s',
                    $label,
                    $name,
                    $path
                )
            );
        }

        require_once $path;
    }

    private static function beginResolution(string $name): void
    {
        if (isset(self::$resolving[$name])) {
            $chain = implode(
                ' -> ',
                [...array_keys(self::$resolving), $name]
            );

            throw new RuntimeException(
                sprintf('Circular ACF field dependency detected: %s', $chain)
            );
        }

        self::$resolving[$name] = true;
    }

    private static function endResolution(string $name): void
    {
        unset(self::$resolving[$name]);
    }

    private static function assertComponentExists(string $name): void
    {
        if (!isset(self::$components[$name])) {
            throw new InvalidArgumentException(
                sprintf('Unknown Avenue component "%s".', $name)
            );
        }
    }

    private static function assertMode(string $mode): void
    {
        if (!in_array($mode, [self::MODE_FIELDS, self::MODE_BLOCK], true)) {
            throw new InvalidArgumentException(
                sprintf(
                    'Invalid component registration mode "%s". Expected "%s" or "%s".',
                    $mode,
                    self::MODE_FIELDS,
                    self::MODE_BLOCK
                )
            );
        }
    }

    private static function higherMode(?string $current, string $requested): string
    {
        if ($current === self::MODE_BLOCK || $requested === self::MODE_BLOCK) {
            return self::MODE_BLOCK;
        }

        return self::MODE_FIELDS;
    }

    private static function reportRegistrationError(
        string $name,
        string $mode,
        \Throwable $exception
    ): void {
        $message = sprintf(
            '[AvenueUI] Component "%s" failed during %s registration: %s',
            $name,
            $mode,
            $exception->getMessage()
        );

        error_log($message);

        do_action(
            'avenue_component_registration_error',
            $name,
            $mode,
            $exception
        );
    }

    /**
     * Strict by default when WP_DEBUG is enabled, soft-fail otherwise.
     *
     * Filter: avenue_component_registry_strict_errors
     */
    private static function shouldThrowRegistrationErrors(): bool
    {
        $strict = defined('WP_DEBUG') && WP_DEBUG;

        if (function_exists('apply_filters')) {
            $strict = (bool) apply_filters(
                'avenue_component_registry_strict_errors',
                $strict
            );
        }

        return $strict;
    }
}
