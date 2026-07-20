<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\GUI;

final class AdminPage
{
   private const MENU_SLUG = 'avenue-ui';
   private const MENU_POSITION = 24;

   private static bool $booted = false;

   private static string $componentsFile = '';

   private static string $sourceBasePath = '';

   /**
    * @param array{componentsFile: string, sourceBasePath: string} $config
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
   }

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

   public static function moveMenuBeforeAcf(): void
   {
      global $menu;

      if (!is_array($menu)) {
         return;
      }

      // WordPress menu keys can be numeric strings; normalize to int indexes.
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
    * @param array<int, mixed> $menu
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
    * @param array<int, mixed> $menu
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

   private static function renderTabs(string $active): void
   {
      $overviewUrl = esc_url(admin_url('admin.php?page=' . self::MENU_SLUG . '&view=overview'));
      $diagnosticsUrl = esc_url(admin_url('admin.php?page=' . self::MENU_SLUG . '&view=diagnostics'));

      echo '<h2 class="nav-tab-wrapper">';
      echo '<a class="nav-tab ' . ($active === 'overview' ? 'nav-tab-active' : '') . '" href="' . $overviewUrl . '">Overview</a>';
      echo '<a class="nav-tab ' . ($active === 'diagnostics' ? 'nav-tab-active' : '') . '" href="' . $diagnosticsUrl . '">Diagnostics</a>';
      echo '</h2>';
   }

   /**
    * @param array<string, mixed> $snapshot
    */
   private static function renderOverview(array $snapshot): void
   {
      $environment = is_array($snapshot['environment'] ?? null)
         ? $snapshot['environment']
         : [];
      $counts = is_array($snapshot['counts'] ?? null)
         ? $snapshot['counts']
         : [];
      $warnings = is_array($snapshot['warnings'] ?? null)
         ? $snapshot['warnings']
         : [];
      $components = is_array($snapshot['components'] ?? null)
         ? $snapshot['components']
         : [];
      $loaderUrl = isset($environment['diagnosticsLoaderUrl']) && is_string($environment['diagnosticsLoaderUrl'])
         ? $environment['diagnosticsLoaderUrl']
         : null;
      $requestedComponents = [];

      foreach ($components as $component) {
         if (!is_array($component)) {
            continue;
         }

         $requestedMode = $component['requestedMode'] ?? null;
         $name = $component['name'] ?? null;

         if (is_string($requestedMode) && $requestedMode !== '' && is_string($name) && $name !== '') {
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

      echo '<p>Install health summary for this WordPress environment.</p>';
      echo '<h2>Components</h2>';
      echo '<p><label for="avenue-ui-component-search">Search:</label> ';
      echo '<input id="avenue-ui-component-search" type="search" placeholder="name, tag, status" style="min-width: 280px;" /></p>';

      echo '<table id="avenue-ui-components-table" class="widefat striped">';
      echo '<thead><tr>';
      echo '<th>Component</th>';
      echo '<th>Tag</th>';
      echo '<th>Requested</th>';
      echo '<th>Discovered</th>';
      echo '<th>Registered</th>';
      echo '<th>Enqueued</th>';
      echo '<th>JS Defined</th>';
      echo '<th>CSS</th>';
      echo '<th>Mode</th>';
      echo '<th>Version</th>';
      echo '<th>Storybook</th>';
      echo '<th>Errors</th>';
      echo '<th>Summary</th>';
      echo '</tr></thead>';
      echo '<tbody>';

      foreach ($components as $component) {
         if (!is_array($component)) {
            continue;
         }

         $nameKey = (string) ($component['name'] ?? '');
         $name = (string) ($component['displayName'] ?? $component['name'] ?? '');
         $tag = (string) ($component['tag'] ?? '');
         $status = (string) ($component['status'] ?? 'Unavailable');
         $requestedMode = (string) ($component['requestedMode'] ?? 'none');
         $version = (string) ($component['version'] ?? '');
         $storybookUrl = $component['storybookUrl'] ?? null;
         $hasStorybook = is_string($storybookUrl) && $storybookUrl !== '';
         $discovered = self::checkMark((bool) ($component['discovered'] ?? false));
         $registered = self::checkMark((bool) ($component['registered'] ?? false));
         $enqueued = self::checkMark((bool) ($component['enqueued'] ?? false));
         $hasError = (bool) ($component['hasError'] ?? false);
         $runtimeMode = self::initialModeLabel($requestedMode);

         echo '<tr class="avenue-component-row" data-component="' . esc_attr($nameKey) . '" data-tag="' . esc_attr($tag) . '" data-discovered="' . (($component['discovered'] ?? false) ? '1' : '0') . '" data-registered="' . (($component['registered'] ?? false) ? '1' : '0') . '" data-enqueued="' . (($component['enqueued'] ?? false) ? '1' : '0') . '" data-has-error="' . ($hasError ? '1' : '0') . '" data-requested-mode="' . esc_attr($requestedMode) . '">';
         echo '<td><strong>' . esc_html($name) . '</strong></td>';
         echo '<td><code>' . esc_html($tag !== '' ? $tag : 'n/a') . '</code></td>';
         echo '<td>' . esc_html($runtimeMode) . '</td>';
         echo '<td class="avenue-cell-discovered">' . esc_html($discovered) . '</td>';
         echo '<td class="avenue-cell-registered">' . esc_html($registered) . '</td>';
         echo '<td class="avenue-cell-enqueued">' . esc_html($enqueued) . '</td>';
         echo '<td class="avenue-cell-js-defined">?</td>';
         echo '<td class="avenue-cell-css">?</td>';
         echo '<td class="avenue-cell-mode">' . esc_html($runtimeMode) . '</td>';
         echo '<td>' . esc_html($version !== '' ? $version : 'n/a') . '</td>';
         if ($hasStorybook) {
            echo '<td><a href="' . esc_url((string) $storybookUrl) . '" target="_blank" rel="noopener noreferrer">Open docs</a></td>';
         } else {
            echo '<td>n/a</td>';
         }
         echo '<td>' . esc_html($hasError ? 'Yes' : 'No') . '</td>';
         echo '<td class="avenue-cell-summary">' . esc_html($status) . '</td>';
         echo '</tr>';
      }

      echo '</tbody>';
      echo '</table>';

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
      echo '<p><button type="button" class="button button-primary" id="avenue-ui-copy-report">Copy report JSON</button>';
      echo ' <span id="avenue-ui-copy-status" aria-live="polite"></span></p>';
      echo '<details><summary>Preview report JSON</summary>';
      echo '<pre id="avenue-ui-report" style="max-height: 320px; overflow: auto; background: #fff; padding: 12px; border: 1px solid #ccd0d4;">';
      echo esc_html($report);
      echo '</pre></details>';

      self::renderOverviewScript();
   }

   /**
    * @param array<string, mixed> $snapshot
    */
   private static function renderDiagnostics(array $snapshot): void
   {
      $errors = is_array($snapshot['errors'] ?? null)
         ? $snapshot['errors']
         : [];

      echo '<p>Phase 1 diagnostics intentionally stays lightweight. The deep checks land in phase 2.</p>';
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
   }

   private static function metaRow(string $label, string $value): void
   {
      echo '<tr>';
      echo '<th style="width: 260px;">' . esc_html($label) . '</th>';
      echo '<td><code>' . esc_html($value) . '</code></td>';
      echo '</tr>';
   }

   private static function checkMark(bool $value): string
   {
      return $value ? '✓' : '✕';
   }

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

   private static function renderOverviewScript(): void
   {
      echo '<script>';
      echo '(function(){';
      echo 'const search = document.getElementById("avenue-ui-component-search");';
      echo 'const table = document.getElementById("avenue-ui-components-table");';
      echo 'const copyBtn = document.getElementById("avenue-ui-copy-report");';
      echo 'const copyStatus = document.getElementById("avenue-ui-copy-status");';
      echo 'const report = document.getElementById("avenue-ui-report");';
      echo 'const loaderScript = document.getElementById("avenue-ui-diagnostics-loader");';
      echo 'const rows = Array.from(document.querySelectorAll(".avenue-component-row"));';
      echo 'if (search && table) {';
      echo 'search.addEventListener("input", function(){';
      echo 'const value = String(search.value || "").toLowerCase();';
      echo 'for (const row of table.tBodies[0].rows) {';
      echo 'const text = row.textContent ? row.textContent.toLowerCase() : "";';
      echo 'row.style.display = text.indexOf(value) !== -1 ? "" : "none";';
      echo '}';
      echo '});';
      echo '}';
      echo 'const tick = (value) => value ? "✓" : "✕";';
      echo 'const cssMark = (value) => value ? "✓" : "—";';
      echo 'const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));';
      echo 'const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));';
      echo 'const waitForLoader = async () => {';
      echo 'if (!loaderScript) return;';
      echo 'if (loaderScript.dataset.loaded === "1") return;';
      echo 'if (loaderScript.dataset.failed === "1") return;';
      echo 'await new Promise((resolve) => {';
      echo 'const onLoad = () => {';
      echo 'loaderScript.dataset.loaded = "1";';
      echo 'cleanup();';
      echo 'resolve();';
      echo '};';
      echo 'const onError = () => {';
      echo 'loaderScript.dataset.failed = "1";';
      echo 'cleanup();';
      echo 'resolve();';
      echo '};';
      echo 'const cleanup = () => {';
      echo 'loaderScript.removeEventListener("load", onLoad);';
      echo 'loaderScript.removeEventListener("error", onError);';
      echo '};';
      echo 'loaderScript.addEventListener("load", onLoad, { once: true });';
      echo 'loaderScript.addEventListener("error", onError, { once: true });';
      echo 'setTimeout(() => {';
      echo 'cleanup();';
      echo 'resolve();';
      echo '}, 2000);';
      echo '});';
      echo '};';
      echo 'const waitForDefinition = async (tag, maxMs) => {';
      echo 'const start = Date.now();';
      echo 'while ((Date.now() - start) < maxMs) {';
      echo 'if (customElements.get(tag)) return true;';
      echo 'await wait(100);';
      echo '}';
      echo 'return !!customElements.get(tag);';
      echo '};';
      echo 'const updateSummary = (row, jsDefined) => {';
      echo 'const discovered = row.dataset.discovered === "1";';
      echo 'const registered = row.dataset.registered === "1";';
      echo 'const enqueued = row.dataset.enqueued === "1";';
      echo 'const hasError = row.dataset.hasError === "1";';
      echo 'const requestedMode = row.dataset.requestedMode || "none";';
      echo 'let summary = "Healthy";';
      echo 'if (!discovered) summary = "Unavailable";';
      echo 'else if (hasError) summary = "Misconfigured";';
      echo 'else if (requestedMode === "none") summary = "Unsupported in current context";';
      echo 'else if (!registered || !enqueued || !jsDefined) summary = "Partially loaded";';
      echo 'const summaryCell = row.querySelector(".avenue-cell-summary");';
      echo 'if (summaryCell) summaryCell.textContent = summary;';
      echo '};';
      echo 'const probeRow = async (row) => {';
      echo 'const tag = row.dataset.tag || "";';
      echo 'const requestedMode = row.dataset.requestedMode || "none";';
      echo 'const discovered = row.dataset.discovered === "1";';
      echo 'const registered = row.dataset.registered === "1";';
      echo 'const enqueued = row.dataset.enqueued === "1";';
      echo 'const jsCell = row.querySelector(".avenue-cell-js-defined");';
      echo 'const cssCell = row.querySelector(".avenue-cell-css");';
      echo 'const modeCell = row.querySelector(".avenue-cell-mode");';
      echo 'const discoveredCell = row.querySelector(".avenue-cell-discovered");';
      echo 'const registeredCell = row.querySelector(".avenue-cell-registered");';
      echo 'const enqueuedCell = row.querySelector(".avenue-cell-enqueued");';
      echo 'if (discoveredCell) discoveredCell.textContent = tick(discovered);';
      echo 'if (registeredCell) registeredCell.textContent = tick(registered);';
      echo 'if (enqueuedCell) enqueuedCell.textContent = tick(enqueued);';
      echo 'if (!tag) {';
      echo 'if (jsCell) jsCell.textContent = "✕";';
      echo 'if (cssCell) cssCell.textContent = "—";';
      echo 'if (modeCell) modeCell.textContent = "Not loaded";';
      echo 'updateSummary(row, false);';
      echo 'return;';
      echo '}';
      echo 'let defined = !!customElements.get(tag);';
      echo 'if (!defined && enqueued) {';
      echo 'defined = await waitForDefinition(tag, 2500);';
      echo '}';
      echo 'let hasCss = false;';
      echo 'let mode = requestedMode === "none" ? "Not loaded" : "Unknown";';
      echo 'if (defined) {';
      echo 'try {';
      echo 'const element = document.createElement(tag);';
      echo 'element.style.position = "fixed";';
      echo 'element.style.left = "-9999px";';
      echo 'element.style.top = "-9999px";';
      echo 'document.body.appendChild(element);';
      echo 'if (typeof customElements.whenDefined === "function") {';
      echo 'await customElements.whenDefined(tag);';
      echo '}';
      echo 'await waitFrame();';
      echo 'await waitFrame();';
      echo 'const shadow = element.shadowRoot;';
      echo 'if (shadow) {';
      echo 'mode = "Shadow DOM";';
      echo 'const hasAdopted = !!(shadow.adoptedStyleSheets && shadow.adoptedStyleSheets.length > 0);';
      echo 'const hasInline = !!shadow.querySelector("style");';
      echo 'hasCss = hasAdopted || hasInline;';
      echo '} else {';
      echo 'mode = "Light DOM";';
      echo '}';
      echo 'element.remove();';
      echo '} catch (error) {';
      echo 'mode = "Not loaded";';
      echo '}';
      echo '} else {';
      echo 'mode = requestedMode === "none" ? "Not loaded" : "Not loaded";';
      echo '}';
      echo 'if (jsCell) jsCell.textContent = tick(defined);';
      echo 'if (cssCell) cssCell.textContent = cssMark(hasCss);';
      echo 'if (modeCell) modeCell.textContent = mode;';
      echo 'updateSummary(row, defined);';
      echo '};';
      echo 'const runProbes = async () => {';
      echo 'await waitForLoader();';
      echo 'for (const row of rows) {';
      echo 'await probeRow(row);';
      echo '}';
      echo '};';
      echo 'runProbes();';
      echo 'if (copyBtn && copyStatus && report) {';
      echo 'copyBtn.addEventListener("click", async function(){';
      echo 'try {';
      echo 'await navigator.clipboard.writeText(report.textContent || "{}");';
      echo 'copyStatus.textContent = "Copied";';
      echo '} catch (error) {';
      echo 'copyStatus.textContent = "Copy failed";';
      echo '}';
      echo '});';
      echo '}';
      echo '})();';
      echo '</script>';
   }
}
