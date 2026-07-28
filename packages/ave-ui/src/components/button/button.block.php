<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\FieldBuilder;
use AvenueUI\Components\Button;

return [
	'name' => 'button',
	'title' => 'Button',
	'description' => 'Display a configurable button CTA.',
	'field_group_key' => FieldBuilder::build_group_key('button', 'component'),
	'category' => 'ave-components',
	'icon' => 'admin-links',
	'keywords' => ['button', 'cta', 'link'],
	'component' => Button::class,
	'preview_props' => [
		'label' => 'Button label',
	],
	'map_fields' => static function ( array $fields, array $block, bool $is_preview, int|string $post_id ): array {
		return [
			'props' => [
				'target' => !empty($fields['target']) ? '_blank' : null,
			],
		];
	},
	'supports' => [
		'align' => true,
		'anchor' => true,
		'mode' => true,
		'jsx' => false,
		'html' => false,
		'customClassName' => true,
		'className' => true,
	]
];
