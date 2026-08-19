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

## Der Bestandswert, den man nicht wegwerfen darf

Ein gespeicherter Wert, der nicht mehr zur Auswahl steht, bleibt sichtbar —
gekennzeichnet mit *(nicht mehr zur Auswahl)*. Ohne diese Regel zeigt die Maske
ein leeres Feld, und das nächste Speichern wirft den Wert stillschweigend weg.
Es fällt niemandem auf: die Maske sieht aus, als wäre dort nie etwas gewesen.

Vorkommen in der Praxis: Angaben aus einem CSV-Import und Optionen, die nach
der Anmeldung umbenannt wurden.

## Stand

**v0.1** — Kern (Definition, Layout, Optionen, Bestandswerte) und React-Schicht
(Renderer, Feld-Eingabe, Slot-Verträge, schlichte Standard-Bausteine), 31 Tests.
Laravel-Gerüst steht, die Wächter folgen. Editor und Vue-Adapter folgen.
