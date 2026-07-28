<?php

declare(strict_types=1);

namespace Avenue\ACF;

/**
 * Describes the integration context in which a value is adapted.
 *
 * The context deliberately contains no Avenue UI implementation details. It
 * allows adapters to make source-specific decisions without coupling the
 * adapter registry to a component library.
 */
final class AdapterContext
{
   /**
    * @param array<string, mixed> $field_definition
    * @param array<string, mixed> $options
    */
   public function __construct(
      public string $platform,
      public string $component,
      public string $prop,
      public bool $is_preview = false,
      public int|string $post_id = 0,
      public array $field_definition = [],
      public array $options = [],
   ) {
      $this->platform = self::normalize_identifier(
         $this->platform,
         'platform',
      );
      $this->component = self::normalize_identifier(
         $this->component,
         'component',
      );
      $this->prop = self::normalize_identifier(
         $this->prop,
         'prop',
      );
   }

   private static function normalize_identifier(
      string $value,
      string $label,
   ): string {
      $value = strtolower(trim($value));

      if (
         $value === '' ||
         preg_match('/^[a-z0-9][a-z0-9._-]*$/', $value) !== 1
      ) {
         throw new \InvalidArgumentException(
            sprintf(
               'Adapter context %s "%s" is invalid.',
               $label,
               $value,
            )
         );
      }

      return $value;
   }
}
