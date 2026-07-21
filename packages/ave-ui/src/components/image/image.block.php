<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\FieldBuilder;
use AvenueUI\Components\Image;

return [
	'name' => 'image',
	'title' => 'Image',
	'description' => 'Image component',
	'field_group_key' => FieldBuilder::build_group_key('image', 'component'),
	'category' => 'ave-components',
	'icon' => 'admin-generic',
	'keywords' => ['image'],
	'component' => Image::class,
	'preview_props' => [
		'label' => 'Image',
	],
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
