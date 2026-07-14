<?php

namespace Loom;

use Twig\TwigFunction;

class Twig
{

    public function __construct()
    {
        add_filter('timber/twig', [$this, 'add_twig_functions']);
    }

    /**
     * Add custom Twig functions.
     *
     * @param \Twig\Environment $twig Twig environment
     * @return \Twig\Environment
     */
    public function add_twig_functions($twig)
    {
        // // Add render_section function
        // $twig->addFunction(
        //     new TwigFunction('render_section', function ($args) {
        //         return ComponentRenderer::renderToString(
        //             'section',
        //             SectionProps::class,
        //             $args,
        //         );
        //     }),
        // );

        // // Add render_card function
        // $twig->addFunction(
        //     new TwigFunction('render_card', function ($args) {
        //         return ComponentRenderer::renderToString(
        //             'card',
        //             CardProps::class,
        //             $args,
        //             function ($props) {
        //                 // Pre-render hook: Convert image to JSON for web component
        //                 if (!empty($props['image'])) {
        //                     // Ensure it's an array before converting
        //                     $imageData = is_array($props['image'])
        //                         ? $props['image']
        //                         : [];
        //                     $props['image'] = AttributeHelper::toJson(
        //                         $imageData,
        //                     );
        //                 }

        //                 // Map 'button' to 'link' and convert to JSON for web component
        //                 if (!empty($props['button'])) {
        //                     // Ensure it's an array before converting
        //                     $buttonData = is_array($props['button'])
        //                         ? $props['button']
        //                         : [];
        //                     $props['link'] = AttributeHelper::toJson(
        //                         $buttonData,
        //                     );
        //                 }

        //                 return $props;
        //             },
        //         );
        //     }),
        // );

        return $twig;
    }
}
