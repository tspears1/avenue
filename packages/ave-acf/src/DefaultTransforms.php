<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class DefaultTransforms
{
   private static bool $booted = false;

   public static function boot(): void
   {
      if (self::$booted) {
         return;
      }

      TransformRegistry::register(
         'boolean-map',
         new BooleanMapTransform(),
      );

      self::$booted = true;
   }
}
