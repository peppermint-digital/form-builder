import { Handle, Position, type NodeProps } from '@xyflow/react';

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
}

export function GruppeKnoten({ data, selected }: NodeProps) {
    const daten = data as RahmenKnotenDaten;

    return (
        <div
            className={`pm-fb-rahmen pm-fb-rahmen--gruppe${
                selected ? ' pm-fb-rahmen--gewaehlt' : ''
            }`}
        >
            <Handle type="target" position={Position.Left} />
            <div className="pm-fb-rahmen__titel">{daten.titel}</div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}

export function SchrittKnoten({ data, selected }: NodeProps) {
    const daten = data as RahmenKnotenDaten;

    return (
        <div
            className={`pm-fb-rahmen pm-fb-rahmen--schritt${
                selected ? ' pm-fb-rahmen--gewaehlt' : ''
            }`}
        >
            <Handle type="target" position={Position.Left} />
            <div className="pm-fb-rahmen__titel">{daten.titel}</div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}

export const KNOTENARTEN = {
    feld: FeldKnoten,
    gruppe: GruppeKnoten,
    schritt: SchrittKnoten,
};
