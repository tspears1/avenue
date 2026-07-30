<?php

declare(strict_types=1);

use AvenueUI\WordPress\GUI\AdminPage;

/**
 * @var array<string, list<array{callback: mixed, priority: int, accepted_args: int}>>
 */
$avenueAdminActions = [];

/**
 * @var list<array{id: string, src: string, dependencies: array<int, string>, version: string|null, args: array<string, mixed>}>
 */
$avenueAdminModules = [];

/**
 * Capture a WordPress action registration for assertions.
 *
 * @param string $hookName     Action hook name.
 * @param mixed  $callback     Registered callback.
 * @param int    $priority     Hook priority.
 * @param int    $acceptedArgs Number of accepted arguments.
 *
 * @return void
 */
function add_action(
    string $hookName,
    mixed $callback,
    int $priority = 10,
    int $acceptedArgs = 1
): void {
    global $avenueAdminActions;

    $avenueAdminActions[$hookName][] = [
        'callback' => $callback,
        'priority' => $priority,
        'accepted_args' => $acceptedArgs,
    ];
}

/**
 * Resolve the test fixture as an existing theme asset.
 *
 * @param string $relativePath Requested theme-relative asset path.
 *
 * @return string Existing test fixture path.
 */
function get_theme_file_path(string $relativePath): string
{
    avenue_assert_same(
        'vendor/bostonuniversity/ave-ui/dist/wordpress/admin-diagnostics.js',
        $relativePath,
        'Admin module filesystem path'
    );

    return __FILE__;
}

/**
 * Resolve a test URL for the requested theme asset.
 *
 * @param string $relativePath Requested theme-relative asset path.
 *
 * @return string Test asset URL.
 */
function get_theme_file_uri(string $relativePath): string
{
    return 'https://example.test/theme/' . $relativePath;
}

/**
 * Capture a WordPress script-module enqueue for assertions.
 *
 * @param string               $id           Script module identifier.
 * @param string               $src          Public module URL.
 * @param array<int, string>   $dependencies Script module dependencies.
 * @param string|null          $version      Script module version.
 * @param array<string, mixed> $args         Enqueue arguments.
 *
 * @return void
 */
function wp_enqueue_script_module(
    string $id,
    string $src,
    array $dependencies = [],
    ?string $version = null,
    array $args = []
): void {
    global $avenueAdminModules;

    $avenueAdminModules[] = [
        'id' => $id,
        'src' => $src,
        'dependencies' => $dependencies,
        'version' => $version,
        'args' => $args,
    ];
}

/**
 * Assert that two values are strictly equal.
 *
 * @param mixed  $expected Expected value.
 * @param mixed  $actual   Actual value.
 * @param string $label    Assertion label.
 *
 * @return void
 */
function avenue_assert_same(
    mixed $expected,
    mixed $actual,
    string $label
): void {
    if ($actual === $expected) {
        return;
    }

    throw new RuntimeException(
        sprintf(
            '%s failed. Expected %s; received %s.',
            $label,
            var_export($expected, true),
            var_export($actual, true)
        )
    );
}

require_once __DIR__ . '/../../src/WordPress/GUI/AdminPage.php';

AdminPage::boot([
    'componentsFile' => '/tmp/components.php',
    'sourceBasePath' => '/tmp/source',
]);

avenue_assert_same(
    1,
    count($avenueAdminActions['admin_enqueue_scripts'] ?? []),
    'Admin enqueue hook registration'
);

AdminPage::enqueueAssets('dashboard');
avenue_assert_same(
    [],
    $avenueAdminModules,
    'Unrelated admin page enqueue'
);

AdminPage::enqueueAssets('toplevel_page_avenue-ui');
avenue_assert_same(
    [
        [
            'id' => 'avenue-ui/admin-diagnostics',
            'src' => 'https://example.test/theme/vendor/bostonuniversity/ave-ui/dist/wordpress/admin-diagnostics.js',
            'dependencies' => [],
            'version' => null,
            'args' => [
                'in_footer' => true,
            ],
        ],
    ],
    $avenueAdminModules,
    'Avenue UI admin module enqueue'
);

$adminPageSource = file_get_contents(
    __DIR__ . '/../../src/WordPress/GUI/AdminPage.php'
);

avenue_assert_same(
    false,
    is_string($adminPageSource)
        && str_contains($adminPageSource, "echo '<script>';"),
    'Inline diagnostics script removal'
);

echo "Admin page asset checks passed.\n";
