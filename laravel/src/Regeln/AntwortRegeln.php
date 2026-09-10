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
     * @param  array<string, mixed>|null  $antworten  Der eingehende Antwortstand.
     *                                                Ohne ihn bleiben die
     *                                                Bedingungen unbeachtet.
     * @return array<string, array<int, string>>
     */
    public static function fuer(
        FormularDefinition $definition,
        string $prefix = '',
        ?RegelEinstellungen $einstellungen = null,
        ?array $antworten = null,
    ): array {
        $einstellungen ??= new RegelEinstellungen;

        // Ohne Antworten laesst sich keine Bedingung auswerten — dann gilt,
        // was am Feld steht. Das ist der Zustand jeder Anwendung, die den
        // Baukasten benutzt, aber noch keine Bedingungen anlegt: fuer sie
        // aendert sich durch diesen Parameter nichts.
        $sichtbarkeit = $antworten === null
            ? null
            : Sichtbarkeit::fuer($definition, $antworten);

        $regeln = [];

        foreach ($definition->felder as $feld) {
            $schluessel = $prefix === '' ? $feld->name : $prefix.'.'.$feld->name;

            // `exclude` und nicht `nullable`: der Wert eines verborgenen
            // Feldes muss WEG sein, nicht bloss ungeprueft. Sonst schreibt
            // eine Anfrage an der Oberflaeche vorbei Werte in die Antworten,
            // die im Formular nie standen — und niemand sieht ihnen an, dass
            // sie dort nicht hingehoeren.
            if ($sichtbarkeit !== null && ! $sichtbarkeit->feldSichtbar($feld->name)) {
                $regeln[$schluessel] = ['exclude'];

                continue;
            }

            $pflicht = $sichtbarkeit?->feldPflicht($feld->name) ?? $feld->required;

            // Eine Mehrfachauswahl ist der einzige Typ, der ZWEI Schluessel
            // braucht: einen fuer die Liste und einen fuer ihre Eintraege.
            // Eine `in:`-Regel am Feld selbst traefe nie zu — Laravel
            // vergleicht dort den ganzen Array, und die Anmeldung waere ab dem
            // ersten Kreuz nicht mehr absendbar.
            if ($feld->istMehrfachauswahl()) {
                // `required` auf einem Array weist auch `[]` ab. Genau das ist
                // bei „mindestens eine Antwort" gemeint.
                $regeln[$schluessel] = [$pflicht ? 'required' : 'nullable', 'array'];
                $regeln[$schluessel.'.*'] = self::fuerEintrag($feld);

                continue;
            }

            $regeln[$schluessel] = self::fuerFeld($feld, $einstellungen, $pflicht);
        }

        return $regeln;
    }

    /**
     * @return array<int, string>
     */
    private static function fuerFeld(
        FormularFeld $feld,
        RegelEinstellungen $einstellungen,
        bool $pflicht,
    ): array {
        $regeln = [$pflicht ? 'required' : 'nullable'];

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
                if ($pflicht) {
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

            case 'nps':
            case 'scale':
                // Die Stufen sind '1' bis n und nichts sonst. Sie stehen nicht
                // in `options`, deshalb greift die `in:`-Regel weiter unten
                // hier nicht — sie muss hier stehen.
                //
                // Ohne sie koennte jemand an der Oberflaeche vorbei '99' in
                // eine Bewertung schreiben, und der Durchschnitt in der
                // Auswertung waere still falsch.
                $regeln[] = 'string';
                $regeln[] = 'in:'.implode(',', $feld->stufenwerte());
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
     * Die Regeln fuer EINEN Eintrag einer Mehrfachauswahl.
     *
     * @return array<int, string>
     */
    private static function fuerEintrag(FormularFeld $feld): array
    {
        $regeln = ['string'];
        $optionen = $feld->optionen();

        if ($optionen === []) {
            return $regeln;
        }

        // Die Werte werden GEQUOTET, anders als bei `select`/`radio` weiter
        // oben. Das ist kein Versehen und auch keine Uneinheitlichkeit aus
        // Bequemlichkeit:
        //
        // `in:` trennt an Kommas. Eine Option „Ja, gerne" zerfaellt
        // unquotiert in „Ja" und „ gerne" — die Regel erlaubt dann zwei Werte,
        // die es nicht gibt, und verbietet den, den es gibt. Das trifft
        // `select` und `radio` seit jeher (siehe Bug-Vermerk im Paket).
        //
        // Dort ist es NICHT hier mitrepariert worden, weil die Reparatur eine
        // Verschaerfung gegen den Bestand waere: Ab dem Ausrollen wiese die
        // Anmeldung Eingaben ab, die am Tag davor durchgingen. Genau davor
        // warnt `config/form-builder.php` ausfuehrlich. Bei `checkboxes` gibt
        // es keinen Bestand — der Typ ist neu —, also faengt er richtig an.
        $gequotet = array_map(
            fn (string $option): string => '"'.str_replace('"', '""', $option).'"',
            $optionen,
        );

        $regeln[] = 'in:'.implode(',', $gequotet);

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

            // Eine Mehrfachauswahl meldet ihre Fehler am EINTRAG
            // (`workshops.1`), nicht am Feld. Ohne diese Zeile lautet die
            // Meldung „The selected workshops.1 is invalid" — mit dem
            // Datenschluessel und dem Index darin, also mit genau den zwei
            // Angaben, die den Leser nichts angehen.
            if ($feld->istMehrfachauswahl()) {
                $attribute[$schluessel.'.*'] = $feld->label;
            }
        }

        return $attribute;
    }
}
