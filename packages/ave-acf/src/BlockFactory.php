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
         * Optional config keys:
         * - preview_props (preview-only component prop defaults).
         * - debug (preview-only dump of fields/config for wiring diagnostics).
    *
    * @param array<string, mixed> $config Block configuration.
    * @return void
    */
   public static function register(array $config): void
   {
      DefaultTransforms::boot();

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
   public static function render_block(array $block, string $content = '', bool $is_preview = false, $post_id = 0, bool $debug = false): void
   {
      $block_name = isset($block['name']) && is_string($block['name'])
         ? str_replace('acf/', '', $block['name'])
         : '';

      $config = self::get_block($block_name);
      $debug_enabled = $debug;

      if (is_array($config)) {
         $debug_enabled = $debug_enabled || Helper::bool_option($config, 'debug', false);
      }

      $fields = function_exists('get_fields')
         ? get_fields()
         : [];

      if (!is_array($fields)) {
         $fields = [];
      }

      if ($is_preview) {
         $fields = self::clean_auto_inline_editing_placeholders(
            $fields
         );
      }

      if (!is_array($config)) {
         self::render_preview_placeholder($is_preview, $fields, $config, $debug_enabled);
         return;
      }

      $fields = self::transform_field_values(
         $config,
         $fields,
      );

      if ($debug_enabled) {
         $debug_context = self::build_debug_context(
            $config,
            $block,
            $fields,
            $is_preview,
            $post_id
         );

         self::render_preview_placeholder($is_preview, $fields, $config, true, $debug_context);
         return;
      }

      // Preferred Avenue component render path.
      if (self::render_component($config, $block, $fields, $is_preview, $post_id)) {
         return;
      }

      // Legacy/custom template fallback.
      if (isset($config['render_template']) && is_string($config['render_template']) && file_exists($config['render_template'])) {
         include $config['render_template'];
         return;
      }

      self::render_preview_placeholder($is_preview, $fields, $config);
   }

   /**
    * Apply reusable transforms declared by ACF field definitions.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $values
    * @return array<string, mixed>
    */
   private static function transform_field_values(
      array $config,
      array $values
   ): array {
      DefaultTransforms::boot();

      $definitions = self::resolve_field_definitions($config);

      if ($definitions === []) {
         return $values;
      }

      return self::transform_values_from_definitions(
         $values,
         $definitions,
      );
   }

   /**
    * @param array<string, mixed> $config
    * @return array<int, array<string, mixed>>
    */
   private static function resolve_field_definitions(
      array $config
   ): array {
      if (
         isset($config['field_definitions']) &&
         is_array($config['field_definitions'])
      ) {
         return array_values(
            array_filter($config['field_definitions'], 'is_array')
         );
      }

      $field_group_key = $config['field_group_key'] ?? null;

      if (
         !is_string($field_group_key) ||
         $field_group_key === '' ||
         !function_exists('acf_get_fields')
      ) {
         return [];
      }

      $definitions = acf_get_fields($field_group_key);

      if (!is_array($definitions)) {
         return [];
      }

      return array_values(
         array_filter($definitions, 'is_array')
      );
   }

   /**
    * @param array<string, mixed> $values
    * @param array<int, array<string, mixed>> $definitions
    * @return array<string, mixed>
    */
   private static function transform_values_from_definitions(
      array $values,
      array $definitions
   ): array {
      foreach ($definitions as $definition) {
         $name = $definition['name'] ?? null;

         if (
            !is_string($name) ||
            $name === '' ||
            !array_key_exists($name, $values)
         ) {
            continue;
         }

         $value = $values[$name];
         $sub_fields = $definition['sub_fields'] ?? null;

         if (is_array($value) && is_array($sub_fields)) {
            $value = self::transform_values_from_definitions(
               $value,
               array_values(array_filter($sub_fields, 'is_array')),
            );
         }

         $transform = $definition['avenue_transform'] ?? null;

         if (is_array($transform)) {
            $value = TransformRegistry::apply(
               $value,
               $transform,
            );
         }

         $values[$name] = $value;
      }

      return $values;
   }

   /**
    * Render a configured Avenue component.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $block
    * @param array<string, mixed> $fields
    * @param int|string $post_id
    */
   private static function render_component(array $config, array $block, array $fields, bool $is_preview, $post_id): bool
   {
      $component = $config['component'] ?? null;

      if (!is_string($component) || !class_exists($component) || !is_callable([$component, 'render'])) {
         return false;
      }

      $render_data = self::build_component_render_data(
         $config,
         $block,
         $fields,
         $is_preview,
         $post_id
      );

      try {
         echo $component::render(
            props: $render_data['props'],
            attrs: $render_data['attrs'],
            classes: $render_data['classes'],
            slots: $render_data['slots']
         );
      } catch (\Throwable $exception) {
         self::report_component_render_error(
            $component,
            $exception
         );

         return false;
      }

      return true;
   }

   /**
    * Log a soft component render failure without crashing the request.
    */
   private static function report_component_render_error(
      string $component,
      \Throwable $exception
   ): void {
      error_log(
         sprintf(
            '[Avenue\ACF] Component render failed for "%s": %s',
            $component,
            $exception->getMessage()
         )
      );
   }

   /**
    * Build the standard Avenue component render arguments.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $block
    * @param array<string, mixed> $fields
    * @param int|string $post_id
    *
    * @return array{
    *    props: array<string, mixed>,
    *    attrs: array<string, mixed>,
    *    classes: array<int|string, mixed>,
    *    slots: array<string, mixed>
    * }
    */
   private static function build_component_render_data(
      array $config,
      array $block,
      array $fields,
      bool $is_preview,
      $post_id
   ): array {
      $map_fields_only = Helper::bool_option(
         $config,
         'map_fields_only',
         false
      );

      $props = $map_fields_only
         ? []
         : self::merge_preview_props(
            $config,
            $fields,
            $is_preview
         );

      $data = [
         // Default behavior: ACF fields map directly to component props.
         'props' => $props,

         // WordPress block settings map to host attributes/classes.
         'attrs' => self::build_block_attributes($block),
         'classes' => self::build_block_classes($block),

         // Empty unless the block mapper supplies slot content.
         'slots' => [],
      ];

      $mapper = $config['map_fields'] ?? null;

      if (!is_callable($mapper)) {
         return $data;
      }

      $mapped = $mapper(
         $fields,
         $block,
         $is_preview,
         $post_id
      );

      if (!is_array($mapped)) {
         return $data;
      }

      foreach (['props', 'attrs', 'classes', 'slots'] as $key) {
         if (
            isset($mapped[$key]) &&
            is_array($mapped[$key])
         ) {
            $data[$key] = self::merge_render_data(
               $data[$key],
               $mapped[$key]
            );
         }
      }

      $discard_stale_props = Helper::bool_option(
         $config,
         'discard_stale_props',
         true
      );

      if ($discard_stale_props) {
         $data['props'] = self::prune_unknown_props(
            $config,
            $data['props']
         );
      }

      return $data;
   }

   /**
    * Remove props not declared in the component schema when available.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $props
    * @return array<string, mixed>
    */
   private static function prune_unknown_props(
      array $config,
      array $props
   ): array {
      $schema = self::inspect_component_schema(
         $config['component'] ?? null
      );

      if (
         !is_array($schema) ||
         !isset($schema['allowed_props']) ||
         !is_array($schema['allowed_props']) ||
         $schema['allowed_props'] === []
      ) {
         return $props;
      }

      $allowed_lookup = array_fill_keys(
         $schema['allowed_props'],
         true
      );

      foreach (array_keys($props) as $name) {
         if (!isset($allowed_lookup[$name])) {
            unset($props[$name]);
         }
      }

      return $props;
   }

   /**
    * Merge preview-only prop defaults with current field values.
    *
      * Non-empty ACF values override preview defaults.
      * Empty strings/nulls are ignored so untouched fields keep preview placeholders.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $fields
    * @return array<string, mixed>
    */
   private static function merge_preview_props(
      array $config,
      array $fields,
      bool $is_preview
   ): array {
      if (!$is_preview) {
         return $fields;
      }

      $preview_props = Helper::array_option(
         $config,
         'preview_props',
         []
      );

      if ($preview_props === []) {
         return $fields;
      }

      return self::merge_preview_field_values(
         $preview_props,
         $fields
      );
   }

   /**
    * Merge field values into preview defaults without wiping defaults with empty values.
    *
    * @param array<string, mixed> $defaults
    * @param array<string, mixed> $fields
    * @return array<string, mixed>
    */
   private static function merge_preview_field_values(
      array $defaults,
      array $fields
   ): array {
      foreach ($fields as $key => $value) {
         if (is_array($value)) {
            if (!isset($defaults[$key]) || !is_array($defaults[$key])) {
               if ($value !== []) {
                  $defaults[$key] = $value;
               }

               continue;
            }

            $defaults[$key] = self::merge_preview_field_values(
               $defaults[$key],
               $value
            );
            continue;
         }

         if (!self::should_override_preview_value($value)) {
            continue;
         }

         $defaults[$key] = $value;
      }

      return $defaults;
   }

   /**
    * Determine if a field value should override a preview default.
    */
   private static function should_override_preview_value($value): bool
   {
      if ($value === null) {
         return false;
      }

      if (is_string($value)) {
         return trim($value) !== '';
      }

      return true;
   }

   /**
    * Merge component rendering data.
    *
    * Associative values are replaced by the mapped values.
    * Numeric values are appended.
    *
    * @param array<mixed> $defaults
    * @param array<mixed> $mapped
    * @return array<mixed>
    */
   private static function merge_render_data(
      array $defaults,
      array $mapped
   ): array {
      foreach ($mapped as $key => $value) {
         if (is_int($key)) {
            $defaults[] = $value;
            continue;
         }

         $defaults[$key] = $value;
      }

      return $defaults;
   }

   /**
    * Build host attributes from ACF block settings.
    *
    * @param array<string, mixed> $block
    * @return array<string, mixed>
    */
   private static function build_block_attributes(
      array $block
   ): array {
      $attrs = [];

      if (
         isset($block['anchor']) &&
         is_string($block['anchor']) &&
         $block['anchor'] !== ''
      ) {
         $attrs['id'] = $block['anchor'];
      }

      if (
         isset($block['align']) &&
         is_string($block['align']) &&
         $block['align'] !== ''
      ) {
         $attrs['data-align'] = $block['align'];
      }

      return $attrs;
   }

   /**
    * Build host classes from ACF block settings.
    *
    * @param array<string, mixed> $block
    * @return array<int|string, mixed>
    */
   private static function build_block_classes(
      array $block
   ): array {
      $name = isset($block['name']) && is_string($block['name'])
         ? str_replace('acf/', '', $block['name'])
         : '';

      $classes = [];

      if ($name !== '') {
         $classes[] = 'wp-block-acf-' . self::normalize_block_name(
            $name
         );
      }

      if (
         isset($block['className']) &&
         is_string($block['className']) &&
         $block['className'] !== ''
      ) {
         $classes[] = $block['className'];
      }

      if (
         isset($block['align']) &&
         is_string($block['align']) &&
         $block['align'] !== ''
      ) {
         $classes[] = 'align' . $block['align'];
      }

      return $classes;
   }

   /**
    * Render the default editor preview placeholder.
    */
   private static function render_preview_placeholder(
      bool $is_preview,
      array $fields,
      array|null $config = null,
      bool $debug = false,
      array $debug_context = []
   ): void {
      if (!$is_preview) {
         return;
      }

      if ($debug) {
         $debug_payload = [
            'fields' => $fields,
            'config' => $config,
            'diagnostics' => $debug_context,
         ];

         echo '<pre>';
         print_r($debug_payload);
         echo '</pre>';
         return;
      }

      echo '<div class="ave-acf-block-preview-placeholder"';
      echo ' style="padding:16px;border:1px dashed #c3c4c7;background:#fff;">';
      echo '<p style="margin:0;color:#50575e;">';
      echo 'Configure block fields to preview content.';
      echo '</p>';
      echo '</div>';
   }

   /**
    * Build block debug diagnostics for field mapping and schema validation.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $block
    * @param array<string, mixed> $fields
    * @param int|string $post_id
    * @return array<string, mixed>
    */
   private static function build_debug_context(
      array $config,
      array $block,
      array $fields,
      bool $is_preview,
      $post_id
   ): array {
      $render_data = self::build_component_render_data(
         $config,
         $block,
         $fields,
         $is_preview,
         $post_id
      );

      $context = [
         'component' => $config['component'] ?? null,
         'has_map_fields' => is_callable($config['map_fields'] ?? null),
         'discard_stale_props' => Helper::bool_option($config, 'discard_stale_props', true),
         'mapped' => [
            'prop_keys' => array_keys($render_data['props']),
            'attr_keys' => array_keys($render_data['attrs']),
            'class_count' => count($render_data['classes']),
            'slot_keys' => array_keys($render_data['slots']),
         ],
         'validation_hints' => [
            'schema_available' => false,
            'unknown_props' => [],
            'missing_required_props' => [],
            'schema_error' => null,
         ],
      ];

      $render_probe = self::probe_component_render(
         $config,
         $render_data
      );

      $context['render_probe'] = $render_probe;

      $schema = self::inspect_component_schema(
         $config['component'] ?? null
      );

      if ($schema === null) {
         return $context;
      }

      $context['validation_hints']['schema_available'] = true;

      if (isset($schema['error']) && is_string($schema['error'])) {
         $context['validation_hints']['schema_error'] = $schema['error'];
      }

      $prop_names = array_keys($render_data['props']);
      $unknown_props = array_values(
         array_diff($prop_names, $schema['allowed_props'])
      );

      $missing_required_props = [];

      foreach ($schema['required_props'] as $required_prop) {
         if (
            !array_key_exists($required_prop, $render_data['props']) ||
            $render_data['props'][$required_prop] === null ||
            $render_data['props'][$required_prop] === ''
         ) {
            $missing_required_props[] = $required_prop;
         }
      }

      $context['schema'] = $schema;
      $context['validation_hints']['unknown_props'] = $unknown_props;
      $context['validation_hints']['missing_required_props'] = $missing_required_props;

      return $context;
   }

   /**
    * Probe component rendering and surface exception details for debug mode.
    *
    * @param array<string, mixed> $config
    * @param array<string, mixed> $render_data
    * @return array<string, mixed>
    */
   private static function probe_component_render(
      array $config,
      array $render_data
   ): array {
      $component = $config['component'] ?? null;

      if (!is_string($component) || !class_exists($component)) {
         return [
            'can_render' => false,
            'error' => 'Component class is unavailable.',
         ];
      }

      if (!is_callable([$component, 'render'])) {
         return [
            'can_render' => false,
            'error' => 'Component render method is not callable.',
         ];
      }

      try {
         $output = $component::render(
            props: $render_data['props'] ?? [],
            attrs: $render_data['attrs'] ?? [],
            classes: $render_data['classes'] ?? [],
            slots: $render_data['slots'] ?? []
         );

         return [
            'can_render' => true,
            'output_length' => is_string($output) ? strlen($output) : 0,
         ];
      } catch (\Throwable $exception) {
         return [
            'can_render' => false,
            'error' => $exception->getMessage(),
            'exception' => get_class($exception),
         ];
      }
   }

   /**
    * Inspect a component schema file when available.
    *
    * @param mixed $component
    * @return array<string, mixed>|null
    */
   private static function inspect_component_schema($component): ?array
   {
      if (!is_string($component) || !class_exists($component)) {
         return null;
      }

      try {
         $reflection = new \ReflectionClass($component);

         if (!$reflection->hasProperty('schema')) {
            return null;
         }

         $schema_property = $reflection->getProperty('schema');
         $schema_property->setAccessible(true);
         $schema_path = $schema_property->getValue();

         if (!is_string($schema_path) || $schema_path === '') {
            return null;
         }

         $resolved_path = realpath($schema_path);

         if ($resolved_path === false || !is_file($resolved_path)) {
            return [
               'path' => $schema_path,
               'allowed_props' => [],
               'required_props' => [],
               'error' => 'Schema file not found.',
            ];
         }

         $contents = file_get_contents($resolved_path);

         if ($contents === false) {
            return [
               'path' => $resolved_path,
               'allowed_props' => [],
               'required_props' => [],
               'error' => 'Schema file could not be read.',
            ];
         }

         $decoded = json_decode($contents, true);

         if (!is_array($decoded)) {
            return [
               'path' => $resolved_path,
               'allowed_props' => [],
               'required_props' => [],
               'error' => 'Schema JSON is invalid.',
            ];
         }

         $definitions = $decoded['props']['root'] ?? [];

         if (!is_array($definitions)) {
            $definitions = [];
         }

         $allowed_props = array_keys($definitions);
         $required_props = [];

         foreach ($definitions as $name => $definition) {
            if (is_array($definition) && (($definition['required'] ?? false) === true)) {
               $required_props[] = $name;
            }
         }

         return [
            'path' => $resolved_path,
            'allowed_props' => $allowed_props,
            'required_props' => $required_props,
         ];
      } catch (\Throwable $exception) {
         return [
            'path' => '',
            'allowed_props' => [],
            'required_props' => [],
            'error' => $exception->getMessage(),
         ];
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
         : static function (array $block, string $content = '', bool $is_preview = false, $post_id = 0) use ($config): void {
            self::render_block($block, $content, $is_preview, $post_id, $config['debug'] ?? false);
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
