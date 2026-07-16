<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class Options
{
   /**
    * Save destination for generated local JSON files.
    */
   public ?string $local_json_path;

   /**
    * Additional JSON load paths for field definitions.
    *
    * @var array<int, string>
    */
   public array $load_json_paths;

   /**
    * Whether ACF's default load path should be removed.
    */
   public bool $remove_default_load_json_path;

   /**
    * Whether to load bundled ACF when ACF is not already available.
    */
   public bool $load_bundled_acf;

   /**
    * Optional override for bundled ACF plugin directory path.
    */
   public ?string $bundled_acf_path;

   /**
    * Optional override for bundled ACF plugin URL.
    */
   public ?string $bundled_acf_url;

   /**
    * Create an options value object for package bootstrapping.
    *
    * @param string|null $local_json_path Save destination for JSON sync.
    * @param array<int, string> $load_json_paths Additional JSON load paths.
    * @param bool $remove_default_load_json_path Remove ACF default load path when true.
    * @param bool $load_bundled_acf Load bundled ACF when global ACF is unavailable.
    * @param string|null $bundled_acf_path Optional bundled ACF path override.
    * @param string|null $bundled_acf_url Optional bundled ACF URL override.
    * @return void
    */
   public function __construct(
      ?string $local_json_path = null,
      array $load_json_paths = [],
      bool $remove_default_load_json_path = true,
      bool $load_bundled_acf = true,
      ?string $bundled_acf_path = null,
      ?string $bundled_acf_url = null,
   ) {
      $this->local_json_path = $local_json_path !== null ? rtrim($local_json_path, '/') : null;
      $this->load_json_paths = self::sanitize_paths($load_json_paths);
      $this->remove_default_load_json_path = $remove_default_load_json_path;
      $this->load_bundled_acf = $load_bundled_acf;
      $this->bundled_acf_path = $bundled_acf_path !== null ? rtrim($bundled_acf_path, '/') . '/' : null;
      $this->bundled_acf_url = $bundled_acf_url !== null ? rtrim($bundled_acf_url, '/') . '/' : null;
   }

   /**
    * Build an Options object from a plain configuration array.
    *
    * @param array<string, mixed> $options
    * @return self
    */
   public static function from_array(array $options): self
   {
      $local_json_path = self::string_option($options, 'local_json_path');
      $load_json_paths = self::array_option($options, 'load_json_paths');
      $remove_default_load_json_path = self::bool_option($options, 'remove_default_load_json_path', true);
      $load_bundled_acf = self::bool_option($options, 'load_bundled_acf', true);
      $bundled_acf_path = self::string_option($options, 'bundled_acf_path');
      $bundled_acf_url = self::string_option($options, 'bundled_acf_url');

      return new self(
         $local_json_path,
         $load_json_paths,
         $remove_default_load_json_path,
         $load_bundled_acf,
         $bundled_acf_path,
         $bundled_acf_url,
      );
   }

   /**
    * Read a nullable string option.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @return string|null
    */
   private static function string_option(array $options, string $key): ?string
   {
      return isset($options[$key]) && is_string($options[$key])
         ? $options[$key]
         : null;
   }

   /**
    * Read an array option and normalize path values.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @return array<int, string>
    */
   private static function array_option(array $options, string $key): array
   {
      if (!isset($options[$key]) || !is_array($options[$key])) {
         return [];
      }

      return self::sanitize_paths($options[$key]);
   }

   /**
    * Read a boolean option with a default fallback.
    *
    * @param array<string, mixed> $options
    * @param string $key
    * @param bool $default
    * @return bool
    */
   private static function bool_option(array $options, string $key, bool $default): bool
   {
      return isset($options[$key]) && is_bool($options[$key])
         ? $options[$key]
         : $default;
   }

   /**
    * Normalize and de-duplicate path strings.
    *
    * @param array<int, mixed> $paths
    * @return array<int, string>
    */
   private static function sanitize_paths(array $paths): array
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
