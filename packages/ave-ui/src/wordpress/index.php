<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

require_once __DIR__ . '/rendering/ComponentRegistry.php';

$componentsFile = dirname(__DIR__) . '/generated/components.php';

if (is_file($componentsFile)) {
   ComponentRegistry::configure(
      require $componentsFile,
      dirname(__DIR__)
   );

   ComponentRegistry::boot();
}
