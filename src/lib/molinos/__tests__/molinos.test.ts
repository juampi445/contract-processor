import { describe, expect, it } from 'vitest';
import {
  cuitsSinIdentificar,
  formatCuit,
  nameResolverFrom,
  normalizeCuit,
  resolveMolinoNombre,
  type MolinoMap,
} from '../molinos';

const catalogo: MolinoMap = {
  '30710123450': { molinoId: 'm1', nombre: 'Molino del Sur' },
  // A second CUIT of the SAME mill (N CUITs → 1 molino).
  '30710865607': { molinoId: 'm1', nombre: 'Molino del Sur' },
  '30500120882': { molinoId: 'm2', nombre: 'Cooperativa Norte' },
};

describe('resolveMolinoNombre', () => {
  it('reads the catalog', () => {
    expect(resolveMolinoNombre('30710123450', catalogo)).toBe('Molino del Sur');
    expect(resolveMolinoNombre('30500120882', catalogo)).toBe('Cooperativa Norte');
  });

  it('has no fallback: a CUIT outside the catalog is unnamed, whoever it is', () => {
    // 30700869918 has reading rules in retenciones/issuers.ts; that says
    // nothing about its name. Until someone names it, it is "sin identificar".
    expect(resolveMolinoNombre('30700869918', catalogo)).toBeNull();
    expect(resolveMolinoNombre('30700869918')).toBeNull();
    expect(resolveMolinoNombre('20123456780', catalogo)).toBeNull();
  });

  it('two CUITs of one mill resolve to the same name', () => {
    expect(resolveMolinoNombre('30710123450', catalogo)).toBe(
      resolveMolinoNombre('30710865607', catalogo),
    );
  });

  it('tolerates a formatted CUIT', () => {
    expect(resolveMolinoNombre('30-71012345-0', catalogo)).toBe('Molino del Sur');
  });
});

describe('nameResolverFrom', () => {
  it('closes over the map and only the map', () => {
    const resolve = nameResolverFrom(catalogo);
    expect(resolve('30710123450')).toBe('Molino del Sur');
    expect(resolve('30507950848')).toBeNull();
  });
});

describe('cuitsSinIdentificar', () => {
  const vistos = [
    { cuit: '30710123450', vistos: 3, ultimaFecha: '2026-09-01' }, // in catalog
    { cuit: '30700869918', vistos: 2, ultimaFecha: '2026-08-14' },
    { cuit: '30-71160163-3', vistos: 5, ultimaFecha: null }, // formatted, unknown
    { cuit: '123', vistos: 9, ultimaFecha: null }, // not a CUIT at all
  ];

  it('keeps the seen CUITs the catalog does not know, most frequent first', () => {
    expect(cuitsSinIdentificar(vistos, catalogo)).toEqual([
      { cuit: '30711601633', vistos: 5, ultimaFecha: null },
      { cuit: '30700869918', vistos: 2, ultimaFecha: '2026-08-14' },
    ]);
  });

  it('is empty when everything seen is already named', () => {
    expect(cuitsSinIdentificar([vistos[0]], catalogo)).toEqual([]);
  });
});

describe('cuit helpers', () => {
  it('normalizes to digits and formats back', () => {
    expect(normalizeCuit('30-50012088-2')).toBe('30500120882');
    expect(formatCuit('30500120882')).toBe('30-50012088-2');
    expect(formatCuit('123')).toBe('123');
  });
});
