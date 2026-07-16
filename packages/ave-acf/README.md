# ave-acf

Reusable ACF helpers for Avenue projects.

## Install

```bash
composer require bostonuniversity/ave-acf
```

## Usage

```php
use Avenue\ACF\Fields;
use Avenue\ACF\FieldBuilder;
use Avenue\ACF\Package;

Package::boot([
	'local_json_path' => get_stylesheet_directory() . '/config/ACF/acf-json',
	'remove_default_load_json_path' => true,
    'load_bundled_acf' => true,
]);

$title = Fields::get('title', default: 'Untitled');

$button_field = FieldBuilder::build_field('button', 'label', [
    'label' => 'Button Label',
    'type' => 'text',
]);
```

## Boot Options

- `local_json_path` (string|null): Save path for local JSON and an optional load path.
- `load_json_paths` (string[]): Additional load paths for JSON syncing.
- `remove_default_load_json_path` (bool): Removes ACF's default JSON load path when true.
- `load_bundled_acf` (bool): When true, loads bundled ACF from theme vendor path if ACF is not already available.
- `bundled_acf_path` (string|null): Override bundled ACF plugin path (expects trailing plugin directory, e.g. `/vendor/advanced-custom-fields-pro/`).
- `bundled_acf_url` (string|null): Override bundled ACF plugin URL.

## Included helpers

### Package

`Avenue\ACF\Package` - Boot package integrations with options.

### LocalJson

`Avenue\ACF\LocalJson` - Registers ACF local JSON save/load paths.

### Fields

`Avenue\ACF\Fields` - Safe field access and data normalization helpers.

### FieldBuilder

`Avenue\ACF\FieldBuilder` - ACF field factory/builder for component-style schemas.

**Builder Methods:**
- `build_field_group()` - Build a full component field group
- `build_field()` - Build a base field with consistent key/name
- `build_group()` - Build a group field
- `build_repeater()` - Build a repeater field
- `build_clone()` - Build a clone field
- `build_flexible()` - Build a flexible content field
- `build_tab()` - Build a tab field
- `build_accordion()` - Build an accordion layout field
- `register_field_group()` - Register group via `acf_add_local_field_group`
- `build_group_key()` and `build_field_key()` - Deterministic key helpers

**Aliases (array-config style):**
- `field_group([...])`
- `field([...])`
- `group([...])`
- `repeater([...])`
- `clone_field([...])` (uses `clone_field` because `clone` is a reserved PHP keyword)
- `flexible([...])`
- `tab([...])`
- `accordion([...])`

**Field Access:**
- `get()` - Safe wrapper around `get_field` with default fallback
- `get_sub()` - Safe wrapper around `get_sub_field` with default fallback

**Data Normalization:**
- `flatten_clone()` - Flatten ACF clone field nested arrays
- `get_image()` - Normalize image field data (array/ID/URL → consistent format)
- `get_link()` - Normalize link field data
- `get_repeater()` - Ensure repeater is always an array
- `has_repeater()` - Check if repeater has rows
- `get_bool()` - Normalize true/false field quirks
- `get_relationship()` - Ensure relationship returns WP_Post objects
- `get_taxonomy()` - Ensure taxonomy returns WP_Term objects

## Examples

```php
// Field access with defaults
$title = Fields::get('title', default: 'Untitled');

// Flatten clone field
$button_data = Fields::flatten_clone($fields['button'], 'button_fields');

// Normalize image (works with array/ID/URL)
$image = Fields::get_image(get_field('hero_image'));
if ($image) {
    echo '<img src="' . esc_url($image['url']) . '" alt="' . esc_attr($image['alt']) . '">';
}

// Safe link handling
$link = Fields::get_link(get_field('cta_link'));
if ($link) {
    echo '<a href="' . esc_url($link['url']) . '" target="' . esc_attr($link['target']) . '">'
        . esc_html($link['title']) . '</a>';
}

// Safe repeater handling
$items = Fields::get_repeater(get_field('items'));
if (Fields::has_repeater($items)) {
    foreach ($items as $item) {
        // Process item
    }
}

// Build a component field group
$fields = [
    FieldBuilder::build_field('button', 'label', [
        'label' => 'Label',
        'type' => 'text',
    ]),
    FieldBuilder::build_field('button', 'url', [
        'label' => 'URL',
        'type' => 'url',
    ]),
];

$field_group = FieldBuilder::build_field_group('button', $fields, [
    'location' => [
        [
            [
                'param' => 'post_type',
                'operator' => '==',
                'value' => 'page',
            ],
        ],
    ],
]);

FieldBuilder::register_field_group($field_group);

// Alias style examples
$group_field = FieldBuilder::group([
    'component_name' => 'button',
    'group_name' => 'content',
    'fields' => [
        FieldBuilder::field([
            'component_name' => 'button',
            'field_name' => 'text',
            'args' => [
                'label' => 'Text',
                'type' => 'text',
            ],
        ]),
    ],
]);

$accordion = FieldBuilder::accordion([
    'component_name' => 'button',
    'accordion_name' => 'settings',
    'args' => [
        'label' => 'Settings',
        'open' => 1,
    ],
]);
```
