<?php

namespace Peppermint\FormBuilder\Regeln;

/**
 * Was von einem Formular bei einem gegebenen Antwortstand gilt.
 */
class Sichtbarkeitsergebnis
{
    /**
     * @param  array<int, string>  $sichtbareFelder
     * @param  array<int, string>  $pflichtFelder  Immer eine Teilmenge von `sichtbareFelder`.
     * @param  array<int, string>  $sichtbareGruppen
     * @param  array<int, string>  $sichtbareSchritte
     * @param  array<int, string>  $zyklen  Kennungen der Regeln, die einander im Kreis bedingen.
     */
    public function __construct(
        public readonly array $sichtbareFelder = [],
        public readonly array $pflichtFelder = [],
        public readonly array $sichtbareGruppen = [],
        public readonly array $sichtbareSchritte = [],
        public readonly array $zyklen = [],
    ) {}

    public function feldSichtbar(string $name): bool
    {
        return in_array($name, $this->sichtbareFelder, true);
    }

    public function feldPflicht(string $name): bool
    {
        return in_array($name, $this->pflichtFelder, true);
    }
}
