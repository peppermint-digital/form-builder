<?php

return [

    /*
    |---------------------------------------------------------------------------
    | Pflichtfelder
    |---------------------------------------------------------------------------
    |
    | Feldnamen, ohne die ein Formular nicht gespeichert werden darf — je mit
    | dem Typ, den sie haben muessen, und dem Satz, der erklaert, was ohne sie
    | kaputtgeht.
    |
    | Der Typ ist nicht schmueckendes Beiwerk: ein Textfeld namens `email`
    | liesse jede Eingabe durch, und die Bestaetigungsmail ginge an eine
    | Zeichenkette, die keine Adresse ist. `Mail::to(null)` schweigt dabei.
    |
    */

    'pflichtfelder' => [
        // 'email' => [
        //     'type' => 'email',
        //     'begruendung' => 'Ohne dieses Feld bekommt niemand eine Bestätigungsmail, '
        //         .'und doppelte Anmeldungen werden nicht erkannt.',
        // ],
    ],

    /*
    |---------------------------------------------------------------------------
    | Namensfelder
    |---------------------------------------------------------------------------
    |
    | Mindestens einer dieser Namen muss vorkommen, sonst steht in jeder Liste
    | und auf jedem Namensschild ein Strich.
    |
    | Die Liste muss sich mit dem decken, was die Anwendung beim LESEN als Namen
    | akzeptiert. Ist der Vertrag hier enger, laesst sich ein Bestandsformular
    | ueberhaupt nicht mehr speichern — und die Seite sagt nicht, warum.
    |
    */

    'namensfelder' => [
        'name',
        'first_name',
        'last_name',
        'vorname',
        'nachname',
    ],

    /*
    |---------------------------------------------------------------------------
    | Eigene Feldtypen
    |---------------------------------------------------------------------------
    |
    | Typen, die nur dieses Produkt kennt (Connect: `hotel_booking`). Sie
    | gehoeren hierher und nicht in den Kern des Pakets — sonst wandert die
    | Fachlichkeit eines Produkts in ein Paket, das alle benutzen.
    |
    */

    'eigene_feldtypen' => [],

];
