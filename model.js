/* ---------------------------------------------------------------------
 * 1. EggDropPuzzle — lógica central del acertijo
 * Encapsula (campos privados #) el número de pisos, huevos y el piso de
 * rotura. Desde fuera solo se puede "probar" un piso con testDrop().
 * ------------------------------------------------------------------- */

export class EggDropPuzzle {
   #totalFloors = 100;
   #totalEggs = 2;
   #breakingFloor;

   constructor(breakingFloor) {
      if (!Number.isInteger(breakingFloor) || breakingFloor < 1 || breakingFloor > this.#totalFloors)
         throw new RangeError('El piso de rotura debe ser un entero entre 1 y 100.');
      this.#breakingFloor = breakingFloor;
   }
   get totalFloors() { return this.#totalFloors; }
   get totalEggs() { return this.#totalEggs; }

   /* Intervalo inicial óptimo.
    * Con x lanzamientos en el peor caso, el primer huevo cae en x, luego
    * subimos x-1, x-2, ... pisos (cada vez que el huevo 1 resiste, le queda
    * un lanzamiento menos al huevo 2 para el tramo lineal). Cubrimos así
    *   x + (x-1) + ... + 1 = x(x+1)/2 pisos.
    * Buscamos el menor x con x(x+1)/2 >= totalFloors. Para 100 pisos: x = 14,
    * porque 14·15/2 = 105 >= 100 (y 13·14/2 = 91 < 100). */
   calculateOptimalStrategyInterval() {
      let x = 1;
      while ((x * (x + 1)) / 2 < this.#totalFloors) x++;
      return x;
   }

   /* mostrar el resultado final. */
   getBreakingFloor() { return this.#breakingFloor; }

   /* Un huevo se rompe si se lanza desde el piso de rotura o uno superior. */
   testDrop(floor) { return floor >= this.#breakingFloor; }
}

/* ---------------------------------------------------------------------
 * 2. SimulationEngine — ejecuta el algoritmo óptimo
 * Es asíncrono para que la vista pueda animar cada lanzamiento antes de
 * continuar 
 * ------------------------------------------------------------------- */
export class SimulationEngine {
   async runOptimalAlgorithm(puzzle, onDropCallback) {
      const total = puzzle.totalFloors;
      let interval = puzzle.calculateOptimalStrategyInterval(); // 14
      let drops = 0, lastSafe = 0, floor = 0, brokeAt = null;

      const report = (currentFloor, eggNumber, isBroken) =>
         onDropCallback({ currentFloor, eggNumber, isBroken, dropsCount: ++drops });

      /* Fase 1 — Huevo 1: saltos decrecientes 14, +13, +12, +11, ... = 14, 27, 39, 50, 60, ...
       * Cada salto más pequeño compensa el lanzamiento ya gastado, de modo
       * que el total de lanzamientos en el peor caso siempre sea 14. */
      while (brokeAt === null) {
         floor = Math.min(floor + interval, total);
         const broken = puzzle.testDrop(floor);
         await report(floor, 1, broken);
         if (broken) brokeAt = floor;
         else if (floor >= total) return { breakingFloor: null, drops };   // nunca se rompe
         else { lastSafe = floor; interval = Math.max(interval - 1, 1); }
      }

      /* Fase 2 — Huevo 2: búsqueda lineal entre el último piso seguro 
       * y el piso donde se rompió el huevo 1. Si se rompe en uno de
       * ellos, ese es el piso; si resiste todos, el piso de rotura es brokeAt. */
      for (let f = lastSafe + 1; f < brokeAt; f++) {
         const broken = puzzle.testDrop(f);
         await report(f, 2, broken);
         if (broken) return { breakingFloor: f, drops };
      }
      return { breakingFloor: brokeAt, drops };
   }
}