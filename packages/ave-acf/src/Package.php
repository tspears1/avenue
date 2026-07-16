<?php

declare(strict_types=1);

namespace Avenue\ACF;

final class Package
{
   /**
    * Boot package integrations for WordPress + ACF.
    *
    * @param array<string, mixed>|Options|null $options Package options array or Options object.
    * @return void
    */
   public static function boot($options = null): void
   {
      if ($options === null) {
         return;
      }

      $config = $options instanceof Options
         ? $options
         : Options::from_array($options);

      AcfPro::ensure_loaded($config);
      LocalJson::register($config);
   }
}
