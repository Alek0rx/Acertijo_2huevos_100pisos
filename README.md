# Dos huevos, cien pisos

Visualización interactiva del acertijo clásico: tienes **2 huevos** y un edificio de **100 pisos**.
Hay un piso, el *piso de rotura*, a partir del cual el huevo se rompe al caer. ¿Cuál es el menor
número de lanzamientos que garantiza encontrarlo en el **peor caso**?

**Respuesta: 14.** La aplicación lo demuestra animando el algoritmo óptimo:

1. **Fase 1 (huevo 1):** sube con saltos decrecientes: piso 14, luego +13 (27), +12 (39), +11 (50)...
   Cada salto es uno menos que el anterior para compensar el lanzamiento ya gastado.
   Se cumple `14 + 13 + 12 + ... + 1 = 105 ≥ 100`, y con 13 no alcanza (`91 < 100`).
2. **Fase 2 (huevo 2):** cuando el huevo 1 se rompe, el huevo 2 busca piso a piso entre el último piso seguro y
   el piso donde se rompió el primero.

La aplicación tiene dos modos:

| Modo | Qué hace |
| --- | --- |
| **Simulación** | Elige un piso de rotura al azar (1–100) y ejecuta el algoritmo automáticamente. |
| **Interactivo** | Tú eliges el piso de rotura (escribiéndolo o haciendo clic en el edificio) y el algoritmo intenta descubrirlo. |

La barra de **velocidad** acelera o ralentiza la animación.

---

## Requisitos

- **Node.js 20 o superior** (las pruebas se verificaron con Node 22). Descarga: <https://nodejs.org>
- Un navegador moderno (Chrome, Edge, Firefox, Safari).
- **No hay dependencias que instalar**: no hace falta `npm install`.

Comprueba tu versión con:

```bash
node --version
```

---

## Cómo iniciar la aplicación

> **Importante:** no abras `huevos-100-pisos.html` con doble clic. El código usa módulos ES
> (`import` / `export`) y los navegadores los bloquean cuando la página se abre como archivo (`file://`).
> Hay que servir la carpeta con un servidor web local. Elige **una** de estas opciones.

Abre una terminal **dentro de la carpeta del proyecto** (donde está `package.json`).

### Opción A: con Node (recomendada)

```bash
npm start
```

La primera vez descarga el paquete `serve` temporalmente (necesita internet). Cuando aparezca
`Serving!`, abre en el navegador:

**<http://localhost:3000/huevos-100-pisos.html>**

> El proyecto no tiene `index.html`, por eso la dirección `http://localhost:3000/` solo muestra la lista
> de archivos. Usa siempre la dirección con `huevos-100-pisos.html`.

Para detenerlo, pulsa `Ctrl + C` en la terminal.

### Opción B: con Python

```bash
python3 -m http.server 8000
```

(En Windows suele ser `python -m http.server 8000` o `py -m http.server 8000`.)
Abre **<http://localhost:8000/huevos-100-pisos.html>**.

### Opción C: con VS Code

Instala la extensión **Live Server**, abre `huevos-100-pisos.html` y pulsa **Go Live**
(abajo a la derecha).

### Si la página sale en blanco

Abre las herramientas de desarrollo del navegador (`F12`, pestaña *Console*). Si ves un error sobre el
**tipo MIME** de `script.js`, tu servidor está enviando los `.js` como `text/plain` (pasa con
`http.server` en algunas instalaciones de Windows). Usa la **Opción A**.

---

## Cómo ejecutar los tests

Las pruebas usan el ejecutor nativo de Node (`node:test`), sin librerías externas.

```bash
npm test
```

Equivale a `node --test`. Salida esperada al final:

```
# tests 88
# suites 20
# pass 88
# fail 0
```

Otras formas de ejecutarlas:

```bash
# Un solo archivo
node --test test/engine.test.js

# Solo las pruebas cuyo nombre contenga un texto
node --test --test-name-pattern="piso 37"

# Modo vigilante: vuelve a ejecutar al guardar cambios
node --test --watch
```

### Qué cubre cada archivo

| Archivo | Qué comprueba |
| --- | --- |
| `test/model.test.js` | Pruebas básicas originales: intervalo 14, validación del piso, `testDrop`, los 100 casos y el máximo de 14 lanzamientos. |
| `test/puzzle.test.js` | `EggDropPuzzle`: constantes de solo lectura, encapsulación (el piso de rotura no se filtra), validación estricta del constructor (tipos y rangos), `testDrop` monótono para los 100 pisos y cálculo del intervalo. |
| `test/engine.test.js` | `SimulationEngine`: el peor caso (14) coincide con el mínimo teórico calculado por programación dinámica; estructura en dos fases (saltos 14, 13, 12...); casos límite (pisos 1, 13, 14, 27 y 100); el motor espera al callback asíncrono, propaga errores y no guarda estado; funciona con puzzles de otro tamaño. |
| `test/game.test.js` | `GameManager` + `UIManager` ejecutando el `script.js` real sobre un DOM falso: arranque, modo simulación, modo interactivo, validación de entradas, selección de piso por clic, máquina de estados (ignora acciones mientras corre una partida) y limpieza entre partidas. |
| `test/html.test.js` | Contrato entre `huevos-100-pisos.html`, `style.css` y `script.js`: ids que pide la vista, archivos enlazados, `type="module"`, clases CSS que usa la animación y que el modelo no toca el DOM. |

`support/fake-dom.js` es una utilidad (no una prueba): un DOM mínimo que lee los ids del HTML real, para poder
probar la vista y el controlador desde Node sin navegador ni `jsdom`. Está fuera de `test/` a propósito,
porque `node --test` ejecuta todo lo que hay dentro de esa carpeta.

---

## Estructura del proyecto

```
.
├── huevos-100-pisos.html     # Página de la aplicación
├── style.css                 # Estilos y animaciones
├── script.js                 # Vista (UIManager) y controlador (GameManager)
├── model.js                  # Modelo: EggDropPuzzle y SimulationEngine
├── package.json              # Scripts: npm start / npm test
├── support/
│   └── fake-dom.js           # DOM falso para probar script.js en Node
├── test/
│   ├── model.test.js
│   ├── puzzle.test.js
│   ├── engine.test.js
│   ├── game.test.js
│   └── html.test.js
└── diagramas/
    ├── diagrama_clases.puml
    ├── diagrama_secuencia.puml           # fuente de los 5 diagramas de secuencia
    └── diagrama_secuencia_*.png          # los mismos diagramas ya renderizados
```

### Arquitectura (estilo MVC)

- **Modelo** (`model.js`): `EggDropPuzzle` guarda el estado y la matemática; `SimulationEngine` ejecuta el
  algoritmo óptimo. No conocen el DOM; avisan de cada lanzamiento mediante un *callback* asíncrono.
- **Vista** (`UIManager`): la única clase que toca el DOM (escena, animaciones, estadísticas y log).
- **Controlador** (`GameManager`): máquina de estados (`IDLE`, `SIMULATION_RUNNING`, `INTERACTIVE_WAITING`,
  `INTERACTIVE_RUNNING`) que conecta modelo y vista.

---

## Diagramas

Están en la carpeta `diagramas/`:

- `diagrama_clases.puml`: diagrama de clases.
- `diagrama_secuencia.puml`: diagrama de secuencia, dividido en 5 páginas (cada una con su `.png`):
  1. Arranque de la aplicación
  2. Modo simulación
  3. Modo interactivo
  4. Ejecución del algoritmo óptimo (`run`)
  5. Procesamiento de cada lanzamiento (`onDrop` / `animateDrop`)

Para regenerarlos o editarlos tienes tres opciones:

- Extensión **PlantUML** de VS Code (`Alt + D` para la vista previa).
- El editor en línea <https://www.plantuml.com/plantuml>.
- Por línea de comandos, con Java y el `.jar` de PlantUML:

  ```bash
  java -jar plantuml.jar -tpng diagramas/diagrama_secuencia.puml
  ```

  El diagrama de clases usa `skinparam linetype ortho`, que además necesita Graphviz instalado.
