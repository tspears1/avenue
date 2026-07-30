<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\GUI;

final class AdminPage
{
    private const MENU_SLUG = 'avenue-ui';
    private const MENU_POSITION = 24;
    private const PAGE_HOOK = 'toplevel_page_avenue-ui';
    private const SCRIPT_MODULE_ID = 'avenue-ui/admin-diagnostics';
    private const SCRIPT_MODULE_PATH = 'vendor/bostonuniversity/ave-ui/dist/wordpress/admin-diagnostics.js';
    private const STYLE_ID = 'avenue-ui-admin-diagnostics';
    private const STYLE_PATH = 'vendor/bostonuniversity/ave-ui/dist/wordpress/admin-diagnostics-styles.css';

    private static bool $booted = false;

    private static string $componentsFile = '';

    private static string $sourceBasePath = '';

    /**
     * Configure the diagnostics page and register its WordPress hooks.
     *
     * @param array{componentsFile: string, sourceBasePath: string} $config Page configuration.
     *
     * @return void
     */
    public static function boot(array $config): void
    {
        if (self::$booted || !function_exists('add_action')) {
            return;
        }

        self::$booted = true;
        self::$componentsFile = $config['componentsFile'];
        self::$sourceBasePath = $config['sourceBasePath'];

        add_action('admin_menu', [self::class, 'registerMenu']);
        add_action('admin_menu', [self::class, 'moveMenuBeforeAcf'], 999);
        add_action('admin_enqueue_scripts', [self::class, 'enqueueAssets']);
    }

    /**
     * Enqueue diagnostics assets only on the Avenue UI administration page.
     *
     * @param string $hookSuffix Current WordPress administration page hook.
     *
     * @return void
     */
    public static function enqueueAssets(string $hookSuffix): void
    {
        if ($hookSuffix !== self::PAGE_HOOK) {
            return;
        }

        $styleUrl = self::resolveAssetUrl(self::STYLE_PATH);

        if ($styleUrl !== null && function_exists('wp_enqueue_style')) {
            wp_enqueue_style(
                self::STYLE_ID,
                $styleUrl,
                [],
                null
            );
        }

        if (!function_exists('wp_enqueue_script_module')) {
            return;
        }

        $moduleUrl = self::resolveAssetUrl(self::SCRIPT_MODULE_PATH);

        if ($moduleUrl === null) {
            return;
        }

        wp_enqueue_script_module(
            self::SCRIPT_MODULE_ID,
            $moduleUrl,
            [],
            null,
            ['in_footer' => true]
        );
    }

    /**
     * Register the Avenue UI top-level administration menu.
     *
     * @return void
     */
    public static function registerMenu(): void
    {
        if (!function_exists('add_menu_page')) {
            return;
        }

        add_menu_page(
            'Avenue UI',
            'Avenue UI',
            'manage_options',
            self::MENU_SLUG,
            [self::class, 'renderPage'],
            'dashicons-screenoptions',
            self::MENU_POSITION
        );
    }

    /**
     * Move the Avenue UI menu immediately before the ACF menu.
     *
     * @return void
     */
    public static function moveMenuBeforeAcf(): void
    {
        global $menu;

        if (!is_array($menu)) {
            return;
        }

        // WordPress menu keys can be numeric strings; normalize to integer indexes.
        $menu = array_values($menu);

        $avenueIndex = self::findMenuIndexBySlug($menu, self::MENU_SLUG);
        $acfIndex = self::findAcfMenuIndex($menu);

        if ($avenueIndex === null || $acfIndex === null) {
            return;
        }

        $avenueItem = $menu[$avenueIndex];
        unset($menu[$avenueIndex]);

        $menu = array_values($menu);

        $acfIndex = self::findAcfMenuIndex($menu);
        if ($acfIndex === null) {
            $menu[] = $avenueItem;
            return;
        }

        array_splice($menu, $acfIndex, 0, [$avenueItem]);
    }

    /**
     * Locate the first ACF menu entry.
     *
     * @param array<int, mixed> $menu WordPress administration menu.
     *
     * @return int|null Menu index, or null when ACF is absent.
     */
    private static function findAcfMenuIndex(array $menu): ?int
    {
        foreach ($menu as $index => $item) {
            if (!is_array($item) || !isset($item[2]) || !is_string($item[2])) {
                continue;
            }

            $slug = $item[2];

            if (
                $slug === 'edit.php?post_type=acf-field-group'
                || $slug === 'acf-options'
                || str_starts_with($slug, 'acf')
            ) {
                return $index;
            }
        }

        return null;
    }

    /**
     * Locate a WordPress menu entry by slug.
     *
     * @param array<int, mixed> $menu WordPress administration menu.
     * @param string            $slug Menu slug.
     *
     * @return int|null Menu index, or null when absent.
     */
    private static function findMenuIndexBySlug(array $menu, string $slug): ?int
    {
        foreach ($menu as $index => $item) {
            if (!is_array($item) || !isset($item[2]) || !is_string($item[2])) {
                continue;
            }

            if ($item[2] === $slug) {
                return $index;
            }
        }

        return null;
    }

    /**
     * Render the active Avenue UI administration view.
     *
     * @return void
     */
    public static function renderPage(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('You do not have permission to access Avenue UI diagnostics.');
        }

        $view = isset($_GET['view']) && is_string($_GET['view'])
            ? sanitize_key($_GET['view'])
            : 'overview';

        if (!in_array($view, ['overview', 'diagnostics'], true)) {
            $view = 'overview';
        }

        $snapshot = OverviewSnapshot::build(self::$componentsFile, self::$sourceBasePath);

        echo '<div class="wrap">';
        echo '<h1>Avenue UI</h1>';

        self::renderTabs($view);

        if ($view === 'overview') {
            self::renderOverview($snapshot);
        } else {
            self::renderDiagnostics($snapshot);
        }

        echo '</div>';
    }

    /**
     * Render diagnostics navigation tabs.
     *
     * @param string $active Active view.
     *
     * @return void
     */
    private static function renderTabs(string $active): void
    {
        $overviewUrl = esc_url(admin_url('admin.php?page=' . self::MENU_SLUG . '&view=overview'));
        $diagnosticsUrl = esc_url(admin_url('admin.php?page=' . self::MENU_SLUG . '&view=diagnostics'));

        echo '<h2 class="nav-tab-wrapper">';
        echo sprintf(
            '<a class="nav-tab %s" href="%s">Overview</a>',
            $active === 'overview' ? 'nav-tab-active' : '',
            $overviewUrl
        );
        echo sprintf(
            '<a class="nav-tab %s" href="%s">Diagnostics</a>',
            $active === 'diagnostics' ? 'nav-tab-active' : '',
            $diagnosticsUrl
        );
        echo '</h2>';
    }

    /**
     * Render the component overview table.
     *
     * @param array<string, mixed> $snapshot Diagnostics snapshot.
     *
     * @return void
     */
    private static function renderOverview(array $snapshot): void
    {
        $environment = is_array($snapshot['environment'] ?? null)
            ? $snapshot['environment']
            : [];
        $components = is_array($snapshot['components'] ?? null)
            ? $snapshot['components']
            : [];
        $loaderUrl = isset($environment['diagnosticsLoaderUrl']) && is_string($environment['diagnosticsLoaderUrl'])
            ? $environment['diagnosticsLoaderUrl']
            : null;
        [$inUse, $available] = self::partitionComponents($components);
        $requestedComponents = [];

        foreach ($inUse as $component) {
            $name = $component['name'] ?? null;

            if (is_string($name) && $name !== '') {
                $requestedComponents[] = $name;
            }
        }

        if ($loaderUrl !== null && $requestedComponents !== []) {
            $loaderUrl = add_query_arg(
                'components',
                implode(',', $requestedComponents),
                $loaderUrl
            );
        }

        if ($loaderUrl !== null && $requestedComponents !== []) {
            echo '<script id="avenue-ui-diagnostics-loader" type="module" src="' . esc_url($loaderUrl) . '"></script>';
        }

        echo '<h2>Components</h2>';
        echo '<p>These status columns trace each component from server registration';
        echo ' through browser initialization. Use the heading help buttons for details.</p>';
        echo '<p><label for="avenue-ui-component-search">Search:</label> ';
        echo '<input id="avenue-ui-component-search" type="search"';
        echo ' placeholder="name, tag, integration, status" style="min-width: 280px;" /></p>';

        self::renderInUseComponents($inUse);
        self::renderAvailableComponents($available);
    }

    /**
     * Divide component metadata into requested and unrequested groups.
     *
     * Requested components remain in use even when registration fails, so
     * integration problems stay visible in the diagnostics table.
     *
     * @param array<int, mixed> $components Component diagnostics metadata.
     *
     * @return array{
     *     0: list<array<string, mixed>>,
     *     1: list<array<string, mixed>>
     * } In-use and available component groups.
     */
    private static function partitionComponents(array $components): array
    {
        $inUse = [];
        $available = [];

        foreach ($components as $component) {
            if (!is_array($component)) {
                continue;
            }

            $requestedMode = $component['requestedMode'] ?? null;

            if (
                is_string($requestedMode)
                && $requestedMode !== ''
                && $requestedMode !== 'none'
            ) {
                $inUse[] = $component;
                continue;
            }

            $available[] = $component;
        }

        return [$inUse, $available];
    }

    /**
     * Render full runtime diagnostics for components used by the site.
     *
     * @param list<array<string, mixed>> $components Requested components.
     *
     * @return void
     */
    private static function renderInUseComponents(array $components): void
    {
        echo '<section class="avenue-ui-component-section">';
        echo '<h3>In use <span class="count">(' . esc_html((string) count($components)) . ')</span></h3>';

        if ($components === []) {
            echo '<p>No Avenue components are currently requested by this site.</p>';
            echo '</section>';
            return;
        }

        echo '<table id="avenue-ui-components-table" class="widefat striped">';
        echo '<thead><tr>';
        echo '<th scope="col">Component</th>';
        echo '<th scope="col">Tag</th>';
        self::renderTableHeading(
            'integration',
            'Integration',
            'Whether this site requested the component as fields-only or as a complete block integration.'
        );
        self::renderTableHeading(
            'registered',
            'Registered',
            'Whether the requested PHP and ACF integration was successfully registered with WordPress.'
        );
        self::renderTableHeading(
            'enqueued',
            'Enqueued',
            'Whether the component’s JavaScript was selected for loading on the current request.'
        );
        self::renderTableHeading(
            'js-defined',
            'JS Defined',
            'Whether the browser ultimately registered the component’s custom-element tag.'
        );
        self::renderTableHeading(
            'css',
            'CSS',
            'Whether the runtime probe found component styles in its shadow root. This verifies presence, not visual correctness.'
        );
        self::renderTableHeading(
            'mode',
            'Mode',
            'Whether the running component renders with Shadow DOM, Light DOM, or is not loaded.'
        );
        echo '<th scope="col">Version</th>';
        echo '<th scope="col">Storybook</th>';
        echo '<th scope="col">Errors</th>';
        echo '<th scope="col">Summary</th>';
        echo '</tr></thead>';
        echo '<tbody>';

        foreach ($components as $component) {
            self::renderInUseComponentRow($component);
        }

        echo '</tbody>';
        echo '</table>';
        echo '</section>';
    }

    /**
     * Render one in-use component diagnostics row.
     *
     * @param array<string, mixed> $component Component diagnostics metadata.
     *
     * @return void
     */
    private static function renderInUseComponentRow(array $component): void
    {
        $nameKey = (string) ($component['name'] ?? '');
        $name = (string) ($component['displayName'] ?? $component['name'] ?? '');
        $tag = (string) ($component['tag'] ?? '');
        $status = (string) ($component['status'] ?? 'Unavailable');
        $requestedMode = (string) ($component['requestedMode'] ?? 'none');
        $version = (string) ($component['version'] ?? '');
        $storybookUrl = $component['storybookUrl'] ?? null;
        $hasStorybook = is_string($storybookUrl) && $storybookUrl !== '';
        $registered = self::checkMark((bool) ($component['registered'] ?? false));
        $enqueued = self::checkMark((bool) ($component['enqueued'] ?? false));
        $hasError = (bool) ($component['hasError'] ?? false);
        $runtimeMode = self::initialModeLabel($requestedMode);

        echo sprintf(
            '<tr class="avenue-component-row" data-avenue-component-row'
            . ' data-component="%s" data-tag="%s"'
            . ' data-discovered="%s" data-registered="%s"'
            . ' data-enqueued="%s" data-has-error="%s"'
            . ' data-requested-mode="%s">',
            esc_attr($nameKey),
            esc_attr($tag),
            ($component['discovered'] ?? false) ? '1' : '0',
            ($component['registered'] ?? false) ? '1' : '0',
            ($component['enqueued'] ?? false) ? '1' : '0',
            $hasError ? '1' : '0',
            esc_attr($requestedMode)
        );
        echo '<td><strong>' . esc_html($name) . '</strong></td>';
        echo '<td><code>' . esc_html($tag !== '' ? $tag : 'n/a') . '</code></td>';
        echo '<td>' . esc_html($runtimeMode) . '</td>';
        echo '<td class="avenue-cell-registered">' . esc_html($registered) . '</td>';
        echo '<td class="avenue-cell-enqueued">' . esc_html($enqueued) . '</td>';
        echo '<td class="avenue-cell-js-defined">?</td>';
        echo '<td class="avenue-cell-css">?</td>';
        echo '<td class="avenue-cell-mode">' . esc_html($runtimeMode) . '</td>';
        echo '<td>' . esc_html($version !== '' ? $version : 'n/a') . '</td>';

        if ($hasStorybook) {
            echo '<td><a href="' . esc_url((string) $storybookUrl) . '"';
            echo ' target="_blank" rel="noopener noreferrer">Open docs</a></td>';
        } else {
            echo '<td>n/a</td>';
        }

        echo '<td>' . esc_html($hasError ? 'Yes' : 'No') . '</td>';
        echo '<td class="avenue-cell-summary">' . esc_html($status) . '</td>';
        echo '</tr>';
    }

    /**
     * Render a collapsed catalog of components not requested by the site.
     *
     * @param list<array<string, mixed>> $components Available components.
     *
     * @return void
     */
    private static function renderAvailableComponents(array $components): void
    {
        echo '<details id="avenue-ui-available-components"';
        echo ' class="avenue-ui-component-section avenue-ui-available-components">';
        echo '<summary><strong>Available</strong> <span class="count">(';
        echo esc_html((string) count($components)) . ')</span></summary>';
        echo '<p>These components are present in Avenue but are not requested by this site.</p>';

        if ($components === []) {
            echo '<p>No additional components are available.</p>';
            echo '</details>';
            return;
        }

        echo '<table class="widefat striped avenue-ui-available-table">';
        echo '<thead><tr>';
        echo '<th scope="col">Component</th>';
        echo '<th scope="col">Tag</th>';
        echo '<th scope="col">Supported integration</th>';
        echo '<th scope="col">Version</th>';
        echo '<th scope="col">Storybook</th>';
        echo '</tr></thead>';
        echo '<tbody>';

        foreach ($components as $component) {
            $name = (string) ($component['displayName'] ?? $component['name'] ?? '');
            $tag = (string) ($component['tag'] ?? '');
            $version = (string) ($component['version'] ?? '');
            $storybookUrl = $component['storybookUrl'] ?? null;
            $hasStorybook = is_string($storybookUrl) && $storybookUrl !== '';

            echo '<tr data-avenue-component-row>';
            echo '<td><strong>' . esc_html($name) . '</strong></td>';
            echo '<td><code>' . esc_html($tag !== '' ? $tag : 'n/a') . '</code></td>';
            echo '<td>' . esc_html(self::supportedIntegrationLabel($component)) . '</td>';
            echo '<td>' . esc_html($version !== '' ? $version : 'n/a') . '</td>';

            if ($hasStorybook) {
                echo '<td><a href="' . esc_url((string) $storybookUrl) . '"';
                echo ' target="_blank" rel="noopener noreferrer">Open docs</a></td>';
            } else {
                echo '<td>n/a</td>';
            }

            echo '</tr>';
        }

        echo '</tbody>';
        echo '</table>';
        echo '</details>';
    }

    /**
     * Describe the WordPress integration modes supported by a component.
     *
     * @param array<string, mixed> $component Component diagnostics metadata.
     *
     * @return string Supported integration label.
     */
    private static function supportedIntegrationLabel(array $component): string
    {
        $supportsFields = (bool) ($component['fieldsSupported'] ?? false);
        $supportsBlock = (bool) ($component['blockSupported'] ?? false);

        if ($supportsFields && $supportsBlock) {
            return 'Fields + Block';
        }

        if ($supportsBlock) {
            return 'Block';
        }

        if ($supportsFields) {
            return 'Fields';
        }

        return 'None declared';
    }

    /**
     * Render environment diagnostics and a copyable report.
     *
     * @param array<string, mixed> $snapshot Diagnostics snapshot.
     *
     * @return void
     */
    private static function renderDiagnostics(array $snapshot): void
    {
        $errors = is_array($snapshot['errors'] ?? null)
            ? $snapshot['errors']
            : [];
        $environment = is_array($snapshot['environment'] ?? null)
            ? $snapshot['environment']
            : [];
        $counts = is_array($snapshot['counts'] ?? null)
            ? $snapshot['counts']
            : [];
        $warnings = is_array($snapshot['warnings'] ?? null)
            ? $snapshot['warnings']
            : [];

        echo '<h2>Registration Errors (Current Request)</h2>';

        if ($errors === []) {
            echo '<p>No captured registration errors in this request.</p>';
        } else {
            echo '<table class="widefat striped" style="max-width: 900px;">';
            echo '<thead><tr><th>Component</th><th>Mode</th><th>Message</th></tr></thead>';
            echo '<tbody>';
            foreach ($errors as $error) {
                if (!is_array($error)) {
                    continue;
                }

                echo '<tr>';
                echo '<td>' . esc_html((string) ($error['component'] ?? 'unknown')) . '</td>';
                echo '<td>' . esc_html((string) ($error['mode'] ?? 'unknown')) . '</td>';
                echo '<td>' . esc_html((string) ($error['message'] ?? 'unknown')) . '</td>';
                echo '</tr>';
            }
            echo '</tbody>';
            echo '</table>';
        }

        echo '<h2>Health Summary</h2>';
        echo '<table class="widefat striped" style="max-width: 900px;">';
        echo '<tbody>';
        self::metaRow('Avenue UI Version', (string) ($environment['avenueUiVersion'] ?? 'unknown'));
        self::metaRow('WordPress Version', (string) ($environment['wordPressVersion'] ?? 'unknown'));
        self::metaRow('PHP Version', (string) ($environment['phpVersion'] ?? 'unknown'));
        self::metaRow('Context', (string) ($environment['requestContext'] ?? 'unknown'));
        self::metaRow('Diagnostics Loader', (string) ($environment['diagnosticsLoaderUrl'] ?? 'unavailable'));
        self::metaRow('Components Metadata File', (string) ($environment['componentsFile'] ?? 'unknown'));
        self::metaRow('Source Base Path', (string) ($environment['sourceBasePath'] ?? 'unknown'));
        self::metaRow('Available Components', (string) ($counts['available'] ?? 0));
        self::metaRow('Requested Components', (string) ($counts['requested'] ?? 0));
        self::metaRow('Registered Fields', (string) ($counts['registeredFields'] ?? 0));
        self::metaRow('Registered Blocks', (string) ($counts['registeredBlocks'] ?? 0));
        self::metaRow('Errors', (string) ($counts['errors'] ?? 0));
        self::metaRow('Warnings', (string) ($counts['warnings'] ?? 0));
        echo '</tbody>';
        echo '</table>';

        if ($warnings !== []) {
            echo '<h2>Warnings</h2>';
            echo '<ul style="list-style: disc; margin-left: 20px;">';
            foreach ($warnings as $warning) {
                echo '<li>' . esc_html((string) $warning) . '</li>';
            }
            echo '</ul>';
        }

        $report = wp_json_encode($snapshot, JSON_PRETTY_PRINT);
        $report = is_string($report) ? $report : '{}';

        echo '<h2>Copy Diagnostics Report</h2>';
        echo '<p><button type="button" class="button button-primary"';
        echo ' id="avenue-ui-copy-report">Copy report JSON</button>';
        echo ' <span id="avenue-ui-copy-status" aria-live="polite"></span></p>';
        echo '<details><summary>Preview report JSON</summary>';
        echo '<pre id="avenue-ui-report" style="max-height: 320px; overflow: auto;';
        echo ' background: #fff; padding: 12px; border: 1px solid #ccd0d4;">';
        echo esc_html($report);
        echo '</pre></details>';
    }

    /**
     * Render one diagnostics metadata row.
     *
     * @param string $label Row label.
     * @param string $value Row value.
     *
     * @return void
     */
    private static function metaRow(string $label, string $value): void
    {
        echo '<tr>';
        echo '<th style="width: 260px;">' . esc_html($label) . '</th>';
        echo '<td><code>' . esc_html($value) . '</code></td>';
        echo '</tr>';
    }

    /**
     * Render an accessible component-lifecycle table heading and tooltip.
     *
     * @param string $id          Stable tooltip identifier suffix.
     * @param string $label       Visible column heading.
     * @param string $description Extended lifecycle description.
     *
     * @return void
     */
    private static function renderTableHeading(
        string $id,
        string $label,
        string $description
    ): void {
        $tooltipId = 'avenue-ui-tooltip-' . $id;

        echo '<th scope="col" class="avenue-ui-table-heading';
        echo ' avenue-ui-table-heading--' . esc_attr($id) . '">';
        echo '<span>' . esc_html($label) . '</span>';
        echo '<button type="button" class="avenue-ui-tooltip-trigger"';
        echo ' data-avenue-tooltip aria-describedby="' . esc_attr($tooltipId) . '"';
        echo ' aria-label="' . esc_attr('About ' . $label) . '">';
        echo '<span aria-hidden="true">?</span>';
        echo '</button>';
        echo '<span id="' . esc_attr($tooltipId) . '"';
        echo ' class="avenue-ui-tooltip" role="tooltip" hidden>';
        echo esc_html($description);
        echo '</span>';
        echo '</th>';
    }

    /**
     * Convert a boolean state to a visual status mark.
     *
     * @param bool $value State value.
     *
     * @return string Status mark.
     */
    private static function checkMark(bool $value): string
    {
        return $value ? '✓' : '✕';
    }

    /**
     * Convert a requested integration mode to a display label.
     *
     * @param string $requestedMode Requested integration mode.
     *
     * @return string Human-readable mode label.
     */
    private static function initialModeLabel(string $requestedMode): string
    {
        if ($requestedMode === 'block') {
            return 'Block';
        }

        if ($requestedMode === 'fields') {
            return 'Fields';
        }

        return 'Not loaded';
    }

    /**
     * Resolve the public URL for a generated administration asset.
     *
     * @param string $relativePath Theme-relative generated asset path.
     *
     * @return string|null Public asset URL, or null when unavailable.
     */
    private static function resolveAssetUrl(string $relativePath): ?string
    {
        if (!function_exists('get_theme_file_path') || !function_exists('get_theme_file_uri')) {
            return null;
        }

        $assetPath = get_theme_file_path($relativePath);

        if (!is_string($assetPath) || $assetPath === '' || !is_file($assetPath)) {
            return null;
        }

        $assetUrl = get_theme_file_uri($relativePath);

        return is_string($assetUrl) && $assetUrl !== ''
            ? $assetUrl
            : null;
    }
}
