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
        /** @var array<int, Bedingungsregel> */
        public readonly array $bedingungen = [],
        /** @var array<int, array<string, mixed>> */
        public readonly array $flow = [],
        /** @var array<string, mixed> */
        public readonly array $graph = [],
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

        $bedingungen = [];

        foreach (is_array($roh['conditions'] ?? null) ? $roh['conditions'] : [] as $roheRegel) {
            if (! is_array($roheRegel)) {
                continue;
            }

            $regel = Bedingungsregel::fromArray($roheRegel);

            if ($regel instanceof Bedingungsregel) {
                $bedingungen[] = $regel;
            }
        }

        return new self(
            felder: $felder,
            layout: is_array($layout) ? $layout : [],
            bedingungen: $bedingungen,
            flow: is_array($roh['flow'] ?? null) ? $roh['flow'] : [],
            graph: is_array($roh['graph'] ?? null) ? $roh['graph'] : [],
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

        // Durchreichen und nicht weglassen: sonst verliert jeder Weg, der
        // ueber diese Darstellung zurueckschreibt, die Bedingungen — und ein
        // Formular ohne Bedingungen sieht aus wie eines, bei dem nie welche
        // eingestellt waren.
        if ($this->bedingungen !== []) {
            $definition['conditions'] = array_map(
                fn (Bedingungsregel $regel): array => $regel->toArray(),
                $this->bedingungen,
            );
        }

        if ($this->flow !== []) {
            $definition['flow'] = $this->flow;
        }

        if ($this->graph !== []) {
            $definition['graph'] = $this->graph;
        }

        return $definition;
    }
}
