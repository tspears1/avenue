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
        return $twig;
    }
}
