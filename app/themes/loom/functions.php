<?php

namespace Loom;

use Timber\Timber;

// Composer autoloader
if (!file_exists($composer = __DIR__ . '/vendor/autoload.php')) {
    wp_die(
        __(
            'Error locating autoloader. Please run <code>composer install</code>.',
            'loom',
        ),
    );
}
require $composer;

// Timber.
Timber::init();

// Run Setup.
new Setup();

add_theme_support('align-wide');
