<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\FieldBuilder;

return [
	'name' => 'button',
	'title' => 'Button',
	'description' => 'Display a configurable button CTA.',
	'field_group_key' => FieldBuilder::build_group_key('button', 'component'),
	'category' => 'ave-components',
	'icon' => 'admin-links',
	'keywords' => ['button', 'cta', 'link'],
	'supports' => [
		'align' => true,
		'anchor' => true,
		'mode' => true,
		'jsx' => false,
		'html' => false,
		'customClassName' => true,
		'className' => true,
	],
];

