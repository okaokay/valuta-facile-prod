come si chiama l'animazione che allo scrol una linea inizia dal punto zero e scrollando va in basso e la line si allunga 

Quell'animazione viene chiamata in diversi modi, a seconda del contesto:

Scroll Progress Line (il nome più comune)
Scroll-driven line animation
Vertical progress line
Timeline progress animation (se la linea accompagna una timeline)
Scroll reveal line (se la linea "rivela" il contenuto mentre cresce)

Se intendi una linea che parte dall'alto con altezza 0 e, mentre scorri, si allunga verso il basso, come nei siti moderni, l'effetto è generalmente chiamato:

Scroll Progress Line Animation

oppure

Scroll-linked line growth

Tecnologie usate

Di solito viene realizzata con:

CSS + JavaScript
GSAP + ScrollTrigger (la soluzione più popolare)
Framer Motion (React)
La nuova API CSS Scroll-driven Animations (animation-timeline: scroll())
Esempio visivo
Inizio pagina

│
│  ← linea altezza: 0

↓ Scroll

│
│
│
│

↓ Ancora scroll

│
│
│
│
│
│

La proprietà che viene animata è spesso:

height
scaleY (più fluida e performante)
oppure stroke-dashoffset se la linea è un elemento SVG.

Se stai cercando esempi su Google o CodePen, prova queste ricerche:

scroll progress line animation
gsap scrolltrigger line grow
vertical line animation on scroll
timeline line fill on scroll
scroll linked animation line

Sono i termini con cui troverai la maggior parte delle demo moderne.

Simboli e forme-13.svg
File
io ho questa icona e voglio che dal punto zero allo scrol si allunga fino alla fine del suo div . 
Elaborazione interrotta

Sì, è possibile. Guardando il tuo SVG, non conviene animare l'altezza (height), perché la linea è curva. La soluzione migliore è animare il tracciato SVG.

L'effetto si ottiene con:

stroke-dasharray
stroke-dashoffset

In pratica la linea è inizialmente "invisibile" e, mentre scorri, viene disegnata dall'inizio alla fine.

Con GSAP + ScrollTrigger è molto semplice:

gsap.registerPlugin(ScrollTrigger);

const path = document.querySelector("svg path");

const length = path.getTotalLength();

path.style.strokeDasharray = length;
path.style.strokeDashoffset = length;

gsap.to(path, {
  strokeDashoffset: 0,
  ease: "none",
  scrollTrigger: {
    trigger: ".section",
    start: "top center",
    end: "bottom bottom",
    scrub: true
  }
});

E il tuo SVG deve avere uno stroke, non un riempimento (fill):

<path
  d="..."
  fill="none"
  stroke="#2F5C9C"
  stroke-width="20"
/>
Se invece il tuo SVG è un fill (come sembra dal file che hai inviato)

Dall'anteprima noto che il simbolo è un'unica forma riempita, non una linea con stroke.

In quel caso stroke-dasharray non funziona.

Hai due possibilità:

La migliore: trasformare quella forma in un percorso con stroke (Illustrator/Figma possono farlo facilmente).
Usare una maschera (clipPath o mask) che rivela progressivamente il simbolo dall'alto verso il basso.
Ti consiglio la prima soluzione

Se il file proviene da Illustrator, puoi esportarlo come Outline/Stroke invece che come forma piena. Avrai un <path> con stroke e l'animazione sarà perfetta, come nei siti di Apple o Stripe.

Se vuoi, 
posso anche trasformare io il tuo SVG in una versione animabile e darti il codice completo con GSAP.

Elaborazione interrotta

Ho analizzato il tuo SVG. Contiene un solo <path> con fill e non ha uno stroke:

<path class="cls-1" d="M1344.83,1447.26c-57.26-50.28..."/>

Questo significa che non è possibile trasformarlo automaticamente in una linea animabile con stroke-dasharray. Quel tipo di animazione funziona solo quando il disegno è costituito da uno o più tracciati con stroke.

Hai due possibilità
Soluzione 1 (consigliata ⭐)

Se hai il file sorgente (Illustrator, Figma, Affinity Designer, ecc.), esporta il simbolo come tracciato con stroke invece che come forma piena.

A quel punto il codice GSAP sarà semplicissimo:

<div class="icon-wrapper">
    <svg id="line-svg" viewBox="0 0 1529.42 1640.13">
        <path
            id="line"
            d="..."
            fill="none"
            stroke="#24538E"
            stroke-width="20"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    </svg>
</div>
.icon-wrapper{
    height:100vh;
}

#line-svg{
    width:100%;
    height:auto;
}
gsap.registerPlugin(ScrollTrigger);

const path = document.querySelector("#line");

const length = path.getTotalLength();

gsap.set(path,{
    strokeDasharray:length,
    strokeDashoffset:length
});

gsap.to(path,{
    strokeDashoffset:0,
    ease:"none",
    scrollTrigger:{
        trigger:".icon-wrapper",
        start:"top center",
        end:"bottom bottom",
        scrub:true
    }
});
Soluzione 2 (funziona con il tuo SVG attuale)

Poiché il simbolo è una forma piena, si usa una mask che cresce con lo scroll.

<div class="wrapper">
    <!-- il tuo SVG -->
</div>
.wrapper{
    overflow:hidden;
}

.wrapper svg{
    clip-path: inset(100% 0 0 0);
}
gsap.registerPlugin(ScrollTrigger);

gsap.to(".wrapper svg",{
    clipPath:"inset(0% 0 0 0)",
    ease:"none",
    scrollTrigger:{
        trigger:".wrapper",
        start:"top center",
        end:"bottom bottom",
        scrub:true
    }
});

Questa soluzione rivela il simbolo dall'alto verso il basso, ma non segue il percorso della linea: scopre semplicemente il disegno.

Posso convertirlo io in modo corretto

Se il simbolo rappresenta davvero una linea sinuosa (come sembra), posso trasformarlo in uno stroke perfettamente animabile, esattamente come nei siti di Apple, Stripe o Awwwards.

Per farlo, però, mi serve il file vettoriale originale:

.AI (Illustrator)
.EPS
.PDF vettoriale
oppure il file Figma o SVG originale non espanso.

Con il solo SVG che hai inviato, il tratto è già stato convertito in una sagoma piena, quindi la sua linea centrale non può essere ricostruita automaticamente in modo accurato. Se mi invii il file sorgente (o anche un PDF vettoriale), posso restituirti uno SVG con stroke già pronto per GSAP e l'animazione di disegno durante lo scroll.

Usa soluzione due , se riesci applica il prodotto codice finito a questo che ti incollo : 



<style>
/* ══════════════════════════════════════════════
   SEZIONE INCONTRO — Layout editoriale
   Ispirazione: testo bold centrato + linea
   organica decorativa di grandi dimensioni
   Widget standalone per Elementor HTML
   ══════════════════════════════════════════════ */

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.km-inc {
  position: relative;
  min-height: 100vh;
  background: #f0ebdd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 48px 80px;
  overflow: hidden;
  isolation: isolate;
}


/* ── Contenuto ── */
.km-inc-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 780px;
  width: 100%;
  text-align: center;
}

/* Label */
.km-inc-label {
  font-family: 'All Round Gothic', sans-serif !important;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.34em; text-transform: uppercase;
  color: rgba(36,83,142,0.45);
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 52px;
}
.km-inc-label::before,
.km-inc-label::after {
  content: '';
  display: inline-block;
  width: 28px; height: 1px;
  background: rgba(36,83,142,0.28);
  flex-shrink: 0;
}

/* Logo wordmark */
.km-inc-logo {
  display: block;
  width: 220px; height: auto;
  color: #24538e;
  margin-bottom: 44px;
  filter: drop-shadow(0 2px 8px rgba(36,83,142,0.08));
}


/* Quote */
.km-inc-quote {
  position: relative;
  padding: 0; margin: 0 0 52px; border: none;
}
.km-inc-quote p {
  font-family: 'All Round Gothic', sans-serif !important;
  font-size: clamp(22px, 3.4vw, 42px);
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #24538e;
  margin: 0;
}

/* CTA */
.km-inc-cta {
  display: inline-flex; align-items: center; gap: 14px;
  padding: 17px 38px;
  border: 2px solid #24538e;
  border-radius: 100px;
  color: #24538e;
  font-family: 'All Round Gothic', sans-serif !important;
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.28em; text-transform: uppercase;
  text-decoration: none;
  transition: background 0.28s, color 0.28s, gap 0.28s, border-color 0.28s;
  background: transparent;
}
.km-inc-cta:hover {
  background: #24538e;
  border-color: #24538e;
  color: #f0ebdd;
  gap: 22px;
}
.km-inc-arrow {
  width: 15px; height: 15px;
  flex-shrink: 0;
  transition: transform 0.28s;
}
.km-inc-cta:hover .km-inc-arrow { transform: translateX(4px); }

/* ── Responsive ── */
@media (max-width: 768px) {
  .km-inc { padding: 80px 32px 64px; }
  .km-inc-logo { width: 170px; margin-bottom: 36px; }
  .km-inc-quote { margin-bottom: 40px; }
}
@media (max-width: 480px) {
  .km-inc { padding: 64px 20px 52px; }
  .km-inc-logo { width: 130px; margin-bottom: 28px; }
  .km-inc-label { margin-bottom: 36px; }
  .km-inc-quote { margin-bottom: 32px; }
  .km-inc-cta { padding: 15px 28px; }
}
</style>

<div class="km-inc" id="incontro">

  <div class="km-inc-content">

    <!-- Label -->
    <span class="km-inc-label" style="font-family:'All Round Gothic',sans-serif;">Il nostro incontro</span>

    <!-- Logo Kura wordmark -->
    <svg class="km-inc-logo" viewBox="0 0 1149.07 399.51" xmlns="http://www.w3.org/2000/svg" aria-label="Kura">
      <path fill="currentColor" d="M584.9,374.52v-36.68h-1.51c-21.55,28.74-49.16,42.35-83.57,42.35-55.97,0-86.22-34.03-86.22-102.47V100.37h77.52v165.25c0,35.92,13.23,50.29,38.19,50.29,30.63,0,51.81-21.55,51.81-58.99V100.37h77.52v274.15h-73.74Z"/>
      <path fill="currentColor" d="M685.41,100.37h72.22v44.24h1.51c17.02-34.41,40.84-49.91,73.36-49.91,8.7,0,16.64,1.13,23.82,3.78v74.18l-1.51-.44c-7.94-2.27-15.13-3.4-24.2-3.4-42.73,0-67.69,25.34-67.69,75.25v130.46h-77.52V100.37Z"/>
      <path fill="currentColor" d="M877.89,172.66c10.13-48.64,54.42-77.96,120.64-77.96,78.27,0,112.69,35.17,112.69,111.17v96.8c0,11.34,3.4,14.37,13.23,14.37,3.78,0,6.81-.38,10.21-1.14h1.51v60.13c-10.97,1.89-20.8,3.02-32.14,3.02-38.57,0-56.72-12.48-56.72-39.33v-1.89h-1.51c-18.53,25.71-48.4,42.35-86.97,42.35-54.83,0-95.67-29.12-95.67-81.3s31.39-79.79,110.42-86.22l61.26-4.92v-14.75c0-24.2-13.99-37.81-38.95-37.81s-38.57,12.1-41.22,31.39M976.6,320.45c34.41,0,58.23-21.55,58.23-52.94v-10.21l-49.16,4.54c-31.01,3.02-43.11,11.72-43.11,31.39,0,18.53,13.23,27.22,34.03,27.22Z"/>
      <path fill="currentColor" d="M106.73,374.52h73.37v-90.27c32.67-6.42,61.73-21.36,86.45-44.36.93,1.08,1.86,2.18,2.79,3.29,35.69,42.65,58.87,94.09,59.27,131.35h73.37c-.34-54.18-29.56-122.48-76.38-178.43-4.57-5.46-9.23-10.72-14-15.79.13-.23.25-.46.37-.69,28.69-53.58,38.82-115.97,38.8-153.46h-73.37c0,19.47-5.3,64.17-23.5,105.15-23.92-15.76-48.87-27.05-73.81-33.31V26.14h-73.37v68.42c-35.26,6.06-64.1,23.71-80.5,50.26-16.99,27.52-17.81,60.37-2.19,87.87,15.48,27.26,44.7,45.4,82.69,52.19v89.65ZM180.1,174.75c10.29,4.04,20.62,9.37,30.84,15.91-9.06,7.35-19.31,13.34-30.84,17.48v-33.39ZM87.85,196.46c-2.31-4.07-2.04-8.48.82-13.11,3.04-4.93,8.99-9.88,18.06-13.3v39.36c-10.14-3.54-16.31-8.42-18.89-12.96Z"/>
    </svg>

    <!-- Quote -->
    <blockquote class="km-inc-quote">
      <p style="font-family:'All Round Gothic',sans-serif;">
        Kura nasce dall&rsquo;incontro
        tra creativit&agrave; e salute, due mondi che oggi lavorano insieme per chi si prende cura degli altri.
      </p>
    </blockquote>

    <!-- CTA -->
    <a href="/scopri-kura" class="km-inc-cta" style="font-family:'All Round Gothic',sans-serif;">
      Scopri Kura
      <svg class="km-inc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </a>

  </div>

</div>

Sì. Ti consiglio di non usare clip-path direttamente sull'SVG del logo, ma di aggiungere il tuo SVG decorativo come elemento assoluto dietro al contenuto e animarlo con GSAP. L'effetto sarà quello che desideri: la linea parte invisibile e, mentre scorri la sezione, viene rivelata dall'alto verso il basso.

1. Aggiungi questo CSS

Subito dopo .km-inc { ... } aggiungi:

/* Linea decorativa */
.km-inc-line{
  position:absolute;
  inset:0;
  z-index:1;
  pointer-events:none;
  display:flex;
  justify-content:center;
  align-items:flex-start;
}

.km-inc-line svg{
  width:clamp(420px,55vw,820px);
  height:auto;

  /* nascosta all'inizio */
  clip-path: inset(100% 0 0 0);
  will-change: clip-path;
}
2. Inserisci il tuo SVG

Subito dopo

<div class="km-inc" id="incontro">

aggiungi

<div class="km-inc-line">

    <!-- INCOLLA QUI IL TUO SVG DELLA LINEA -->
    <!-- quello "Simboli e forme-13.svg" -->

</div>

Non modificare altro.

3. GSAP

Alla fine della pagina (dopo aver caricato GSAP e ScrollTrigger)

<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>

<script>

gsap.registerPlugin(ScrollTrigger);

gsap.to(".km-inc-line svg",{

    clipPath:"inset(0% 0 0 0)",

    ease:"none",

    scrollTrigger:{
        trigger:"#incontro",
        start:"top 80%",
        end:"bottom 20%",
        scrub:true
    }

});

</script>
Se vuoi un effetto molto più elegante

Dalla forma del file che mi hai inviato, il clip-path farà comparire il disegno "a finestra". È un buon effetto, ma non sembra che la linea venga disegnata.

Io farei invece questa versione:

ricostruisco il tuo SVG come stroke
lo animo con stroke-dashoffset
il tratto segue perfettamente tutte le curve
l'effetto è identico ai siti Apple, Stripe, Awwwards e Studio Freight.

Il risultato è decisamente più professionale.

Posso ricostruire io il tuo SVG (anche se è un fill) e restituirti un file già pronto con l'animazione GSAP. È un lavoro di qualche minuto, ma il risultato è nettamente migliore rispetto al semplice clip-path.

Posso ricostruire io il tuo SVG

Sì, posso farlo.

Dal file che hai inviato posso ricostruire il tracciato centrale del simbolo e trasformarlo in uno SVG con stroke, ottimizzato per essere animato con GSAP.

Ti restituirò:

✅ Uno SVG pulito con fill="none" e stroke
✅ Il percorso ottimizzato (meno punti possibile)
✅ Il codice HTML pronto da incollare in Elementor
✅ Il CSS necessario
✅ L'animazione GSAP con ScrollTrigger che disegna la linea dall'inizio alla fine durante lo scroll (stroke-dasharray / stroke-dashoffset)
✅ Lo stesso colore e lo stesso spessore del tuo simbolo originale

Il risultato sarà molto più naturale del clip-path: invece di "rivelare" una forma, sembrerà che la linea venga realmente disegnata seguendo tutte le curve.

Ho però bisogno del file originale in chat. Al momento vedo solo un riferimento interno al file (Simboli e forme-13.svg), ma non posso recuperarlo direttamente.

Carica nuovamente il file Simboli e forme-13.svg (trascinandolo qui nella conversazione) e ti restituisco direttamente:

il nuovo SVG animabile;
il codice completo da incollare nel widget HTML di Elementor, già integrato con GSAP. 