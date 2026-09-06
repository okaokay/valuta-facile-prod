// Piccolo registro per condividere `buildCapBasedValuation` (definita in
// server/index.js, che ha bisogno di restare l'entrypoint dell'app Express)
// con i moduli di generazione report (report.ts/payment.ts) SENZA creare un
// import circolare: index.js importa già quelle route, quindi quelle route
// non possono importare a loro volta direttamente da index.js.
//
// index.js registra la funzione una sola volta all'avvio (subito dopo averla
// definita), ben prima che arrivi qualunque richiesta HTTP; i moduli che ne
// hanno bisogno la recuperano qui al momento dell'uso.
let _buildCapBasedValuation = null

export function registerValuationEngine(fn) {
  _buildCapBasedValuation = fn
}

export function getValuationEngine() {
  return _buildCapBasedValuation
}
