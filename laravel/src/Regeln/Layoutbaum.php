<?php

namespace Peppermint\FormBuilder\Regeln;

use Peppermint\FormBuilder\Data\FormularDefinition;

/**
 * Was das Layout ueber Rahmen und Zugehoerigkeit aussagt.
 *
 * Die Gegenstelle ist `layoutAufloesen()` in `src/core/definition.ts`, und
 * beide muessen dieselben Entscheidungen treffen — sonst zeigt der Browser ein
 * Feld, das der Server verwirft, oder umgekehrt.
 *
 * Die drei Entscheidungen, die hier nachgebildet sind:
 *
 * 1. Ein Rahmen ohne aufgeloesten Inhalt faellt weg. Er entsteht, sobald
 *    jemand die Felder darin loescht, und waere im Formular eine Luecke.
 * 2. Ein Feldname zaehlt nur beim ERSTEN Vorkommen, ueber den ganzen Baum.
 *    Zwei Eingabefelder auf denselben Datenschluessel ueberschreiben sich.
 * 3. Ein Feld, das in keinem Knoten vorkommt, liegt auf oberster Ebene — es
 *    darf nicht unsichtbar werden, nur weil das Layout es nicht kennt.
 */
class Layoutbaum
{
    /** @var array<int, string> */
    private array $gruppen = [];

    /** @var array<int, string> */
    private array $schritte = [];

    /** @var array<string, array<int, string>> */
    private array $eltern = [];

    /** @var array<int, string> */
    private array $verbraucht = [];

    /** @var array<int, string> */
    private readonly array $bekannt;

    public function __construct(FormularDefinition $definition)
    {
        $this->bekannt = $definition->feldnamen();

        $this->gehen($definition->layout, []);

        foreach ($this->bekannt as $name) {
            if (! in_array($name, $this->verbraucht, true)) {
                $this->eltern[$name] = [];
            }
        }
    }

    /**
     * @return array<int, string>
     */
    public function gruppen(): array
    {
        return $this->gruppen;
    }

    /**
     * @return array<int, string>
     */
    public function schritte(): array
    {
        return $this->schritte;
    }

    /**
     * Die Kennungen aller Rahmen ueber einem Feld, von aussen nach innen.
     *
     * @return array<int, string>
     */
    public function vorfahren(string $feldname): array
    {
        return $this->eltern[$feldname] ?? [];
    }

    /**
     * @param  array<int, mixed>  $liste
     * @param  array<int, string>  $vorfahren
     * @return int Wie viele Knoten dieser Zweig beigesteuert hat.
     */
    private function gehen(array $liste, array $vorfahren): int
    {
        $gezaehlt = 0;

        foreach ($liste as $eintrag) {
            if (! is_array($eintrag)) {
                continue;
            }

            $typ = $eintrag['type'] ?? null;

            if ($typ === 'section') {
                $gezaehlt++;

                continue;
            }

            if ($typ === 'group' || $typ === 'step') {
                $id = $eintrag['id'] ?? null;

                if (! is_string($id) || $id === '') {
                    continue;
                }

                $kinder = is_array($eintrag['children'] ?? null) ? $eintrag['children'] : [];

                // Erst hinabsteigen, dann entscheiden: ein Rahmen, in dem
                // nichts uebrig bleibt, wird nicht eingetragen. Dabei kann
                // auch kein Feldname verbraucht worden sein — sonst waere
                // etwas uebrig geblieben.
                if ($this->gehen($kinder, [...$vorfahren, $id]) === 0) {
                    continue;
                }

                if ($typ === 'group') {
                    $this->gruppen[] = $id;
                } else {
                    $this->schritte[] = $id;
                }

                $gezaehlt++;

                continue;
            }

            $spalten = $eintrag['columns'] ?? null;

            if (! is_array($spalten)) {
                continue;
            }

            $treffer = 0;

            foreach ($spalten as $spalte) {
                if (! is_array($spalte)) {
                    continue;
                }

                foreach ($spalte as $name) {
                    if (! is_string($name)) {
                        continue;
                    }

                    if (in_array($name, $this->verbraucht, true)) {
                        continue;
                    }

                    if (! in_array($name, $this->bekannt, true)) {
                        continue;
                    }

                    $this->verbraucht[] = $name;
                    $this->eltern[$name] = $vorfahren;
                    $treffer++;
                }
            }

            if ($treffer > 0) {
                $gezaehlt++;
            }
        }

        return $gezaehlt;
    }
}
