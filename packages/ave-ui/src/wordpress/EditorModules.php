<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

/**
 * Enqueue editor UI/content modules for Avenue UI component activation.
 */
final class EditorModules
{
   /**
   * Stable editor UI module identifier used by WordPress import maps.
    */
   private const MODULE_ID = 'avenue-ui/editor-ui';

   /**
    * Stable frontend module identifier used by WordPress import maps.
    */
   private const FRONTEND_MODULE_ID = 'avenue-ui/frontend-components';

   private static bool $booted = false;

   /**
    * Register WordPress hooks exactly once.
    */
   public static function boot(): void
   {
      if (self::$booted || !function_exists('add_action')) {
         return;
      }

      self::$booted = true;

      add_action('enqueue_block_assets', [self::class, 'enqueueEditorUi'], 20);
      add_action('wp_enqueue_scripts', [self::class, 'enqueueFrontendComponents'], 20);
   }

   /**
    * Enqueue the editor UI module with requested component names.
    */
   public static function enqueueEditorUi(): void
   {
      if (!function_exists('wp_enqueue_script_module')) {
         return;
      }

      $shouldEnqueue = self::isEditorLikeRequest();

      if (!$shouldEnqueue) {
         return;
      }

      $requested = array_keys(ComponentRegistry::getRequested());
      if ($requested === []) {
         return;
      }

      $moduleUrl = self::resolveEditorLoaderUrl();
      if ($moduleUrl === null) {
         return;
      }

      $components = implode(',', $requested);
      $moduleUrl = add_query_arg('components', $components, $moduleUrl);

      wp_enqueue_script_module(
         self::MODULE_ID,
         $moduleUrl,
         [],
         null,
         ['in_footer' => true]
      );
   }

   /**
    * Enqueue frontend component loader module with requested component names.
    */
   public static function enqueueFrontendComponents(): void
   {
      if (!function_exists('wp_enqueue_script_module') || is_admin()) {
         return;
      }

      $requested = array_keys(ComponentRegistry::getRequested());
      if ($requested === []) {
         return;
      }

      $moduleUrl = self::resolveFrontendLoaderUrl();
      if ($moduleUrl === null) {
         return;
      }

      $components = implode(',', $requested);
      $moduleUrl = add_query_arg('components', $components, $moduleUrl);

      wp_enqueue_script_module(
         self::FRONTEND_MODULE_ID,
         $moduleUrl,
         [],
         null,
         ['in_footer' => true]
      );
   }

   /**
    * Determine whether the current request is a block-editor context.
    */
   private static function isEditorLikeRequest(): bool
   {
      if (is_admin()) {
         return true;
      }

      if (function_exists('wp_should_load_block_editor_scripts_and_styles')) {
         return (bool) wp_should_load_block_editor_scripts_and_styles();
      }

      return false;
   }

   /**
      * Resolve the public URL for the generated editor UI module.
    */
   private static function resolveEditorLoaderUrl(): ?string
   {
      if (!function_exists('get_theme_file_path') || !function_exists('get_theme_file_uri')) {
         return null;
      }

      $relativeThemePath = 'vendor/bostonuniversity/ave-ui/dist/wordpress/editor-ui.js';
      $themeModulePath = get_theme_file_path($relativeThemePath);

      if (!is_string($themeModulePath) || $themeModulePath === '' || !is_file($themeModulePath)) {
         return null;
      }

      $url = get_theme_file_uri($relativeThemePath);

      return is_string($url) && $url !== ''
         ? $url
         : null;
   }

   /**
    * Resolve the public URL for the generated frontend component loader module.
    */
   private static function resolveFrontendLoaderUrl(): ?string
   {
      if (!function_exists('get_theme_file_path') || !function_exists('get_theme_file_uri')) {
         return null;
      }

      $relativeThemePath = 'vendor/bostonuniversity/ave-ui/dist/wordpress/editor-content.js';
      $themeModulePath = get_theme_file_path($relativeThemePath);

      if (!is_string($themeModulePath) || $themeModulePath === '' || !is_file($themeModulePath)) {
         return null;
      }

      $url = get_theme_file_uri($relativeThemePath);

      return is_string($url) && $url !== ''
         ? $url
         : null;
   }

}
