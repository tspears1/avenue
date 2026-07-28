<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\GUI;

final class DiagnosticsStore
{
    /**
     * @var list<array{component: string, mode: string, message: string}>
     */
    private static array $registrationErrors = [];

    private static bool $booted = false;

    /**
     * Register the diagnostics event listener exactly once.
     *
     * @return void
     */
    public static function boot(): void
    {
        if (self::$booted || !function_exists('add_action')) {
            return;
        }

        self::$booted = true;

        add_action(
            'avenue_component_registration_error',
            [self::class, 'captureRegistrationError'],
            10,
            3
        );
    }

    /**
     * Capture a component registration error for the current request.
     *
     * @param string     $component Component name.
     * @param mixed      $mode      Requested registration mode.
     * @param \Throwable $exception Registration failure.
     *
     * @return void
     */
    public static function captureRegistrationError(
        string $component,
        $mode,
        \Throwable $exception
    ): void {
        self::$registrationErrors[] = [
            'component' => $component,
            'mode' => is_string($mode) ? $mode : 'unknown',
            'message' => $exception->getMessage(),
        ];
    }

    /**
     * Return registration errors captured during the current request.
     *
     * @return list<array{component: string, mode: string, message: string}>
     *     Captured registration errors.
     */
    public static function getRegistrationErrors(): array
    {
        return self::$registrationErrors;
    }
}
