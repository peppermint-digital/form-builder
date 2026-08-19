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

Die Eingabe-Elemente reicht die Anwendung hinein:

```tsx
<FormularRenderer
    definition={definition}
    komponenten={{ text: Input, select: Select, textarea: Textarea }}
/>
```

Der Grund ist praktisch: shadcn ist kopierter Code, kein Paket — `@/components/ui/select`
ist ein Anwendungs-Alias, den ein npm-Paket gar nicht auflösen kann. Und Radix
als peerDependency würde Vue-Anwendungen dauerhaft ausschließen. So bleibt der
Kern framework-agnostisch.

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

## Stand

**v0.1** — Kern (Definition, Layout, Optionen) mit Tests, Laravel-Gerüst.
Renderer, Editor und die Wächter folgen.
