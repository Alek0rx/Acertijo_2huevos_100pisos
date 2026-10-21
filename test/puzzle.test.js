/* Pruebas de EggDropPuzzle: encapsulación, invariantes y validación.
 * (test/model.test.js ya cubre el caso básico; aquí se profundiza.) */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EggDropPuzzle } from '../model.js';

describe('EggDropPuzzle — constantes del acertijo', () => {
   test('siempre son 100 pisos y 2 huevos, sea cual sea el piso de rotura', () => {
      for (const f of [1, 50, 100]) {
         const p = new EggDropPuzzle(f);
         assert.equal(p.totalFloors, 100);
         assert.equal(p.totalEggs, 2);
      }
   });

   test('totalFloors y totalEggs son de solo lectura', () => {
      const p = new EggDropPuzzle(10);
      assert.throws(() => { p.totalFloors = 5; }, TypeError);
      assert.throws(() => { p.totalEggs = 99; }, TypeError);
      assert.equal(p.totalFloors, 100);
      assert.equal(p.totalEggs, 2);
   });
});

describe('EggDropPuzzle — encapsulación', () => {
   test('el piso de rotura no se filtra como propiedad pública', () => {
      const p = new EggDropPuzzle(42);
      assert.deepEqual(Object.keys(p), []);
      assert.deepEqual(Object.getOwnPropertyNames(p), []);
      assert.equal(JSON.stringify(p), '{}');
      for (const nombre of ['breakingFloor', '_breakingFloor', 'totalFloors_', 'floor'])
         assert.equal(p[nombre], undefined, nombre);
   });

   test('la única forma de conocer el piso es getBreakingFloor() o sondear con testDrop()', () => {
      const p = new EggDropPuzzle(42);
      assert.equal(p.getBreakingFloor(), 42);
      assert.equal(p.testDrop(41), false);
      assert.equal(p.testDrop(42), true);
   });

   test('dos instancias no comparten estado', () => {
      const a = new EggDropPuzzle(10);
      const b = new EggDropPuzzle(90);
      assert.equal(a.getBreakingFloor(), 10);
      assert.equal(b.getBreakingFloor(), 90);
      assert.equal(a.testDrop(50), true);
      assert.equal(b.testDrop(50), false);
   });
});

describe('EggDropPuzzle — validación del constructor', () => {
   test('acepta exactamente los enteros 1..100 (límites incluidos)', () => {
      assert.equal(new EggDropPuzzle(1).getBreakingFloor(), 1);
      assert.equal(new EggDropPuzzle(100).getBreakingFloor(), 100);
      for (let f = 1; f <= 100; f++) assert.doesNotThrow(() => new EggDropPuzzle(f), `piso ${f}`);
   });

   test('rechaza fuera de rango, no enteros y tipos que no son número', () => {
      const invalidos = [0, -1, 101, 1000, 0.5, 99.9, NaN, Infinity, -Infinity,
         '50', '', null, undefined, true, false, [], [50], {}, () => 50];
      for (const v of invalidos)
         assert.throws(() => new EggDropPuzzle(v), RangeError, `debería rechazar ${String(v)}`);
   });

   test('el mensaje de error indica el rango válido', () => {
      assert.throws(() => new EggDropPuzzle(0), { name: 'RangeError', message: /entre 1 y 100/ });
   });

   test('sin argumento falla (no hay piso de rotura por defecto)', () => {
      assert.throws(() => new EggDropPuzzle(), RangeError);
   });
});

describe('EggDropPuzzle — testDrop (el huevo se rompe desde el piso de rotura hacia arriba)', () => {
   test('es monótono: resiste por debajo y se rompe desde el piso de rotura, para los 100 casos', () => {
      for (let rotura = 1; rotura <= 100; rotura++) {
         const p = new EggDropPuzzle(rotura);
         for (let piso = 1; piso <= 100; piso++)
            assert.equal(p.testDrop(piso), piso >= rotura, `rotura=${rotura}, piso=${piso}`);
      }
   });

   test('piso de rotura 1: se rompe desde cualquier piso', () => {
      const p = new EggDropPuzzle(1);
      assert.ok([1, 2, 50, 100].every(f => p.testDrop(f)));
   });

   test('piso de rotura 100: solo se rompe desde el último piso', () => {
      const p = new EggDropPuzzle(100);
      assert.equal(p.testDrop(99), false);
      assert.equal(p.testDrop(100), true);
   });

   test('testDrop no tiene efectos secundarios: repetir la consulta da lo mismo', () => {
      const p = new EggDropPuzzle(30);
      for (let i = 0; i < 5; i++) {
         assert.equal(p.testDrop(29), false);
         assert.equal(p.testDrop(30), true);
      }
      assert.equal(p.getBreakingFloor(), 30);
   });
});

describe('EggDropPuzzle — calculateOptimalStrategyInterval', () => {
   test('es el menor x con x(x+1)/2 >= 100 (14: 105 >= 100 y 13: 91 < 100)', () => {
      const x = new EggDropPuzzle(1).calculateOptimalStrategyInterval();
      assert.equal(x, 14);
      assert.ok((x * (x + 1)) / 2 >= 100);
      assert.ok(((x - 1) * x) / 2 < 100);
   });

   test('no depende del piso de rotura elegido', () => {
      const intervalos = new Set();
      for (let f = 1; f <= 100; f++) intervalos.add(new EggDropPuzzle(f).calculateOptimalStrategyInterval());
      assert.deepEqual([...intervalos], [14]);
   });

   test('es determinista: llamarlo varias veces devuelve lo mismo', () => {
      const p = new EggDropPuzzle(77);
      assert.equal(p.calculateOptimalStrategyInterval(), p.calculateOptimalStrategyInterval());
   });
});
