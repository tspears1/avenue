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
     * @param mixed $mode
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
     * @return list<array{component: string, mode: string, message: string}>
     */
    public static function getRegistrationErrors(): array
    {
        return self::$registrationErrors;
    }
}