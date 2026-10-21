/* Pruebas de contrato entre huevos-100-pisos.html, style.css y script.js:
 * detectan ids que faltan, archivos enlazados que no existen o clases CSS
 * que la vista usa pero la hoja de estilos no define. */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = nombre => fileURLToPath(new URL(`../${nombre}`, import.meta.url));
const html = readFileSync(ruta('huevos-100-pisos.html'), 'utf8');
const css = readFileSync(ruta('style.css'), 'utf8');
const js = readFileSync(ruta('script.js'), 'utf8');

const idsEnHtml = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

/* ids que pide UIManager: la lista pasada a getElementById dentro del constructor */
const idsQueUsaLaVista = (() => {
   const bloque = js.match(/\[\s*((?:'[A-Za-z]+'\s*,\s*)+'[A-Za-z]+')\s*\]\s*\.forEach\(id =>/);
   assert.ok(bloque, 'no se encontró la lista de ids en UIManager');
   return [...bloque[1].matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]);
})();

describe('HTML ↔ script.js', () => {
   test('la lista de ids de la vista se detectó correctamente (al menos 20)', () => {
      assert.ok(idsQueUsaLaVista.length >= 20, `solo se detectaron ${idsQueUsaLaVista.length}`);
      assert.ok(idsQueUsaLaVista.includes('btnSim') && idsQueUsaLaVista.includes('floors'));
   });

   test('todos los ids que usa UIManager existen en el HTML', () => {
      const faltan = idsQueUsaLaVista.filter(id => !idsEnHtml.includes(id));
      assert.deepEqual(faltan, [], `faltan en el HTML: ${faltan.join(', ')}`);
   });

   test('no hay ids duplicados en el HTML', () => {
      const duplicados = idsEnHtml.filter((id, i) => idsEnHtml.indexOf(id) !== i);
      assert.deepEqual(duplicados, []);
   });

   test('el HTML carga script.js como módulo ES (necesario para los import/export)', () => {
      assert.match(html, /<script\s+type="module"\s+src="script\.js"\s*>/);
   });

   test('los archivos enlazados desde el HTML existen', () => {
      const enlaces = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map(m => m[1]);
      assert.ok(enlaces.includes('style.css') && enlaces.includes('script.js'));
      for (const archivo of enlaces) assert.ok(existsSync(ruta(archivo)), `no existe ${archivo}`);
   });

   test('script.js importa model.js y ese archivo exporta las dos clases del modelo', () => {
      assert.match(js, /import\s*\{\s*EggDropPuzzle\s*,\s*SimulationEngine\s*\}\s*from\s*["']\.\/model\.js["']/);
      const modelo = readFileSync(ruta('model.js'), 'utf8');
      assert.match(modelo, /export class EggDropPuzzle/);
      assert.match(modelo, /export class SimulationEngine/);
   });

   test('el modelo no toca el DOM (la lógica no conoce la vista)', () => {
      const modelo = readFileSync(ruta('model.js'), 'utf8');
      for (const prohibido of ['document', 'window', 'getElementById', 'querySelector', 'innerHTML'])
         assert.equal(modelo.includes(prohibido), false, `model.js usa «${prohibido}»`);
   });
});

describe('style.css ↔ clases que añade la vista', () => {
   /* Clases que script.js activa o crea dinámicamente y que deben tener estilo. */
   const clasesDinamicas = ['safe', 'broken', 'picked', 'selectable', 'open', 'show', 'falling', 'splat', 'egg', 'floor', 'car', 'rtl', 'star', 'block', 'tick'];

   for (const clase of clasesDinamicas)
      test(`style.css define la clase .${clase}`, () => {
         assert.match(css, new RegExp(`\\.${clase}(?![\\w-])`), `no hay regla para .${clase}`);
      });

   test('las clases estáticas del HTML que son hooks de la vista siguen existiendo (street)', () => {
      assert.match(html, /class="street"/);
      assert.match(js, /querySelector\('\.street'\)/);
   });
});

describe('package.json', () => {
   const pkg = JSON.parse(readFileSync(ruta('package.json'), 'utf8'));

   test('declara módulos ES y el script de pruebas con el ejecutor nativo de Node', () => {
      assert.equal(pkg.type, 'module');
      assert.match(pkg.scripts.test, /node --test/);
   });
});
