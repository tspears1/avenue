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
            [
               'key' => self::build_field_key($component_key, 'section'),
               'name' => $component_key . '_section',
               'label' => self::build_label($component_key),
               'type' => 'group',
               'sub_fields' => $fields,
               'layout' => 'block',
               'wrapper' => ['class' => $wrapper_class],
            ],
         ];
      }

      $defaults = [
         'key' => self::build_group_key($component_key, 'component'),
         'title' => '[Component] ' . self::build_label($component_key),
         'fields' => $fields,
         'location' => [],
      ];

      unset($config['wrap'], $config['wrapper_class']);

      return array_merge($defaults, $config);
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

      return array_merge([
         'key' => self::build_field_key($component_key, $field_key),
         'name' => $field_key,
      ], $args);
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

      return [
         'key' => self::build_field_key($component_key, 'group_' . $group_key),
         'name' => $group_key,
         'label' => $args['label'] ?? self::build_label($group_key),
         'type' => 'group',
         'layout' => $args['layout'] ?? 'block',
         'sub_fields' => $fields,
         'wrapper' => $args['wrapper'] ?? [],
      ];
   }

   /**
    * Build an ACF clone field.
    *
    * @param string $component_name Component slug or name.
    * @param string $clone_name Clone field name.
    * @param array<int, string>|null $clone_keys Field/group keys or source field names.
    *                                       When null/empty or containing "all"/"*", clones the full source component group.
    * @param array<string, mixed> $args Additional ACF clone args.
    * @return array<string, mixed> ACF clone field array.
    */
   public static function build_clone(string $component_name, string $clone_name, ?array $clone_keys = null, array $args = []): array
   {
      $component_key = self::normalize_token($component_name);
      $clone_key = self::normalize_token($clone_name);
      $resolved_clone_keys = self::resolve_clone_keys($clone_key, $clone_keys);

      return [
         'key' => self::build_field_key($component_key, 'clone_' . $clone_key),
         'name' => $clone_key,
         'label' => $args['label'] ?? self::build_label($clone_key),
         'type' => 'clone',
         'clone' => $resolved_clone_keys,
         'display' => $args['display'] ?? 'seamless',
         'layout' => $args['layout'] ?? 'block',
         'wrapper' => $args['wrapper'] ?? [],
      ];
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

      return [
         'key' => self::build_field_key($component_key, 'flex_' . $flex_key),
         'name' => $flex_key,
         'label' => $args['label'] ?? self::build_label($flex_key),
         'type' => 'flexible_content',
         'layouts' => $layouts,
         'wrapper' => $args['wrapper'] ?? [],
      ];
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

      return [
         'key' => self::build_field_key($component_key, 'tab_' . $tab_key),
         'name' => $tab_key,
         'label' => $args['label'] ?? self::build_label($tab_key),
         'type' => 'tab',
         'placement' => $args['placement'] ?? 'top',
      ];
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

      return [
         'key' => self::build_field_key($component_key, 'accordion_' . $accordion_key),
         'name' => $accordion_key,
         'label' => $args['label'] ?? self::build_label($accordion_key),
         'type' => 'accordion',
         'open' => $args['open'] ?? 0,
         'multi_expand' => $args['multi_expand'] ?? 0,
         'endpoint' => $args['endpoint'] ?? 0,
         'placement' => $args['placement'] ?? 'top',
      ];
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

      return [
         'key' => self::build_field_key($component_key, 'repeater_' . $repeater_key),
         'name' => $repeater_key,
         'label' => $args['label'] ?? self::build_label($repeater_key),
         'type' => 'repeater',
         'sub_fields' => $fields,
         'layout' => $args['layout'] ?? 'block',
         'min' => $args['min'] ?? 0,
         'max' => $args['max'] ?? 0,
         'wrapper' => $args['wrapper'] ?? [],
      ];
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
    *
    * @param string $component_name Component slug or name.
    * @param string $suffix Group key suffix.
    * @return string Deterministic group key.
    */
   public static function build_group_key(string $component_name, string $suffix = 'component'): string
   {
      $component_key = self::normalize_token($component_name);
      $suffix_key = self::normalize_token($suffix);
      return 'group_ave_' . $component_key . '_' . $suffix_key;
   }

   /**
    * Build a deterministic field key.
    *
    * @param string $component_name Component slug or name.
    * @param string $field_name Field slug or name.
    * @return string Deterministic field key.
    */
   public static function build_field_key(string $component_name, string $field_name): string
   {
      $component_key = self::normalize_token($component_name);
      $field_key = self::normalize_token($field_name);
      return 'field_ave_' . $component_key . '_' . $field_key;
   }

   /**
    * Alias for build_field_group using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, fields, and optional config.
    * @return array<string, mixed> ACF field group array.
    */
   public static function field_group(array $config): array
   {
      return self::build_field_group(
         (string) ($config['component_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['config'] ?? []),
      );
   }

   /**
    * Alias for build_field using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, field_name, and optional args.
    * @return array<string, mixed> ACF field array.
    */
   public static function field(array $config): array
   {
      return self::build_field(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['field_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_group using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, group_name, fields, and optional args.
    * @return array<string, mixed> ACF group field array.
    */
   public static function group(array $config): array
   {
      return self::build_group(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['group_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_repeater using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, repeater_name, fields, and optional args.
    * @return array<string, mixed> ACF repeater field array.
    */
   public static function repeater(array $config): array
   {
      return self::build_repeater(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['repeater_name'] ?? ''),
         (array) ($config['fields'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_clone using a single config array.
    *
    * `clone` is a reserved keyword in PHP, so the alias is `clone_field`.
    *
    * @param array<string, mixed> $config Alias config with component_name, clone_name, clone_keys, and optional args.
    * @return array<string, mixed> ACF clone field array.
    */
   public static function clone_field(array $config): array
   {
      return self::build_clone(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['clone_name'] ?? ''),
         (array) ($config['clone_keys'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_flexible using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, flex_name, layouts, and optional args.
    * @return array<string, mixed> ACF flexible content field array.
    */
   public static function flexible(array $config): array
   {
      return self::build_flexible(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['flex_name'] ?? ''),
         (array) ($config['layouts'] ?? []),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_tab using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, tab_name, and optional args.
    * @return array<string, mixed> ACF tab field array.
    */
   public static function tab(array $config): array
   {
      return self::build_tab(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['tab_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Alias for build_accordion using a single config array.
    *
    * @param array<string, mixed> $config Alias config with component_name, accordion_name, and optional args.
    * @return array<string, mixed> ACF accordion field array.
    */
   public static function accordion(array $config): array
   {
      return self::build_accordion(
         (string) ($config['component_name'] ?? ''),
         (string) ($config['accordion_name'] ?? ''),
         (array) ($config['args'] ?? []),
      );
   }

   /**
    * Build a human-readable label from an underscore token.
    *
    * @param string $value Normalized token value.
    * @return string Human-readable label.
    */
   private static function build_label(string $value): string
   {
      return ucwords(str_replace('_', ' ', $value));
   }

   /**
    * Normalize arbitrary input into a safe underscore token.
    *
    * @param string $value Raw token value.
    * @return string Normalized token.
    */
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

         if (str_starts_with($trimmed_target, 'field_') || str_starts_with($trimmed_target, 'group_')) {
            $resolved_keys[] = $trimmed_target;
            continue;
         }

         $resolved_keys[] = self::build_field_key($source_key, $normalized_target);
      }

      $resolved_keys = array_values(array_unique($resolved_keys));

      if ($resolved_keys === []) {
         return [$default_group_key];
      }

      return $resolved_keys;
   }
}
