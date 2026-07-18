<?php
/**
 * Components.
 *
 * @package Core
 *
 * @since 0.0.1
 */

namespace Loom;

use AvenueUI\WordPress\ComponentRegistry;

class Components
{
   public static function init()
   {
      ComponentRegistry::register([
         'button' => 'block',
      ]);
   }
}