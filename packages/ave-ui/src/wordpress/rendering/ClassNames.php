<?php

declare(strict_types=1);

namespace AvenueUI\Core;

final class ClassNames
{
   /**
    * @param array<int|string, mixed>|string $classes
    */
   public static function render(array|string $classes): string
   {
      if (is_string($classes)) {
         return trim($classes);
      }

      $output = [];

      foreach ($classes as $key => $value) {
         if (is_int($key)) {
            if (is_string($value) && trim($value) !== '') {
               $output[] = trim($value);
            }

            continue;
         }

         if ($value) {
            $output[] = trim($key);
         }
      }

      return implode(
         ' ',
         array_values(array_unique($output)),
      );
   }
}