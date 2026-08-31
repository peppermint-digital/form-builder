<?php

use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Regeln\Sichtbarkeit;

/**
 * Derselbe Prueffallsatz wie auf der TypeScript-Seite.
 *
 * Die Sichtbarkeit wird zweimal entschieden: im Browser, damit das Formular
 * die richtigen Felder zeigt, und hier, damit der Server die richtigen
 * verlangt und die uebrigen wegwirft. Zwei Umsetzungen derselben Regel laufen
 * auseinander — und der Unterschied faellt nicht beim Programmieren auf,
 * sondern dann, wenn jemand ein Formular nicht abschicken kann.
 *
 * Deshalb liegen die Faelle als JSON neben beiden Sprachen. Wer eine Regel
 * aendert, aendert die Datei mit — oder derselbe Fall wird in beiden Sprachen
 * rot.
 */
function prueffaelle(): array
{
    $ordner = __DIR__.'/../../faelle/sichtbarkeit';
    $faelle = [];

    foreach (glob($ordner.'/*.json') ?: [] as $pfad) {
        $inhalt = json_decode((string) file_get_contents($pfad), true);
        $faelle[basename($pfad)] = [$inhalt];
    }

    return $faelle;
}

it('findet den gemeinsamen Prueffallordner', function () {
    // Ein leerer Ordner liesse die ganze Datei gruen durchlaufen, ohne dass
    // eine einzige Regel geprueft waere.
    expect(count(prueffaelle()))->toBeGreaterThan(10);
});

it('entscheidet wie die TypeScript-Seite', function (array $fall) {
    $ergebnis = Sichtbarkeit::fuer(
        FormularDefinition::fromArray($fall['definition']),
        $fall['werte'],
    );

    expect(sortiert($ergebnis->sichtbareFelder))
        ->toBe($fall['erwartet']['sichtbareFelder'], $fall['warum']);

    expect(sortiert($ergebnis->pflichtFelder))
        ->toBe($fall['erwartet']['pflichtFelder'], $fall['warum']);

    expect(sortiert($ergebnis->sichtbareGruppen))
        ->toBe($fall['erwartet']['sichtbareGruppen'], $fall['warum']);

    expect(sortiert($ergebnis->sichtbareSchritte))
        ->toBe($fall['erwartet']['sichtbareSchritte'], $fall['warum']);

    expect(sortiert($ergebnis->zyklen))
        ->toBe($fall['erwartet']['zyklen'], $fall['warum']);
})->with(prueffaelle());

function sortiert(array $werte): array
{
    $kopie = array_values($werte);
    sort($kopie);

    return $kopie;
}
