<?php

declare(strict_types=1);

namespace AvenueUI\wordpress\adapters;

use Avenue\ACF\AdapterContext;
use Avenue\ACF\ValueAdapter;
use InvalidArgumentException;

/**
 * Convert an ACF/WordPress image value into canonical Avenue Image props.
 */
final class WordPressImageAdapter implements ValueAdapter
{
    /**
     * @param mixed $value
     * @param array<string, mixed> $definition
     *
     * @return array<string, mixed>|null
     */
    public function adapt(
        mixed $value,
        array $definition,
        AdapterContext $context,
    ): ?array {
        if (
            $value === null ||
            $value === false ||
            $value === '' ||
            $value === []
        ) {
            return null;
        }

        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            $value = ['ID' => (int) $value];
        }

        if (!is_array($value)) {
            throw new InvalidArgumentException(
                sprintf(
                    'The "%s.%s" Image value must be a WordPress image array or attachment ID; %s given.',
                    $context->component,
                    $context->prop,
                    get_debug_type($value),
                )
            );
        }

        $attachment_id = $this->attachment_id($value);
        $size = $this->image_size($context);
        $attachment = $this->attachment_data(
            $attachment_id,
            $size,
        );

        $src = $this->first_string(
            $value['src'] ?? null,
            $value['url'] ?? null,
            $attachment['src'] ?? null,
        );

        if ($src === null) {
            return null;
        }

        $adapted = [
            'src' => $src,
            'alt' => $this->first_string(
                $value['alt'] ?? null,
                $attachment['alt'] ?? null,
            ) ?? '',
        ];

        $this->copy_string(
            $adapted,
            'srcset',
            $value['srcset'] ?? null,
            $attachment['srcset'] ?? null,
        );
        $this->copy_string(
            $adapted,
            'sizes',
            is_string($value['sizes'] ?? null)
                ? $value['sizes']
                : null,
            $value['sizes_attribute'] ?? null,
            $attachment['sizes'] ?? null,
        );
        $this->copy_dimension(
            $adapted,
            'width',
            $value['width'] ?? null,
            $attachment['width'] ?? null,
        );
        $this->copy_dimension(
            $adapted,
            'height',
            $value['height'] ?? null,
            $attachment['height'] ?? null,
        );
        $this->copy_string(
            $adapted,
            'objectFit',
            $value['objectFit'] ?? null,
            $value['object_fit'] ?? null,
        );
        $this->copy_string(
            $adapted,
            'objectPosition',
            $value['objectPosition'] ?? null,
            $value['object_position'] ?? null,
        );

        if (array_key_exists('sources', $value)) {
            $adapted['sources'] = $this->adapt_sources(
                $value['sources'],
            );
        }

        return $adapted;
    }

    /**
     * @param array<string, mixed> $value
     */
    private function attachment_id(array $value): int
    {
        $id = $value['ID'] ?? $value['id'] ?? 0;

        if (is_int($id)) {
            return max(0, $id);
        }

        if (is_string($id) && ctype_digit($id)) {
            return (int) $id;
        }

        return 0;
    }

    private function image_size(AdapterContext $context): string
    {
        $size = $context->options['image_size'] ?? 'full';

        return is_string($size) && $size !== ''
            ? $size
            : 'full';
    }

    /**
     * Enrich sparse image values when WordPress attachment APIs are available.
     *
     * @return array<string, int|string>
     */
    private function attachment_data(
        int $attachment_id,
        string $size,
    ): array {
        if ($attachment_id <= 0) {
            return [];
        }

        $data = [];

        if (function_exists('wp_get_attachment_image_src')) {
            $source = wp_get_attachment_image_src(
                $attachment_id,
                $size,
            );

            if (is_array($source)) {
                if (isset($source[0]) && is_string($source[0])) {
                    $data['src'] = $source[0];
                }

                if (isset($source[1]) && is_numeric($source[1])) {
                    $data['width'] = (int) $source[1];
                }

                if (isset($source[2]) && is_numeric($source[2])) {
                    $data['height'] = (int) $source[2];
                }
            }
        }

        if (function_exists('wp_get_attachment_image_srcset')) {
            $srcset = wp_get_attachment_image_srcset(
                $attachment_id,
                $size,
            );

            if (is_string($srcset) && $srcset !== '') {
                $data['srcset'] = $srcset;
            }
        }

        if (function_exists('wp_get_attachment_image_sizes')) {
            $sizes = wp_get_attachment_image_sizes(
                $attachment_id,
                $size,
            );

            if (is_string($sizes) && $sizes !== '') {
                $data['sizes'] = $sizes;
            }
        }

        if (function_exists('get_post_meta')) {
            $alt = get_post_meta(
                $attachment_id,
                '_wp_attachment_image_alt',
                true,
            );

            if (is_string($alt)) {
                $data['alt'] = $alt;
            }
        }

        return $data;
    }

    /**
     * @param array<string, mixed> $target
     */
    private function copy_string(
        array &$target,
        string $name,
        mixed ...$values,
    ): void {
        $value = $this->first_string(...$values);

        if ($value !== null) {
            $target[$name] = $value;
        }
    }

    /**
     * @param array<string, mixed> $target
     */
    private function copy_dimension(
        array &$target,
        string $name,
        mixed ...$values,
    ): void {
        foreach ($values as $value) {
            if (is_int($value) || is_float($value)) {
                $target[$name] = (string) $value;
                return;
            }

            if (is_string($value) && $value !== '' && is_numeric($value)) {
                $target[$name] = $value;
                return;
            }
        }
    }

    private function first_string(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @return list<array{src: string, type: string, media: string, sizes: string}>
     */
    private function adapt_sources(mixed $sources): array
    {
        if (!is_array($sources)) {
            throw new InvalidArgumentException(
                sprintf(
                    'Image sources must be an array; %s given.',
                    get_debug_type($sources),
                )
            );
        }

        $adapted = [];

        foreach ($sources as $source) {
            if (!is_array($source)) {
                throw new InvalidArgumentException(
                    'Every Image source must be an object-like array.'
                );
            }

            $src = $this->first_string($source['src'] ?? null);

            if ($src === null) {
                throw new InvalidArgumentException(
                    'Every Image source must contain a non-empty "src".'
                );
            }

            $adapted[] = [
                'src' => $src,
                'type' => $this->first_string($source['type'] ?? null) ?? '',
                'media' => $this->first_string($source['media'] ?? null) ?? '',
                'sizes' => $this->first_string($source['sizes'] ?? null) ?? '',
            ];
        }

        return $adapted;
    }
}
