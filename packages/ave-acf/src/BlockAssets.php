<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class BlockAssets
{
   private static bool $hooks_registered = false;

   /**
    * @var array<int, string>
    */
   private static array $force_module_handles = [];

   /**
    * @var callable|null
    */
   private static $module_handle_predicate = null;

   /**
    * @var callable|null
    */
   private static $enqueue_assets_callback = null;

   /**
    * @var callable|null
    */
   private static $enqueue_editor_assets_callback = null;

   private static bool $include_editor_underscore_backbone = false;

   /**
    * Build a preset for WordPress iframe editor compatibility defaults.
    *
    * @param array<string, mixed> $overrides Override values for preset options.
    * @return array<string, mixed>
    */
   public static function wp_iframe_defaults(array $overrides = []): array
   {
      return array_merge([
         'include_editor_underscore_backbone' => true,
      ], $overrides);
   }

   /**
    * Register reusable block/editor hook callbacks.
    *
    * @param array<string, mixed> $options Hook options.
    * @return void
    */
   public static function register_global_hooks(array $options = []): void
   {
      self::apply_options($options);

      if (self::$hooks_registered || !function_exists('add_action')) {
         return;
      }

      self::$hooks_registered = true;

      add_action('enqueue_block_assets', [self::class, 'enqueue_assets']);
      add_action('enqueue_block_assets', [self::class, 'enqueue_editor_assets']);

      add_filter('script_loader_tag', [self::class, 'force_module_script_tag'], 10, 3);

      add_action('admin_enqueue_scripts', [self::class, 'ensure_editor_dependencies'], 1);
   }

   /**
    * Execute the configured general block asset callback.
    *
    * @return void
    */
   public static function enqueue_assets(): void
   {
      if (is_callable(self::$enqueue_assets_callback)) {
         call_user_func(self::$enqueue_assets_callback);
      }
   }

   /**
    * Execute the configured block editor asset callback.
    *
    * @return void
    */
   public static function enqueue_editor_assets(): void
   {
      if (!is_admin()) {
         return;
      }

      if (is_callable(self::$enqueue_editor_assets_callback)) {
         call_user_func(self::$enqueue_editor_assets_callback);
      }
   }

   /**
    * Force `type="module"` on selected script handles.
    *
    * @param string $tag Existing script tag.
    * @param string $handle Script handle.
    * @param string $src Script source URL.
    * @return string
    */
   public static function force_module_script_tag(string $tag, string $handle, string $src): string
   {
      if (!self::should_force_module($handle)) {
         return $tag;
      }

      $safe_src = function_exists('esc_url') ? esc_url($src) : $src;
      return '<script type="module" src="' . $safe_src . '" id="' . $handle . '-js"></script>' . "\n";
   }

   /**
    * Ensure underscore/backbone are enqueued in block editor when configured.
    *
    * @return void
    */
   public static function ensure_editor_dependencies(): void
   {
      if (!self::$include_editor_underscore_backbone) {
         return;
      }

      if (!function_exists('get_current_screen') || !function_exists('wp_enqueue_script')) {
         return;
      }

      $screen = get_current_screen();
      if (!$screen || !method_exists($screen, 'is_block_editor') || !$screen->is_block_editor()) {
         return;
      }

      wp_enqueue_script('underscore');
      wp_enqueue_script('backbone');
   }

   /**
    * @param array<string, mixed> $options
    * @return void
    */
   private static function apply_options(array $options): void
   {
      if (Helper::bool_option($options, 'use_wp_iframe_defaults', false)) {
         $options = array_merge(self::wp_iframe_defaults(), $options);
      }

      $enqueue_assets_callback = Helper::callable_option($options, 'enqueue_assets_callback');
      if ($enqueue_assets_callback !== null) {
         self::$enqueue_assets_callback = $enqueue_assets_callback;
      }

      $enqueue_editor_assets_callback = Helper::callable_option($options, 'enqueue_editor_assets_callback');
      if ($enqueue_editor_assets_callback !== null) {
         self::$enqueue_editor_assets_callback = $enqueue_editor_assets_callback;
      }

      if (isset($options['force_module_handles'])) {
         $handles = Helper::string_list(Helper::array_option($options, 'force_module_handles', []));
         self::$force_module_handles = array_values(array_unique(array_merge(self::$force_module_handles, $handles)));
      }

      $module_handle_predicate = Helper::callable_option($options, 'module_handle_predicate');
      if ($module_handle_predicate !== null) {
         self::$module_handle_predicate = $module_handle_predicate;
      }

      self::$include_editor_underscore_backbone = Helper::bool_option(
         $options,
         'include_editor_underscore_backbone',
         self::$include_editor_underscore_backbone,
      );
   }

   /**
    * @param string $handle
    * @return bool
    */
   private static function should_force_module(string $handle): bool
   {
      if (in_array($handle, self::$force_module_handles, true)) {
         return true;
      }

      if (is_callable(self::$module_handle_predicate)) {
         return (bool) call_user_func(self::$module_handle_predicate, $handle);
      }

      return false;
   }
}
