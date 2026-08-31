<?php

namespace Peppermint\FormBuilder\Regeln;

/**
 * Wie streng die abgeleiteten Antwort-Regeln sein sollen.
 *
 * Diese Klasse existiert nicht aus Geschmacksgruenden. Sie existiert, weil
 * eine Anwendung, die den Baukasten NACHTRAEGLICH uebernimmt, einen gewachsenen
 * Bestand mitbringt: Formulare, die seit Monaten laufen, und Leute, die sich
 * gerade jetzt darueber anmelden.
 *
 * Jede Regel, die schaerfer ist als das, was die Anwendung bisher akzeptiert
 * hat, weist ab diesem Moment Eingaben ab, die gestern noch durchgingen — und
 * zwar ohne dass jemand es bemerkt, bis sich jemand nicht anmelden kann. Eine
 * Verschaerfung ist deshalb kein Nebeneffekt einer Vereinheitlichung, sondern
 * eine eigene Entscheidung mit eigener Messung.
 *
 * Die Vorgabewerte hier sind die STRENGEN. Wer den Baukasten neu einsetzt,
 * bekommt sie geschenkt. Wer ihn nachtraeglich uebernimmt, stellt sie zuerst
 * auf seinen Bestand und zieht sie danach einzeln nach.
 */
class RegelEinstellungen
{
    /**
     * @param  int  $maxText  Laengengrenze fuer einzeilige Texte (text, tel, email).
     * @param  int|null  $maxFliesstext  Laengengrenze fuer textarea. `null` heisst
     *                                   unbegrenzt — die Datenbankspalte ist die
     *                                   einzige Grenze.
     * @param  bool  $typpruefung  Prueft `number` als Zahl und `date` als Datum.
     *                             Auf einem Bestand ist das eine Verschaerfung:
     *                             was einmal als Text abgelegt wurde, faellt
     *                             beim naechsten Absenden durch.
     * @param  bool  $zustimmungErzwingen  Ein Pflicht-Ankreuzfeld muss angekreuzt
     *                                     sein (`accepted`), nicht nur vorhanden.
     *                                     `required` allein laesst '0' durch — die
     *                                     Zustimmung waere erteilt, ohne dass
     *                                     jemand geklickt hat.
     */
    public function __construct(
        public readonly int $maxText = 255,
        public readonly ?int $maxFliesstext = null,
        public readonly bool $typpruefung = true,
        public readonly bool $zustimmungErzwingen = true,
    ) {}

    /**
     * Aus dem `antwortregeln`-Block der Konfiguration.
     *
     * Fehlende Schluessel fallen auf die strengen Vorgaben zurueck. Das ist
     * Absicht: eine unvollstaendige Konfiguration soll nicht stillschweigend
     * alles erlauben.
     *
     * @param  array<string, mixed>  $konfiguration
     */
    public static function ausKonfiguration(array $konfiguration): self
    {
        $maxFliesstext = $konfiguration['max_fliesstext'] ?? null;

        return new self(
            maxText: (int) ($konfiguration['max_text'] ?? 255),
            maxFliesstext: is_numeric($maxFliesstext) ? (int) $maxFliesstext : null,
            typpruefung: (bool) ($konfiguration['typpruefung'] ?? true),
            zustimmungErzwingen: (bool) ($konfiguration['zustimmung_erzwingen'] ?? true),
        );
    }
}
