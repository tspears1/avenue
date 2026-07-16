<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class Helper
{
   /**
    * Read a nullable string option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @param string|null $default
    * @return string|null
    */
   public static function string_option(array $options, string $key, ?string $default = null): ?string
   {
      return isset($options[$key]) && is_string($options[$key])
         ? $options[$key]
         : $default;
   }

   /**
    * Read a boolean option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @param bool $default
    * @return bool
    */
   public static function bool_option(array $options, string $key, bool $default = false): bool
   {
      return isset($options[$key]) && is_bool($options[$key])
         ? $options[$key]
         : $default;
   }

   /**
    * Read an integer option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @param int $default
    * @return int
    */
   public static function int_option(array $options, string $key, int $default = 0): int
   {
      return isset($options[$key]) && is_numeric($options[$key])
         ? (int) $options[$key]
         : $default;
   }

   /**
    * Read an array option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @param array<mixed> $default
    * @return array<mixed>
    */
   public static function array_option(array $options, string $key, array $default = []): array
   {
      return isset($options[$key]) && is_array($options[$key])
         ? $options[$key]
         : $default;
   }

   /**
    * Read a callable option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @return callable|null
    */
   public static function callable_option(array $options, string $key): ?callable
   {
      return isset($options[$key]) && is_callable($options[$key])
         ? $options[$key]
         : null;
   }

   /**
    * Normalize a mixed list into unique, non-empty string values.
    *
    * @param array<int, mixed> $values
    * @return array<int, string>
    */
   public static function string_list(array $values): array
   {
      $clean = [];

      foreach ($values as $value) {
         if (!is_string($value) || $value === '') {
            continue;
         }

         if (!in_array($value, $clean, true)) {
            $clean[] = $value;
         }
      }

      return $clean;
   }

   /**
    * Normalize and de-duplicate path strings.
    *
    * @param array<int, mixed> $paths
    * @return array<int, string>
    */
   public static function sanitize_paths(array $paths): array
   {
      $clean = [];

      foreach ($paths as $path) {
         if (!is_string($path) || $path === '') {
            continue;
         }

         $normalized = rtrim($path, '/');

         if (!in_array($normalized, $clean, true)) {
            $clean[] = $normalized;
         }
      }

      return $clean;
   }
}
