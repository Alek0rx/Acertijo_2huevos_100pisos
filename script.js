/* =====================================================================
 * ARQUITECTURA (estilo MVC)
 *  - Modelo:      EggDropPuzzle (estado + matemática), SimulationEngine (algoritmo)
 *  - Vista:       UIManager (única clase que toca el DOM)
 *  - Controlador: GameManager (estados, modos, conecta modelo y vista)
 * La lógica nunca conoce el DOM: se comunica con la vista solo mediante
 * un callback (onDropCallback) que recibe objetos 'step'.
* ===================================================================== */

import { EggDropPuzzle, SimulationEngine } from "./model.js";

const FLOOR_H = 6, STREET_H = 140;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* UIManager — vista: DOM, eventos, animaciones */
class UIManager {
   #el = {}; #floorEls = []; #handlers = {}; #splats = 0;

   constructor() {
      ['floors', 'tower', 'ticks', 'marker', 'mlabel', 'eggs', 'stars', 'skyline', 'splats', 'statMode', 'statEggs',
         'statDrops', 'statInterval', 'log', 'result', 'speed', 'interactiveBox', 'floorInput', 'btnSim', 'btnInt', 'btnGo', 'statTarget']
         .forEach(id => this.#el[id] = document.getElementById(id));
      this.#buildScene();
      this.#wireEvents();
   }

   /* El controlador registra aquí qué hacer ante cada acción del usuario. */
   bind(handlers) { this.#handlers = handlers; }

   /* Dibuja estrellas, ciudad de fondo, los 100 pisos con ventanas y las marcas de altura. */
   #buildScene() {
      const rnd = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < 70; i++) {
         const s = document.createElement('i'); s.className = 'star';
         s.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(0, 60)}%;opacity:${rnd(.25, .9)}`;
         this.#el.stars.appendChild(s);
      }
      for (let x = 150; x < 480; x += 34) {              // edificios de fondo (a la derecha de la torre)
         const w = rnd(30, 62), h = rnd(90, 300);
         const b = document.createElement('div'); b.className = 'block';
         b.style.cssText = `left:${x}px;width:${w}px;height:${h}px`;
         const dots = [];                                 // ventanas = una sola caja con muchas sombras
         for (let k = 0; k < w * h / 120; k++)
            dots.push(`${Math.floor(rnd(3, w - 6))}px ${Math.floor(rnd(4, h - 4))}px 0 0 rgba(233,191,98,${rnd(.3, .8).toFixed(2)})`);
         const i = document.createElement('i'); i.style.boxShadow = dots.join(','); b.appendChild(i);
         this.#el.skyline.appendChild(b);
      }
      for (let n = 1; n <= 100; n++) {                    // pisos (flex column-reverse: el 1 queda abajo)
         const row = document.createElement('div'); row.className = 'floor'; row.dataset.floor = n;
         row.title = `Piso ${n}`;
         for (let k = 0; k < 11; k++) {
            const w = document.createElement('span'); w.className = 'w' + (Math.random() < .5 ? ' on' : '');
            row.appendChild(w);
         }
         this.#el.floors.appendChild(row); this.#floorEls.push(row);
         if (n % 10 === 0) {
            const t = document.createElement('span'); t.className = 'tick'; t.textContent = n;
            t.style.bottom = `${STREET_H + (n - .5) * FLOOR_H}px`; this.#el.ticks.appendChild(t);
         }
      }
      this.#renderEggs(2);
      this.#buildTraffic(5);
   }

   #renderEggs(count) {
      this.#el.eggs.innerHTML = '<div class="egg"></div>'.repeat(count);
   }

   #buildTraffic(count = 8) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const colors = ['#2f6fb5', '#c0392b', '#e0b030', '#2e9e6b', '#8e44ad', '#d9d9e3', '#e67e22', '#16a0b8'];
      const street = document.querySelector('.street');
      for (let i = 0; i < count; i++) {
         const toLeft = i % 2 === 1;
         const car = document.createElement('div');
         car.className = 'car' + (toLeft ? ' rtl' : '');
         car.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
         car.style.top = toLeft ? '74px' : '26px';
         car.style.animationDuration = `${rnd(16, 40)}s`;
         car.style.animationDelay = `-${rnd(0, 40)}s`;
         street.appendChild(car);
      }
   }

   #wireEvents() {
      this.#el.btnSim.onclick = () => this.#handlers.onSimulation?.();
      this.#el.btnInt.onclick = () => this.#handlers.onInteractive?.();
      this.#el.btnGo.onclick = () => this.#handlers.onConfirm?.(Number(this.#el.floorInput.value));
      this.#el.floorInput.oninput = () => this.#highlightPick(Number(this.#el.floorInput.value));
      this.#el.floors.onclick = e => {                    // clic en un piso (solo en modo interactivo)
         const row = e.target.closest('.floor');
         if (row && this.#el.tower.classList.contains('selectable')) this.selectFloor(Number(row.dataset.floor));
      };
   }

   #highlightPick(n) {
      this.#floorEls.forEach(r => r.classList.remove('picked'));
      if (Number.isInteger(n) && n >= 1 && n <= 100) this.#floorEls[n - 1].classList.add('picked');
   }
   selectFloor(n) { this.#el.floorInput.value = n; this.#highlightPick(n); }

   showInteractiveInput(show) {
      this.#el.interactiveBox.classList.toggle('open', show);
      this.#el.tower.classList.toggle('selectable', show);
      if (!show) this.#highlightPick(NaN);
      else this.#el.floorInput.focus();
   }
   setBusy(busy) { ['btnSim', 'btnInt', 'btnGo'].forEach(k => this.#el[k].disabled = busy); this.#el.floorInput.disabled = busy; }

   /* Limpia la escena para una nueva ejecución. */
   resetScene() {
      this.#floorEls.forEach(r => r.classList.remove('safe', 'broken'));
      this.#el.marker.style.display = 'none';
      this.#el.splats.innerHTML = ''; this.#splats = 0;
      this.#el.result.classList.remove('show');
      this.#el.log.innerHTML = '';
      this.#renderEggs(2);
   }

   renderStats({ mode, eggs, drops, interval, target }) {
      this.#el.statMode.textContent = mode;
      this.#el.statEggs.textContent = eggs;
      this.#el.statDrops.textContent = drops;
      if (interval) this.#el.statInterval.textContent = interval;
      if (target !== undefined) this.#el.statTarget.textContent = target;
   }

   log(text, kind = '') {
      const li = document.createElement('li'); li.className = kind; li.textContent = text;
      this.#el.log.appendChild(li); this.#el.log.scrollTop = this.#el.log.scrollHeight;
   }

   /* Anima un lanzamiento: el huevo sube hasta el piso, se revela el resultado
    * (verde = seguro, rojo = rompe) y, si se rompe, cae a la calle y deja una mancha. */
   async animateDrop(step) {
      const speed = Number(this.#el.speed.value), m = this.#el.marker;
      const bottomOf = f => `${STREET_H + (f - .5) * FLOOR_H}px`;
      const climb = 600 / speed, fall = 500 / speed;      

      if (m.style.display !== 'block') {                  
         m.classList.remove('falling'); m.style.transition = 'none';
         m.style.display = 'block'; m.style.bottom = `${STREET_H}px`; void m.offsetHeight; m.style.transition = '';
      }
      m.classList.remove('falling');
      m.style.transitionDuration = `${climb}ms`;          
      this.#el.mlabel.textContent = `← ${step.currentFloor}`;
      m.style.bottom = bottomOf(step.currentFloor);
      await sleep(climb + 100 / speed);                   

      const row = this.#floorEls[step.currentFloor - 1];
      if (step.isBroken) {
         row.classList.add('broken');
         m.classList.add('falling');
         m.style.transitionDuration = `${fall}ms`;
         m.style.bottom = `${STREET_H}px`;
         await sleep(fall + 20 / speed);
         const s = document.createElement('div'); s.className = 'splat';
         s.style.left = `${190 + this.#splats++ * 40}px`; this.#el.splats.appendChild(s);
         this.#el.eggs.children[step.eggNumber - 1]?.classList.add('broken');
         this.#el.mlabel.textContent = '';
         await sleep(450 / speed);
      }
      else {
         for (let i = 0; i < step.currentFloor; i++)       
            if (!this.#floorEls[i].classList.contains('broken')) this.#floorEls[i].classList.add('safe');
         await sleep(350 / speed);
      }
   }
   showResult(text) { this.#el.result.textContent = text; this.#el.result.classList.add('show'); }
}
/* GameManager — controlador
 * Máquina de estados sencilla: solo se puede iniciar un modo desde
 * IDLE o INTERACTIVE_WAITING; mientras corre el algoritmo, los botones se bloquean.
*/
class GameManager {
   static STATES = Object.freeze({
      IDLE: 'IDLE', SIMULATION_RUNNING: 'SIMULATION_RUNNING',
      INTERACTIVE_WAITING: 'INTERACTIVE_WAITING', INTERACTIVE_RUNNING: 'INTERACTIVE_RUNNING'
   });
   #state = GameManager.STATES.IDLE;
   #ui; #puzzle = null; #engine = null; #eggs = 2; #drops = 0; #modeName = '—';

   constructor(ui) {
      this.#ui = ui;
      ui.bind({
         onSimulation: () => this.startSimulationMode(),
         onInteractive: () => this.#openInteractive(),
         onConfirm: floor => this.startInteractiveMode(floor)
      });
      ui.renderStats({ mode: '—', eggs: 2, drops: 0, interval: new EggDropPuzzle(1).calculateOptimalStrategyInterval() });
   }

   #canStart() {
      const S = GameManager.STATES;
      return this.#state === S.IDLE || this.#state === S.INTERACTIVE_WAITING;
   }

   /* Modo simulación: piso aleatorio 1–100 y ejecución automática. */
   startSimulationMode() {
      if (!this.#canStart()) return;
      const breakingFloor = Math.floor(Math.random() * 100) + 1;
      this.#modeName = 'Simulación';
      this.#ui.showInteractiveInput(false);
      this.#prepare(breakingFloor);
      this.#state = GameManager.STATES.SIMULATION_RUNNING;
      this.#run();
   }

   /* Pasa a esperar el piso que elija el usuario. */
   #openInteractive() {
      if (!this.#canStart()) return;
      this.#state = GameManager.STATES.INTERACTIVE_WAITING;
      this.#modeName = 'Interactivo';
      this.#ui.resetScene();
      this.#ui.renderStats({ mode: this.#modeName, eggs: 2, drops: 0 });
      this.#ui.log('Elige el piso donde el huevo empieza a romperse y pulsa Iniciar algoritmo.');
      this.#ui.showInteractiveInput(true);
   }

   /* Modo interactivo: valida el piso del usuario y ejecuta. Siempre 2 huevos. */
   startInteractiveMode(userSelectedFloor) {
      if (this.#state !== GameManager.STATES.INTERACTIVE_WAITING) return;
      if (!Number.isInteger(userSelectedFloor) || userSelectedFloor < 1 || userSelectedFloor > 100) {
         this.#ui.log('Escribe un número entero entre 1 y 100.', 'error');
         return;
      }
      this.#modeName = 'Interactivo';
      this.#prepare(userSelectedFloor);
      this.#state = GameManager.STATES.INTERACTIVE_RUNNING;
      this.#run();
   }

   /* Crea modelo y motor nuevos, y deja la vista en estado inicial. */
   #prepare(breakingFloor) {
      this.#puzzle = new EggDropPuzzle(breakingFloor);
      this.#engine = new SimulationEngine();
      this.#eggs = this.#puzzle.totalEggs; this.#drops = 0;
      this.#ui.resetScene();
      this.#ui.renderStats({
         mode: this.#modeName, eggs: this.#eggs, drops: 0,
         interval: this.#puzzle.calculateOptimalStrategyInterval(),
         target: this.#modeName === 'Interactivo' ? breakingFloor : '?'
      });
   }

   async #run() {
      this.#ui.setBusy(true);
      this.#ui.showInteractiveInput(false);
      const result = await this.#engine.runOptimalAlgorithm(this.#puzzle, step => this.#onDrop(step));
      const msg = `El huevo se rompe desde el piso ${result.breakingFloor}. Lanzamientos usados: ${result.drops}`;
      // this.#ui.log(msg, 'end');
      this.#ui.showResult(msg);
      this.#state = GameManager.STATES.IDLE;
      this.#ui.setBusy(false);
      this.#ui.renderStats({
         mode: this.#modeName, eggs: this.#eggs, drops: this.#drops,
         target: this.#puzzle.getBreakingFloor()
      });
   }

   /* Callback del motor: anima, actualiza estadísticas y registra el paso. */
   async #onDrop(step) {
      await this.#ui.animateDrop(step);
      this.#drops = step.dropsCount;
      if (step.isBroken) this.#eggs--;
      this.#ui.renderStats({ mode: this.#modeName, eggs: this.#eggs, drops: this.#drops });
      this.#ui.log(`Lanzamiento ${step.dropsCount}: huevo ${step.eggNumber} desde el piso ${step.currentFloor} → ${step.isBroken ? 'se rompe' : 'resiste'}`,
         step.isBroken ? 'broken' : 'safe');
   }
}

/* Punto de entrada: la vista se crea primero y el controlador la recibe. */
new GameManager(new UIManager());
