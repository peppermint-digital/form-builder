export type Knotenart = 'feld' | 'gruppe' | 'schritt' | 'regel';

/**
 * Die Kennung eines Knotens im Graphen.
 *
 * Mit Praefix, und das ist keine Kosmetik: Feldnamen, Gruppen-, Schritt- und
 * Regelkennungen leben in GETRENNTEN Namensraeumen. Ein Feld namens `g1` und
 * eine Gruppe `g1` sind zwei verschiedene Dinge — ohne Praefix waeren sie im
 * Graphen ein einziger Knoten, und eine Kante traefe das Falsche.
 *
 * Aus demselben Grund traegt `Bedingungsziel` im Kern seine `kind`-Angabe.
 */
export function knotenId(art: Knotenart, ref: string): string {
    return `${art}:${ref}`;
}

export function knotenRef(id: string): { art: Knotenart; ref: string } | null {
    const trenner = id.indexOf(':');

    if (trenner < 1) {
        return null;
    }

    const art = id.slice(0, trenner);
    const ref = id.slice(trenner + 1);

    if (ref === '' || !['feld', 'gruppe', 'schritt', 'regel'].includes(art)) {
        return null;
    }

    return { art: art as Knotenart, ref };
}

/** Die Zielart, wie der Kern sie kennt — `regel` ist dort kein Ziel. */
export function zielArtVon(art: Knotenart): 'field' | 'group' | 'step' | null {
    switch (art) {
        case 'feld':
            return 'field';
        case 'gruppe':
            return 'group';
        case 'schritt':
            return 'step';
        default:
            return null;
    }
}

/**
 * Die naechste freie Kennung der Form `praefixN`.
 *
 * Bewusst nicht `laenge + 1` und bewusst kein Zufall: nach dem Loeschen einer
 * Regel traefe das Hochzaehlen eine bereits vergebene Kennung, und ein
 * Zufallswert macht jeden Test unlesbar und jede Definition unvergleichbar.
 */
export function naechsteKennung(vergeben: string[], praefix: string): string {
    let nummer = vergeben.length + 1;

    while (vergeben.includes(`${praefix}${nummer}`)) {
        nummer++;
    }

    return `${praefix}${nummer}`;
}
