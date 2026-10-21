/* Pruebas de integración Vista + Controlador (UIManager + GameManager).
 * Se ejecuta script.js REAL sobre un DOM falso (support/fake-dom.js) y se
 * maneja la aplicación igual que lo haría el usuario: pulsando botones. */

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, waitFor } from '../support/fake-dom.js';

let dom;
const el = id => dom.el(id);
const floorRow = n => el('floors').children[n - 1];
const logLines = () => el('log').children.map(li => li.textContent);

/* La partida terminó cuando hay resultado visible y los botones se liberaron. */
const esperarFin = () => waitFor(
   () => el('result').classList.contains('show') && !el('btnSim').disabled,
   { msg: 'la partida no terminó' }
);

/* Modo interactivo completo: abrir, escribir el piso y pulsar "Iniciar algoritmo". */
async function jugarInteractivo(piso) {
   el('btnInt').onclick();
   el('floorInput').value = piso;
   el('btnGo').onclick();
   await esperarFin();
}

beforeEach(async () => { dom = await loadApp(); });
afterEach(() => { mock.restoreAll(); dom.restore(); });

describe('Arranque de la aplicación', () => {
   test('construye los 100 pisos numerados, con marcas cada 10 pisos', () => {
      assert.equal(el('floors').children.length, 100);
      assert.equal(floorRow(1).dataset.floor, '1');
      assert.equal(floorRow(100).dataset.floor, '100');
      assert.deepEqual(
         el('ticks').children.map(t => t.textContent),
         ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100']
      );
   });

   test('muestra 2 huevos y deja el tráfico de fondo en marcha (5 coches, 2 en sentido contrario)', () => {
      assert.equal(el('eggs').children.length, 2);
      const coches = dom.street().children;
      assert.equal(coches.length, 5);
      assert.equal(coches.filter(c => c.classList.contains('rtl')).length, 2);
   });

   test('estadísticas iniciales: sin modo, 2 huevos, 0 lanzamientos e intervalo 14', () => {
      assert.equal(el('statMode').textContent, '—');
      assert.equal(el('statEggs').textContent, '2');
      assert.equal(el('statDrops').textContent, '0');
      assert.equal(el('statInterval').textContent, '14');
   });

   test('todos los botones empiezan habilitados y el panel interactivo cerrado', () => {
      for (const id of ['btnSim', 'btnInt', 'btnGo', 'floorInput']) assert.equal(el(id).disabled, false, id);
      assert.equal(el('interactiveBox').classList.contains('open'), false);
      assert.equal(el('tower').classList.contains('selectable'), false);
   });
});

describe('Modo simulación', () => {
   test('con piso de rotura 62: 8 lanzamientos, resultado y estadísticas finales correctos', async () => {
      mock.method(Math, 'random', () => 0.617);          // floor(0.617 * 100) + 1 = 62
      el('btnSim').onclick();

      // Nada más pulsar: estado "ocupado" y piso objetivo oculto ('?')
      for (const id of ['btnSim', 'btnInt', 'btnGo', 'floorInput']) assert.equal(el(id).disabled, true, id);
      assert.equal(el('statMode').textContent, 'Simulación');
      assert.equal(el('statTarget').textContent, '?');

      await esperarFin();

      // Huevo 1: 14, 27, 39, 50, 60 (resiste) y 69 (se rompe) = 6 lanzamientos.
      // Huevo 2: 61 (resiste) y 62 (se rompe) = 2 lanzamientos. Total 8.
      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 62. Lanzamientos usados: 8');
      assert.equal(el('statMode').textContent, 'Simulación');
      assert.equal(el('statDrops').textContent, '8');
      assert.equal(el('statEggs').textContent, '0');
      assert.equal(el('statTarget').textContent, '62');
      for (const id of ['btnSim', 'btnInt', 'btnGo', 'floorInput']) assert.equal(el(id).disabled, false, id);
   });

   test('el log registra cada lanzamiento con su clase (safe / broken)', async () => {
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();
      await esperarFin();

      const lis = el('log').children;
      assert.equal(lis.length, 8);
      assert.equal(lis[0].textContent, 'Lanzamiento 1: huevo 1 desde el piso 14 → resiste');
      assert.equal(lis[0].className, 'safe');
      assert.equal(lis[5].textContent, 'Lanzamiento 6: huevo 1 desde el piso 69 → se rompe');
      assert.equal(lis[5].className, 'broken');
      assert.equal(lis[7].textContent, 'Lanzamiento 8: huevo 2 desde el piso 62 → se rompe');
   });

   test('pinta los pisos: seguros por debajo del límite, rotos donde se rompió un huevo', async () => {
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();
      await esperarFin();

      for (let n = 1; n <= 61; n++) assert.ok(floorRow(n).classList.contains('safe'), `piso ${n} debería ser seguro`);
      for (const n of [62, 69]) assert.ok(floorRow(n).classList.contains('broken'), `piso ${n} debería estar roto`);
      assert.equal(floorRow(70).classList.contains('safe'), false);
      assert.equal(floorRow(100).classList.contains('broken'), false);
   });

   test('cada huevo roto deja una mancha en la calle y se marca en el HUD', async () => {
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();
      await esperarFin();

      assert.equal(el('splats').children.length, 2);
      assert.ok(el('eggs').children.every(e => e.classList.contains('broken')));
      assert.equal(el('marker').style.display, 'block');
   });

   test('los extremos del azar (piso 1 y piso 100) producen resultados válidos', async () => {
      let azar = 0;                                        // floor(0 * 100) + 1 = 1
      mock.method(Math, 'random', () => azar);

      el('btnSim').onclick();
      await esperarFin();
      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 1. Lanzamientos usados: 2');

      azar = 0.9999;                                       // floor(99.99) + 1 = 100
      el('btnSim').onclick();
      await esperarFin();
      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 100. Lanzamientos usados: 12');
   });
});

describe('Modo interactivo', () => {
   test('al abrirlo: muestra el panel, permite elegir pisos con clic y no inicia nada', () => {
      el('btnInt').onclick();

      assert.ok(el('interactiveBox').classList.contains('open'));
      assert.ok(el('tower').classList.contains('selectable'));
      assert.equal(el('floorInput').focused, true);
      assert.equal(el('statMode').textContent, 'Interactivo');
      assert.match(logLines()[0], /Elige el piso/);
      assert.equal(el('btnSim').disabled, false);          // todavía no hay ejecución en curso
      assert.equal(el('result').classList.contains('show'), false);
   });

   test('rechaza valores inválidos (vacío, 0, 101, decimal, texto) y sigue esperando', () => {
      el('btnInt').onclick();
      const invalidos = ['', '0', '101', '3.5', 'abc', '-7'];

      invalidos.forEach((valor, i) => {
         el('floorInput').value = valor;
         el('btnGo').onclick();
         const ultimo = el('log').children.at(-1);
         assert.equal(ultimo.textContent, 'Escribe un número entero entre 1 y 100.', `valor «${valor}»`);
         assert.equal(ultimo.className, 'error');
         assert.equal(el('log').children.length, 1 + (i + 1));   // mensaje inicial + un error por intento
      });

      assert.ok(el('interactiveBox').classList.contains('open'));     // sigue esperando
      assert.equal(el('btnSim').disabled, false);
      assert.equal(el('result').classList.contains('show'), false);
   });

   test('piso 37: huevo 1 resiste 14 y 27 y se rompe en 39; huevo 2 recorre 28–37 → 13 lanzamientos', async () => {
      await jugarInteractivo(37);

      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 37. Lanzamientos usados: 13');
      assert.equal(el('statMode').textContent, 'Interactivo');
      assert.equal(el('statTarget').textContent, '37');
      assert.equal(el('statDrops').textContent, '13');
      assert.equal(el('statEggs').textContent, '0');
      assert.equal(el('log').children.length, 13);
   });

   test('tras ejecutar, el panel interactivo se cierra y ya no se puede elegir piso con clic', async () => {
      await jugarInteractivo(50);

      assert.equal(el('interactiveBox').classList.contains('open'), false);
      assert.equal(el('tower').classList.contains('selectable'), false);
   });

   test('en el peor caso conocido (piso 13 y piso 14) usa exactamente 14 lanzamientos', async () => {
      await jugarInteractivo(13);
      assert.equal(el('statDrops').textContent, '14');
      await jugarInteractivo(14);
      assert.equal(el('statDrops').textContent, '14');
      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 14. Lanzamientos usados: 14');
   });
});

describe('Selección de piso (clic en el edificio y campo numérico)', () => {
   test('fuera del modo interactivo, hacer clic en un piso no hace nada', () => {
      el('floors').onclick({ target: floorRow(50) });
      assert.equal(el('floorInput').value, '');
      assert.equal(floorRow(50).classList.contains('picked'), false);
   });

   test('en modo interactivo, un clic rellena el campo y resalta solo ese piso', () => {
      el('btnInt').onclick();

      el('floors').onclick({ target: floorRow(50) });
      assert.equal(el('floorInput').value, '50');
      assert.ok(floorRow(50).classList.contains('picked'));

      el('floors').onclick({ target: floorRow(60) });
      assert.equal(el('floorInput').value, '60');
      assert.ok(floorRow(60).classList.contains('picked'));
      assert.equal(floorRow(50).classList.contains('picked'), false);
   });

   test('escribir en el campo resalta el piso; un valor fuera de rango quita el resalte', () => {
      el('btnInt').onclick();

      el('floorInput').value = '75';
      el('floorInput').oninput();
      assert.ok(floorRow(75).classList.contains('picked'));

      for (const fuera of ['500', '0', '7.5', '']) {
         el('floorInput').value = fuera;
         el('floorInput').oninput();
         assert.equal(el('floors').children.filter(r => r.classList.contains('picked')).length, 0, `valor «${fuera}»`);
      }
   });
});

describe('Máquina de estados del controlador', () => {
   test('«Iniciar algoritmo» se ignora si no se abrió antes el modo interactivo (estado IDLE)', () => {
      el('floorInput').value = '20';
      el('btnGo').onclick();

      assert.equal(el('log').children.length, 0);
      assert.equal(el('result').classList.contains('show'), false);
      assert.equal(el('btnSim').disabled, false);
   });

   test('mientras corre una partida, pulsar otros modos se ignora (no se duplica ni se reinicia)', async () => {
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();

      el('btnSim').onclick();      // segunda simulación a medio camino
      el('btnInt').onclick();      // intento de cambiar a interactivo
      el('btnGo').onclick();       // intento de confirmar

      await esperarFin();
      assert.equal(el('statMode').textContent, 'Simulación');
      assert.equal(el('log').children.length, 8);          // una sola ejecución, sin entradas duplicadas
      assert.equal(el('statDrops').textContent, '8');
   });

   test('desde el modo interactivo en espera se puede saltar a simulación', async () => {
      el('btnInt').onclick();
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();

      assert.equal(el('interactiveBox').classList.contains('open'), false);   // el panel se cierra
      await esperarFin();
      assert.equal(el('statMode').textContent, 'Simulación');
      assert.equal(el('statTarget').textContent, '62');
   });

   test('al terminar vuelve a IDLE y una nueva partida limpia la escena anterior', async () => {
      mock.method(Math, 'random', () => 0.617);
      el('btnSim').onclick();                              // 1.ª partida: piso 62
      await esperarFin();
      assert.ok(floorRow(62).classList.contains('broken'));

      await jugarInteractivo(37);                          // 2.ª partida: piso 37

      assert.equal(el('result').textContent, 'El huevo se rompe desde el piso 37. Lanzamientos usados: 13');
      assert.equal(el('log').children.length, 13);         // el log de la 1.ª partida se borró
      assert.equal(el('splats').children.length, 2);       // las manchas anteriores se borraron
      assert.equal(floorRow(62).classList.contains('broken'), false);
      assert.ok(floorRow(37).classList.contains('broken'));
   });
});
