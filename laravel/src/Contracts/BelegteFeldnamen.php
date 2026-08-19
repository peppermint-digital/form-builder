<?php

namespace Peppermint\FormBuilder\Contracts;

/**
 * Beantwortet die einzige Frage, die das Paket allein nicht beantworten kann:
 * unter welchen Feldnamen liegen bereits Antworten?
 *
 * Die Antworten liegen in der Anwendung — in Connect an einer Veranstaltung,
 * anderswo an etwas anderem. Das Paket kennt die Tabelle nicht und soll sie
 * auch nicht kennen.
 */
interface BelegteFeldnamen
{
    /**
     * Wie viele Datensaetze unter dem jeweiligen Namen einen nicht-leeren Wert
     * tragen. Namen ohne Treffer duerfen fehlen.
     *
     * @param  array<int, string>  $feldnamen
     * @return array<string, int>
     */
    public function belegt(array $feldnamen): array;
}
