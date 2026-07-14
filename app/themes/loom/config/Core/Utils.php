<?php

/**
 * Utility functions.
 *
 * @package Core
 *
 * @since 0.0.1
 */

namespace Loom;

class Utils
{
   public static function use_script_module(string $handle)
   {
      add_filter('script_loader_tag', function ($_tag, $_handle) use ($handle) {
         if ($_handle === $handle) {
            return str_replace('<script ', '<script type="module" ', $_tag);
         }
         return $_tag;
      }, 10, 2);
   }
}
