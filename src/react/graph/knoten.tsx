import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';

/**
 * Die drei Knotenarten des Graphen.
 *
 * Sie zeichnen bewusst schlicht und mit eigenen Klassen statt mit einer
 * Bibliothek — dieselbe Entscheidung wie beim Renderer: das Paket bringt
 * keine UI-Bibliothek mit, und eine Anwendung soll ihr Aussehen ueber
 * `styles.css` oder eigene Regeln setzen koennen.
 */

export interface FeldKnotenDaten extends Record<string, unknown> {
    titel: string;
    feldTyp: string;
    pflicht: boolean;
    /** Gesetzt, wenn der Datenschluessel gesperrt ist — mit der Begruendung. */
    gesperrt?: string;
}

export function FeldKnoten({ data, selected }: NodeProps) {
    const daten = data as FeldKnotenDaten;

    return (
        <div
            className={`pm-fb-knoten pm-fb-knoten--feld${
                selected ? ' pm-fb-knoten--gewaehlt' : ''
            }`}
        >
            {/*
                Beide Anschluesse sitzen an jedem Feldknoten, auch wenn noch
                keine Kante daran haengt: ein Anschluss, der erst beim
                Verbinden erscheint, laesst sich nicht treffen.
            */}
            <Handle type="target" position={Position.Left} />

            <div className="pm-fb-knoten__titel">
                {daten.titel}
                {daten.pflicht && (
                    <span className="pm-fb-knoten__pflicht" aria-hidden="true">
                        {' *'}
                    </span>
                )}
            </div>

            <div className="pm-fb-knoten__zeile">
                <span className="pm-fb-knoten__typ">{daten.feldTyp}</span>
                {daten.gesperrt && (
                    <span className="pm-fb-knoten__sperre" title={daten.gesperrt}>
                        gesperrt
                    </span>
                )}
            </div>

            <Handle type="source" position={Position.Right} />
        </div>
    );
}

export interface RahmenKnotenDaten extends Record<string, unknown> {
    titel: string;
    /**
     * Wie klein der Rahmen hoechstens werden darf.
     *
     * Das umschliessende Rechteck seines Inhalts. Ohne die Grenze zieht man
     * ihn kleiner als seine eigenen Felder, und die liegen dann sichtbar
     * daneben.
     */
    mindestBreite: number;
    mindestHoehe: number;
}

function Rahmen({
    data,
    selected,
    art,
}: NodeProps & { art: 'gruppe' | 'schritt' }) {
    const daten = data as RahmenKnotenDaten;

    return (
        <div
            className={`pm-fb-rahmen pm-fb-rahmen--${art}${
                selected ? ' pm-fb-rahmen--gewaehlt' : ''
            }`}
        >
            {/*
                Die Griffe erscheinen erst bei Auswahl: dauerhaft sichtbar
                liegen sie ueber den Feldern am Rand und fangen deren Klicks
                ab.
            */}
            <NodeResizer
                isVisible={selected}
                minWidth={daten.mindestBreite}
                minHeight={daten.mindestHoehe}
            />
            <Handle type="target" position={Position.Left} />
            <div className="pm-fb-rahmen__titel">{daten.titel}</div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}

export function GruppeKnoten(props: NodeProps) {
    return <Rahmen {...props} art="gruppe" />;
}

export function SchrittKnoten(props: NodeProps) {
    return <Rahmen {...props} art="schritt" />;
}

export interface RegelKnotenDaten extends Record<string, unknown> {
    titel: string;
    imKreis: boolean;
    entfernen: () => void;
}

/**
 * Eine Bedingung als eigener Knoten.
 *
 * Nicht als blosse Kante, weil eine Regel mehrere Pruefungen haben kann: sie
 * muessen sichtbar an EINER Stelle zusammenlaufen. Als Kanten waere „A und B,
 * dann zeige C" nicht von „A oder B" zu unterscheiden.
 */
export function RegelKnoten({ data, selected }: NodeProps) {
    const daten = data as RegelKnotenDaten;

    return (
        <div
            className={`pm-fb-knoten pm-fb-knoten--regel${
                selected ? ' pm-fb-knoten--gewaehlt' : ''
            }${daten.imKreis ? ' pm-fb-knoten--kreis' : ''}`}
        >
            <Handle type="target" position={Position.Left} />

            <div className="pm-fb-knoten__zeile">
                <span className="pm-fb-knoten__titel">{daten.titel}</span>
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--gefahr"
                    onClick={daten.entfernen}
                >
                    Löschen
                </button>
            </div>

            {daten.imKreis && (
                <div className="pm-fb-knoten__warnung">
                    Hängt im Kreis — wird nicht angewendet
                </div>
            )}

            <Handle type="source" position={Position.Right} />
        </div>
    );
}

export const KNOTENARTEN = {
    feld: FeldKnoten,
    gruppe: GruppeKnoten,
    schritt: SchrittKnoten,
    regel: RegelKnoten,
};
