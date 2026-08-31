<?php

use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Regeln\AntwortRegeln;
use Peppermint\FormBuilder\Regeln\RegelEinstellungen;

function def(array $felder): FormularDefinition
{
    return FormularDefinition::fromArray(['fields' => $felder]);
}

it('macht aus einem Pflicht-Mailfeld required und email', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'email', 'label' => 'E-Mail', 'type' => 'email', 'required' => true],
    ]));

    expect($regeln['email'])->toBe(['required', 'email', 'max:255']);
});

it('macht aus einem freiwilligen Feld nullable', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'firma', 'label' => 'Firma', 'type' => 'text'],
    ]));

    expect($regeln['firma'])->toContain('nullable');
});

it('bindet eine Auswahlliste an ihre Optionen', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'anrede', 'label' => 'Anrede', 'type' => 'select', 'options' => ['Frau', 'Herr']],
    ]));

    // Ohne diese Regel koennte jeder per manipuliertem Formular beliebige
    // Werte in die Auswertung schreiben.
    expect($regeln['anrede'])->toContain('in:Frau,Herr');
});

it('laesst den leeren Eintrag aus dem Zeilenumbruch nicht in die Regel', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'anrede', 'label' => 'Anrede', 'type' => 'select', 'options' => ['Frau', 'Herr', '']],
    ]));

    expect($regeln['anrede'])->toContain('in:Frau,Herr');
});

it('verlangt bei einem Pflicht-Ankreuzfeld die Zustimmung, nicht nur Anwesenheit', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'agb', 'label' => 'AGB', 'type' => 'checkbox', 'required' => true],
    ]));

    // `required` allein liesse '0' durchgehen — die Zustimmung waere dann
    // erteilt, ohne dass jemand geklickt hat.
    expect($regeln['agb'])->toBe(['accepted']);
});

it('erlaubt bei einem freiwilligen Ankreuzfeld nur 0 und 1', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'newsletter', 'label' => 'Newsletter', 'type' => 'checkbox'],
    ]));

    expect($regeln['newsletter'])->toBe(['nullable', 'in:0,1']);
});

it('setzt den Prefix vor jeden Schluessel', function () {
    $regeln = AntwortRegeln::fuer(
        def([['name' => 'email', 'label' => 'E-Mail', 'type' => 'email']]),
        'form_data',
    );

    expect($regeln)->toHaveKey('form_data.email');
});

it('liefert die Beschriftungen als Attributnamen', function () {
    $attribute = AntwortRegeln::attribute(
        def([['name' => 'first_name', 'label' => 'Vorname', 'type' => 'text']]),
        'form_data',
    );

    // Damit in der Meldung „Das Feld Vorname …" steht und nicht „first_name".
    expect($attribute['form_data.first_name'])->toBe('Vorname');
});

/*
|-------------------------------------------------------------------------------
| Regelschaerfe
|-------------------------------------------------------------------------------
|
| Eine Anwendung, die den Baukasten nachtraeglich uebernimmt, muss ihre
| bisherige Schaerfe abbilden koennen. Ohne das weist die Vereinheitlichung
| Eingaben ab, die gestern noch durchgingen — und niemand merkt es, bis sich
| jemand nicht anmelden kann.
|
*/

it('nimmt die Laengengrenze fuer einzeilige Texte aus den Einstellungen', function () {
    $regeln = AntwortRegeln::fuer(
        def([['name' => 'firma', 'label' => 'Firma', 'type' => 'text']]),
        '',
        new RegelEinstellungen(maxText: 1000),
    );

    expect($regeln['firma'])->toBe(['nullable', 'string', 'max:1000']);
});

it('laesst Fliesstext ohne Grenze, solange keine gesetzt ist', function () {
    $regeln = AntwortRegeln::fuer(
        def([['name' => 'anmerkung', 'label' => 'Anmerkung', 'type' => 'textarea']]),
    );

    expect($regeln['anmerkung'])->toBe(['nullable', 'string']);
});

it('setzt die Grenze fuer Fliesstext, wenn eine gesetzt ist', function () {
    $regeln = AntwortRegeln::fuer(
        def([['name' => 'anmerkung', 'label' => 'Anmerkung', 'type' => 'textarea']]),
        '',
        new RegelEinstellungen(maxFliesstext: 1000),
    );

    expect($regeln['anmerkung'])->toBe(['nullable', 'string', 'max:1000']);
});

it('laesst die Typpruefung weg, wenn sie abgeschaltet ist', function () {
    $einstellungen = new RegelEinstellungen(typpruefung: false);

    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'anzahl', 'label' => 'Anzahl', 'type' => 'number'],
        ['name' => 'anreise', 'label' => 'Anreise', 'type' => 'date'],
    ]), '', $einstellungen);

    // Auf einem gewachsenen Bestand ist jede dieser Regeln eine Verschaerfung.
    // Sie faellt getrennt und nach einer Messung, nicht nebenbei.
    expect($regeln['anzahl'])->toBe(['nullable'])
        ->and($regeln['anreise'])->toBe(['nullable']);
});

it('prueft Zahl und Datum, solange die Typpruefung an ist', function () {
    $regeln = AntwortRegeln::fuer(def([
        ['name' => 'anzahl', 'label' => 'Anzahl', 'type' => 'number'],
        ['name' => 'anreise', 'label' => 'Anreise', 'type' => 'date'],
    ]));

    expect($regeln['anzahl'])->toBe(['nullable', 'numeric'])
        ->and($regeln['anreise'])->toBe(['nullable', 'date']);
});

it('verlangt beim Pflicht-Ankreuzfeld nur Anwesenheit, wenn die Zustimmung nicht erzwungen wird', function () {
    $regeln = AntwortRegeln::fuer(
        def([['name' => 'agb', 'label' => 'AGB', 'type' => 'checkbox', 'required' => true]]),
        '',
        new RegelEinstellungen(zustimmungErzwingen: false),
    );

    // '0' geht damit durch — genau das Verhalten, das eine Anwendung mit
    // Bestand vorfindet. Es zu verschaerfen ist eine eigene Entscheidung.
    expect($regeln['agb'])->toBe(['required', 'in:0,1']);
});

it('faellt bei unvollstaendiger Konfiguration auf die strengen Vorgaben zurueck', function () {
    $einstellungen = RegelEinstellungen::ausKonfiguration(['max_text' => 1000]);

    // Eine lueckenhafte Konfiguration darf nicht stillschweigend alles
    // erlauben — nur der gesetzte Wert weicht ab.
    expect($einstellungen->maxText)->toBe(1000)
        ->and($einstellungen->maxFliesstext)->toBeNull()
        ->and($einstellungen->typpruefung)->toBeTrue()
        ->and($einstellungen->zustimmungErzwingen)->toBeTrue();
});

it('baut die Einstellungen aus der Konfiguration der Anwendung', function () {
    config()->set('form-builder.antwortregeln', [
        'max_text' => 1000,
        'max_fliesstext' => 1000,
        'typpruefung' => false,
        'zustimmung_erzwingen' => false,
    ]);

    $einstellungen = app(RegelEinstellungen::class);

    expect($einstellungen->maxText)->toBe(1000)
        ->and($einstellungen->maxFliesstext)->toBe(1000)
        ->and($einstellungen->typpruefung)->toBeFalse()
        ->and($einstellungen->zustimmungErzwingen)->toBeFalse();
});
