<?php

declare(strict_types=1);

namespace AvenueUI\Core;

use InvalidArgumentException;

final class AttributeRenderer
{
   /**
    * @param array<string, mixed> $attributes
    */
   public static function render(array $attributes): string
   {
      $output = [];

      foreach ($attributes as $name => $value) {
         if ($value === null || $value === false || $value === '') {
            continue;
         }

         if (!self::isValidName($name)) {
            throw new InvalidArgumentException(
               sprintf('Invalid HTML attribute name "%s".', $name)
            );
         }

         if ($value === true) {
            $output[] = $name;
            continue;
         }

         $output[] = sprintf(
            '%s="%s"',
            $name,
            self::escape((string) $value),
         );
      }

      return $output === []
         ? ''
         : ' ' . implode(' ', $output);
   }

   public static function isValidName(string $name): bool
   {
      return preg_match(
         '/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/',
         $name,
      ) === 1;
   }

   public static function escapeName(string $name): string
   {
      if (!self::isValidName($name)) {
         throw new InvalidArgumentException(
            sprintf('Invalid HTML attribute name "%s".', $name)
         );
      }

      return $name;
   }

   public static function escape(string $value): string
   {
      return htmlspecialchars(
         $value,
         ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5,
         'UTF-8',
      );
   }
}