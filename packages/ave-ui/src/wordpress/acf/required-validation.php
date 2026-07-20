<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

if (!function_exists('add_filter')) {
   return;
}

add_filter(
   'acf/validate_value',
   static function ($valid, $value, $field, $input) {
      if ($valid !== true) {
         return $valid;
      }

      if (!is_array($field)) {
         return $valid;
      }

      $field_key = isset($field['key']) && is_string($field['key'])
         ? $field['key']
         : '';

      $componentName = resolve_component_name_for_field($field);
      $componentLabel = $componentName !== ''
         ? format_component_label($componentName)
         : 'Component';

      $is_required = !empty($field['required']);

      if ($componentName === '' || !$is_required) {
         return $valid;
      }

      if (!is_value_empty($value)) {
         return $valid;
      }

      $label = isset($field['label']) && is_string($field['label']) && $field['label'] !== ''
         ? $field['label']
         : 'This field';

      return sprintf('%s: %s is required.', $componentLabel, $label);
   },
   10,
   4
);

if (function_exists('add_action')) {
   add_action('acf/validate_save_post', static function (): void {
      if (!function_exists('acf_add_validation_error')) {
         return;
      }

      $posted = $_POST['acf'] ?? null;
      if (!is_array($posted) || $posted === []) {
         return;
      }

      $requiredByComponent = collect_required_fields_by_component();

      foreach ($requiredByComponent as $componentKey => $requiredFields) {
         if (!is_string($componentKey) || !is_array($requiredFields) || $requiredFields === []) {
            continue;
         }

         foreach ($requiredFields as $fieldKey => $label) {
            if (!has_posted_field_key($posted, $fieldKey)) {
               continue;
            }
            $value = find_posted_field_value($posted, $fieldKey);

            if (!is_value_empty($value)) {
               continue;
            }

            acf_add_validation_error(
               sprintf('acf[%s]', $fieldKey),
               sprintf('%s: %s is required.', format_component_label($componentKey), $label)
            );
         }
      }
   }, 20);
}

if (function_exists('add_filter')) {
   add_filter('rest_pre_insert_post', __NAMESPACE__ . '\\validate_required_fields_in_rest_request', 20, 2);
   add_filter('rest_pre_insert_page', __NAMESPACE__ . '\\validate_required_fields_in_rest_request', 20, 2);
}

/**
 * Validate required Avenue component fields from REST block content payloads.
 *
 * @param mixed $prepared_post
 * @param mixed $request
 * @return mixed
 */
function validate_required_fields_in_rest_request($prepared_post, $request)
{
   if (!($request instanceof \WP_REST_Request) || !function_exists('parse_blocks')) {
      return $prepared_post;
   }

   $content = extract_rest_raw_content($request);
   if (!is_string($content) || trim($content) === '') {
      return $prepared_post;
   }

   $requiredByComponent = collect_required_fields_by_component_name();
   if ($requiredByComponent === []) {
      return $prepared_post;
   }

   $errors = [];
   validate_required_fields_in_blocks(
      parse_blocks($content),
      $requiredByComponent,
      $errors
   );

   if ($errors === []) {
      return $prepared_post;
   }

   return new \WP_Error(
      'avenue_required_fields_missing',
         implode(' | ', $errors),
      ['status' => 400]
   );
}

/**
 * Extract raw content from a REST request payload.
 */
function extract_rest_raw_content(\WP_REST_Request $request): string
{
   $content = $request->get_param('content');

   if (is_array($content) && isset($content['raw']) && is_string($content['raw'])) {
      return $content['raw'];
   }

   return is_string($content) ? $content : '';
}

/**
 * @param array<int, array<string, mixed>> $blocks
 * @param array<string, array<string, array{label:string,key:string}>> $requiredByComponentName
 * @param array<int, string> $errors
 */
function validate_required_fields_in_blocks(
   array $blocks,
   array $requiredByComponentName,
   array &$errors
): void {
   foreach ($blocks as $block) {
      if (!is_array($block)) {
         continue;
      }

      $blockName = isset($block['blockName']) && is_string($block['blockName'])
         ? $block['blockName']
         : '';

      if (str_starts_with($blockName, 'acf/')) {
         $componentName = extract_component_name_from_block($blockName);
         $requiredFields = $componentName !== ''
            ? ($requiredByComponentName[$componentName] ?? [])
            : [];

         if ($requiredFields !== []) {
            $attrs = isset($block['attrs']) && is_array($block['attrs'])
               ? $block['attrs']
               : [];
            $data = isset($attrs['data']) && is_array($attrs['data'])
               ? $attrs['data']
               : [];

            foreach ($requiredFields as $fieldName => $meta) {
               $label = is_array($meta) && isset($meta['label']) && is_string($meta['label'])
                  ? $meta['label']
                  : 'This field';
               $fieldKey = is_array($meta) && isset($meta['key']) && is_string($meta['key'])
                  ? $meta['key']
                  : '';

               $value = resolve_block_field_value($data, $fieldName, $fieldKey);

               if (is_value_empty($value)) {
                  $errors[] = sprintf(
                     '%s: %s is required.',
                     format_component_label($componentName),
                     $label
                  );
               }
            }
         }
      }

      $innerBlocks = isset($block['innerBlocks']) && is_array($block['innerBlocks'])
         ? $block['innerBlocks']
         : [];

      if ($innerBlocks !== []) {
         validate_required_fields_in_blocks(
            $innerBlocks,
            $requiredByComponentName,
            $errors
         );
      }
   }
}

/**
 * Resolve an ACF block field value by name from attrs.data payload.
 *
 * Supports direct name keys and ACF pointer keys (_name => field_key).
 *
 * @param array<string, mixed> $data
 * @param string $fieldKey
 * @return mixed|null
 */
function resolve_block_field_value(array $data, string $fieldName, string $fieldKey = '')
{
   if ($fieldKey !== '' && array_key_exists($fieldKey, $data)) {
      return $data[$fieldKey];
   }

   if (array_key_exists($fieldName, $data)) {
      return $data[$fieldName];
   }

   $normalized = str_replace('-', '_', $fieldName);

   if ($normalized !== $fieldName && array_key_exists($normalized, $data)) {
      return $data[$normalized];
   }

   $pointer = $data['_' . $fieldName] ?? null;

   if (!is_string($pointer) || $pointer === '') {
      $pointer = $data['_' . $normalized] ?? null;
   }

   if (is_string($pointer) && $pointer !== '' && array_key_exists($pointer, $data)) {
      return $data[$pointer];
   }

   return null;
}

/**
 * Extract component token from ACF block name.
 */
function extract_component_name_from_block(string $blockName): string
{
   if ($blockName === '') {
      return '';
   }

   $parts = explode('/', $blockName);
   $name = end($parts);

   return is_string($name) ? $name : '';
}

/**
 * Extract component token from an Avenue field key.
 */
function extract_component_name_from_field_key(string $fieldKey): string
{
   if (preg_match('/^field_ave_([^_]+)_/', $fieldKey, $matches)) {
      return (string) $matches[1];
   }

   return '';
}

/**
 * Resolve component token for an ACF field.
 *
 * Prefers field key parsing, then parent group/location lookup.
 *
 * @param array<string, mixed> $field
 */
function resolve_component_name_for_field(array $field): string
{
   $fieldKey = isset($field['key']) && is_string($field['key'])
      ? $field['key']
      : '';

   $fromFieldKey = extract_component_name_from_field_key($fieldKey);
   if ($fromFieldKey !== '') {
      return $fromFieldKey;
   }

   $parent = isset($field['parent']) && is_string($field['parent'])
      ? $field['parent']
      : '';

   if ($parent === '') {
      return '';
   }

   return extract_component_name_from_parent_identifier($parent);
}

/**
 * Resolve component token from a parent identifier.
 *
 * Supports both field-group keys and parent field recursion.
 */
function extract_component_name_from_parent_identifier(string $parent): string
{
   $fromGroupKey = extract_component_name_from_group_key($parent);

   if ($fromGroupKey !== '') {
      return $fromGroupKey;
   }

   if (!str_starts_with($parent, 'field_') || !function_exists('acf_get_field')) {
      return '';
   }

   $seen = [];
   $current = $parent;

   while ($current !== '' && !isset($seen[$current])) {
      $seen[$current] = true;

      $parentField = acf_get_field($current);
      if (!is_array($parentField)) {
         return '';
      }

      $fromParentFieldKey = isset($parentField['key']) && is_string($parentField['key'])
         ? extract_component_name_from_field_key($parentField['key'])
         : '';

      if ($fromParentFieldKey !== '') {
         return $fromParentFieldKey;
      }

      $parentIdentifier = isset($parentField['parent']) && is_string($parentField['parent'])
         ? $parentField['parent']
         : '';

      $fromParentGroup = extract_component_name_from_group_key($parentIdentifier);
      if ($fromParentGroup !== '') {
         return $fromParentGroup;
      }

      if (!str_starts_with($parentIdentifier, 'field_')) {
         return '';
      }

      $current = $parentIdentifier;
   }

   return '';
}

/**
 * Extract component token from an Avenue field-group key.
 */
function extract_component_name_from_group_key(string $groupKey): string
{
   if (preg_match('/^group_ave_([^_]+)_/', $groupKey, $matches)) {
      return (string) $matches[1];
   }

   return '';
}

/**
 * Extract component token from field-group location rules.
 *
 * @param array<string, mixed> $group
 */
function extract_component_name_from_group_location(array $group): string
{
   $location = $group['location'] ?? null;
   if (!is_array($location)) {
      return '';
   }

   foreach ($location as $orRules) {
      if (!is_array($orRules)) {
         continue;
      }

      foreach ($orRules as $rule) {
         if (!is_array($rule)) {
            continue;
         }

         $param = isset($rule['param']) && is_string($rule['param'])
            ? $rule['param']
            : '';
         $value = isset($rule['value']) && is_string($rule['value'])
            ? $rule['value']
            : '';

         if ($param !== 'block' || !str_starts_with($value, 'acf/')) {
            continue;
         }

         return extract_component_name_from_block($value);
      }
   }

   return '';
}

/**
 * Extract component token from field-group metadata.
 *
 * @param array<string, mixed> $group
 */
function extract_component_name_from_group(array $group): string
{
   $groupKey = isset($group['key']) && is_string($group['key'])
      ? $group['key']
      : '';

   $fromGroupKey = extract_component_name_from_group_key($groupKey);
   if ($fromGroupKey !== '') {
      return $fromGroupKey;
   }

   return extract_component_name_from_group_location($group);
}

/**
 * Convert component token to human-readable label.
 */
function format_component_label(string $component): string
{
   $normalized = str_replace(['-', '_'], ' ', trim($component));

   if ($normalized === '') {
      return 'Component';
   }

   return ucwords($normalized);
}

/**
 * Collect required Avenue field labels keyed by component token.
 *
 * @return array<string, array<string, string>>
 */
function collect_required_fields_by_component(): array
{
   if (!function_exists('acf_get_field_groups') || !function_exists('acf_get_fields')) {
      return [];
   }

   $groups = acf_get_field_groups();
   if (!is_array($groups)) {
      return [];
   }

   $required = [];

   foreach ($groups as $group) {
      if (!is_array($group)) {
         continue;
      }

      $componentKey = extract_component_name_from_group($group);
      if ($componentKey === '') {
         continue;
      }

      $fields = acf_get_fields($group);
      if (!is_array($fields)) {
         continue;
      }

      foreach (flatten_acf_fields($fields) as $field) {
         if (!is_array($field) || empty($field['required'])) {
            continue;
         }

         $fieldKey = isset($field['key']) && is_string($field['key'])
            ? $field['key']
            : '';

         if ($fieldKey === '') {
            continue;
         }

         $label = isset($field['label']) && is_string($field['label']) && $field['label'] !== ''
            ? $field['label']
            : 'This field';

         $required[$componentKey][$fieldKey] = $label;
      }
   }

   return $required;
}

/**
 * Collect required Avenue field definitions keyed by component and field name.
 *
 * @return array<string, array<string, array{label:string,key:string}>>
 */
function collect_required_fields_by_component_name(): array
{
   if (!function_exists('acf_get_field_groups') || !function_exists('acf_get_fields')) {
      return [];
   }

   $groups = acf_get_field_groups();
   if (!is_array($groups)) {
      return [];
   }

   $required = [];

   foreach ($groups as $group) {
      if (!is_array($group)) {
         continue;
      }

      $componentName = extract_component_name_from_group($group);
      if ($componentName === '') {
         continue;
      }

      $fields = acf_get_fields($group);
      if (!is_array($fields)) {
         continue;
      }

      foreach (flatten_acf_fields($fields) as $field) {
         if (!is_array($field) || empty($field['required'])) {
            continue;
         }

         $fieldKey = isset($field['key']) && is_string($field['key'])
            ? $field['key']
            : '';

         if ($fieldKey === '') {
            continue;
         }

         $fieldName = isset($field['name']) && is_string($field['name'])
            ? $field['name']
            : '';

         if ($fieldName === '') {
            continue;
         }

         $label = isset($field['label']) && is_string($field['label']) && $field['label'] !== ''
            ? $field['label']
            : 'This field';

         $required[$componentName][$fieldName] = [
            'label' => $label,
            'key' => $fieldKey,
         ];
      }
   }

   return $required;
}

/**
 * Flatten nested ACF field trees (group/repeater/flexible layouts).
 *
 * @param array<int, array<string, mixed>> $fields
 * @return array<int, array<string, mixed>>
 */
function flatten_acf_fields(array $fields): array
{
   $flat = [];

   foreach ($fields as $field) {
      if (!is_array($field)) {
         continue;
      }

      $flat[] = $field;

      if (isset($field['sub_fields']) && is_array($field['sub_fields'])) {
         $flat = array_merge($flat, flatten_acf_fields($field['sub_fields']));
      }

      if (isset($field['layouts']) && is_array($field['layouts'])) {
         foreach ($field['layouts'] as $layout) {
            if (!is_array($layout) || !isset($layout['sub_fields']) || !is_array($layout['sub_fields'])) {
               continue;
            }

            $flat = array_merge($flat, flatten_acf_fields($layout['sub_fields']));
         }
      }
   }

   return $flat;
}

/**
 * Recursively collect posted ACF field keys.
 *
 * @param array<string, mixed> $posted
 * @return array<int, string>
 */
function extract_posted_field_keys(array $posted): array
{
   $keys = [];

   foreach ($posted as $key => $value) {
      if (is_string($key)) {
         $keys[] = $key;
      }

      if (is_array($value)) {
         $keys = array_merge($keys, extract_posted_field_keys($value));
      }
   }

   return $keys;
}

/**
 * Determine whether a field key exists anywhere in posted ACF payload.
 *
 * @param array<string, mixed> $posted
 */
function has_posted_field_key(array $posted, string $fieldKey): bool
{
   if (array_key_exists($fieldKey, $posted)) {
      return true;
   }

   foreach ($posted as $value) {
      if (!is_array($value)) {
         continue;
      }

      if (has_posted_field_key($value, $fieldKey)) {
         return true;
      }
   }

   return false;
}

/**
 * Recursively find a posted value by ACF field key.
 *
 * @param array<string, mixed> $posted
 * @param string $fieldKey
 * @return mixed
 */
function find_posted_field_value(array $posted, string $fieldKey)
{
   if (array_key_exists($fieldKey, $posted)) {
      return $posted[$fieldKey];
   }

   foreach ($posted as $value) {
      if (!is_array($value)) {
         continue;
      }

      $found = find_posted_field_value($value, $fieldKey);

      if ($found !== null) {
         return $found;
      }
   }

   return null;
}

/**
 * Determine whether an ACF field value should be treated as empty.
 *
 * Preserves meaningful falsey values like 0 and false.
 *
 * @param mixed $value
 */
function is_value_empty($value): bool
{
   if (is_string($value)) {
      return trim($value) === '';
   }

   if (is_array($value)) {
      return $value === [];
   }

   return $value === null;
}
