<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class LocalJson
{
   /**
    * Save destination for generated local JSON files.
    */
   private static ?string $save_path = null;

   /**
    * Load locations for local JSON field definitions.
    *
    * @var array<int, string>
    */
   private static array $load_paths = [];

   /**
    * Whether to remove ACF's default load_json path.
    */
   private static bool $remove_default_load_path = true;

   /**
    * Register save/load hooks for ACF local JSON.
    *
    * @param Options $options Runtime package options.
    * @return void
    */
   public static function register(Options $options): void
   {
      if (!function_exists('add_filter')) {
         return;
      }

      self::$save_path = $options->local_json_path;
      self::$load_paths = $options->load_json_paths;
      self::$remove_default_load_path = $options->remove_default_load_json_path;

      if (self::$save_path !== null && !in_array(self::$save_path, self::$load_paths, true)) {
         self::$load_paths[] = self::$save_path;
      }

      add_filter('acf/settings/save_json', [self::class, 'save_path']);
      add_filter('acf/settings/load_json', [self::class, 'load_paths']);
   }

   /**
    * Filter callback that returns the JSON save path.
    *
    * @param string $default_path ACF-provided default path.
    * @return string
    */
   public static function save_path(string $default_path): string
   {
      return self::$save_path ?? $default_path;
   }

   /**
    * @param array<int, string> $paths
    * @return array<int, string>
    */
   public static function load_paths(array $paths): array
   {
      if (self::$remove_default_load_path) {
         unset($paths[0]);
      }

      if (self::$load_paths === []) {
         return $paths;
      }

      foreach (self::$load_paths as $path) {
         if (!in_array($path, $paths, true)) {
            $paths[] = $path;
         }
      }

      return array_values($paths);
   }
}
