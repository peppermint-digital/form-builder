<?php

namespace Peppermint\FormBuilder\Tests;

use Orchestra\Testbench\TestCase as Testbench;
use Peppermint\FormBuilder\FormBuilderServiceProvider;

abstract class TestCase extends Testbench
{
    /**
     * @return array<int, class-string>
     */
    protected function getPackageProviders($app): array
    {
        return [FormBuilderServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        // In-Memory-SQLite: die Waechter muessen auf derselben Datenbank
        // funktionieren, auf der die Tests laufen. Ein Waechter, der nur unter
        // MySQL greift, faellt in der Entwicklung nie auf.
        $app['config']->set('database.default', 'testing');
    }
}
