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
    * Render the component.
    *
    * @param array<string, mixed>              $props
    * @param array<string, mixed>              $attrs
    * @param array<int|string, mixed>|string   $classes
    * @param array<string, HtmlString|string>  $slots
    */
   final public static function render(
      array $props = [],
      array $attrs = [],
      array|string $classes = [],
      array $slots = [],
   ): string {
      $schema = ComponentSchema::fromFile(static::$schema);

      $props = $schema->prepareProps($props);

      $schema->validateAttributes($attrs);
      $schema->validateSlots($slots);

      $hostAttributes = static::buildHostAttributes(
         props: $props,
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
    */
   final public static function html(string $html): HtmlString
   {
      return new HtmlString($html);
   }

   /**
    * @param array<string, mixed>            $props
    * @param array<string, mixed>            $attrs
    * @param array<int|string, mixed>|string $classes
    *
    * @return array<string, mixed>
    */
   private static function buildHostAttributes(
      array $props,
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

      foreach ($props as $name => $value) {
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

      return $attrs;
   }

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
    * @param array<string, HtmlString|string> $slots
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
    * Add a slot attribute to trusted markup.
    *
    * This supports:
    * <ave-icon name="arrow"></ave-icon>
    *
    * becoming:
    * <ave-icon slot="prefix" name="arrow"></ave-icon>
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