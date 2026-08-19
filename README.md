# @peppermint-digital/form-builder

Baukasten für **Formular-Definitionen** — für Laravel-Anwendungen mit React
(Vue folgt). Das Paket besteht aus zwei Teilen:

| Manifest | Paket | Inhalt |
|---|---|---|
| `package.json` | `@peppermint-digital/form-builder` | Editor und Renderer |
| `composer.json` | `peppermint/form-builder` | Wächter, Validierungsregeln, Installations-Command |

## Was dieses Paket anders macht

Ein Formular ist kein Dokument. Beim Mail-Builder und beim Dokument-Builder ist
das Ergebnis **Darstellung** — hier ist es ein **Datenvertrag**: unter
`feld.name` liegt die Antwort, und an diesem Schlüssel hängen Mailversand,
Listen, Auswertungen und Exporte der einbindenden Anwendung.

Deshalb ist der Baukasten kein HTML-Editor. Gespeichert wird eine Definition:

```ts
{
  fields: [ { name: 'email', label: 'E-Mail', type: 'email', required: true } ],
  layout: [ { type: 'row', columns: [['first_name'], ['last_name']] } ]
}
```

`fields` ist der Vertrag, `layout` ist die Darstellung. Spalten verweisen nur
auf Namen und enthalten die Felder nicht — ein Layout darf man wegwerfen und
neu bauen, ohne dass eine einzige gespeicherte Antwort ihren Platz verliert.

**`layout` ist optional.** Fehlt es, wird einspaltig in der Reihenfolge von
`fields` gerendert. Bestandsformulare laufen dadurch ohne Migration weiter.

## Es bringt keine UI-Bibliothek mit

```tsx
import { FormularRenderer } from '@peppermint-digital/form-builder/react';
import '@peppermint-digital/form-builder/styles.css';

<FormularRenderer
    definition={event.form_config}
    werte={data}
    onChange={(name, wert) => setData(name, wert)}
    fehler={errors}
/>
```

So funktioniert es sofort — mit schlichten, nativen Elementen. Wer sein eigenes
Aussehen will, reicht Bausteine herein:

```tsx
<FormularRenderer
    …
    komponenten={{
        Text: ({ wert, onChange, ...rest }) => (
            <Input {...rest} value={wert} onChange={(e) => onChange(e.target.value)} />
        ),
        Auswahl: ({ wert, optionen, onChange, id, placeholder }) => (
            <Select value={wert} onValueChange={onChange}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder={placeholder || 'Bitte wählen'} />
                </SelectTrigger>
                <SelectContent>
                    {optionen.map((o) => (
                        <SelectItem key={o.wert} value={o.wert}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        ),
    }}
/>
```

Der Grund ist praktisch: shadcn ist kopierter Code, kein Paket — `@/components/ui/select`
ist ein Anwendungs-Alias, den ein npm-Paket gar nicht auflösen kann. Und Radix
als peerDependency würde Vue-Anwendungen dauerhaft ausschließen. So bleibt der
Kern framework-agnostisch.

Wichtig an dieser Aufteilung: der Adapter zeichnet nur. **Was** er zeichnet,
entscheidet weiter das Paket — welche Optionen es gibt, ob ein Bestandswert
ergänzt werden muss, wie die `id` heißt. Sonst läge diese Logik in jeder
Anwendung noch einmal, und in jeder ein bisschen anders.

## Eigene Feldtypen

Fachliches gehört in die Anwendung, nicht in ein Paket, das mehrere Produkte
benutzen:

```tsx
<FormularRenderer
    …
    eigeneTypen={{
        hotel_booking: { komponente: HotelBuchung, labelImFeld: true },
    }}
/>
```

`labelImFeld` sagt, dass dieser Typ seine Beschriftung selbst zeichnet — dann
lässt der Renderer das äußere Label weg, sonst stünde es doppelt.

## Vier Regeln, die im Kern sitzen

Sie stehen hier und nicht in den Anwendungen, weil jede von ihnen gegen einen
Ausfall gerichtet ist, den man erst im Browser oder gar nicht sieht:

1. **Kein Layout** → einspaltig, Reihenfolge von `fields`.
2. **Feld ohne Platz im Layout** → hinten anhängen. Ein Feld darf nie
   unsichtbar werden, nur weil das Layout es nicht kennt.
3. **Verweis auf ein gelöschtes Feld** → überspringen.
4. **Derselbe Name mehrfach** → nur einmal rendern. Zwei Eingaben auf denselben
   Schlüssel überschreiben sich gegenseitig, und welche gewinnt, wäre Zufall.

Dazu `nutzbareOptionen()`: trimmt Optionslisten, verwirft Leeres, fasst
Doppeltes zusammen. Ein leerer Eintrag — beim Tippen durch den abschließenden
Zeilenumbruch der Normalfall — bringt Radix zum Werfen und damit die ganze
Seite.

## Installation

```bash
npm install github:peppermint-digital/form-builder
composer require peppermint/form-builder
php artisan form-builder:install
```

Ein `github:`-Eintrag friert im `package-lock.json` einen konkreten Commit ein.
Ein Push ins Paket-Repo erreicht die Anwendungen **nicht** von selbst — dort
muss `npm install @peppermint-digital/form-builder` laufen und die Lockfile-
Änderung mitcommittet werden.

## Der Editor

```tsx
import { FormularEditor } from '@peppermint-digital/form-builder/react';

<FormularEditor
    definition={event.form_config}
    onChange={(definition) => setData('form_config', definition)}
    gesperrteNamen={feldnamenMitDaten}
    zusatzTypen={[{ wert: 'hotel_booking', label: 'Hotelbuchung' }]}
/>
```

Felder werden gezogen — auf eine Ablagestelle **neben** einem Feld wird die
Zeile zweispaltig, auf eine **zwischen** den Zeilen entsteht eine neue. Mehr
als drei Spalten nimmt eine Zeile nicht an.

**Jede Bewegung geht zusätzlich über Schaltflächen.** Das ist kein Zusatz,
sondern die Bedingung dafür, dass der Baukasten ohne Maus bedienbar bleibt:
freies Ziehen und Ablegen ist mit der Tastatur kaum zu treffen.

`gesperrteNamen` zeigt im Editor dieselbe Regel, die der Wächter auf der
Serverseite durchsetzt — das erspart den Fehlschlag beim Speichern.

Vor dem Absenden bereinigen:

```ts
import { definitionBereinigen } from '@peppermint-digital/form-builder/core';

put(url, { form_config: definitionBereinigen(definition) });
```

## Die Laravel-Seite: Wächter über dem Datenvertrag

Ein Formular ist gleichzeitig eine Oberfläche, die man frei gestalten können
soll, und ein Datenvertrag, den man nicht brechen darf. Die Wächter
verteidigen das zweite gegen das erste.

```php
use Peppermint\FormBuilder\Belegung\JsonSpaltenBelegung;
use Peppermint\FormBuilder\Data\FormularDefinition;
use Peppermint\FormBuilder\Regeln\DefinitionPruefer;

$fehler = app(DefinitionPruefer::class)->pruefen(
    neu: FormularDefinition::fromArray($request->input('form_config')),
    bisher: FormularDefinition::fromArray($event->form_config),
    belegung: new JsonSpaltenBelegung(
        Registration::where('event_id', $event->id)->toBase(),
    ),
);
```

Geprüft wird:

1. **Konfigurierte Pflichtfelder** — samt Typ. Ein Textfeld namens `email`
   ließe jede Eingabe durch, und die Bestätigungsmail ginge an eine
   Zeichenkette, die keine Adresse ist.
2. **Ein Feld, das den Datensatz benennt** — aus einer Liste erlaubter Namen.
3. **Keine doppelten Feldnamen** — zwei Felder mit demselben Namen
   überschreiben sich, und welches gewinnt, wäre Zufall.
4. **Die Waisen-Sperre**: ein Schlüssel, unter dem bereits Antworten liegen,
   lässt sich nicht mehr umbenennen oder entfernen.

Zu Punkt 4 gehört eine Geschichte. Am 18.08.2026 wurde in Peppermint Connect
das Feld „Termin" aus einem Formular entfernt — danach lagen **429 Werte ohne
Ziel** in der Datenbank. Sichtbar war nichts: Listen zeigten Lücken, Ausdrucke
blieben leer, und es fiel erst auf, als jemand nachsah.

Bewusst eine **Sperre** und kein Mitziehen der Daten: Antworten mitwandern zu
lassen hieße, dass jedes Speichern des Formulars stillschweigend alle
Datensätze umschreibt — eine schwere Nebenwirkung an einer Stelle, an der
niemand sie erwartet. Die **Beschriftung** bleibt frei änderbar; genau dafür
ist die Trennung von `name` und `label` da.

### Validierungsregeln ableiten

```php
$request->validate(
    AntwortRegeln::fuer($definition, 'form_data'),
    attributes: AntwortRegeln::attribute($definition, 'form_data'),
);
```

Zwei Quellen für dieselbe Aussage laufen immer auseinander. Welche von beiden
gilt, merkt man erst, wenn jemand etwas abschickt, das nicht hätte durchgehen
dürfen — deshalb kommen die Regeln aus der Definition selbst.

Ein Detail, das leicht übersehen wird: ein **Pflicht-Ankreuzfeld** bekommt
`accepted`, nicht `required`. Mit `required` ginge `'0'` durch — die
Zustimmung wäre erteilt, ohne dass jemand geklickt hat.

## Der Bestandswert, den man nicht wegwerfen darf

Ein gespeicherter Wert, der nicht mehr zur Auswahl steht, bleibt sichtbar —
gekennzeichnet mit *(nicht mehr zur Auswahl)*. Ohne diese Regel zeigt die Maske
ein leeres Feld, und das nächste Speichern wirft den Wert stillschweigend weg.
Es fällt niemandem auf: die Maske sieht aus, als wäre dort nie etwas gewesen.

Vorkommen in der Praxis: Angaben aus einem CSV-Import und Optionen, die nach
der Anmeldung umbenannt wurden.

## Stand

**v0.1** — vollständig für React: Kern (Definition, Layout, Bearbeitung),
Renderer, Editor mit Drag & Drop und die Laravel-Seite mit den vier Wächtern.
**92 Tests** — 61 mit vitest, 31 mit Pest.

Ein Vue-Adapter folgt. Der Kern ist framework-agnostisch, das ist dann nur
noch die Zeichenschicht.
