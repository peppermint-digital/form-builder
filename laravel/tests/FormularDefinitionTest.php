<?php

use Peppermint\FormBuilder\Data\FormularDefinition;

it('nimmt das Objekt mit fields an', function () {
    $definition = FormularDefinition::fromArray([
        'fields' => [['name' => 'email', 'label' => 'E-Mail', 'type' => 'email']],
    ]);

    expect($definition->feldnamen())->toBe(['email']);
});

it('nimmt die nackte Feldliste aelterer Bestaende an', function () {
    $definition = FormularDefinition::fromArray([
        ['name' => 'email', 'label' => 'E-Mail', 'type' => 'email'],
    ]);

    expect($definition->feldnamen())->toBe(['email']);
});

it('macht aus null eine leere Definition statt zu werfen', function () {
    expect(FormularDefinition::fromArray(null)->istLeer())->toBeTrue();
    expect(FormularDefinition::fromArray('kaputt')->istLeer())->toBeTrue();
});

it('verwirft Eintraege ohne Namen — sie haetten keinen Datenschluessel', function () {
    $definition = FormularDefinition::fromArray([
        'fields' => [['name' => 'email'], ['label' => 'ohne Namen']],
    ]);

    expect($definition->feldnamen())->toBe(['email']);
});

it('nimmt das Label als Rueckfall fuer eine fehlende Beschriftung', function () {
    $definition = FormularDefinition::fromArray(['fields' => [['name' => 'email']]]);

    expect($definition->feld('email')?->label)->toBe('email');
});

it('bereinigt Optionen beim Lesen', function () {
    $definition = FormularDefinition::fromArray([
        'fields' => [[
            'name' => 'anrede',
            'type' => 'select',
            'options' => [' Frau ', 'Frau', '', 'Herr'],
        ]],
    ]);

    expect($definition->feld('anrede')?->optionen())->toBe(['Frau', 'Herr']);
});

it('behaelt das Layout', function () {
    $definition = FormularDefinition::fromArray([
        'fields' => [['name' => 'a'], ['name' => 'b']],
        'layout' => [['type' => 'row', 'columns' => [['a'], ['b']]]],
    ]);

    expect($definition->layout)->toHaveCount(1)
        ->and($definition->toArray())->toHaveKey('layout');
});
