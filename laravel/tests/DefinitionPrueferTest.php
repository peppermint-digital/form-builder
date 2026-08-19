<?php

use Peppermint\FormBuilder\Contracts\BelegteFeldnamen;
use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Regeln\DefinitionPruefer;

function definition(array $felder, array $layout = []): FormularDefinition
{
    return FormularDefinition::fromArray(['fields' => $felder, 'layout' => $layout]);
}

function feld(string $name, array $rest = []): array
{
    return array_merge(['name' => $name, 'label' => $name, 'type' => 'text'], $rest);
}

/** Eine Belegung, die vorgibt, welche Namen Daten tragen. */
function belegungMit(array $treffer): BelegteFeldnamen
{
    return new class($treffer) implements BelegteFeldnamen
    {
        public function __construct(private array $treffer) {}

        public function belegt(array $feldnamen): array
        {
            return array_intersect_key($this->treffer, array_flip($feldnamen));
        }
    };
}

it('laesst eine Definition durch, die alles erfuellt', function () {
    $pruefer = new DefinitionPruefer(
        pflichtfelder: ['email' => ['type' => 'email']],
        namensfelder: ['name'],
    );

    $fehler = $pruefer->pruefen(definition([
        feld('email', ['type' => 'email']),
        feld('name'),
    ]));

    expect($fehler)->toBe([]);
});

it('verlangt das konfigurierte Pflichtfeld', function () {
    $pruefer = new DefinitionPruefer(
        pflichtfelder: ['email' => ['type' => 'email', 'begruendung' => 'Sonst keine Mail.']],
    );

    $fehler = $pruefer->pruefen(definition([feld('name')]));

    expect($fehler)->toHaveCount(1)
        ->and($fehler[0])->toContain('email')
        ->and($fehler[0])->toContain('Sonst keine Mail.');
});

it('besteht auf dem richtigen Typ — ein Textfeld namens email liesse alles durch', function () {
    $pruefer = new DefinitionPruefer(pflichtfelder: ['email' => ['type' => 'email']]);

    $fehler = $pruefer->pruefen(definition([feld('email', ['type' => 'text'])]));

    expect($fehler)->toHaveCount(1)
        ->and($fehler[0])->toContain('muss vom Typ „email" sein');
});

it('verlangt irgendein Namensfeld aus der Liste', function () {
    $pruefer = new DefinitionPruefer(namensfelder: ['name', 'vorname', 'first_name']);

    expect($pruefer->pruefen(definition([feld('vorname')])))->toBe([]);
    expect($pruefer->pruefen(definition([feld('strasse')])))->toHaveCount(1);
});

it('erkennt das Namensfeld unabhaengig von der Gross-/Kleinschreibung', function () {
    $pruefer = new DefinitionPruefer(namensfelder: ['vorname']);

    expect($pruefer->pruefen(definition([feld('Vorname')])))->toBe([]);
});

it('weist doppelte Feldnamen ab — sie ueberschreiben sich gegenseitig', function () {
    $fehler = (new DefinitionPruefer)->pruefen(definition([feld('email'), feld('email')]));

    expect($fehler)->toHaveCount(1)
        ->and($fehler[0])->toContain('mehrfach');
});

it('sperrt das Entfernen eines Feldes, unter dem Daten liegen', function () {
    $bisher = definition([feld('name'), feld('termin')]);
    $neu = definition([feld('name')]);

    $fehler = (new DefinitionPruefer)->pruefen($neu, $bisher, belegungMit(['termin' => 429]));

    expect($fehler)->toHaveCount(1)
        ->and($fehler[0])->toContain('termin')
        ->and($fehler[0])->toContain('429');
});

it('sperrt auch das Umbenennen — fuer die Daten ist das dasselbe', function () {
    $bisher = definition([feld('termin')]);
    $neu = definition([feld('zeitpunkt')]);

    $fehler = (new DefinitionPruefer)->pruefen($neu, $bisher, belegungMit(['termin' => 3]));

    expect($fehler)->toHaveCount(1);
});

it('laesst das Entfernen zu, solange keine Daten daran haengen', function () {
    $bisher = definition([feld('name'), feld('termin')]);
    $neu = definition([feld('name')]);

    expect((new DefinitionPruefer)->pruefen($neu, $bisher, belegungMit([])))->toBe([]);
});

it('laesst die Beschriftung frei aendern', function () {
    $bisher = definition([feld('termin', ['label' => 'Termin'])]);
    $neu = definition([feld('termin', ['label' => 'Wunschtermin'])]);

    expect((new DefinitionPruefer)->pruefen($neu, $bisher, belegungMit(['termin' => 429])))->toBe([]);
});

it('prueft ein leeres Formular nicht — es ist noch keine Aussage', function () {
    $pruefer = new DefinitionPruefer(pflichtfelder: ['email' => ['type' => 'email']]);

    expect($pruefer->pruefen(definition([])))->toBe([]);
});
