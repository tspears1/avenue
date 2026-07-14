<?php

namespace Loom;

class ACF
{
    /**
     * Initialize the ACF configuration.
     *
     * This method sets up the local JSON path for ACF and registers the necessary
     * filters and actions to handle ACF settings.
     */
    public static function init()
    {
        // Setup Local JSON.
        define(
            'ACF_LOCAL_JSON_PATH',
            \get_stylesheet_directory() . '/config/ACF/acf-json',
        );
        add_filter('acf/settings/save_json', [
            self::class,
            'set_local_json_path',
        ]);
        add_filter('acf/settings/load_json', [
            self::class,
            'add_local_json_path',
        ]);
    }

    /**
     * Set the path for local JSON files
     *
     * @param string $path
     */
    public static function set_local_json_path(string $path): string
    {
        if (!defined('ACF_LOCAL_JSON_PATH')) {
            // If the constant is not defined, return default path.
            return $path;
        } else {
            // If the constant is defined, return the constant value
            return ACF_LOCAL_JSON_PATH;
        }
    }

    /**
     * Add the local JSON path to the ACF load paths
     *
     * @param array $paths
     * @return array
     */
    public static function add_local_json_path(array $paths): array
    {
        unset($paths[0]); // Remove the default path
        if (!defined('ACF_LOCAL_JSON_PATH')) {
            return $paths; // If the constant is not defined, return the original paths
        }
        $paths[] = ACF_LOCAL_JSON_PATH; // Add the custom path
        return $paths;
    }
}
