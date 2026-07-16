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
      $this->load_json_paths = Helper::sanitize_paths($load_json_paths);
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
      $local_json_path = Helper::string_option($options, 'local_json_path');
      $load_json_paths = Helper::array_option($options, 'load_json_paths');
      $remove_default_load_json_path = Helper::bool_option($options, 'remove_default_load_json_path', true);
      $load_bundled_acf = Helper::bool_option($options, 'load_bundled_acf', true);
      $bundled_acf_path = Helper::string_option($options, 'bundled_acf_path');
      $bundled_acf_url = Helper::string_option($options, 'bundled_acf_url');

      return new self(
         $local_json_path,
         $load_json_paths,
         $remove_default_load_json_path,
         $load_bundled_acf,
         $bundled_acf_path,
         $bundled_acf_url,
      );
   }
}
