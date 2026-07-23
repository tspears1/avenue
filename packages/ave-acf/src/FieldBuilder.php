<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class FieldBuilder
{
   /**
    * Build a component-level field group.
    *
    * @param string $component_name Component slug or name.
    * @param array<int, array<string, mixed>> $fields Field definitions.
    * @param array<string, mixed> $config Field group configuration overrides.
    * @return array<string, mixed> ACF field group array.
    */
   public static function build_field_group(string $component_name, array $fields, array $config = []): array
   {
      $component_key = self::normalize_token($component_name);
      $wrap = (bool) ($config['wrap'] ?? true);
      $wrapper_class = (string) ($config['wrapper_class'] ?? 'ghost-wrapper');

      if ($wrap) {
         $fields = [
            self::build_group(
               $component_key,
               'section',
               $fields,
               [
                  'name' => $component_key . '_section',
                  'label' => self::build_label($component_key),
                  'wrapper' => ['class' => $wrapper_class],
               ],
            ),
         ];
      }

      $defaults = [
         'key' => self::build_group_key($component_key, 'component'),
         'title' => '[Component] ' . self::build_label($component_key),
         'fields' => $fields,
         'location' => [],
      ];

      unset($config['wrap'], $config['wrapper_class']);

      return array_replace($defaults, $config, [
         'key' => $defaults['key'],
         'fields' => $fields,
      ]);
   }

   /**
    * Build a base field with deterministic key + normalized name.
    *
    * @param string $component_name Component slug or name.
    * @param string $field_name Field slug or name.
    * @param array<string, mixed> $args Additional ACF field args.
    * @return array<string, mixed> ACF field array.
    */
   public static function build_field(string $component_name, string $field_name, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $field_key = self::normalize_token($field_name);

      return array_replace(
         [
            'key' => self::build_field_key($component_key, $field_key),
            'name' => $field_key,
         ],
         $args,
         [
            'key' => self::build_field_key($component_key, $field_key),
         ],
      );
   }

   /**
    * Build an ACF group field.
    *
    * @param string $component_name Component slug or name.
    * @param string $group_name Group field name.
    * @param array<int, array<string, mixed>> $fields Sub fields.
    * @param array<string, mixed> $args Additional ACF group args.
    * @return array<string, mixed> ACF group field array.
    */
   public static function build_group(string $component_name, string $group_name, array $fields, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $group_key = self::normalize_token($group_name);

      $defaults = [
         'key' => self::build_field_key($component_key, 'group_' . $group_key),
         'name' => $group_key,
         'label' => self::build_label($group_key),
         'type' => 'group',
         'layout' => 'block',
         'sub_fields' => $fields,
         'wrapper' => [],
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'group',
         'sub_fields' => $fields,
      ]);
   }

   /**
    * Build an ACF clone field.
    *
    * @param string $component_name Component slug or name.
    * @param string $clone_name Clone field name.
    * @param array<int, string>|null $clone_keys Field/group keys or source field names.
    * @param array<string, mixed> $args Additional ACF clone args.
    * @return array<string, mixed> ACF clone field array.
    */
   public static function build_clone(string $component_name, string $clone_name, ?array $clone_keys = null, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $clone_key = self::normalize_token($clone_name);
      $resolved_clone_keys = self::resolve_clone_keys($clone_key, $clone_keys);

      $defaults = [
         'key' => self::build_field_key($component_key, 'clone_' . $clone_key),
         'name' => $clone_key,
         'label' => self::build_label($clone_key),
         'type' => 'clone',
         'clone' => $resolved_clone_keys,
         'display' => 'seamless',
         'layout' => 'block',
         'wrapper' => [],
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'clone',
         'clone' => $resolved_clone_keys,
      ]);
   }

   /**
    * Build an ACF flexible content field.
    *
    * @param string $component_name Component slug or name.
    * @param string $flex_name Flexible field name.
    * @param array<int, array<string, mixed>> $layouts Flexible layouts.
    * @param array<string, mixed> $args Additional ACF flexible args.
    * @return array<string, mixed> ACF flexible content field array.
    */
   public static function build_flexible(string $component_name, string $flex_name, array $layouts, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $flex_key = self::normalize_token($flex_name);

      $defaults = [
         'key' => self::build_field_key($component_key, 'flex_' . $flex_key),
         'name' => $flex_key,
         'label' => self::build_label($flex_key),
         'type' => 'flexible_content',
         'layouts' => $layouts,
         'wrapper' => [],
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'flexible_content',
         'layouts' => $layouts,
      ]);
   }

   /**
    * Build an ACF tab field.
    *
    * @param string $component_name Component slug or name.
    * @param string $tab_name Tab field name.
    * @param array<string, mixed> $args Additional ACF tab args.
    * @return array<string, mixed> ACF tab field array.
    */
   public static function build_tab(string $component_name, string $tab_name, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $tab_key = self::normalize_token($tab_name);

      $defaults = [
         'key' => self::build_field_key($component_key, 'tab_' . $tab_key),
         'name' => $tab_key,
         'label' => self::build_label($tab_key),
         'type' => 'tab',
         'placement' => 'top',
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'tab',
      ]);
   }

   /**
    * Build an ACF accordion field.
    *
    * @param string $component_name Component slug or name.
    * @param string $accordion_name Accordion field name.
    * @param array<string, mixed> $args Additional ACF accordion args.
    * @return array<string, mixed> ACF accordion field array.
    */
   public static function build_accordion(string $component_name, string $accordion_name, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $accordion_key = self::normalize_token($accordion_name);

      $defaults = [
         'key' => self::build_field_key($component_key, 'accordion_' . $accordion_key),
         'name' => $accordion_key,
         'label' => self::build_label($accordion_key),
         'type' => 'accordion',
         'open' => 0,
         'multi_expand' => 0,
         'endpoint' => 0,
         'placement' => 'top',
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'accordion',
      ]);
   }

   /**
    * Build an ACF repeater field.
    *
    * @param string $component_name Component slug or name.
    * @param string $repeater_name Repeater field name.
    * @param array<int, array<string, mixed>> $fields Sub fields.
    * @param array<string, mixed> $args Additional ACF repeater args.
    * @return array<string, mixed> ACF repeater field array.
    */
   public static function build_repeater(string $component_name, string $repeater_name, array $fields, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $repeater_key = self::normalize_token($repeater_name);

      $defaults = [
         'key' => self::build_field_key($component_key, 'repeater_' . $repeater_key),
         'name' => $repeater_key,
         'label' => self::build_label($repeater_key),
         'type' => 'repeater',
         'sub_fields' => $fields,
         'layout' => 'block',
         'min' => 0,
         'max' => 0,
         'wrapper' => [],
      ];

      return array_replace($defaults, $args, [
         'key' => $defaults['key'],
         'type' => 'repeater',
         'sub_fields' => $fields,
      ]);
   }

   /**
    * Extract fields from a field group.
    *
    * When the group uses FieldBuilder's component wrapper, the wrapper's
    * sub-fields are returned by default.
    *
    * @param array<string, mixed> $field_group ACF field group config.
    * @param bool $unwrap Whether to unwrap the generated component group.
    * @return array<int, array<string, mixed>> Field definitions.
    */
   public static function get_fields(array $field_group, bool $unwrap = true): array
   {
      $fields = $field_group['fields'] ?? [];

      if (!is_array($fields)) {
         return [];
      }

      if (!$unwrap || count($fields) !== 1) {
         return array_values($fields);
      }

      $wrapper = $fields[0] ?? null;

      if (
         !is_array($wrapper)
         || ($wrapper['type'] ?? null) !== 'group'
         || !isset($wrapper['sub_fields'])
         || !is_array($wrapper['sub_fields'])
      ) {
         return array_values($fields);
      }

      return array_values($wrapper['sub_fields']);
   }

   /**
    * Apply field overrides recursively.
    *
    * Overrides may target a field by name, full ACF key, or dotted field path.
    * Dotted paths are useful when duplicate field names exist in separate groups.
    *
    * Example:
    * [
    *    'items' => ['min' => 1, 'max' => 4],
    *    'settings.theme' => ['default_value' => 'light'],
    *    'field_ave_button_url' => ['required' => true],
    * ]
    *
    * @param array<int, array<string, mixed>> $fields Field definitions.
    * @param array<string, array<string, mixed>> $overrides Overrides keyed by name, key, or path.
    * @return array<int, array<string, mixed>> Updated field definitions.
    */
   public static function override_fields(array $fields, array $overrides): array
   {
      return self::walk_fields(
         $fields,
         static function (array $field, string $path) use ($overrides): array {
            $targets = array_filter([
               $field['name'] ?? null,
               $field['key'] ?? null,
               $path,
            ], 'is_string');

            foreach ($targets as $target) {
               if (!isset($overrides[$target]) || !is_array($overrides[$target])) {
                  continue;
               }

               $field = self::replace_field_args($field, $overrides[$target]);
            }

            return $field;
         },
      );
   }

   /**
    * Materialize reusable field definitions for another component.
    *
    * This copies the fields, applies context-specific overrides, and generates
    * fresh deterministic keys for the consuming component. Use this instead of
    * an ACF clone field when the consuming component needs different settings.
    *
    * @param string $component_name Consuming component name.
    * @param array<int, array<string, mixed>> $fields Source field definitions.
    * @param array<string, array<string, mixed>> $overrides Overrides keyed by name, key, or dotted path.
    * @param string|null $namespace Optional key namespace for multiple instances in one component.
    * @return array<int, array<string, mixed>> Materialized field definitions.
    */
   public static function materialize_fields(
      string $component_name,
      array $fields,
      array $overrides = [],
      ?string $namespace = null,
   ): array {
      $component_key = self::normalize_token($component_name);
      $namespace_key = self::normalize_token((string) $namespace);

      $fields = self::override_fields($fields, $overrides);

      return self::walk_fields(
         $fields,
         static function (array $field, string $path) use ($component_key, $namespace_key): array {
            $identity = $path !== ''
               ? $path
               : (string) ($field['name'] ?? $field['key'] ?? 'field');

            if ($namespace_key !== '') {
               $identity = $namespace_key . '_' . $identity;
            }

            $field['key'] = self::build_field_key($component_key, $identity);

            return $field;
         },
      );
   }

   /**
    * Register a local field group with ACF if available.
    *
    * @param array<string, mixed> $field_group ACF field group config.
    * @return bool True when registered, false when ACF is unavailable.
    */
   public static function register_field_group(array $field_group): bool
   {
      if (!function_exists('acf_add_local_field_group')) {
         return false;
      }

      acf_add_local_field_group($field_group);
      return true;
   }

   /**
    * Build a deterministic group key.
    */
   public static function build_group_key(string $component_name, string $suffix = 'component'): string
   {
      $component_key = self::normalize_token($component_name);
      $suffix_key = self::normalize_token($suffix);

      return 'group_ave_' . $component_key . '_' . $suffix_key;
   }

   /**
    * Build a deterministic field key.
    */
   public static function build_field_key(string $component_name, string $field_name): string
   {
      $component_key = self::normalize_token($component_name);
      $field_key = self::normalize_token($field_name);

      return 'field_ave_' . $component_key . '_' . $field_key;
   }

   public static function field_group(array $config): array
   {
      return self::build_field_group(
         (string) ($config['component_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['config'] ?? []),
      );
   }

   public static function field(array $config): array
   {
      return self::build_field(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['field_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   public static function group(array $config): array
   {
      return self::build_group(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['group_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   public static function repeater(array $config): array
   {
      return self::build_repeater(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['repeater_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   public static function clone_field(array $config): array
   {
      return self::build_clone(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['clone_name'] ?? ''),
         isset($config['clone_keys']) && is_array($config['clone_keys'])
            ? $config['clone_keys']
            : null,
         (array) ($config['args'] ?? []),
      );
   }

   public static function flexible(array $config): array
   {
      return self::build_flexible(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['flex_name'] ?? ''),
         (array) ($config['layouts'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   public static function tab(array $config): array
   {
      return self::build_tab(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['tab_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   public static function accordion(array $config): array
   {
      return self::build_accordion(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['accordion_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Recursively walk fields, nested sub-fields, and flexible layouts.
    *
    * @param array<int, array<string, mixed>> $fields
    * @param callable(array<string, mixed>, string): array<string, mixed> $callback
    * @param string $parent_path
    * @return array<int, array<string, mixed>>
    */
   private static function walk_fields(array $fields, callable $callback, string $parent_path = ''): array
   {
      foreach ($fields as $index => $field) {
         if (!is_array($field)) {
            continue;
         }

         $field_name = self::normalize_token(
            (string) ($field['name'] ?? $field['key'] ?? 'field_' . $index),
         );

         $path = $parent_path === ''
            ? $field_name
            : $parent_path . '.' . $field_name;

         $field = $callback($field, $path);

         if (isset($field['sub_fields']) && is_array($field['sub_fields'])) {
            $field['sub_fields'] = self::walk_fields(
               $field['sub_fields'],
               $callback,
               $path,
            );
         }

         if (isset($field['layouts']) && is_array($field['layouts'])) {
            foreach ($field['layouts'] as $layout_index => $layout) {
               if (!is_array($layout)) {
                  continue;
               }

               $layout_name = self::normalize_token(
                  (string) ($layout['name'] ?? $layout['key'] ?? 'layout_' . $layout_index),
               );

               $layout_path = $path . '.' . $layout_name;

               if (isset($layout['sub_fields']) && is_array($layout['sub_fields'])) {
                  $layout['sub_fields'] = self::walk_fields(
                     $layout['sub_fields'],
                     $callback,
                     $layout_path,
                  );
               }

               $field['layouts'][$layout_index] = $layout;
            }
         }

         $fields[$index] = $field;
      }

      return array_values($fields);
   }

   /**
    * Replace a field's settings while protecting structural identity.
    *
    * Associative settings such as wrapper and conditional_logic are merged
    * recursively. Indexed arrays such as choices are replaced as complete values.
    *
    * @param array<string, mixed> $field
    * @param array<string, mixed> $overrides
    * @return array<string, mixed>
    */
   private static function replace_field_args(array $field, array $overrides): array
   {
      unset(
         $overrides['key'],
         $overrides['name'],
         $overrides['type'],
         $overrides['sub_fields'],
         $overrides['layouts'],
      );

      foreach ($overrides as $key => $value) {
         if (
            isset($field[$key])
            && is_array($field[$key])
            && is_array($value)
            && !array_is_list($field[$key])
            && !array_is_list($value)
         ) {
            $field[$key] = array_replace_recursive($field[$key], $value);
            continue;
         }

         $field[$key] = $value;
      }

      return $field;
   }

   private static function build_label(string $value): string
   {
      return ucwords(str_replace('_', ' ', $value));
   }

   private static function normalize_token(string $value): string
   {
      $normalized = strtolower(trim($value));
      $normalized = preg_replace('/[^a-z0-9_]+/', '_', $normalized) ?? '';
      $normalized = preg_replace('/_+/', '_', $normalized) ?? '';

      return trim($normalized, '_');
   }

   /**
    * Resolve clone targets from full ACF keys or shorthand field names.
    *
    * @param string $source_component Component name used as the clone source.
    * @param array<int, string>|null $clone_keys Clone keys or shorthand names.
    * @return array<int, string> Resolved ACF clone targets.
    */
   private static function resolve_clone_keys(string $source_component, ?array $clone_keys): array
   {
      $source_key = self::normalize_token($source_component);
      $default_group_key = self::build_group_key($source_key, 'component');

      if ($clone_keys === null || $clone_keys === []) {
         return [$default_group_key];
      }

      $resolved_keys = [];

      foreach ($clone_keys as $clone_target) {
         if (!is_string($clone_target)) {
            continue;
         }

         $trimmed_target = trim($clone_target);

         if ($trimmed_target === '') {
            continue;
         }

         $normalized_target = self::normalize_token($trimmed_target);

         if ($normalized_target === 'all' || $trimmed_target === '*') {
            $resolved_keys[] = $default_group_key;
            continue;
         }

         if (
            str_starts_with($trimmed_target, 'field_')
            || str_starts_with($trimmed_target, 'group_')
         ) {
            $resolved_keys[] = $trimmed_target;
            continue;
         }

         $resolved_keys[] = self::build_field_key($source_key, $normalized_target);
      }

      $resolved_keys = array_values(array_unique($resolved_keys));

      return $resolved_keys !== []
         ? $resolved_keys
         : [$default_group_key];
   }

   /**
    * Select fields by field name or full ACF field key.
    *
    * An empty include list returns all fields. Exclusions are applied after
    * inclusions and therefore take precedence.
    *
    * This selects top-level fields only. Nested sub-fields remain attached to
    * their parent field.
    *
    * @param array<int, array<string, mixed>> $fields Field definitions.
    * @param array<int, string>|null $include Field names or keys to include.
    * @param array<int, string> $exclude Field names or keys to exclude.
    * @return array<int, array<string, mixed>> Selected field definitions.
    */
   public static function select_fields(
      array $fields,
      ?array $include = null,
      array $exclude = [],
   ): array {
      $include = self::normalize_field_selectors($include ?? []);
      $exclude = self::normalize_field_selectors($exclude);

      return array_values(
         array_filter(
            $fields,
            static function (array $field) use ($include, $exclude): bool {
               $identifiers = self::get_field_identifiers($field);

               $is_included = $include === []
                  || array_intersect($identifiers, $include) !== [];

               $is_excluded = array_intersect($identifiers, $exclude) !== [];

               return $is_included && !$is_excluded;
            },
         ),
      );
   }

   /**
    * Get the selectable identifiers for a field.
    *
    * @param array<string, mixed> $field Field definition.
    * @return array<int, string>
    */
   private static function get_field_identifiers(array $field): array
   {
      $identifiers = [];

      if (isset($field['name']) && is_string($field['name'])) {
         $identifiers[] = self::normalize_token($field['name']);
      }

      if (isset($field['key']) && is_string($field['key'])) {
         $identifiers[] = $field['key'];
      }

      return array_values(array_unique($identifiers));
   }

   /**
    * Normalize field selector names while preserving complete ACF keys.
    *
    * @param array<int, mixed> $selectors Field names or keys.
    * @return array<int, string>
    */
   private static function normalize_field_selectors(array $selectors): array
   {
      $normalized = [];

      foreach ($selectors as $selector) {
         if (!is_string($selector)) {
            continue;
         }

         $selector = trim($selector);

         if ($selector === '') {
            continue;
         }

         $normalized[] = str_starts_with($selector, 'field_')
            ? $selector
            : self::normalize_token($selector);
      }

      return array_values(array_unique($normalized));
   }
}
