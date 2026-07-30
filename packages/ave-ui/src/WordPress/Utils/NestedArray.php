<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\Utils;

/**
 * Search recursively through nested associative arrays.
 */
final class NestedArray
{
    /**
     * Determine whether a key exists at any depth.
     *
     * @param array<mixed> $values Values to search.
     * @param string       $key    Key to locate.
     *
     * @return bool Whether the key exists.
     */
    public static function containsKey(array $values, string $key): bool
    {
        if (array_key_exists($key, $values)) {
            return true;
        }

        foreach ($values as $value) {
            if (is_array($value) && self::containsKey($value, $key)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Find the first value associated with a key at any depth.
     *
     * @param array<mixed> $values Values to search.
     * @param string       $key    Key to locate.
     *
     * @return mixed The matching value, or null when the key is absent.
     */
    public static function findByKey(array $values, string $key): mixed
    {
        if (array_key_exists($key, $values)) {
            return $values[$key];
        }

        foreach ($values as $value) {
            if (!is_array($value)) {
                continue;
            }

            $found = self::findByKey($value, $key);

            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }
}
