<?php

namespace Peppermint\FormBuilder;

use Illuminate\Support\ServiceProvider;
use Peppermint\FormBuilder\Console\InstallCommand;
use Peppermint\FormBuilder\Regeln\DefinitionPruefer;

class FormBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/form-builder.php', 'form-builder');

        // Aus der Konfiguration gebaut, damit jede Anwendung ihre eigenen
        // Pflichtfelder setzt. Ein Paket, das „email" fest vorschreibt, waere
        // fuer jedes Formular falsch, das keine Mail verschickt.
        $this->app->singleton(DefinitionPruefer::class, fn ($app): DefinitionPruefer => new DefinitionPruefer(
            pflichtfelder: $app['config']->get('form-builder.pflichtfelder', []),
            namensfelder: $app['config']->get('form-builder.namensfelder', []),
        ));
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
