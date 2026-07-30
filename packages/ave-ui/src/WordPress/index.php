<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

require_once __DIR__ . '/ComponentRegistry.php';
require_once __DIR__ . '/EditorModules.php';
require_once __DIR__ . '/ValueAdapters.php';
require_once __DIR__ . '/ACF/required-validation.php';
require_once __DIR__ . '/GUI/DiagnosticsStore.php';
require_once __DIR__ . '/GUI/OverviewSnapshot.php';
require_once __DIR__ . '/GUI/AdminPage.php';

ValueAdapters::boot();
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
