import { describe, expect, it } from 'vitest';
import {
  formatCuit,
  nameResolverFrom,
  normalizeCuit,
  resolveEmisorNombre,
  type EmisorMap,
} from '../emisores';

const db: EmisorMap = {
  // A mill nobody has in code, named from Configuración.
  '30710123450': { molinoId: 'm1', nombre: 'Molino Nuevo SA' },
  // A second CUIT of the SAME mill (N CUITs → 1 molino).
  '30710865607': { molinoId: 'm1', nombre: 'Molino Nuevo SA' },
  // A known mill renamed in the database: the database wins.
  '30500120882': { molinoId: 'm2', nombre: 'ACA Coop.' },
};

describe('resolveEmisorNombre', () => {
  it('reads the database first', () => {
    expect(resolveEmisorNombre('30710123450', db)).toBe('Molino Nuevo SA');
    expect(resolveEmisorNombre('30500120882', db)).toBe('ACA Coop.');
  });

  it('falls back to the code table for a CUIT the database does not have', () => {
    expect(resolveEmisorNombre('30700869918', db)).toBe('Bunge');
    expect(resolveEmisorNombre('30700869918')).toBe('Bunge');
  });

  it('returns null when neither knows the CUIT: "sin identificar", not an error', () => {
    expect(resolveEmisorNombre('20123456780', db)).toBeNull();
    expect(resolveEmisorNombre('20123456780')).toBeNull();
  });

  it('two CUITs of one mill resolve to the same name', () => {
    expect(resolveEmisorNombre('30710123450', db)).toBe(resolveEmisorNombre('30710865607', db));
  });

  it('tolerates a formatted CUIT', () => {
    expect(resolveEmisorNombre('30-71012345-0', db)).toBe('Molino Nuevo SA');
  });
});

describe('nameResolverFrom', () => {
  it('closes over the map', () => {
    const resolve = nameResolverFrom(db);
    expect(resolve('30710123450')).toBe('Molino Nuevo SA');
    expect(resolve('30507950848')).toBe('Molino Cañuelas');
    expect(resolve('20123456780')).toBeNull();
  });
});

describe('cuit helpers', () => {
  it('normalizes to digits and formats back', () => {
    expect(normalizeCuit('30-50012088-2')).toBe('30500120882');
    expect(formatCuit('30500120882')).toBe('30-50012088-2');
    expect(formatCuit('123')).toBe('123');
  });
});
