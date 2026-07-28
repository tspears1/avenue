<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use InvalidArgumentException;
use JsonException;
use Stringable;

abstract class AvenueElement
{
    protected static string $name;

    protected static string $tag;

    protected static string $schema;

    /**
     * Render a schema-validated Avenue custom element.
     *
     * @param array<string, mixed>             $props   Component properties.
     * @param array<string, mixed>             $attrs   Additional host attributes.
     * @param array<int|string, mixed>|string  $classes Host classes.
     * @param array<string, HtmlString|string> $slots   Named slot content.
     *
     * @return string Rendered custom-element markup.
    */
    final public static function render(
        array $props = [],
        array $attrs = [],
        array|string $classes = [],
        array $slots = [],
    ): string {
        $schema = ComponentSchema::fromFile(static::$schema);

        $props = $schema->prepareProps($props);
        $transport = $schema->partitionProps($props);

        $schema->validateAttributes($attrs);
        $schema->validateSlots($slots);

        $hostAttributes = static::buildHostAttributes(
            attributeProps: $transport['attributes'],
            propertyProps: $transport['properties'],
            attrs: $attrs,
            classes: $classes,
        );

        return sprintf(
            '<%1$s%2$s>%3$s</%1$s>',
            static::$tag,
            AttributeRenderer::render($hostAttributes),
            static::renderSlots($slots),
        );
    }

    /**
     * Create an explicitly trusted HTML value.
     *
     * @param string $html Trusted HTML markup.
     *
     * @return HtmlString Trusted HTML wrapper.
     */
    final public static function html(string $html): HtmlString
    {
        return new HtmlString($html);
    }

    /**
     * Combine transported props with caller-supplied host attributes.
     *
     * @param array<string, mixed>            $attributeProps Attribute-transport properties.
     * @param array<string, mixed>            $propertyProps  Property-transport properties.
     * @param array<string, mixed>            $attrs          Additional host attributes.
     * @param array<int|string, mixed>|string $classes        Host classes.
     *
     * @return array<string, mixed> Complete host attributes.
    */
    private static function buildHostAttributes(
        array $attributeProps,
        array $propertyProps,
        array $attrs,
        array|string $classes,
    ): array {
        $classNames = ClassNames::render($classes);

        if ($classNames !== '') {
            $attrs['class'] = ClassNames::render([
                $attrs['class'] ?? '',
                $classNames,
            ]);
        }

        foreach ($attributeProps as $name => $value) {
            if (array_key_exists($name, $attrs)) {
                throw new InvalidArgumentException(
                    sprintf(
                        'The "%s" value was supplied as both a prop and an attribute for "%s".',
                        $name,
                        static::$name,
                    )
                );
            }

            $attrs[$name] = static::serializeProp($value);
        }

        if ($propertyProps !== []) {
            $attrs['data-props'] = static::serializePropertyProps(
                $propertyProps,
            );
        }

        return $attrs;
    }

    /**
     * Serialize an attribute-transport property.
     *
     * @param mixed $value Property value.
     *
     * @return mixed Scalar, stringable, or JSON-encoded attribute value.
     */
    private static function serializeProp(mixed $value): mixed
    {
        if (
            $value === null ||
            is_string($value) ||
            is_int($value) ||
            is_float($value) ||
            is_bool($value)
        ) {
            return $value;
        }

        if ($value instanceof Stringable) {
            return (string) $value;
        }

        if (is_array($value) || is_object($value)) {
            try {
                return json_encode(
                    $value,
                    JSON_THROW_ON_ERROR |
                    JSON_UNESCAPED_SLASHES |
                    JSON_UNESCAPED_UNICODE,
                );
            } catch (JsonException $exception) {
                throw new InvalidArgumentException(
                    'Unable to serialize component prop.',
                    previous: $exception,
                );
            }
        }

        throw new InvalidArgumentException(
            sprintf(
                'Unsupported component prop type: %s.',
                get_debug_type($value),
            )
        );
    }

    /**
     * Serialize structured properties for the data-props attribute.
     *
     * @param array<string, mixed> $props Structured properties.
     *
     * @return string JSON-encoded property payload.
     */
    private static function serializePropertyProps(array $props): string
    {
        $options =
            JSON_THROW_ON_ERROR |
            JSON_UNESCAPED_SLASHES |
            JSON_UNESCAPED_UNICODE;

        try {
            $json = function_exists('wp_json_encode')
                ? wp_json_encode($props, $options)
                : json_encode($props, $options);
        } catch (JsonException $exception) {
            throw new InvalidArgumentException(
                sprintf(
                    'Unable to serialize data-props for "%s".',
                    static::$name,
                ),
                previous: $exception,
            );
        }

        if (!is_string($json)) {
            throw new InvalidArgumentException(
                sprintf(
                    'Unable to serialize data-props for "%s".',
                    static::$name,
                )
            );
        }

        return $json;
    }

    /**
     * Render named component slots.
     *
     * @param array<string, HtmlString|string> $slots Slot content keyed by name.
     *
     * @return string Rendered slot markup.
     */
    private static function renderSlots(array $slots): string
    {
        $output = '';

        foreach ($slots as $name => $content) {
            if ($content === null || $content === '') {
                continue;
            }

            $slot = AttributeRenderer::escapeName($name);

            if ($content instanceof HtmlString) {
                $output .= static::injectSlotAttribute(
                    $content->value(),
                    $slot,
                );

                continue;
            }

            $output .= sprintf(
                '<span slot="%s">%s</span>',
                AttributeRenderer::escape($slot),
                AttributeRenderer::escape((string) $content),
            );
        }

        return $output;
    }

    /**
     * Add a slot attribute to the root element of trusted markup.
     *
     * @param string $html Trusted HTML markup.
     * @param string $slot Validated slot name.
     *
     * @return string Markup with the slot assignment.
     */
    private static function injectSlotAttribute(
        string $html,
        string $slot,
    ): string {
        $replacement = sprintf(
            '<$1 slot="%s"$2>',
            AttributeRenderer::escape($slot),
        );

        $result = preg_replace(
            '/^<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/',
            $replacement,
            $html,
            1,
        );

        if ($result === null || $result === $html) {
            return sprintf(
                '<span slot="%s">%s</span>',
                AttributeRenderer::escape($slot),
                $html,
            );
        }

        return $result;
    }
}
