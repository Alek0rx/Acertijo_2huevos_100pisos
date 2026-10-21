/* =====================================================================
 * DOM falso mínimo para probar script.js (UIManager + GameManager) en Node,
 * sin navegador ni dependencias externas (nada de jsdom).
 *
 *  - Los ids disponibles se leen del HTML REAL (huevos-100-pisos.html), así
 *    que si la vista pide un id que el HTML no tiene, getElementById devuelve
 *    null (igual que en el navegador) y la construcción de la UI falla.
 *  - Implementa solo lo que script.js usa: classList, style, dataset,
 *    appendChild, children, innerHTML (para los huevos del HUD), closest, etc.
 *
 * Esta carpeta está fuera de /test a propósito: `node --test` ejecuta todo lo
 * que hay dentro de /test, y este archivo es una utilidad, no una prueba.
 * ===================================================================== */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HTML_PATH = fileURLToPath(new URL('../huevos-100-pisos.html', import.meta.url));

export class FakeElement {
   constructor(tagName = 'div', id = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.children = [];
      this.parentNode = null;
      // Como en el DOM real, dataset y textContent convierten todo a texto.
      this.dataset = new Proxy({}, { set: (t, k, v) => ((t[k] = String(v)), true) });
      this.style = { cssText: '', setProperty(name, value) { this[name] = value; } };
      this.title = '';
      this.disabled = false;
      this.focused = false;
      this.scrollTop = 0;
      this.scrollHeight = 0;
      this.offsetHeight = 0;
      this.onclick = null;
      this.oninput = null;
      this._text = '';
      this._value = '';
      this._html = '';
      this._classes = new Set();
      const self = this;
      this.classList = {
         add: (...names) => names.forEach(n => self._classes.add(n)),
         remove: (...names) => names.forEach(n => self._classes.delete(n)),
         contains: name => self._classes.has(name),
         toggle(name, force) {
            const on = force === undefined ? !self._classes.has(name) : Boolean(force);
            if (on) self._classes.add(name); else self._classes.delete(name);
            return on;
         }
      };
   }

   get className() { return [...this._classes].join(' '); }
   set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }

   get textContent() { return this._text; }
   set textContent(v) { this._text = String(v); }

   get value() { return this._value; }
   set value(v) { this._value = String(v); }

   /* Solo se necesita para <div class="egg"></div>.repeat(n): crea un hijo por etiqueta. */
   get innerHTML() { return this._html; }
   set innerHTML(html) {
      this._html = html;
      this.children = [];
      for (const m of html.matchAll(/<(\w+)\s+class="([^"]*)"\s*>/g)) {
         const child = new FakeElement(m[1]);
         child.className = m[2];
         child.parentNode = this;
         this.children.push(child);
      }
   }

   appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
   focus() { this.focused = true; }
   matches(selector) { return selector.startsWith('.') && this._classes.has(selector.slice(1)); }
   closest(selector) {
      for (let n = this; n; n = n.parentNode) if (n.matches(selector)) return n;
      return null;
   }
   /* Útil en las pruebas: hijos que tienen cierta clase. */
   childrenWithClass(name) { return this.children.filter(c => c.classList.contains(name)); }
}

/* Instala un `document` global falso construido a partir del HTML real. */
export function installFakeDocument() {
   const html = readFileSync(HTML_PATH, 'utf8');
   const byId = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new FakeElement('div', m[1])]));
   const classesInHtml = new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
   const byClass = new Map();

   const document = {
      getElementById: id => byId.get(id) ?? null,
      createElement: tag => new FakeElement(tag),
      querySelector(selector) {
         if (!selector.startsWith('.')) return null;
         const name = selector.slice(1);
         if (!classesInHtml.has(name)) return null;
         if (!byClass.has(name)) { const e = new FakeElement('div'); e.className = name; byClass.set(name, e); }
         return byClass.get(name);
      }
   };

   const previous = globalThis.document;
   globalThis.document = document;
   return {
      document,
      el: id => byId.get(id),
      street: () => document.querySelector('.street'),
      restore() { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
   };
}

let instancia = 0;

/* Carga script.js desde cero (módulo nuevo) con el DOM falso ya instalado.
 * `speed` alto = animaciones casi instantáneas para que las pruebas sean rápidas. */
export async function loadApp({ speed = 1000 } = {}) {
   const dom = installFakeDocument();
   dom.el('speed').value = speed;
   await import(new URL(`../script.js?instancia=${++instancia}`, import.meta.url).href);
   return dom;
}

/* Espera (con tope de tiempo) a que se cumpla una condición. */
export async function waitFor(cond, { timeout = 5000, step = 2, msg = 'condición no cumplida' } = {}) {
   const t0 = Date.now();
   while (!cond()) {
      if (Date.now() - t0 > timeout) throw new Error(`waitFor: ${msg}`);
      await new Promise(r => setTimeout(r, step));
   }
}
