<?php

namespace Peppermint\FormBuilder\Data;

/**
 * Eine vollstaendige Formular-Definition.
 *
 * Nimmt alle Bestandsformen an: das Objekt mit `fields`, die nackte Feldliste
 * aelterer Fassungen, und `null`. Wer das an jeder Stelle einzeln abfaengt,
 * vergisst es an einer — und genau die faellt dann leer aus, ohne Fehler.
 */
class FormularDefinition
{
    /**
     * @param  array<int, FormularFeld>  $felder
     * @param  array<int, array<string, mixed>>  $layout
     */
    public function __construct(
        public readonly array $felder = [],
        public readonly array $layout = [],
    ) {}

    public static function fromArray(mixed $roh): self
    {
        if (! is_array($roh)) {
            return new self;
        }

        $rohfelder = $roh['fields'] ?? $roh;
        $layout = $roh['layout'] ?? [];

        if (! is_array($rohfelder)) {
            return new self;
        }

        $felder = [];

        foreach ($rohfelder as $rohfeld) {
            if (! is_array($rohfeld)) {
                continue;
            }

            $feld = FormularFeld::fromArray($rohfeld);

            if ($feld instanceof FormularFeld) {
                $felder[] = $feld;
            }
        }

        return new self(
            felder: $felder,
            layout: is_array($layout) ? $layout : [],
        );
    }

    /**
     * @return array<int, string>
     */
    public function feldnamen(): array
    {
        return array_map(fn (FormularFeld $feld): string => $feld->name, $this->felder);
    }

    public function feld(string $name): ?FormularFeld
    {
        foreach ($this->felder as $feld) {
            if ($feld->name === $name) {
                return $feld;
            }
        }

        return null;
    }

    public function hatFeld(string $name): bool
    {
        return $this->feld($name) instanceof FormularFeld;
    }

    public function istLeer(): bool
    {
        return $this->felder === [];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $definition = [
            'fields' => array_map(fn (FormularFeld $feld): array => $feld->toArray(), $this->felder),
        ];

        if ($this->layout !== []) {
            $definition['layout'] = $this->layout;
        }

        return $definition;
    }
}
