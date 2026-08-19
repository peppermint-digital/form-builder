<?php

namespace Peppermint\FormBuilder\Belegung;

use Illuminate\Contracts\Database\Query\Builder;
use Peppermint\FormBuilder\Contracts\BelegteFeldnamen;

/**
 * Der Normalfall: die Antworten liegen als JSON in einer Spalte.
 *
 * Die Anwendung reicht die bereits eingegrenzte Abfrage herein — in Connect
 * etwa die Anmeldungen EINER Veranstaltung. Was hineingegeben wird, bestimmt,
 * worueber gezaehlt wird; das Paket grenzt nichts nach.
 */
class JsonSpaltenBelegung implements BelegteFeldnamen
{
    public function __construct(
        private readonly Builder $abfrage,
        private readonly string $spalte = 'form_data',
    ) {}

    /**
     * @param  array<int, string>  $feldnamen
     * @return array<string, int>
     */
    public function belegt(array $feldnamen): array
    {
        $treffer = [];

        foreach ($feldnamen as $name) {
            // Ueber Laravels JSON-Notation und nicht ueber rohes SQL:
            // JSON_UNQUOTE kennt nur MySQL, die Tests laufen auf SQLite. Ein
            // Waechter, der nur in Produktion funktioniert, ist keiner.
            $pfad = $this->spalte.'->'.$name;

            $anzahl = (clone $this->abfrage)
                ->whereNotNull($pfad)
                ->where($pfad, '!=', '')
                ->count();

            if ($anzahl > 0) {
                $treffer[$name] = $anzahl;
            }
        }

        return $treffer;
    }
}
