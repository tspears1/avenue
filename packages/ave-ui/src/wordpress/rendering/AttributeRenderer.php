<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use InvalidArgumentException;

final class AttributeRenderer
{
    /**
     * Render an associative array as escaped HTML attributes.
     *
     * @param array<string, mixed> $attributes Attributes to render.
     *
     * @return string Rendered attributes, including the leading space.
    */
    public static function render(array $attributes): string
    {
        $output = [];

        foreach ($attributes as $name => $value) {
            if ($value === null || $value === false || $value === '') {
                continue;
            }

            if (!self::isValidName($name)) {
                throw new InvalidArgumentException(
                    sprintf('Invalid HTML attribute name "%s".', $name)
                );
            }

            if ($value === true) {
                $output[] = $name;
                continue;
            }

            $output[] = sprintf(
                '%s="%s"',
                $name,
                self::escape((string) $value),
            );
        }

        return $output === []
            ? ''
            : ' ' . implode(' ', $output);
    }

    /**
     * Determine whether a string is a valid HTML attribute name.
     *
     * @param string $name Attribute name to inspect.
     *
     * @return bool Whether the name is valid.
     */
    public static function isValidName(string $name): bool
    {
        return preg_match(
            '/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/',
            $name,
        ) === 1;
    }

    /**
     * Validate and return an HTML attribute name.
     *
     * @param string $name Attribute name to validate.
     *
     * @return string Validated attribute name.
     */
    public static function escapeName(string $name): string
    {
        if (!self::isValidName($name)) {
            throw new InvalidArgumentException(
                sprintf('Invalid HTML attribute name "%s".', $name)
            );
        }

        return $name;
    }

    /**
     * Escape an HTML attribute or text value.
     *
     * @param string $value Value to escape.
     *
     * @return string HTML-safe value.
     */
    public static function escape(string $value): string
    {
        return htmlspecialchars(
            $value,
            ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5,
            'UTF-8',
        );
    }
}
