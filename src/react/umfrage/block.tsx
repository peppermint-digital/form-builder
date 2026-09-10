import { useState } from 'react';

import {
    rahmenAendern,
    rahmenEntfernen,
    regelnFuerZiel,
    type FormularDefinition,
    type FormularFeld,
} from '../../core';
import Bedingungen from './bedingungen';
import type { Woerter } from './fragekarte';

interface Props {
    definition: FormularDefinition;
    id: string;
    title: string | undefined;
    /** Alle Felder VOR dem Block. */
    vorgaenger: FormularFeld[];
    woerter: Woerter;
    onChange: (definition: FormularDefinition) => void;
    children: React.ReactNode;
}

/**
 * Ein Block — mehrere Fragen unter EINER Bedingung.
 *
 * Der Grund, warum es ihn im gefuehrten Aufbau gibt: „Wenn Nein, dann zeige
 * diese vier Fragen" laesst sich auch mit vier Regeln bauen. Aber das ist
 * viermal dieselbe Arbeit, und beim naechsten Umbau vergisst jemand eine davon
 * — dann taucht eine Frage auf, die niemand mehr erwartet.
 *
 * Ein Block ist DARSTELLUNG und traegt keine Antwort. Loest man ihn auf,
 * bleiben die Fragen; was wegfaellt, sind die Regeln, die auf ihn zeigten.
 * Genau das steht auch am Knopf, damit niemand „Aufloesen" mit „Loeschen"
 * verwechselt.
 */
export default function Block({
    definition,
    id,
    title,
    vorgaenger,
    woerter,
    onChange,
    children,
}: Props) {
    const [logikOffen, setLogikOffen] = useState(false);
    const regeln = regelnFuerZiel(definition, 'group', id);

    return (
        <section className="pm-fb-block">
            <header className="pm-fb-block__kopf">
                <input
                    className="pm-fb-eingabe pm-fb-block__titel"
                    value={title ?? ''}
                    placeholder="Block ohne Titel"
                    aria-label="Titel des Blocks"
                    onChange={(e) =>
                        onChange(rahmenAendern(definition, id, { title: e.target.value }))
                    }
                />

                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    aria-expanded={logikOffen}
                    onClick={() => setLogikOffen(!logikOffen)}
                >
                    Wann zeigen?
                    {regeln.length > 0 && ` (${regeln.length})`}
                </button>

                {/*
                    „Auflösen" und nicht „Löschen": Die Fragen bleiben, nur die
                    Klammer fällt weg. Ein Block ist Darstellung, eine Frage ist
                    ein Datenschlüssel, unter dem Antworten liegen.
                */}
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    onClick={() => onChange(rahmenEntfernen(definition, id))}
                >
                    Block auflösen ({woerter.mehrzahl} bleiben)
                </button>
            </header>

            {logikOffen && (
                <Bedingungen
                    definition={definition}
                    ziel={{ kind: 'group', ref: id }}
                    vorgaenger={vorgaenger}
                    woerter={woerter}
                    was="Block"
                    onChange={onChange}
                />
            )}

            <div className="pm-fb-block__inhalt">{children}</div>
        </section>
    );
}
