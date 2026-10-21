import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EggDropPuzzle, SimulationEngine } from '../model.js';

describe('EggDropPuzzle', () => {
  test('el intervalo óptimo para 100 pisos es 14', () => {
    assert.equal(new EggDropPuzzle(50).calculateOptimalStrategyInterval(), 14);
  });

  test('rechaza pisos de rotura inválidos', () => {
    for (const malo of [0, 101, 3.5, NaN, '50'])
      assert.throws(() => new EggDropPuzzle(malo), RangeError);
  });

  test('testDrop: se rompe desde el piso de rotura hacia arriba', () => {
    const p = new EggDropPuzzle(62);
    assert.equal(p.testDrop(61), false);
    assert.equal(p.testDrop(62), true);
    assert.equal(p.testDrop(100), true);
  });
});

describe('SimulationEngine', () => {
  const engine = new SimulationEngine();
  const correr = async piso => {
    const pasos = [];
    const r = await engine.runOptimalAlgorithm(new EggDropPuzzle(piso), s => pasos.push(s));
    return { r, pasos };
  };

  test('encuentra el piso correcto para los 100 casos posibles', async () => {
    for (let f = 1; f <= 100; f++)
      assert.equal((await correr(f)).r.breakingFloor, f, `falló con el piso ${f}`);
  });

  test('nunca usa más de 14 lanzamientos (peor caso)', async () => {
    for (let f = 1; f <= 100; f++)
      assert.ok((await correr(f)).r.drops <= 14, `piso ${f} excede 14`);
  });

  test('nunca rompe más de 2 huevos', async () => {
    for (let f = 1; f <= 100; f++) {
      const { pasos } = await correr(f);
      assert.ok(pasos.filter(s => s.isBroken).length <= 2);
    }
  });

  test('el huevo 1 sube con saltos decrecientes: 14, 27, 39, 50', async () => {
    const { pasos } = await correr(100);
    assert.deepEqual(pasos.slice(0, 4).map(s => s.currentFloor), [14, 27, 39, 50]);
  });

  test('dropsCount crece de 1 en 1 y el callback recibe la forma esperada', async () => {
    const { pasos } = await correr(37);
    pasos.forEach((s, i) => {
      assert.equal(s.dropsCount, i + 1);
      assert.deepEqual(Object.keys(s).sort(), ['currentFloor', 'dropsCount', 'eggNumber', 'isBroken']);
    });
  });
});