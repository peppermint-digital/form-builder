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

it('laesst eine Quelle durch, die der Host anbietet', function () {
    $pruefer = new DefinitionPruefer(quellen: ['order.delivery_date', 'order.project_name']);
    $neu = definition([feld('liefertermin', ['quelle' => 'order.delivery_date'])]);

    expect($pruefer->pruefen($neu))->toBe([]);
});

/**
 * Der stillste Fehler, den dieses Feld haben kann: Das Formular sieht richtig
 * aus, das Feld bleibt beim Oeffnen leer, und der Anwender haelt das fuer die
 * Absicht. Ein Tippfehler faellt sonst erst auf, wenn jemand dasselbe Datum
 * zum zwanzigsten Mal abgetippt hat.
 */
it('meldet eine Quelle, die es nicht gibt — statt sie stumm ins Leere laufen zu lassen', function () {
    $pruefer = new DefinitionPruefer(quellen: ['order.delivery_date']);
    $neu = definition([feld('liefertermin', ['quelle' => 'order.lieferdatum'])]);

    $fehler = $pruefer->pruefen($neu);

    expect($fehler)->toHaveCount(1)
        ->and($fehler[0])->toContain('order.lieferdatum')
        // Die Meldung nennt, was stattdessen zur Wahl steht — sonst faengt das
        // Raten von vorne an.
        ->and($fehler[0])->toContain('order.delivery_date');
});

it('meldet jede Vorbelegung, wenn der Host gar keine Quellen anbietet', function () {
    $neu = definition([feld('liefertermin', ['quelle' => 'order.delivery_date'])]);

    expect((new DefinitionPruefer)->pruefen($neu))->toHaveCount(1);
});

it('laesst Felder ohne Quelle in Ruhe', function () {
    $pruefer = new DefinitionPruefer(quellen: ['order.delivery_date']);

    expect($pruefer->pruefen(definition([feld('bemerkung')])))->toBe([]);
});

/**
 * Der Baukasten schickt ein geleertes Auswahlfeld als leere Zeichenkette. Ohne
 * den Schnitt in FormularFeld haette das Feld eine Quelle namens "" — und der
 * Waechter meldete einen Fehler fuer etwas, das der Anwender gerade bewusst
 * entfernt hat.
 */
it('behandelt eine geleerte Quelle wie keine', function () {
    $pruefer = new DefinitionPruefer(quellen: ['order.delivery_date']);
    $neu = definition([feld('liefertermin', ['quelle' => '  '])]);

    expect($pruefer->pruefen($neu))->toBe([])
        ->and($neu->feld('liefertermin')->quelle)->toBeNull();
});

it('traegt die Quelle durch fromArray und toArray unveraendert', function () {
    $definition = definition([feld('liefertermin', ['quelle' => 'order.delivery_date'])]);

    expect($definition->feld('liefertermin')->quelle)->toBe('order.delivery_date')
        ->and($definition->feld('liefertermin')->toArray()['quelle'])->toBe('order.delivery_date');
});

it('laesst die Quelle aus toArray weg, wenn keine gesetzt ist', function () {
    expect(definition([feld('bemerkung')])->feld('bemerkung')->toArray())
        ->not->toHaveKey('quelle');
});

/**
 * Der Waechter nuetzt nichts, wenn ihn niemand mit der Liste versorgt.
 *
 * Genau das war er zwischenzeitlich: Der Konstruktor nahm `quellen`
 * entgegen, der ServiceProvider reichte sie nicht durch, und die Pruefung
 * lief in jeder Laravel-Anwendung gegen eine leere Liste — ein eingestellter
 * Wert, den niemand abholt.
 */
it('bekommt die erlaubten Quellen aus der Konfiguration', function () {
    // Nur die Quellen-Regel isolieren: Der Prueferer aus dem Container traegt
    // sonst auch die Namensfeld-Regel, und die meldete hier zu Recht etwas
    // ganz anderes.
    config()->set('form-builder.quellen', ['order.delivery_date']);
    config()->set('form-builder.namensfelder', []);
    config()->set('form-builder.pflichtfelder', []);

    $pruefer = app(DefinitionPruefer::class);

    expect($pruefer->pruefen(definition([feld('a', ['quelle' => 'order.delivery_date'])])))->toBe([])
        ->and($pruefer->pruefen(definition([feld('b', ['quelle' => 'order.tippfehler'])])))->toHaveCount(1);
});
