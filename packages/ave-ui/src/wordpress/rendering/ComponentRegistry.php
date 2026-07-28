<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

use Avenue\ACF\BlockFactory;
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
     * @param array<string, array<string, mixed>> $components Generated component metadata.
     * @param string                              $basePath   Component source base path.
     *
     * @return void
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
     *
     * @return void
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
     * @param string|array<int|string, string|array{mode?: string}> $components Components and modes to request.
     *
     * @return void
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
     *
     * @return void
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
     * Return generated metadata for one component.
     *
     * @param string $name Component name.
     *
     * @return array<string, mixed>|null Component metadata, or null.
     */
    public static function getMetadata(string $name): ?array
    {
        return self::$components[$name] ?? null;
    }

    /**
     * Return registration state keyed by component.
     *
     * @return array<string, array{fields: bool, block: bool}> Registration state.
     */
    public static function getRegistered(): array
    {
        return self::$registered;
    }

    /**
     * Return requested integration modes keyed by component.
     *
     * @return array<string, self::MODE_*> Requested integration modes.
     */
    public static function getRequested(): array
    {
        return self::$requested;
    }

    /**
     * Return all components present in generated metadata.
     *
     * @return list<string> Available component names.
     */
    public static function getAvailable(): array
    {
        return array_keys(self::$components);
    }

    /**
     * Register a component's ACF field integration and dependencies.
     *
     * @param string $name Component name.
     *
     * @return void
     */
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

    /**
     * Register a component's ACF block integration.
     *
     * @param string $name Component name.
     *
     * @return void
     */
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

        $config = self::requireIntegrationFile($name, $block, 'ACF block');

        if (!is_array($config)) {
            throw new RuntimeException(
                sprintf(
                    'ACF block file for "%s" must return a config array.',
                    $name
                )
            );
        }

        if (!isset($config['name']) || !is_string($config['name']) || $config['name'] === '') {
            $config['name'] = $name;
        }

        self::ensureComponentClassIsLoadable(
            $name,
            $config,
            $block
        );

        BlockFactory::register($config);

        self::$registered[$name]['block'] = true;

        do_action(
            'avenue_component_block_registered',
            $name,
            $metadata
        );
    }

    /**
     * Ensure the configured component class can be loaded.
     *
     * This guards against stale Composer classmaps by requiring the
     * component class file directly when needed.
     *
     * @param string               $name        Component name.
     * @param array<string, mixed> $config      Block configuration.
     * @param array<string, mixed> $integration Generated integration metadata.
     *
     * @return void
     */
    private static function ensureComponentClassIsLoadable(
        string $name,
        array $config,
        array $integration
    ): void {
        $component = $config['component'] ?? null;

        if (!is_string($component) || $component === '') {
            return;
        }

        if (class_exists($component)) {
            return;
        }

        foreach (self::componentClassCandidates($name, $integration) as $candidate) {
            if (!is_file($candidate)) {
                continue;
            }

            require_once $candidate;

            if (class_exists($component)) {
                return;
            }
        }

        throw new RuntimeException(
            sprintf(
                'Component class "%s" for "%s" could not be loaded. '
                . 'Run "composer dump-autoload" in app/themes/loom to refresh classmaps.',
                $component,
                $name
            )
        );
    }

    /**
     * Build likely filesystem paths for a component class file.
     *
     * @param string               $name        Component name.
     * @param array<string, mixed> $integration Generated integration metadata.
     *
     * @return array<int, string> Candidate class-file paths.
     */
    private static function componentClassCandidates(
        string $name,
        array $integration
    ): array {
        $paths = [];

        $blockFile = $integration['file'] ?? null;

        if (is_string($blockFile) && $blockFile !== '') {
            $resolvedBlock = self::$basePath . '/' . ltrim($blockFile, '/\\');
            $blockDir = dirname($resolvedBlock);

            $paths[] = $blockDir . '/' . $name . '.class.php';

            $blockBase = basename($blockFile, '.block.php');

            if ($blockBase !== '' && $blockBase !== $name) {
                $paths[] = $blockDir . '/' . $blockBase . '.class.php';
            }
        }

        $paths[] = self::$basePath . '/components/' . $name . '/' . $name . '.class.php';

        return array_values(array_unique($paths));
    }

    /**
     * Require and return a generated integration file.
     *
     * @param string               $name        Component name.
     * @param array<string, mixed> $integration Generated integration metadata.
     * @param string               $label       Human-readable integration label.
     *
     * @return mixed Value returned by the integration file.
     */
    private static function requireIntegrationFile(
        string $name,
        array $integration,
        string $label
    ) {
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

        return require $path;
    }

    /**
     * Mark a component as actively resolving and detect cycles.
     *
     * @param string $name Component name.
     *
     * @return void
     */
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

    /**
     * Mark a component resolution as complete.
     *
     * @param string $name Component name.
     *
     * @return void
     */
    private static function endResolution(string $name): void
    {
        unset(self::$resolving[$name]);
    }

    /**
     * Assert that generated metadata contains a component.
     *
     * @param string $name Component name.
     *
     * @return void
     */
    private static function assertComponentExists(string $name): void
    {
        if (!isset(self::$components[$name])) {
            throw new InvalidArgumentException(
                sprintf('Unknown Avenue component "%s".', $name)
            );
        }
    }

    /**
     * Assert that an integration mode is supported.
     *
     * @param string $mode Integration mode.
     *
     * @return void
     */
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

    /**
     * Resolve the more capable of two integration modes.
     *
     * @param string|null $current   Existing integration mode.
     * @param string      $requested Requested integration mode.
     *
     * @return string Resolved integration mode.
     */
    private static function higherMode(?string $current, string $requested): string
    {
        if ($current === self::MODE_BLOCK || $requested === self::MODE_BLOCK) {
            return self::MODE_BLOCK;
        }

        return self::MODE_FIELDS;
    }

    /**
     * Report a component integration registration failure.
     *
     * @param string     $name      Component name.
     * @param string     $mode      Requested integration mode.
     * @param \Throwable $exception Registration failure.
     *
     * @return void
     */
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
     *
     * @return bool Whether registration errors should be rethrown.
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
