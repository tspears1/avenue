<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

/**
 * Resolve Avenue component metadata from ACF fields and field groups.
 */
final class AcfFieldInspector
{
    /**
     * Resolve an ACF block field value from an attrs.data payload.
     *
     * Supports field keys, direct field names, normalized field names, and
     * ACF pointer entries such as `_field_name => field_key`.
     *
     * @param array<string, mixed> $data      Block field data.
     * @param string               $fieldName Canonical field name.
     * @param string               $fieldKey  Optional ACF field key.
     *
     * @return mixed The resolved value, or null when it is absent.
     */
    public static function resolveBlockFieldValue(
        array $data,
        string $fieldName,
        string $fieldKey = ''
    ): mixed {
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
     * Extract a component name from an ACF block name.
     *
     * @param string $blockName Block name such as `acf/card`.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromBlock(string $blockName): string
    {
        if ($blockName === '') {
            return '';
        }

        $parts = explode('/', $blockName);
        $name = end($parts);

        return is_string($name) ? $name : '';
    }

    /**
     * Extract a component name from an Avenue ACF field key.
     *
     * @param string $fieldKey Field key to inspect.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromFieldKey(string $fieldKey): string
    {
        if (preg_match('/^field_ave_([^_]+)_/', $fieldKey, $matches)) {
            return (string) $matches[1];
        }

        return '';
    }

    /**
     * Resolve the owning component for an ACF field definition.
     *
     * @param array<string, mixed> $field Field definition.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameForField(array $field): string
    {
        $fieldKey = isset($field['key']) && is_string($field['key'])
            ? $field['key']
            : '';

        $fromFieldKey = self::componentNameFromFieldKey($fieldKey);

        if ($fromFieldKey !== '') {
            return $fromFieldKey;
        }

        $parent = isset($field['parent']) && is_string($field['parent'])
            ? $field['parent']
            : '';

        return $parent !== ''
            ? self::componentNameFromParent($parent)
            : '';
    }

    /**
     * Resolve a component name from an ACF parent identifier.
     *
     * @param string $parent Field-group key or parent field key.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromParent(string $parent): string
    {
        $fromGroupKey = self::componentNameFromGroupKey($parent);

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

            $fieldKey = isset($parentField['key']) && is_string($parentField['key'])
                ? $parentField['key']
                : '';
            $fromFieldKey = self::componentNameFromFieldKey($fieldKey);

            if ($fromFieldKey !== '') {
                return $fromFieldKey;
            }

            $parentIdentifier = isset($parentField['parent']) && is_string($parentField['parent'])
                ? $parentField['parent']
                : '';
            $fromParentGroup = self::componentNameFromGroupKey($parentIdentifier);

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
     * Extract a component name from an Avenue ACF field-group key.
     *
     * @param string $groupKey Field-group key to inspect.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromGroupKey(string $groupKey): string
    {
        if (preg_match('/^group_ave_([^_]+)_/', $groupKey, $matches)) {
            return (string) $matches[1];
        }

        return '';
    }

    /**
     * Extract a component name from ACF field-group location rules.
     *
     * @param array<string, mixed> $group Field-group definition.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromGroupLocation(array $group): string
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

                if ($param === 'block' && str_starts_with($value, 'acf/')) {
                    return self::componentNameFromBlock($value);
                }
            }
        }

        return '';
    }

    /**
     * Resolve the component represented by an ACF field group.
     *
     * @param array<string, mixed> $group Field-group definition.
     *
     * @return string Component name, or an empty string when unavailable.
     */
    public static function componentNameFromGroup(array $group): string
    {
        $groupKey = isset($group['key']) && is_string($group['key'])
            ? $group['key']
            : '';
        $fromGroupKey = self::componentNameFromGroupKey($groupKey);

        return $fromGroupKey !== ''
            ? $fromGroupKey
            : self::componentNameFromGroupLocation($group);
    }

    /**
     * Convert a component name into a human-readable label.
     *
     * @param string $component Component name.
     *
     * @return string Human-readable component label.
     */
    public static function formatComponentLabel(string $component): string
    {
        $normalized = str_replace(['-', '_'], ' ', trim($component));

        return $normalized !== ''
            ? ucwords($normalized)
            : 'Component';
    }

    /**
     * Collect normalized required fields for every registered component.
     *
     * @return array<string, array<string, array{name: string, key: string, label: string}>>
     *     Required field metadata keyed by component name.
     */
    public static function requiredFieldsByComponent(): array
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

            $component = self::componentNameFromGroup($group);

            if ($component === '') {
                continue;
            }

            $fields = acf_get_fields($group);

            if (!is_array($fields)) {
                continue;
            }

            foreach (self::flattenFields($fields) as $field) {
                if (empty($field['required'])) {
                    continue;
                }

                $name = isset($field['name']) && is_string($field['name'])
                    ? $field['name']
                    : '';
                $key = isset($field['key']) && is_string($field['key'])
                    ? $field['key']
                    : '';

                if ($key === '') {
                    continue;
                }

                $label = isset($field['label']) && is_string($field['label']) && $field['label'] !== ''
                    ? $field['label']
                    : 'This field';

                $required[$component][$key] = [
                    'name' => $name,
                    'key' => $key,
                    'label' => $label,
                ];
            }
        }

        return $required;
    }

    /**
     * Flatten nested ACF group, repeater, and flexible-content fields.
     *
     * @param array<int, array<string, mixed>> $fields Fields to flatten.
     *
     * @return list<array<string, mixed>> Flattened field definitions.
     */
    public static function flattenFields(array $fields): array
    {
        $flat = [];

        foreach ($fields as $field) {
            if (!is_array($field)) {
                continue;
            }

            $flat[] = $field;

            if (isset($field['sub_fields']) && is_array($field['sub_fields'])) {
                $flat = array_merge($flat, self::flattenFields($field['sub_fields']));
            }

            if (!isset($field['layouts']) || !is_array($field['layouts'])) {
                continue;
            }

            foreach ($field['layouts'] as $layout) {
                if (!is_array($layout) || !isset($layout['sub_fields']) || !is_array($layout['sub_fields'])) {
                    continue;
                }

                $flat = array_merge($flat, self::flattenFields($layout['sub_fields']));
            }
        }

        return $flat;
    }
}
