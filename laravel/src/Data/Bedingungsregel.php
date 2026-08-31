<?php

namespace Peppermint\FormBuilder\Data;

/**
 * Eine Sichtbarkeits- oder Pflichtregel.
 *
 * Anders als beim Layout wird hier streng gefiltert. Beim Layout waere das
 * falsch — dort liegt ein gewachsener Bestand, und eine zu enge Pruefung
 * raeumte bestehende Formulare leer. Bedingungen sind neu: es gibt keinen
 * Bestand, den Strenge treffen koennte. Eine HALBE Regel dagegen ist
 * gefaehrlich, denn sie entscheidet ueber Sichtbarkeit, und was sie bei
 * fehlenden Angaben tut, waere Zufall.
 */
class Bedingungsregel
{
    public const ZIELARTEN = ['field', 'group', 'step'];

    public const WIRKUNGEN = ['show', 'hide', 'require', 'optional'];

    public function __construct(
        public readonly string $id,
        /** `field` zeigt auf `feld.name`, `group`/`step` auf deren `id`. */
        public readonly string $zielArt,
        public readonly string $zielRef,
        public readonly string $wirkung,
        /** `all` = alle Pruefungen (UND), `any` = mindestens eine (ODER). */
        public readonly string $verknuepfung,
        /** @var array<int, Pruefung> */
        public readonly array $pruefungen,
    ) {}

    /**
     * @param  array<string, mixed>  $roh
     */
    public static function fromArray(array $roh): ?self
    {
        $id = $roh['id'] ?? null;
        $ziel = $roh['target'] ?? null;
        $wirkung = $roh['effect'] ?? null;
        $verknuepfung = $roh['match'] ?? null;
        $rohePruefungen = $roh['tests'] ?? null;

        if (! is_string($id) || $id === '') {
            return null;
        }

        if (! is_array($ziel)) {
            return null;
        }

        $art = $ziel['kind'] ?? null;
        $ref = $ziel['ref'] ?? null;

        if (! is_string($art) || ! in_array($art, self::ZIELARTEN, true)) {
            return null;
        }

        if (! is_string($ref) || $ref === '') {
            return null;
        }

        if (! is_string($wirkung) || ! in_array($wirkung, self::WIRKUNGEN, true)) {
            return null;
        }

        if (! in_array($verknuepfung, ['all', 'any'], true)) {
            return null;
        }

        if (! is_array($rohePruefungen) || $rohePruefungen === []) {
            return null;
        }

        $pruefungen = [];

        foreach ($rohePruefungen as $rohePruefung) {
            if (! is_array($rohePruefung)) {
                return null;
            }

            $pruefung = Pruefung::fromArray($rohePruefung);

            // Eine Regel, von der eine Pruefung fehlt, ist eine ANDERE Regel.
            // Sie halb anzuwenden waere schlimmer, als sie wegzulassen.
            if (! $pruefung instanceof Pruefung) {
                return null;
            }

            $pruefungen[] = $pruefung;
        }

        return new self(
            id: $id,
            zielArt: $art,
            zielRef: $ref,
            wirkung: $wirkung,
            verknuepfung: $verknuepfung,
            pruefungen: $pruefungen,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'target' => ['kind' => $this->zielArt, 'ref' => $this->zielRef],
            'effect' => $this->wirkung,
            'match' => $this->verknuepfung,
            'tests' => array_map(fn (Pruefung $p): array => $p->toArray(), $this->pruefungen),
        ];
    }
}
