<?php

namespace Peppermint\FormBuilder\Console;

use Illuminate\Console\Command;

class InstallCommand extends Command
{
    protected $signature = 'form-builder:install';

    protected $description = 'Veroeffentlicht die Konfiguration des Form-Builders';

    public function handle(): int
    {
        $this->callSilent('vendor:publish', [
            '--tag' => 'form-builder-config',
        ]);

        $this->info('config/form-builder.php wurde veroeffentlicht.');
        $this->line('');
        $this->line('Naechster Schritt: Pflichtfelder eintragen — also die Feldnamen,');
        $this->line('an denen in dieser Anwendung etwas haengt (Mailversand, Listen,');
        $this->line('Namensschilder). Ohne sie prueft das Paket nichts.');

        return self::SUCCESS;
    }
}
