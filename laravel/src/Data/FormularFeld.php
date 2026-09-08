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
    ) {}

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

    public function istAuswahl(): bool
    {
        return in_array($this->type, ['select', 'radio'], true);
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
            'placeholder' => $this->placeholder,
            'hinweis' => $this->hinweis,
            'quelle' => $this->quelle,
        ], fn ($wert) => $wert !== null && $wert !== []);
    }
}
