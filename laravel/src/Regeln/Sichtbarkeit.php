<?php

namespace Peppermint\FormBuilder\Regeln;

use Peppermint\FormBuilder\Data\Bedingungsregel;
use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Data\FormularFeld;
use Peppermint\FormBuilder\Data\Pruefung;

/**
 * Wertet die Bedingungen eines Formulars gegen einen Antwortstand aus.
 *
 * Die Portierung von `sichtbarkeit()` aus `src/core/sichtbarkeit.ts`. Zwei
 * Umsetzungen derselben Regel sind eine Fehlerquelle, die sich nicht
 * wegdiskutieren laesst — aber eine Sichtbarkeit, die nur im Browser gilt,
 * ist keine: der Server muss dieselbe Frage beantworten, um die richtigen
 * Felder zu verlangen und die uebrigen wegzuwerfen.
 *
 * Nachgehalten wird die Uebereinstimmung ueber den gemeinsamen
 * Prueffallsatz unter `faelle/sichtbarkeit/`. Wer hier etwas aendert, aendert
 * es dort mit — oder ein Fall wird rot, und zwar in beiden Sprachen.
 */
class Sichtbarkeit
{
    private const MAX_DURCHLAEUFE = 50;

    /**
     * @param  array<string, mixed>  $antworten
     */
    public static function fuer(
        FormularDefinition $definition,
        array $antworten = [],
    ): Sichtbarkeitsergebnis {
        $zyklen = self::zyklenFinden($definition->bedingungen);
        $anwendbar = array_values(array_filter(
            $definition->bedingungen,
            fn (Bedingungsregel $regel): bool => ! in_array($regel->id, $zyklen, true),
        ));

        $baum = new Layoutbaum($definition);
        $alleFelder = $definition->feldnamen();
        $alleGruppen = $baum->gruppen();
        $alleSchritte = $baum->schritte();

        $sichtbareFelder = $alleFelder;
        $sichtbareGruppen = $alleGruppen;
        $sichtbareSchritte = $alleSchritte;

        for ($durchlauf = 0; $durchlauf < self::MAX_DURCHLAEUFE; $durchlauf++) {
            $stand = self::einDurchlauf(
                $anwendbar,
                $antworten,
                $sichtbareFelder,
                $alleFelder,
                $alleGruppen,
                $alleSchritte,
            );

            // Die Vererbung gehoert IN die Schleife: ein Feld in einem
            // verborgenen Rahmen ist verborgen, und eine Regel, die dieses
            // Feld prueft, muss es als leer lesen.
            $stand['felder'] = self::vererben(
                $stand,
                $baum,
                $alleGruppen,
                $alleSchritte,
            );

            $stabil = self::gleich($stand['felder'], $sichtbareFelder)
                && self::gleich($stand['gruppen'], $sichtbareGruppen)
                && self::gleich($stand['schritte'], $sichtbareSchritte);

            $sichtbareFelder = $stand['felder'];
            $sichtbareGruppen = $stand['gruppen'];
            $sichtbareSchritte = $stand['schritte'];

            if ($stabil) {
                break;
            }
        }

        return new Sichtbarkeitsergebnis(
            sichtbareFelder: array_values($sichtbareFelder),
            pflichtFelder: self::pflichtBestimmen($definition, $anwendbar, $antworten, $sichtbareFelder),
            sichtbareGruppen: array_values($sichtbareGruppen),
            sichtbareSchritte: array_values($sichtbareSchritte),
            zyklen: $zyklen,
        );
    }

    /**
     * @param  array<int, Bedingungsregel>  $regeln
     * @param  array<string, mixed>  $antworten
     * @param  array<int, string>  $sichtbareFelder
     * @param  array<int, string>  $alleFelder
     * @param  array<int, string>  $alleGruppen
     * @param  array<int, string>  $alleSchritte
     * @return array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}
     */
    private static function einDurchlauf(
        array $regeln,
        array $antworten,
        array $sichtbareFelder,
        array $alleFelder,
        array $alleGruppen,
        array $alleSchritte,
    ): array {
        $stand = [
            'felder' => $alleFelder,
            'gruppen' => $alleGruppen,
            'schritte' => $alleSchritte,
        ];

        // Ein Ziel mit `show`-Regel startet verborgen. Ohne diese Umkehr waere
        // „zeige X, wenn Y" wirkungslos — X ist ohnehin sichtbar.
        foreach ($regeln as $regel) {
            if ($regel->wirkung === 'show') {
                $stand = self::entfernen($stand, $regel);
            }
        }

        foreach ($regeln as $regel) {
            if ($regel->wirkung === 'show' && self::regelTrifftZu($regel, $antworten, $sichtbareFelder)) {
                $stand = self::hinzufuegen($stand, $regel);
            }
        }

        // Zuletzt, damit Verbergen gewinnt: ein Feld, das sichtbar ist, obwohl
        // es niemand sehen sollte, sammelt Angaben ein, die nicht erhoben
        // werden duerfen.
        foreach ($regeln as $regel) {
            if ($regel->wirkung === 'hide' && self::regelTrifftZu($regel, $antworten, $sichtbareFelder)) {
                $stand = self::entfernen($stand, $regel);
            }
        }

        return $stand;
    }

    /**
     * @param  array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}  $stand
     * @param  array<int, string>  $alleGruppen
     * @param  array<int, string>  $alleSchritte
     * @return array<int, string>
     */
    private static function vererben(
        array $stand,
        Layoutbaum $baum,
        array $alleGruppen,
        array $alleSchritte,
    ): array {
        return array_values(array_filter(
            $stand['felder'],
            function (string $feld) use ($stand, $baum, $alleGruppen, $alleSchritte): bool {
                foreach ($baum->vorfahren($feld) as $kennung) {
                    if (in_array($kennung, $alleGruppen, true) && ! in_array($kennung, $stand['gruppen'], true)) {
                        return false;
                    }

                    if (in_array($kennung, $alleSchritte, true) && ! in_array($kennung, $stand['schritte'], true)) {
                        return false;
                    }
                }

                return true;
            },
        ));
    }

    /**
     * @param  array<int, Bedingungsregel>  $regeln
     * @param  array<string, mixed>  $antworten
     * @param  array<int, string>  $sichtbareFelder
     * @return array<int, string>
     */
    private static function pflichtBestimmen(
        FormularDefinition $definition,
        array $regeln,
        array $antworten,
        array $sichtbareFelder,
    ): array {
        $pflicht = array_map(
            fn (FormularFeld $feld): string => $feld->name,
            array_filter($definition->felder, fn (FormularFeld $feld): bool => $feld->required),
        );

        foreach ($regeln as $regel) {
            if (
                $regel->wirkung === 'require'
                && $regel->zielArt === 'field'
                && self::regelTrifftZu($regel, $antworten, $sichtbareFelder)
            ) {
                $pflicht[] = $regel->zielRef;
            }
        }

        // Nach `require`, damit `optional` gewinnt: die andere Richtung waere
        // ein Formular, das sich nicht absenden laesst.
        foreach ($regeln as $regel) {
            if (
                $regel->wirkung === 'optional'
                && $regel->zielArt === 'field'
                && self::regelTrifftZu($regel, $antworten, $sichtbareFelder)
            ) {
                $pflicht = array_filter($pflicht, fn (string $name): bool => $name !== $regel->zielRef);
            }
        }

        // Was niemand sieht, kann niemand ausfuellen.
        $pflicht = array_filter(
            $pflicht,
            fn (string $name): bool => in_array($name, $sichtbareFelder, true),
        );

        return array_values(array_unique($pflicht));
    }

    /**
     * @param  array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}  $stand
     * @return array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}
     */
    private static function entfernen(array $stand, Bedingungsregel $regel): array
    {
        $schluessel = self::schluesselFuer($regel->zielArt);

        $stand[$schluessel] = array_values(array_filter(
            $stand[$schluessel],
            fn (string $eintrag): bool => $eintrag !== $regel->zielRef,
        ));

        return $stand;
    }

    /**
     * @param  array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}  $stand
     * @return array{felder: array<int, string>, gruppen: array<int, string>, schritte: array<int, string>}
     */
    private static function hinzufuegen(array $stand, Bedingungsregel $regel): array
    {
        $schluessel = self::schluesselFuer($regel->zielArt);

        if (! in_array($regel->zielRef, $stand[$schluessel], true)) {
            $stand[$schluessel][] = $regel->zielRef;
        }

        return $stand;
    }

    private static function schluesselFuer(string $zielArt): string
    {
        return match ($zielArt) {
            'group' => 'gruppen',
            'step' => 'schritte',
            default => 'felder',
        };
    }

    /**
     * @param  array<string, mixed>  $antworten
     * @param  array<int, string>  $sichtbareFelder
     */
    private static function regelTrifftZu(
        Bedingungsregel $regel,
        array $antworten,
        array $sichtbareFelder,
    ): bool {
        if ($regel->pruefungen === []) {
            return false;
        }

        foreach ($regel->pruefungen as $pruefung) {
            $trifft = self::pruefungTrifftZu($pruefung, $antworten, $sichtbareFelder);

            if ($regel->verknuepfung === 'any' && $trifft) {
                return true;
            }

            if ($regel->verknuepfung === 'all' && ! $trifft) {
                return false;
            }
        }

        return $regel->verknuepfung === 'all';
    }

    /**
     * @param  array<string, mixed>  $antworten
     * @param  array<int, string>  $sichtbareFelder
     */
    private static function pruefungTrifftZu(
        Pruefung $pruefung,
        array $antworten,
        array $sichtbareFelder,
    ): bool {
        $wert = self::wertLesen($pruefung->feld, $antworten, $sichtbareFelder);
        $vergleich = $pruefung->wert ?? '';

        return match ($pruefung->op) {
            'is' => $wert === $vergleich,
            'is_not' => $wert !== $vergleich,
            'contains' => $vergleich !== '' && str_contains($wert, $vergleich),
            'not_contains' => $vergleich === '' || ! str_contains($wert, $vergleich),
            'filled' => $wert !== '',
            'empty' => $wert === '',
            // Nur Zahlen. Auf Text verglichen ist '10' kleiner als '9' — das
            // sieht im Editor richtig aus und liefert im Formular Ergebnisse,
            // die niemand vorhersagt.
            'gt' => is_numeric($wert) && is_numeric($vergleich) && (float) $wert > (float) $vergleich,
            'lt' => is_numeric($wert) && is_numeric($vergleich) && (float) $wert < (float) $vergleich,
            default => false,
        };
    }

    /**
     * Der Wert eines Feldes als Text — und leer, wenn das Feld verborgen ist.
     *
     * Die zweite Haelfte ist die wichtige: die Antwort eines verborgenen
     * Feldes wird verworfen. Zaehlte hier der alte Inhalt weiter mit,
     * entschieden Browser und Server verschieden darueber, was sichtbar ist.
     *
     * @param  array<string, mixed>  $antworten
     * @param  array<int, string>  $sichtbareFelder
     */
    private static function wertLesen(
        string $name,
        array $antworten,
        array $sichtbareFelder,
    ): string {
        if (! in_array($name, $sichtbareFelder, true)) {
            return '';
        }

        $roh = $antworten[$name] ?? null;

        if ($roh === null || $roh === false || $roh === '') {
            return '';
        }

        if ($roh === true) {
            return '1';
        }

        return is_scalar($roh) ? (string) $roh : '';
    }

    /**
     * Regeln, die einander im Kreis bedingen.
     *
     * Eine Kante laeuft vom geprueften Feld zum Ziel der Regel. Fuehrt vom
     * Ziel ein Weg zurueck, haengt die Regel in einem Kreis.
     *
     * Bewusst je Kante gefragt statt einmal quer durch den Graphen gelaufen:
     * eine Tiefensuche mit Merkliste findet je nach Startpunkt nur EINE der
     * beteiligten Regeln, und welche das ist, haengt an der Reihenfolge der
     * Eintraege.
     *
     * @param  array<int, Bedingungsregel>  $regeln
     * @return array<int, string>
     */
    private static function zyklenFinden(array $regeln): array
    {
        /** @var array<string, array<int, string>> $nachfolger */
        $nachfolger = [];
        /** @var array<int, array{von: string, nach: string, regel: string}> $kanten */
        $kanten = [];

        foreach ($regeln as $regel) {
            foreach ($regel->pruefungen as $pruefung) {
                $kanten[] = [
                    'von' => $pruefung->feld,
                    'nach' => $regel->zielRef,
                    'regel' => $regel->id,
                ];
                $nachfolger[$pruefung->feld][] = $regel->zielRef;
            }
        }

        $erreichbar = function (string $start, string $ziel) use ($nachfolger): bool {
            $offen = [$start];
            $gesehen = [];

            while ($offen !== []) {
                $knoten = array_pop($offen);

                if ($knoten === $ziel) {
                    return true;
                }

                if (in_array($knoten, $gesehen, true)) {
                    continue;
                }

                $gesehen[] = $knoten;

                foreach ($nachfolger[$knoten] ?? [] as $naechster) {
                    $offen[] = $naechster;
                }
            }

            return false;
        };

        $betroffen = [];

        foreach ($kanten as $kante) {
            // `von === nach`: „zeige A, wenn A gefuellt ist" — dieselbe
            // Sackgasse, nur ohne Umweg.
            if ($kante['von'] === $kante['nach'] || $erreichbar($kante['nach'], $kante['von'])) {
                $betroffen[] = $kante['regel'];
            }
        }

        $betroffen = array_values(array_unique($betroffen));
        sort($betroffen);

        return $betroffen;
    }

    /**
     * @param  array<int, string>  $a
     * @param  array<int, string>  $b
     */
    private static function gleich(array $a, array $b): bool
    {
        if (count($a) !== count($b)) {
            return false;
        }

        foreach ($a as $eintrag) {
            if (! in_array($eintrag, $b, true)) {
                return false;
            }
        }

        return true;
    }
}
