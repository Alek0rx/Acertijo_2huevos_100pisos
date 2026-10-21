/* Pruebas de SimulationEngine: estructura del algoritmo, optimalidad,
 * casos límite y contrato con el callback (asíncrono, en orden). */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EggDropPuzzle, SimulationEngine } from '../model.js';

const engine = new SimulationEngine();

async function correr(piso) {
   const pasos = [];
   const resultado = await engine.runOptimalAlgorithm(new EggDropPuzzle(piso), s => { pasos.push(s); });
   return { resultado, pasos };
}
const pisosDe = pasos => pasos.map(p => p.currentFloor);

/* Puzzle "de mentira" (duck typing) para probar el motor con otros tamaños. */
function puzzleFalso({ pisos, rotura, testDrop }) {
   let x = 1;
   while ((x * (x + 1)) / 2 < pisos) x++;
   return {
      totalFloors: pisos,
      calculateOptimalStrategyInterval: () => x,
      testDrop: testDrop ?? (f => f >= rotura)
   };
}

/* Referencia independiente: nº mínimo de lanzamientos en el peor caso con `huevos` huevos
 * y `pisos` pisos, por programación dinámica. cubre[k][e] = pisos que se pueden resolver con
 * k lanzamientos y e huevos = cubre[k-1][e-1] + cubre[k-1][e] + 1. */
function minimoPeorCaso(pisos, huevos) {
   let previo = new Array(huevos + 1).fill(0);
   for (let k = 1; ; k++) {
      const actual = new Array(huevos + 1).fill(0);
      for (let e = 1; e <= huevos; e++) actual[e] = previo[e - 1] + previo[e] + 1;
      if (actual[huevos] >= pisos) return k;
      previo = actual;
   }
}

describe('SimulationEngine — corrección y optimalidad', () => {
   test('el peor caso real (14) coincide con el mínimo teórico calculado por programación dinámica', async () => {
      assert.equal(minimoPeorCaso(100, 2), 14);
      let peor = 0;
      for (let f = 1; f <= 100; f++) peor = Math.max(peor, (await correr(f)).resultado.drops);
      assert.equal(peor, minimoPeorCaso(100, 2));
   });

   test('el resultado devuelto coincide con el piso real y con el conteo de pasos', async () => {
      for (let f = 1; f <= 100; f++) {
         const { resultado, pasos } = await correr(f);
         assert.equal(resultado.breakingFloor, f);
         assert.equal(resultado.drops, pasos.length);
         assert.deepEqual(Object.keys(resultado).sort(), ['breakingFloor', 'drops']);
      }
   });

   test('cada paso informa isBroken de forma coherente con el piso real', async () => {
      for (const f of [1, 14, 37, 62, 99, 100])
         for (const p of (await correr(f)).pasos)
            assert.equal(p.isBroken, p.currentFloor >= f, `rotura=${f}, lanzamiento desde ${p.currentFloor}`);
   });

   test('nunca lanza desde un piso fuera de 1..100 ni repite un piso', async () => {
      for (let f = 1; f <= 100; f++) {
         const pisos = pisosDe((await correr(f)).pasos);
         assert.ok(pisos.every(p => Number.isInteger(p) && p >= 1 && p <= 100), `rotura=${f}`);
         assert.equal(new Set(pisos).size, pisos.length, `rotura=${f} repite pisos`);
      }
   });
});

describe('SimulationEngine — estructura en dos fases', () => {
   test('fase 1: el huevo 1 sube con saltos 14, 13, 12, 11, ... (14, 27, 39, 50, 60, 69, 77, 84, 90, 95, 99, 100)', async () => {
      const { pasos } = await correr(100);
      const huevo1 = pasos.filter(p => p.eggNumber === 1);
      assert.deepEqual(pisosDe(huevo1), [14, 27, 39, 50, 60, 69, 77, 84, 90, 95, 99, 100]);
      const saltos = huevo1.slice(1).map((p, i) => p.currentFloor - huevo1[i].currentFloor);
      assert.deepEqual(saltos, [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 1]);   // el último se recorta al piso 100
   });

   test('el huevo 1 siempre actúa primero; cuando entra el huevo 2 ya no vuelve el huevo 1', async () => {
      for (let f = 1; f <= 100; f++) {
         const numeros = (await correr(f)).pasos.map(p => p.eggNumber);
         const primerHuevo2 = numeros.indexOf(2);
         if (primerHuevo2 === -1) continue;                 // el huevo 1 bastó (p. ej. piso 100)
         assert.ok(numeros.slice(0, primerHuevo2).every(n => n === 1), `rotura=${f}`);
         assert.ok(numeros.slice(primerHuevo2).every(n => n === 2), `rotura=${f}`);
      }
   });

   test('el huevo 1 solo se rompe en su último lanzamiento (si no, la fase 1 continúa)', async () => {
      for (let f = 1; f <= 100; f++) {
         const huevo1 = (await correr(f)).pasos.filter(p => p.eggNumber === 1);
         assert.ok(huevo1.slice(0, -1).every(p => !p.isBroken), `rotura=${f}`);
         assert.equal(huevo1.at(-1).isBroken, true, `rotura=${f}`);
      }
   });

   test('fase 2: el huevo 2 recorre pisos consecutivos desde el último seguro + 1 hasta antes del piso donde se rompió el 1', async () => {
      // rotura 62 → el huevo 1 resiste 60 y se rompe en 69; el huevo 2 prueba 61 y 62
      const { pasos } = await correr(62);
      assert.deepEqual(pisosDe(pasos.filter(p => p.eggNumber === 2)), [61, 62]);

      // rotura 37 → el huevo 1 resiste 27 y se rompe en 39; el huevo 2 prueba 28..37
      const huevo2 = (await correr(37)).pasos.filter(p => p.eggNumber === 2);
      assert.deepEqual(pisosDe(huevo2), [28, 29, 30, 31, 32, 33, 34, 35, 36, 37]);
   });

   test('el huevo 2 solo puede romperse en su último lanzamiento (o no romperse si el piso es el del huevo 1)', async () => {
      for (let f = 1; f <= 100; f++) {
         const huevo2 = (await correr(f)).pasos.filter(p => p.eggNumber === 2);
         assert.ok(huevo2.slice(0, -1).every(p => !p.isBroken), `rotura=${f}`);
         // Si el huevo 2 sobrevive a todo el tramo, el piso de rotura es el que rompió el huevo 1
         const sobrevive = huevo2.length > 0 && !huevo2.at(-1).isBroken;
         if (sobrevive) assert.ok(f === (await correr(f)).pasos.find(p => p.eggNumber === 1 && p.isBroken).currentFloor, `rotura=${f}`);
      }
   });
});

describe('SimulationEngine — casos límite', () => {
   test('piso 1: el huevo 1 se rompe en 14 y el huevo 2 lo confirma en el 1 → 2 lanzamientos', async () => {
      const { resultado, pasos } = await correr(1);
      assert.deepEqual(resultado, { breakingFloor: 1, drops: 2 });
      assert.deepEqual(pisosDe(pasos), [14, 1]);
   });

   test('piso 100: lo resuelve el huevo 1 en 12 lanzamientos, sin usar el huevo 2', async () => {
      const { resultado, pasos } = await correr(100);
      assert.deepEqual(resultado, { breakingFloor: 100, drops: 12 });
      assert.ok(pasos.every(p => p.eggNumber === 1));
   });

   test('el piso de rotura coincide con un piso del huevo 1 (14, 27, 39...): el huevo 2 resiste todo el tramo y la respuesta es ese piso', async () => {
      // rotura 27 → huevo 1: 14 ok, 27 rompe. Huevo 2: 15..26 resiste (12 lanzamientos). Respuesta 27.
      const { resultado, pasos } = await correr(27);
      assert.deepEqual(resultado, { breakingFloor: 27, drops: 14 });
      assert.deepEqual(pisosDe(pasos.filter(p => p.eggNumber === 2)), [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
      assert.ok(pasos.filter(p => p.eggNumber === 2).every(p => !p.isBroken));
   });

   test('los pisos 13 y 14 son peores casos: exactamente 14 lanzamientos', async () => {
      assert.equal((await correr(13)).resultado.drops, 14);
      assert.equal((await correr(14)).resultado.drops, 14);
   });

});

describe('SimulationEngine — contrato con el callback', () => {
   test('espera a que termine el callback asíncrono antes de hacer el siguiente lanzamiento', async () => {
      const eventos = [];
      await engine.runOptimalAlgorithm(new EggDropPuzzle(20), async s => {
         eventos.push(`inicio ${s.dropsCount}`);
         await new Promise(r => setTimeout(r, 2));          // simula la animación
         eventos.push(`fin ${s.dropsCount}`);
      });
      assert.ok(eventos.length >= 4 && eventos.length % 2 === 0);
      eventos.forEach((e, i) => {
         const n = Math.floor(i / 2) + 1;
         assert.equal(e, i % 2 === 0 ? `inicio ${n}` : `fin ${n}`);   // sin solaparse: inicio1, fin1, inicio2, fin2...
      });
   });

   test('un error en el callback hace fallar la ejecución y detiene el algoritmo', async () => {
      let llamadas = 0;
      await assert.rejects(
         engine.runOptimalAlgorithm(new EggDropPuzzle(80), () => { if (++llamadas === 3) throw new Error('boom'); }),
         { message: 'boom' }
      );
      assert.equal(llamadas, 3);
   });

   test('el motor no guarda estado entre ejecuciones: se puede reutilizar y da siempre lo mismo', async () => {
      const a = await correr(55);
      const b = await correr(55);
      const otro = await correr(56);
      assert.deepEqual(a, b);
      assert.notDeepEqual(a.resultado, otro.resultado);
   });
});

describe('SimulationEngine — solo depende de la interfaz del puzzle (no de «100»)', () => {
   test('edificio de 10 pisos (intervalo 4): encuentra todos los casos con ≤ 4 lanzamientos', async () => {
      for (let rotura = 1; rotura <= 10; rotura++) {
         const resultado = await engine.runOptimalAlgorithm(puzzleFalso({ pisos: 10, rotura }), () => {});
         assert.equal(resultado.breakingFloor, rotura, `rotura=${rotura}`);
         assert.ok(resultado.drops <= 4, `rotura=${rotura} usó ${resultado.drops}`);
      }
   });

   test('edificios pequeños (1, 3 y 6 pisos) también se resuelven', async () => {
      for (const pisos of [1, 3, 6])
         for (let rotura = 1; rotura <= pisos; rotura++) {
            const r = await engine.runOptimalAlgorithm(puzzleFalso({ pisos, rotura }), () => {});
            assert.equal(r.breakingFloor, rotura, `pisos=${pisos}, rotura=${rotura}`);
         }
   });

   test('si el huevo nunca se rompe, termina en el último piso devolviendo breakingFloor null', async () => {
      const pasos = [];
      const r = await engine.runOptimalAlgorithm(
         puzzleFalso({ pisos: 100, testDrop: () => false }),
         s => { pasos.push(s); }
      );
      assert.deepEqual(r, { breakingFloor: null, drops: 12 });
      assert.equal(pisosDe(pasos).at(-1), 100);
      assert.ok(pasos.every(p => p.eggNumber === 1 && !p.isBroken));
   });
});
