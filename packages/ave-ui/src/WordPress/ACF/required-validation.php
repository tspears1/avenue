<?php

declare(strict_types=1);

namespace AvenueUI\WordPress\ACF;

if (!function_exists('add_filter')) {
    return;
}

require_once dirname(__DIR__) . '/Utils/NestedArray.php';
require_once __DIR__ . '/AcfFieldInspector.php';
require_once __DIR__ . '/RequiredFieldValidator.php';

RequiredFieldValidator::boot();
