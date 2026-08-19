<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Peppermint\FormBuilder\Belegung\JsonSpaltenBelegung;

beforeEach(function () {
    Schema::create('anmeldungen', function ($tabelle) {
        $tabelle->id();
        $tabelle->unsignedBigInteger('veranstaltung_id')->default(1);
        $tabelle->json('form_data')->nullable();
    });
});

/**
 * Der Test laeuft gegen SQLite — genau das ist sein Zweck.
 *
 * Die Abfrage muss ueber Laravels JSON-Notation gehen und nicht ueber rohes
 * SQL: JSON_UNQUOTE kennt nur MySQL. Ein Waechter, der nur in Produktion
 * greift, faellt in der Entwicklung nie auf und schuetzt nichts.
 */
it('zaehlt Antworten unter einem Feldnamen', function () {
    DB::table('anmeldungen')->insert([
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => '10 Uhr'])],
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => '14 Uhr'])],
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['name' => 'Ohne Termin'])],
    ]);

    $belegung = new JsonSpaltenBelegung(DB::table('anmeldungen'));

    expect($belegung->belegt(['termin']))->toBe(['termin' => 2]);
});

it('zaehlt leere Zeichenketten nicht mit', function () {
    DB::table('anmeldungen')->insert([
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => ''])],
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => '10 Uhr'])],
    ]);

    $belegung = new JsonSpaltenBelegung(DB::table('anmeldungen'));

    expect($belegung->belegt(['termin']))->toBe(['termin' => 1]);
});

it('nennt Namen ohne Treffer gar nicht', function () {
    DB::table('anmeldungen')->insert([
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['name' => 'A'])],
    ]);

    $belegung = new JsonSpaltenBelegung(DB::table('anmeldungen'));

    expect($belegung->belegt(['termin', 'hotel']))->toBe([]);
});

it('zaehlt nur innerhalb der hereingereichten Abfrage', function () {
    DB::table('anmeldungen')->insert([
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => '10 Uhr'])],
        ['veranstaltung_id' => 2, 'form_data' => json_encode(['termin' => '14 Uhr'])],
    ]);

    // Die Anwendung grenzt ein, nicht das Paket. Ohne diese Trennung wuerde
    // eine Veranstaltung das Feld einer anderen sperren.
    $belegung = new JsonSpaltenBelegung(
        DB::table('anmeldungen')->where('veranstaltung_id', 1),
    );

    expect($belegung->belegt(['termin']))->toBe(['termin' => 1]);
});

it('bleibt nach mehreren Abfragen benutzbar', function () {
    DB::table('anmeldungen')->insert([
        ['veranstaltung_id' => 1, 'form_data' => json_encode(['termin' => '10 Uhr', 'hotel' => '1'])],
    ]);

    $belegung = new JsonSpaltenBelegung(DB::table('anmeldungen'));

    // Ohne das clone in der Schleife haetten sich die where-Bedingungen
    // aufaddiert und ab dem zweiten Namen nichts mehr gefunden.
    expect($belegung->belegt(['termin', 'hotel']))->toBe(['termin' => 1, 'hotel' => 1]);
});
