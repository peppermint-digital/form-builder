<?php

namespace Peppermint\FormBuilder\Regeln;

use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Data\FormularFeld;

/**
 * Leitet aus einer Formular-Definition die Validierungsregeln fuer die
 * eingehenden Antworten ab.
 *
 * Vorher schrieb jede Anwendung diese Regeln von Hand — und musste sie bei
 * jeder Aenderung am Baukasten nachziehen. Zwei Quellen fuer dieselbe Aussage
 * laufen immer auseinander; welche von beiden dann gilt, merkt man erst, wenn
 * jemand etwas abschickt, das nicht haette durchgehen duerfen.
 *
 * Wie streng die Regeln ausfallen, entscheidet `RegelEinstellungen`. Der Grund
 * steht dort: eine Anwendung mit gewachsenem Bestand darf nicht dadurch
 * strenger werden, dass sie die Regeln an einer Stelle zusammenfuehrt.
 */
class AntwortRegeln
{
    /**
     * @return array<string, array<int, string>>
     */
    public static function fuer(
        FormularDefinition $definition,
        string $prefix = '',
        ?RegelEinstellungen $einstellungen = null,
    ): array {
        $einstellungen ??= new RegelEinstellungen;
        $regeln = [];

        foreach ($definition->felder as $feld) {
            $schluessel = $prefix === '' ? $feld->name : $prefix.'.'.$feld->name;
            $regeln[$schluessel] = self::fuerFeld($feld, $einstellungen);
        }

        return $regeln;
    }

    /**
     * @return array<int, string>
     */
    private static function fuerFeld(FormularFeld $feld, RegelEinstellungen $einstellungen): array
    {
        $regeln = [$feld->required ? 'required' : 'nullable'];

        switch ($feld->type) {
            case 'email':
                $regeln[] = 'email';
                break;

            case 'number':
                if ($einstellungen->typpruefung) {
                    $regeln[] = 'numeric';
                }
                break;

            case 'date':
                if ($einstellungen->typpruefung) {
                    $regeln[] = 'date';
                }
                break;

            case 'checkbox':
                // Ankreuzfelder kommen als '1' oder '0' an, nicht als
                // Wahrheitswert: die Antworten liegen als JSON neben lauter
                // Texten. Ein `boolean` wuerde '0' zwar annehmen, aber ein
                // Pflicht-Ankreuzfeld mit `required` liesse '0' durchgehen —
                // deshalb `accepted`, wenn es Pflicht ist.
                if ($feld->required) {
                    return $einstellungen->zustimmungErzwingen
                        ? ['accepted']
                        : ['required', 'in:0,1'];
                }

                $regeln[] = 'in:0,1';
                break;

            case 'textarea':
                $regeln[] = 'string';

                if ($einstellungen->maxFliesstext !== null) {
                    $regeln[] = 'max:'.$einstellungen->maxFliesstext;
                }
                break;

            default:
                $regeln[] = 'string';
                break;
        }

        // Eine Auswahlliste, die alles annimmt, ist keine Auswahl. Ohne diese
        // Regel kann jeder per Formular-Manipulation beliebige Werte in die
        // Auswertung schreiben.
        if ($feld->istAuswahl() && $feld->optionen() !== []) {
            $regeln[] = 'in:'.implode(',', $feld->optionen());
        }

        if (in_array($feld->type, ['text', 'tel', 'email'], true)) {
            $regeln[] = 'max:'.$einstellungen->maxText;
        }

        return $regeln;
    }

    /**
     * Die Beschriftungen als Attributnamen — damit in der Fehlermeldung
     * „Das Feld Vorname …" steht und nicht „Das Feld first_name …".
     *
     * @return array<string, string>
     */
    public static function attribute(
        FormularDefinition $definition,
        string $prefix = '',
    ): array {
        $attribute = [];

        foreach ($definition->felder as $feld) {
            $schluessel = $prefix === '' ? $feld->name : $prefix.'.'.$feld->name;
            $attribute[$schluessel] = $feld->label;
        }

        return $attribute;
    }
}
