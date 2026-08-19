<?php

namespace Peppermint\FormBuilder;

use Illuminate\Support\ServiceProvider;
use Peppermint\FormBuilder\Console\InstallCommand;

class FormBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/form-builder.php', 'form-builder');
    }

    public function boot(): void
    {
        // Bewusst kein loadMigrationsFrom(): die Definition liegt in einer
        // Spalte der Anwendung, nicht in einer Tabelle dieses Pakets. Ein
        // Paket, das unangekuendigt eine Produktionstabelle anfasst, ist ein
        // Fussangel — dieselbe Entscheidung wie im document-builder.

        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallCommand::class,
            ]);

            $this->publishes([
                __DIR__.'/../config/form-builder.php' => config_path('form-builder.php'),
            ], 'form-builder-config');
        }
    }
}
