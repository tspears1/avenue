<?php

namespace Loom;

use Timber\Site;
use Loom\ACF;
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
        // Delegate ACF setup/loading to the ave-acf package bootstrap.
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
