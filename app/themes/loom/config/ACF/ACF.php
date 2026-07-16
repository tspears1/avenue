<?php

namespace Loom;

use Avenue\ACF\Package;

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
        $local_json_path = \get_stylesheet_directory() . '/config/ACF/acf-json';
        Package::boot([
            'local_json_path' => $local_json_path,
            'remove_default_load_json_path' => true,
            'load_bundled_acf' => true,
        ]);
    }
}
