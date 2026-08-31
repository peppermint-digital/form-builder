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

    /*
    |---------------------------------------------------------------------------
    | Antwort-Regeln
    |---------------------------------------------------------------------------
    |
    | Wie streng die aus der Definition abgeleiteten Validierungsregeln sein
    | sollen. Die Vorgaben hier sind die STRENGEN — richtig fuer jede Anwendung,
    | die den Baukasten von Anfang an einsetzt.
    |
    | Wer ihn nachtraeglich uebernimmt, hat einen Bestand: Formulare, die
    | laufen, und Leute, die sich gerade darueber anmelden. Jede Regel, die
    | schaerfer ist als das, was die Anwendung bisher akzeptiert hat, weist ab
    | sofort Eingaben ab, die gestern durchgingen — und das faellt niemandem
    | auf, bis sich jemand nicht anmelden kann.
    |
    | Deshalb: erst auf den eigenen Bestand stellen, dann einzeln nachziehen —
    | und vor jedem Nachziehen messen, wie viele bestehende Antworten die
    | schaerfere Regel treffen wuerde.
    |
    */

    'antwortregeln' => [

        // Laengengrenze fuer einzeilige Texte (text, tel, email).
        'max_text' => 255,

        // Laengengrenze fuer mehrzeilige Texte (textarea). `null` heisst
        // unbegrenzt — dann ist die Datenbankspalte die einzige Grenze.
        'max_fliesstext' => null,

        // `number` als Zahl und `date` als Datum pruefen.
        'typpruefung' => true,

        // Ein Pflicht-Ankreuzfeld muss angekreuzt sein, nicht nur vorhanden.
        // Ohne das gilt eine Zustimmung als erteilt, die niemand geklickt hat.
        'zustimmung_erzwingen' => true,

    ],

];
