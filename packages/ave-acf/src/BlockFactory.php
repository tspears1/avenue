<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class BlockFactory
{
   /**
    * @var array<string, array<string, mixed>>
    */
   private static array $registered_blocks = [];

   /**
    * @var array<string, mixed>
    */
   private static array $global_hook_options = [];

   /**
    * Configure global block hook options.
    *
      * @param array<string, mixed> $options Global hook options for BlockAssets.
      * Supported options include `use_wp_iframe_defaults` for WordPress iframe editor defaults.
    * @return void
    */
   public static function configure_global_hooks(array $options): void
   {
      self::$global_hook_options = $options;
      BlockAssets::register_global_hooks(self::$global_hook_options);
   }

   /**
    * Register a single ACF block.
    *
    * Required config keys: name, title, field_group_key.
    *
    * @param array<string, mixed> $config Block configuration.
    * @return void
    */
   public static function register(array $config): void
   {
      if (!self::has_required_config($config)) {
         return;
      }

      $name = self::normalize_block_name((string) $config['name']);
      $config['name'] = $name;
      self::$registered_blocks[$name] = $config;

      $register_global_hooks = Helper::bool_option($config, 'register_global_hooks', true);

      if ($register_global_hooks) {
         $hook_options = Helper::array_option($config, 'global_hook_options', []);
         BlockAssets::register_global_hooks(array_merge(self::$global_hook_options, $hook_options));
      }

      if (function_exists('acf_register_block_type')) {
         self::register_block_type($config, $name);
         return;
      }

      if (function_exists('add_action')) {
         add_action('acf/init', static function () use ($config, $name): void {
            self::register_block_type($config, $name);
         });
      }
   }

   /**
    * Register many blocks in one call.
    *
    * @param array<int, array<string, mixed>> $configs Block configurations.
    * @return void
    */
   public static function register_many(array $configs): void
   {
      foreach ($configs as $config) {
         if (!is_array($config)) {
            continue;
         }

         self::register($config);
      }
   }

   /**
    * Get a registered block config by name.
    *
    * @param string $name Block name.
    * @return array<string, mixed>|null
    */
   public static function get_block(string $name): ?array
   {
      $normalized_name = self::normalize_block_name($name);
      return self::$registered_blocks[$normalized_name] ?? null;
   }

   /**
    * Get all registered block configs.
    *
    * @return array<string, array<string, mixed>>
    */
   public static function get_blocks(): array
   {
      return self::$registered_blocks;
   }

   /**
    * Default render callback for registered blocks.
    *
    * @param array<string, mixed> $block Block settings.
    * @param string $content Block content.
    * @param bool $is_preview Preview mode flag.
    * @param int|string $post_id Post ID/context.
    * @return void
    */
   public static function render_block(array $block, string $content = '', bool $is_preview = false, $post_id = 0): void
   {
      $block_name = isset($block['name']) && is_string($block['name'])
         ? str_replace('acf/', '', $block['name'])
         : '';

      $config = self::get_block($block_name);
      $fields = function_exists('get_fields') ? get_fields() : [];

      if (!is_array($fields)) {
         $fields = [];
      }

      if ($is_preview) {
         $fields = self::clean_auto_inline_editing_placeholders($fields);
      }

      if (is_array($config) && isset($config['render_template']) && is_string($config['render_template'])) {
         $template = $config['render_template'];
         if (file_exists($template)) {
            include $template;
            return;
         }
      }

      if ($is_preview && $fields === []) {
         echo '<div class="ave-acf-block-preview-placeholder" style="padding:16px;border:1px dashed #c3c4c7;background:#fff;">';
         echo '<p style="margin:0;color:#50575e;">Configure block fields to preview content.</p>';
         echo '</div>';
      }
   }

   /**
    * Register the underlying block type with ACF.
    *
    * @param array<string, mixed> $config Block configuration.
    * @param string $name Normalized block name.
    * @return void
    */
   private static function register_block_type(array $config, string $name): void
   {
      static $registered_names = [];
      if (in_array($name, $registered_names, true)) {
         return;
      }
      $registered_names[] = $name;

      if (!function_exists('acf_register_block_type')) {
         return;
      }

      $defaults = [
         'category' => 'ave-components',
         'icon' => 'admin-generic',
         'keywords' => [],
         'api_version' => 3,
         'acf_block_version' => 3,
         'mode' => 'auto',
         'supports' => [
            'align' => true,
            'mode' => true,
            'jsx' => false,
            'anchor' => true,
            'html' => false,
            'customClassName' => true,
            'className' => true,
         ],
      ];

      $render_callback = (isset($config['render_callback']) && is_callable($config['render_callback']))
         ? $config['render_callback']
         : static function (array $block, string $content = '', bool $is_preview = false, $post_id = 0): void {
            self::render_block($block, $content, $is_preview, $post_id);
         };

      $block_config = [
         'name' => $name,
         'title' => (string) Helper::string_option($config, 'title', ''),
         'description' => (string) Helper::string_option($config, 'description', ''),
         'icon' => (string) Helper::string_option($config, 'icon', $defaults['icon']),
         'category' => (string) Helper::string_option($config, 'category', $defaults['category']),
         'keywords' => Helper::array_option($config, 'keywords', $defaults['keywords']),
         'api_version' => Helper::int_option($config, 'api_version', $defaults['api_version']),
         'acf_block_version' => Helper::int_option($config, 'acf_block_version', $defaults['acf_block_version']),
         'mode' => (string) Helper::string_option($config, 'mode', $defaults['mode']),
         'supports' => Helper::array_option($config, 'supports', $defaults['supports']),
         'render_callback' => $render_callback,
      ];

      self::copy_optional_array_keys($config, $block_config, ['post_types', 'parent', 'example']);

      acf_register_block_type($block_config);
      self::attach_field_group((string) $config['field_group_key'], $name);
   }

   /**
    * Attach a field group key to a block location rule.
    *
    * @param string $field_group_key ACF field group key.
    * @param string $block_name Block name.
    * @return void
    */
   private static function attach_field_group(string $field_group_key, string $block_name): void
   {
      if (!function_exists('add_filter') || $field_group_key === '') {
         return;
      }

      add_filter('acf/load_field_group', static function ($field_group) use ($field_group_key, $block_name) {
         if (!is_array($field_group) || !isset($field_group['key']) || $field_group['key'] !== $field_group_key) {
            return $field_group;
         }

         $field_group['location'] = [
            [
               [
                  'param' => 'block',
                  'operator' => '==',
                  'value' => 'acf/' . $block_name,
               ],
            ],
         ];

         return $field_group;
      });
   }

   /**
    * Validate required config keys.
    *
    * @param array<string, mixed> $config Block configuration.
    * @return bool
    */
   private static function has_required_config(array $config): bool
   {
      $required = ['name', 'title', 'field_group_key'];

      foreach ($required as $key) {
         if (!isset($config[$key]) || $config[$key] === '') {
            if (function_exists('trigger_error')) {
               trigger_error('BlockFactory::register() missing required config key: ' . $key, E_USER_WARNING);
            }
            return false;
         }
      }

      return true;
   }

   /**
    * Copy selected array-valued keys from source to target when present.
    *
    * @param array<string, mixed> $source
    * @param array<string, mixed> $target
    * @param array<int, string> $keys
    * @return void
    */
   private static function copy_optional_array_keys(array $source, array &$target, array $keys): void
   {
      foreach ($keys as $key) {
         if (isset($source[$key]) && is_array($source[$key])) {
            $target[$key] = $source[$key];
         }
      }
   }

   /**
    * Normalize raw block names to key-safe slugs.
    *
    * @param string $name Raw block name.
    * @return string
    */
   private static function normalize_block_name(string $name): string
   {
      if (function_exists('sanitize_key')) {
         return sanitize_key($name);
      }

      $normalized = strtolower(trim($name));
      $normalized = preg_replace('/[^a-z0-9_-]+/', '-', $normalized) ?? '';
      return trim($normalized, '-');
   }

   /**
    * Remove ACF auto inline editing placeholder values recursively.
    *
    * @param mixed $data
    * @return mixed
    */
   private static function clean_auto_inline_editing_placeholders($data)
   {
      if (!is_array($data)) {
         return $data;
      }

      foreach ($data as $key => $value) {
         if (is_string($value) && strpos($value, 'acf_auto_inline_editing_field_name_') === 0) {
            unset($data[$key]);
            continue;
         }

         if (is_array($value)) {
            $data[$key] = self::clean_auto_inline_editing_placeholders($value);
         }
      }

      return $data;
   }
}
