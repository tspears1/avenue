<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

use Avenue\ACF\AdapterRegistry;
use AvenueUI\WordPress\Adapters\WordPressImageAdapter;

/**
 * Registers Avenue's canonical component contracts for WordPress input.
 */
final class ValueAdapters
{
   public const PLATFORM = 'wordpress';
   public const IMAGE_CONTRACT = 'avenue/image';

   private static bool $booted = false;

   public static function boot(): void
   {
      if (self::$booted) {
         return;
      }

      AdapterRegistry::register(
         self::PLATFORM,
         self::IMAGE_CONTRACT,
         new WordPressImageAdapter(),
      );

      self::$booted = true;
   }
}
