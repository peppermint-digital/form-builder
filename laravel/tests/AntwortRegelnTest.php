<?php

use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Regeln\AntwortRegeln;

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
