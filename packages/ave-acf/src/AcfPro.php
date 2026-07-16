<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class AcfPro
{
   /**
    * Ensure ACF is available by loading a bundled copy when needed.
    *
    * @param Options $options Runtime package options.
    * @return void
    */
   public static function ensure_loaded(Options $options): void
   {
      if (!$options->load_bundled_acf || class_exists('ACF')) {
         return;
      }

      $acf_path = $options->bundled_acf_path ?? self::default_acf_path();
      $acf_url = $options->bundled_acf_url ?? self::default_acf_url();

      if ($acf_path === null || $acf_url === null) {
         return;
      }

      if (!defined('MY_ACF_PATH')) {
         define('MY_ACF_PATH', $acf_path);
      }

      if (!defined('MY_ACF_URL')) {
         define('MY_ACF_URL', $acf_url);
      }

      if (!file_exists(MY_ACF_PATH . 'acf.php')) {
         return;
      }

      include_once MY_ACF_PATH . 'acf.php';

      add_filter('acf/settings/url', [self::class, 'acf_url']);
   }

   /**
    * Filter callback that returns the bundled ACF asset URL.
    *
    * @param string $url Existing ACF URL.
    * @return string
    */
   public static function acf_url(string $url): string
   {
      return defined('MY_ACF_URL') ? MY_ACF_URL : $url;
   }

   /**
    * Resolve the default bundled ACF plugin path from the active theme.
    *
    * @return string|null
    */
   private static function default_acf_path(): ?string
   {
      if (!function_exists('get_template_directory')) {
         return null;
      }

      return rtrim(get_template_directory(), '/') . '/vendor/advanced-custom-fields-pro/';
   }

   /**
    * Resolve the default bundled ACF plugin URL from the active theme.
    *
    * @return string|null
    */
   private static function default_acf_url(): ?string
   {
      if (!function_exists('get_template_directory_uri')) {
         return null;
      }

      return rtrim(get_template_directory_uri(), '/') . '/vendor/advanced-custom-fields-pro/';
   }
}
