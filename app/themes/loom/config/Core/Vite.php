<?php

namespace Loom;
/**
 * Vite helper class.
 */
class Vite
{
    protected static $manifest = null;

    /**
     * Load the Vite manifest.
     *
     * @return void
     */
    protected static function loadManifest(): void
    {
        if (self::$manifest !== null) {
            return;
        }

        $manifest_path = get_template_directory() . '/dist/.vite/manifest.json';

        if (!file_exists($manifest_path)) {
            self::$manifest = [];
            return;
        }

        $manifest_content = file_get_contents($manifest_path);
        self::$manifest = json_decode($manifest_content, true);
    }

    /**
     * Get the URL of a Vite asset.
     *
     * @param string $asset The asset name.
     * @return string| The asset URL.
     */
    public static function asset($asset): string
    {
        self::loadManifest();

        if (!isset(self::$manifest[$asset])) {
            return '';
        }

        return get_template_directory_uri() .
            '/dist/' .
            self::$manifest[$asset]['file'];
    }
}
