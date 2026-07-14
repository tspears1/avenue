<?php

namespace Loom;

use Timber\Site;
use Loom\Vite;
use Loom\Utils;

class Setup extends Site
{
    public function __construct()
    {
        if (!is_admin()) {
            add_action('wp_enqueue_scripts', [$this, 'theme_assets']);
        } else {
            // Enqueue editor assets in both contexts
            add_action('enqueue_block_assets', [$this, 'editor_assets']);
        }

        // Load ACF Pro first
        add_action('after_setup_theme', [$this, 'load_acf_pro']);

        // Register components after ACF is initialized
        add_action('acf/init', [$this, 'register_components']);
    }

    /**
     * Enqueue scripts and styles.
     */
    public function theme_assets()
    {
        $theme_styles = Vite::asset('src/css/main.css');
        $theme_scripts = Vite::asset('src/js/main.js');

        if ($theme_styles) {
            wp_enqueue_style('theme-styles', $theme_styles, [], null);
        }
        if ($theme_scripts) {
            wp_enqueue_script('theme-scripts', $theme_scripts, [], null, true);
            // Add module type attribute for ES modules
            Utils::use_script_module('theme-scripts');
        }
    }

    /**
     * Enqueue editor scripts and styles.
     */
    public function editor_assets()
    {
        // Just load it and use JavaScript to detect iframe context
        // This is more reliable than trying to guess PHP parameters
        $editor_scripts = Vite::asset('src/js/editor.js');

        if ($editor_scripts) {
            wp_enqueue_script('theme-editor-scripts', $editor_scripts, [], null, true );
            // Add module type attribute for ES modules
            Utils::use_script_module('theme-editor-scripts');
        }
    }

    /**
     * ACF Pro.
     */
    public function load_acf_pro()
    {
        // Check if another plugin or theme has bundled ACF
        if (defined('MY_ACF_PATH')) {
            return;
        }

        // Define path and URL to the ACF plugin.
        define( 'MY_ACF_PATH', get_template_directory() . '/vendor/advanced-custom-fields-pro/' );
        define( 'MY_ACF_URL', get_template_directory_uri() . '/vendor/advanced-custom-fields-pro/' );

        // Include the ACF plugin.
        include_once MY_ACF_PATH . 'acf.php';

        // Customize the URL setting to fix incorrect asset URLs.
        add_filter('acf/settings/url', function ($url) {
            return MY_ACF_URL;
        });

        // Load ACF config
        ACF::init();
    }

    /**
     * Register components from ka-components package.
     */
    public function register_components()
    {
        //Components::init();
    }
}
