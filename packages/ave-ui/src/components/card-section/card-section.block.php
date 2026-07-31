<?php

declare(strict_types=1);

namespace AvenueUI\Blocks;

use Avenue\ACF\FieldBuilder;
use AvenueUI\Components\CardSection;

return [
    'name' => 'card-section',
    'title' => 'Card Section',
    'description' => 'A Section pattern containing a collection of Cards.',
    'field_group_key' => FieldBuilder::build_group_key('card-section', 'component'),
    'category' => 'ave-components',
    'icon' => 'align-wide',
    'keywords' => ['card-section'],
    'component' => CardSection::class,
    'preview_props' => [
        'section' => [
            'header' => [
                'heading' => 'Featured Stories',
                'intro' => 'Explore the latest stories from Avenue.',
            ],
        ],
        'cards' => [
            [
                'title' => 'First Card',
                'text' => 'A preview Card within the Card Section pattern.',
            ],
        ],
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
