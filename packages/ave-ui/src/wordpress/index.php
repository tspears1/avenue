<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

require_once __DIR__ . '/rendering/ComponentRegistry.php';
require_once __DIR__ . '/EditorModules.php';
require_once __DIR__ . '/acf/required-validation.php';
require_once __DIR__ . '/gui/DiagnosticsStore.php';
require_once __DIR__ . '/gui/OverviewSnapshot.php';
require_once __DIR__ . '/gui/AdminPage.php';

GUI\DiagnosticsStore::boot();

$componentsFile = dirname(__DIR__) . '/generated/components.php';

GUI\AdminPage::boot([
   'componentsFile' => $componentsFile,
   'sourceBasePath' => dirname(__DIR__),
]);

if (is_file($componentsFile)) {
   ComponentRegistry::configure(
      require $componentsFile,
      dirname(__DIR__)
   );

   ComponentRegistry::boot();
   EditorModules::boot();
}
