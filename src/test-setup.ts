/**
 * Was jsdom fehlt und React Flow braucht.
 *
 * React Flow misst seine Zeichenflaeche ueber `ResizeObserver` und rechnet
 * Koordinaten mit `DOMMatrixReadOnly` um. jsdom kennt beides nicht, und ohne
 * Ersatz wirft schon das erste Rendern — der Editor waere damit ungetestet.
 *
 * Die Stubs messen nichts Echtes. Sie reichen genau so weit, dass sich
 * pruefen laesst, WELCHE Knoten entstehen — nicht, wo sie auf dem Bildschirm
 * landen. Das gehoert ohnehin vor ein echtes Auge.
 */
class ResizeObserverStub {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
}

class DOMMatrixReadOnlyStub {
    m22 = 1;

    constructor(_transform?: string) {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as never;
globalThis.DOMMatrixReadOnly ??= DOMMatrixReadOnlyStub as never;

Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: { get: () => 400, configurable: true },
    offsetWidth: { get: () => 800, configurable: true },
});

globalThis.SVGElement.prototype.getBBox ??= (() => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
})) as never;
