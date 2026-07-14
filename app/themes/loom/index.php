<?php
/**
 * WP: index.php
 *
 * @package Loom
 * @version 0.0.1
 */

namespace Loom;
use Timber\Timber;

$templates = ['templates/index.twig'];

$context = Timber::context();

Timber::render($templates, $context);
