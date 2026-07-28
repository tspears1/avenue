<?php

declare(strict_types=1);

namespace Avenue\ACF;

use InvalidArgumentException;

/**
 * Map a boolean-like integration value to two canonical output values.
 */
final class BooleanMapTransform implements ValueTransform
{
   /**
    * @param array<string, mixed> $options
    */
   public function transform(
      mixed $value,
      array $options,
   ): mixed {
      if ($value === null) {
         return null;
      }

      if (
         !array_key_exists('true', $options) ||
         !array_key_exists('false', $options)
      ) {
         throw new InvalidArgumentException(
            'The "boolean-map" transform requires "true" and "false" output values.'
         );
      }

      return $this->to_boolean($value)
         ? $options['true']
         : $options['false'];
   }

   private function to_boolean(mixed $value): bool
   {
      if (is_bool($value)) {
         return $value;
      }

      if ($value === 1 || $value === '1') {
         return true;
      }

      if (
         $value === 0 ||
         $value === '0' ||
         $value === ''
      ) {
         return false;
      }

      if (is_string($value)) {
         $normalized = strtolower(trim($value));

         if (in_array($normalized, ['true', 'yes', 'on'], true)) {
            return true;
         }

         if (in_array($normalized, ['false', 'no', 'off'], true)) {
            return false;
         }
      }

      throw new InvalidArgumentException(
         sprintf(
            'The "boolean-map" transform cannot interpret %s as a boolean.',
            get_debug_type($value),
         )
      );
   }
}
