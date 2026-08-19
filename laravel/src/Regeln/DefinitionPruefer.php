<?php

namespace Peppermint\FormBuilder\Regeln;

use Peppermint\FormBuilder\Contracts\BelegteFeldnamen;
use Peppermint\FormBuilder\Data\FormularDefinition;

/**
 * Die Waechter ueber einer Formular-Definition.
 *
 * Sie stehen zwischen dem Baukasten und der Datenbank, weil ein Formular
 * gleichzeitig zwei Dinge ist: eine Oberflaeche, die man frei gestalten
 * koennen soll, und ein Datenvertrag, den man nicht brechen darf. Jede Regel
 * hier verteidigt die zweite Eigenschaft gegen die erste.
 */
class DefinitionPruefer
{
    /**
     * @param  array<string, array{type?: string, begruendung?: string}>  $pflichtfelder
     * @param  array<int, string>  $namensfelder
     */
    public function __construct(
        private readonly array $pflichtfelder = [],
        private readonly array $namensfelder = [],
    ) {}

    /**
     * Prueft eine neue Definition — gegen die bisherige, wenn es eine gibt.
     *
     * @return array<int, string> Meldungen; leeres Array heisst: in Ordnung.
     */
    public function pruefen(
        FormularDefinition $neu,
        ?FormularDefinition $bisher = null,
        ?BelegteFeldnamen $belegung = null,
    ): array {
        if ($neu->istLeer()) {
            return [];
        }

        return array_merge(
            $this->pflichtfelderPruefen($neu),
            $this->namensfeldPruefen($neu),
            $this->doppelteNamenPruefen($neu),
            $this->verwaisendeFelderPruefen($neu, $bisher, $belegung),
        );
    }

    /**
     * @return array<int, string>
     */
    private function pflichtfelderPruefen(FormularDefinition $neu): array
    {
        $meldungen = [];

        foreach ($this->pflichtfelder as $name => $vorgabe) {
            $feld = $neu->feld($name);

            if (! $feld) {
                $meldungen[] = trim(sprintf(
                    'Das Formular braucht ein Feld mit dem Namen „%s". %s',
                    $name,
                    $vorgabe['begruendung'] ?? '',
                ));

                continue;
            }

            // Der Typ ist nicht schmueckendes Beiwerk: ein Textfeld namens
            // „email" liesse jede Eingabe durch, und die Bestaetigungsmail
            // ginge an eine Zeichenkette, die keine Adresse ist.
            $erwartet = $vorgabe['type'] ?? null;

            if (is_string($erwartet) && $feld->type !== $erwartet) {
                $meldungen[] = sprintf(
                    'Das Feld „%s" muss vom Typ „%s" sein.',
                    $name,
                    $erwartet,
                );
            }
        }

        return $meldungen;
    }

    /**
     * @return array<int, string>
     */
    private function namensfeldPruefen(FormularDefinition $neu): array
    {
        if ($this->namensfelder === []) {
            return [];
        }

        $vorhanden = array_map('mb_strtolower', $neu->feldnamen());
        $gesucht = array_map('mb_strtolower', $this->namensfelder);

        if (array_intersect($vorhanden, $gesucht) !== []) {
            return [];
        }

        return [sprintf(
            'Das Formular braucht ein Feld, das den Teilnehmer benennt (%s). '
            .'Ohne das bleibt jede Liste leer.',
            implode(', ', array_map(fn (string $n): string => '„'.$n.'"', $this->namensfelder)),
        )];
    }

    /**
     * @return array<int, string>
     */
    private function doppelteNamenPruefen(FormularDefinition $neu): array
    {
        $zaehlung = array_count_values($neu->feldnamen());
        $doppelt = array_keys(array_filter($zaehlung, fn (int $n): bool => $n > 1));

        if ($doppelt === []) {
            return [];
        }

        // Zwei Felder mit demselben Namen ueberschreiben sich in den
        // gespeicherten Antworten; welches gewinnt, waere Zufall.
        return [sprintf(
            'Diese Feldnamen kommen mehrfach vor: %s. Jeder Name darf nur einmal vergeben werden.',
            implode(', ', $doppelt),
        )];
    }

    /**
     * Verhindert, dass ein Feldschluessel unter vorhandenen Daten weggezogen wird.
     *
     * Die gespeicherten Antworten haengen am Feldnamen. Verschwindet der Name
     * aus der Definition — umbenannt oder geloescht —, sind alle Werte
     * schlagartig unauffindbar: Listen zeigen Luecken, Ausdrucke bleiben leer,
     * Vorbefuellung greift nicht mehr. Nichts daran ist sichtbar, es faellt
     * erst auf, wenn jemand eine Liste ansieht.
     *
     * Genau das ist am 18.08.2026 in Peppermint Connect mit dem Feld „Termin"
     * passiert: entfernt, 429 Werte lagen danach ohne Ziel in der Datenbank.
     *
     * Bewusst eine Sperre und kein Mitziehen: die Daten mitwandern zu lassen
     * hiesse, dass jedes Speichern des Formulars stillschweigend alle
     * Antworten umschreibt — eine schwere Nebenwirkung an einer Stelle, an der
     * niemand sie erwartet, und im Fehlerfall schwer zurueckzudrehen.
     *
     * Das LABEL bleibt frei aenderbar. Genau dafuer ist die Trennung von
     * `name` und `label` da.
     *
     * @return array<int, string>
     */
    private function verwaisendeFelderPruefen(
        FormularDefinition $neu,
        ?FormularDefinition $bisher,
        ?BelegteFeldnamen $belegung,
    ): array {
        if (! $bisher instanceof FormularDefinition || ! $belegung instanceof BelegteFeldnamen) {
            return [];
        }

        $entfallen = array_values(array_diff($bisher->feldnamen(), $neu->feldnamen()));

        if ($entfallen === []) {
            return [];
        }

        $meldungen = [];

        foreach ($belegung->belegt($entfallen) as $name => $anzahl) {
            if ($anzahl < 1) {
                continue;
            }

            $meldungen[] = sprintf(
                'Das Feld „%s" trägt bereits Daten aus %d %s. Sein Schlüssel lässt sich '
                .'deshalb nicht mehr ändern oder entfernen — die Werte wären danach nicht '
                .'mehr auffindbar. Die Beschriftung kannst du frei ändern.',
                $name,
                $anzahl,
                $anzahl === 1 ? 'Eintrag' : 'Einträgen',
            );
        }

        return $meldungen;
    }
}
