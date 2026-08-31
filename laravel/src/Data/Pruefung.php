<?php

namespace Peppermint\FormBuilder\Data;

/**
 * Eine einzelne Pruefung innerhalb einer Bedingung.
 *
 * Die Gegenstelle steht in `src/core/types.ts`. Beide muessen dasselbe
 * bedeuten — die gemeinsamen Prueffaelle unter `faelle/sichtbarkeit/` sind
 * die Stelle, an der das nachgehalten wird.
 */
class Pruefung
{
    public const VERGLEICHE = [
        'is',
        'is_not',
        'contains',
        'not_contains',
        'filled',
        'empty',
        'gt',
        'lt',
    ];

    public function __construct(
        /** Der DATENSCHLUESSEL des geprueften Feldes (`feld.name`). */
        public readonly string $feld,
        public readonly string $op,
        /** Fehlt bei `filled` und `empty` — dort gibt es nichts zu vergleichen. */
        public readonly ?string $wert = null,
    ) {}

    /**
     * @param  array<string, mixed>  $roh
     */
    public static function fromArray(array $roh): ?self
    {
        $feld = $roh['field'] ?? null;
        $op = $roh['op'] ?? null;

        if (! is_string($feld) || $feld === '') {
            return null;
        }

        if (! is_string($op) || ! in_array($op, self::VERGLEICHE, true)) {
            return null;
        }

        $wert = $roh['value'] ?? null;

        return new self(
            feld: $feld,
            op: $op,
            wert: is_scalar($wert) ? (string) $wert : null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return array_filter([
            'field' => $this->feld,
            'op' => $this->op,
            'value' => $this->wert,
        ], fn ($wert) => $wert !== null);
    }
}
