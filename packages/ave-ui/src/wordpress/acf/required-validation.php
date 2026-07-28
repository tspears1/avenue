<?php

declare(strict_types=1);

namespace AvenueUI\WordPress;

if (!function_exists('add_filter')) {
    return;
}

require_once dirname(__DIR__) . '/utils/NestedArray.php';
require_once __DIR__ . '/AcfFieldInspector.php';
require_once __DIR__ . '/RequiredFieldValidator.php';

RequiredFieldValidator::boot();
