<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\ACF;

use AvenueUI\WordPress\Utils\NestedArray;

/**
 * Validate required Avenue ACF fields across classic and REST submissions.
 */
final class RequiredFieldValidator
{
    /**
     * Register required-field validation hooks.
     *
     * @return void
     */
    public static function boot(): void
    {
        add_filter('acf/validate_value', [self::class, 'validateValue'], 10, 4);

        if (function_exists('add_action')) {
            add_action('acf/validate_save_post', [self::class, 'validateSavePost'], 20);
        }

        add_filter('rest_pre_insert_post', [self::class, 'validateRestRequest'], 20, 2);
        add_filter('rest_pre_insert_page', [self::class, 'validateRestRequest'], 20, 2);
    }

    /**
     * Validate an individual ACF value with component-aware messaging.
     *
     * @param mixed $valid Existing ACF validation result.
     * @param mixed $value Submitted field value.
     * @param mixed $field ACF field definition.
     * @param mixed $input Submitted input name.
     *
     * @return mixed The existing result or a validation error message.
     */
    public static function validateValue(mixed $valid, mixed $value, mixed $field, mixed $input): mixed
    {
        if ($valid !== true || !is_array($field)) {
            return $valid;
        }

        $component = AcfFieldInspector::componentNameForField($field);

        if ($component === '' || empty($field['required']) || !self::isEmpty($value)) {
            return $valid;
        }

        $label = isset($field['label']) && is_string($field['label']) && $field['label'] !== ''
            ? $field['label']
            : 'This field';

        return sprintf(
            '%s: %s is required.',
            AcfFieldInspector::formatComponentLabel($component),
            $label
        );
    }

    /**
     * Validate required fields present in a classic ACF save payload.
     *
     * @return void
     */
    public static function validateSavePost(): void
    {
        if (!function_exists('acf_add_validation_error')) {
            return;
        }

        $posted = $_POST['acf'] ?? null;

        if (!is_array($posted) || $posted === []) {
            return;
        }

        foreach (AcfFieldInspector::requiredFieldsByComponent() as $component => $fields) {
            foreach ($fields as $field) {
                if (!NestedArray::containsKey($posted, $field['key'])) {
                    continue;
                }

                $value = NestedArray::findByKey($posted, $field['key']);

                if (!self::isEmpty($value)) {
                    continue;
                }

                acf_add_validation_error(
                    sprintf('acf[%s]', $field['key']),
                    sprintf(
                        '%s: %s is required.',
                        AcfFieldInspector::formatComponentLabel($component),
                        $field['label']
                    )
                );
            }
        }
    }

    /**
     * Validate required fields embedded in REST block content.
     *
     * @param mixed $preparedPost Prepared post data.
     * @param mixed $request      REST request.
     *
     * @return mixed Prepared post data or a WordPress validation error.
     */
    public static function validateRestRequest(mixed $preparedPost, mixed $request): mixed
    {
        if (!($request instanceof \WP_REST_Request) || !function_exists('parse_blocks')) {
            return $preparedPost;
        }

        $content = self::extractRestRawContent($request);

        if (trim($content) === '') {
            return $preparedPost;
        }

        $required = AcfFieldInspector::requiredFieldsByComponent();

        if ($required === []) {
            return $preparedPost;
        }

        $errors = [];
        self::validateBlocks(parse_blocks($content), $required, $errors);

        if ($errors === []) {
            return $preparedPost;
        }

        return new \WP_Error(
            'avenue_required_fields_missing',
            implode(' | ', $errors),
            ['status' => 400]
        );
    }

    /**
     * Extract raw post content from a REST request.
     *
     * @param \WP_REST_Request $request REST request.
     *
     * @return string Raw post content.
     */
    private static function extractRestRawContent(\WP_REST_Request $request): string
    {
        $content = $request->get_param('content');

        if (is_array($content) && isset($content['raw']) && is_string($content['raw'])) {
            return $content['raw'];
        }

        return is_string($content) ? $content : '';
    }

    /**
     * Recursively validate required fields in parsed Gutenberg blocks.
     *
     * @param array<int, array<string, mixed>> $blocks Parsed blocks.
     * @param array<string, array<string, array{name: string, key: string, label: string}>>
     *     $required Required fields.
     * @param array<int, string> $errors Collected errors.
     *
     * @return void
     */
    private static function validateBlocks(array $blocks, array $required, array &$errors): void
    {
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            $blockName = isset($block['blockName']) && is_string($block['blockName'])
                ? $block['blockName']
                : '';

            if (str_starts_with($blockName, 'acf/')) {
                self::validateBlock($block, $blockName, $required, $errors);
            }

            $innerBlocks = isset($block['innerBlocks']) && is_array($block['innerBlocks'])
                ? $block['innerBlocks']
                : [];

            if ($innerBlocks !== []) {
                self::validateBlocks($innerBlocks, $required, $errors);
            }
        }
    }

    /**
     * Validate one parsed ACF block.
     *
     * @param array<string, mixed> $block Parsed block.
     * @param string $blockName Block name.
     * @param array<string, array<string, array{name: string, key: string, label: string}>>
     *     $required Required fields.
     * @param array<int, string> $errors Collected errors.
     *
     * @return void
     */
    private static function validateBlock(
        array $block,
        string $blockName,
        array $required,
        array &$errors
    ): void {
        $component = AcfFieldInspector::componentNameFromBlock($blockName);
        $fields = $component !== ''
            ? ($required[$component] ?? [])
            : [];

        if ($fields === []) {
            return;
        }

        $attrs = isset($block['attrs']) && is_array($block['attrs'])
            ? $block['attrs']
            : [];
        $data = isset($attrs['data']) && is_array($attrs['data'])
            ? $attrs['data']
            : [];
        $validatedNames = [];

        foreach ($fields as $field) {
            if ($field['name'] === '' || isset($validatedNames[$field['name']])) {
                continue;
            }

            $validatedNames[$field['name']] = true;
            $value = AcfFieldInspector::resolveBlockFieldValue(
                $data,
                $field['name'],
                $field['key']
            );

            if (!self::isEmpty($value)) {
                continue;
            }

            $errors[] = sprintf(
                '%s: %s is required.',
                AcfFieldInspector::formatComponentLabel($component),
                $field['label']
            );
        }
    }

    /**
     * Determine whether an ACF value is empty without rejecting zero or false.
     *
     * @param mixed $value Value to inspect.
     *
     * @return bool Whether the value is empty.
     */
    private static function isEmpty(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) === '';
        }

        if (is_array($value)) {
            return $value === [];
        }

        return $value === null;
    }
}
