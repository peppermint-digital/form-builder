<?php

namespace Peppermint\FormBuilder\Data;

/**
 * Ein einzelnes Feld einer Formular-Definition.
 *
 * `name` ist der Datenschluessel — unter ihm liegt die Antwort. `label` ist
 * nur Beschriftung. Die Trennung ist der Grund, warum sich die Beschriftung
 * jederzeit aendern laesst und der Name nicht.
 */
class FormularFeld
{
    /**
     * @param  array<int, string>  $options
     */
    public function __construct(
        public readonly string $name,
        public readonly string $label,
        public readonly string $type,
        public readonly bool $required = false,
        public readonly array $options = [],
        public readonly ?string $placeholder = null,
        public readonly ?string $hinweis = null,
        /**
         * Woher das Feld beim Oeffnen vorbelegt wird — ein Pfad in die Daten
         * des Hosts, etwa `order.delivery_date`.
         *
         * Nur eine VORBELEGUNG, keine Bindung: Der Wert wird beim Oeffnen
         * eingesetzt und danach wie jede andere Antwort gespeichert. Wer ihn
         * ueberschreibt, behaelt seine Aenderung — auch wenn sich die Quelle
         * spaeter aendert.
         *
         * Das ist der Unterschied zu einem Platzhalter im Druck, und er ist
         * beabsichtigt: Ein ausgedrucktes Formular soll den Stand vom
         * Druckzeitpunkt zeigen, nicht den von heute.
         */
        public readonly ?string $quelle = null,
        /**
         * Nur fuer `scale`: wie viele Stufen die Skala hat.
         *
         * Steht hier und nicht in `options`, weil die Stufen KEINE frei
         * getippten Werte sind — sie sind 1 bis n. Eine Skala als Optionsliste
         * abzulegen hiesse, dass jemand sie umbenennen kann, und dann rechnet
         * die Auswertung einen Durchschnitt ueber Text.
         */
        public readonly int $stufen = self::STUFEN_VORGABE,
    ) {}

    /** Fuenf Stufen, wenn nichts anderes dasteht. */
    public const STUFEN_VORGABE = 5;

    /**
     * Weniger als zwei Stufen ist keine Skala, mehr als elf liest niemand mehr
     * — und elf ist genau das Fenster, das ein NPS braucht (0 bis 10).
     */
    public const STUFEN_MIN = 2;

    public const STUFEN_MAX = 11;

    /**
     * @param  array<string, mixed>  $roh
     */
    public static function fromArray(array $roh): ?self
    {
        $name = $roh['name'] ?? null;

        // Ein Feld ohne Namen hat keinen Datenschluessel. Es waere ein
        // Eingabefeld, dessen Inhalt beim Speichern verschwindet.
        if (! is_string($name) || $name === '') {
            return null;
        }

        $options = $roh['options'] ?? [];

        return new self(
            name: $name,
            label: is_string($roh['label'] ?? null) ? $roh['label'] : $name,
            type: is_string($roh['type'] ?? null) ? $roh['type'] : 'text',
            required: ($roh['required'] ?? false) === true,
            options: is_array($options) ? array_values(array_filter($options, 'is_string')) : [],
            placeholder: is_string($roh['placeholder'] ?? null) ? $roh['placeholder'] : null,
            hinweis: is_string($roh['hinweis'] ?? null) ? $roh['hinweis'] : null,
            quelle: self::quelleAus($roh['quelle'] ?? null),
            stufen: self::stufenAus($roh['stufen'] ?? null),
        );
    }

    /**
     * Eine leere Quelle ist keine Quelle.
     *
     * Der Baukasten schickt ein geleertes Auswahlfeld als leere Zeichenkette,
     * nicht als `null`. Ohne diesen Schnitt haette ein Feld eine Quelle namens
     * "" — und die Vorbelegung suchte danach still ins Leere.
     */
    private static function quelleAus(mixed $wert): ?string
    {
        $quelle = is_string($wert) ? trim($wert) : '';

        return $quelle === '' ? null : $quelle;
    }

    /**
     * Die auswaehlbaren Werte, benutzbar gemacht.
     *
     * Der Baukasten speichert Optionen als Zeilen eines Textfeldes. Ein
     * abschliessender Zeilenumbruch — beim Tippen der Normalfall — erzeugt
     * einen LEEREN Eintrag. Im Browser bringt der die Auswahlliste zum
     * Absturz; hier sorgt er dafuer, dass eine abgeleitete `in:`-Regel einen
     * leeren Wert erlaubt.
     *
     * @return array<int, string>
     */
    public function optionen(): array
    {
        $sauber = [];

        foreach ($this->options as $option) {
            $wert = trim($option);

            if ($wert !== '' && ! in_array($wert, $sauber, true)) {
                $sauber[] = $wert;
            }
        }

        return $sauber;
    }

    /**
     * Eine gespeicherte Stufenzahl, in die Schranken gewiesen.
     *
     * Der Wert kommt aus einer JSON-Spalte und damit von aussen. Ohne
     * Begrenzung erzeugte `stufen: 5000` eine `in:`-Regel mit 5000 Eintraegen
     * — die Validierung liefe, die Fehlermeldung waere unlesbar, und im
     * Browser stuenden 5000 Knoepfe.
     */
    private static function stufenAus(mixed $wert): int
    {
        if (! is_int($wert) && ! (is_string($wert) && ctype_digit($wert))) {
            return self::STUFEN_VORGABE;
        }

        return max(self::STUFEN_MIN, min(self::STUFEN_MAX, (int) $wert));
    }

    /** Genau eine Antwort aus einer Liste. */
    public function istAuswahl(): bool
    {
        return in_array($this->type, ['select', 'radio'], true);
    }

    /**
     * Mehrere Antworten aus einer Liste — der Wert ist ein Array.
     *
     * Bewusst NICHT Teil von `istAuswahl()`: Dort haengt die `in:`-Regel
     * dran, und die gehoert bei einer Mehrfachauswahl an die EINTRAEGE
     * (`feld.*`), nicht an das Feld. Eine `in:`-Regel auf einem Array trifft
     * nie zu — die Anmeldung waere ab dem ersten Kreuz nicht mehr absendbar.
     */
    public function istMehrfachauswahl(): bool
    {
        return $this->type === 'checkboxes';
    }

    /**
     * Die zulaessigen Stufen einer Skala, als Zeichenketten.
     *
     * Zeichenketten, weil die Antworten als JSON neben lauter Texten liegen —
     * dieselbe Regel wie beim Ankreuzfeld ('1'/'0'). `gt`/`lt` rechnen
     * trotzdem richtig, die vergleichen ueber `Number`/`(float)`.
     *
     * @return array<int, string>
     */
    public function stufenwerte(): array
    {
        // Ein NPS hat feste Werte. Sie kommen NICHT aus `stufen` — sonst
        // koennte jemand im Baukasten eine Sieben-Punkte-Skala daraus machen,
        // und die Auswertung rechnete weiter mit den NPS-Schwellen.
        if ($this->type === 'nps') {
            return array_map('strval', range(0, 10));
        }

        return array_map('strval', range(1, $this->stufen));
    }

    /**
     * Ob dieses Feld nach der NPS-Vorschrift ausgewertet wird.
     *
     * Promotor ist 9–10, Detraktor 0–6, dazwischen zaehlt niemand. Der Wert
     * ist Promotoren minus Detraktoren in Prozentpunkten — eine Zahl zwischen
     * -100 und +100, und keine Note.
     */
    public function istNps(): bool
    {
        return $this->type === 'nps';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return array_filter([
            'name' => $this->name,
            'label' => $this->label,
            'type' => $this->type,
            'required' => $this->required,
            'options' => $this->optionen(),
            'stufen' => $this->type === 'scale' ? $this->stufen : null,
            'placeholder' => $this->placeholder,
            'hinweis' => $this->hinweis,
            'quelle' => $this->quelle,
        ], fn ($wert) => $wert !== null && $wert !== []);
    }
}
