import type { DescargaField } from './types';

/**
 * ERP import task name — one block per Excel row, wrapped in
 * `<CONTENT><TaskDS>...</TaskDS></CONTENT>`. Built from an example of the
 * ERP's own response (no sample request was available); validate against a
 * real import before relying on it.
 */
export const SUBTASK_NAME = 'SubTask_INSERT_ENVIODESC_002_001';

/** Excel columns a valid file must have; anything else falls back to a default. */
export const REQUIRED_COLUMNS = [
  'CTG',
  'CPORTE',
  'FECHA',
  'CODGRANO',
  'PESOBRUT',
  'PESOEGRE',
  'TOTNETO',
] as const;

/**
 * Every XML tag, in output order. FECING/FECSAL both derive from the single
 * FECHA column (dd/mm/yyyy in the source, ddmmyyyy in the output); HORING/
 * HORSAL have no source column and are always left blank.
 */
export const FIELDS: DescargaField[] = [
  { tag: 'CODGRANO', type: 'num' },
  { tag: 'GRANELBOLSA', type: 'text' },
  { tag: 'COSECHA', type: 'text' },
  { tag: 'FECING', type: 'date', source: 'FECHA' },
  { tag: 'HORING', type: 'blank' },
  { tag: 'FECSAL', type: 'date', source: 'FECHA' },
  { tag: 'HORSAL', type: 'blank' },
  { tag: 'CUITPUERTO', type: 'text' },
  { tag: 'NOMPUERTO', type: 'text' },
  { tag: 'RECIBIDOR', type: 'text' },
  { tag: 'NOMRECIBIDOR', type: 'text' },
  { tag: 'VENDEDOR', type: 'text' },
  { tag: 'NOMVENDEDOR', type: 'text' },
  { tag: 'CUITCORRCOMP', type: 'text' },
  { tag: 'NOMCORRCOMP', type: 'text' },
  { tag: 'ENTREGADOR', type: 'text' },
  { tag: 'NOMENTREGADOR', type: 'text' },
  { tag: 'CARGADOR', type: 'text' },
  { tag: 'NOMCARGADOR', type: 'text' },
  { tag: 'COMPRADOR', type: 'text' },
  { tag: 'NOMCOMPRADOR', type: 'text' },
  { tag: 'CUITCORRENDO', type: 'text' },
  { tag: 'NOMCORRENDO', type: 'text' },
  { tag: 'CUITCOMPENDO', type: 'text' },
  { tag: 'NOMCOMPENDO', type: 'text' },
  { tag: 'CORREDOR', type: 'text' },
  { tag: 'NOMCORREDOR', type: 'text' },
  { tag: 'PLANTA_ORIGEN', type: 'text' },
  { tag: 'NOMPLANTA_ORIGEN', type: 'text' },
  { tag: 'PROCEDE', type: 'text' },
  { tag: 'NOMPROCEDE', type: 'text' },
  { tag: 'DESTIN', type: 'text' },
  { tag: 'NOMDESTIN', type: 'text' },
  { tag: 'CODMOVIE', type: 'num' },
  { tag: 'PATCHA', type: 'text' },
  { tag: 'PESOBRUT', type: 'num' },
  { tag: 'PESOEGRE', type: 'num' },
  { tag: 'TOTBRUT', type: 'num' },
  { tag: 'TOTMERM', type: 'num' },
  { tag: 'TOTNETO', type: 'num' },
  { tag: 'PORHUME', type: 'num' },
  { tag: 'PMERMAHUME', type: 'num' },
  { tag: 'KGSHUME', type: 'num' },
  { tag: 'KGSBONHU', type: 'num' },
  { tag: 'PORZARAN', type: 'num' },
  { tag: 'KGSZARAN', type: 'num' },
  { tag: 'PORDESCA', type: 'num' },
  { tag: 'KGSDESCA', type: 'num' },
  { tag: 'PORVOLAT', type: 'num' },
  { tag: 'KGSVOLAT', type: 'num' },
  { tag: 'CANTBOLSA', type: 'num' },
  { tag: 'FUMIGADA', type: 'num' },
  { tag: 'PESOPROCEDE', type: 'num' },
  { tag: 'CONTRATO', type: 'text' },
  { tag: 'CPORTE', type: 'text' },
  { tag: 'TIPOTRANS', type: 'text', fixedDefault: 'A' },
  { tag: 'GRADO', type: 'num' },
  { tag: 'FACTOR', type: 'num' },
  { tag: 'OBS', type: 'text' },
  { tag: 'CONCALIDAD', type: 'text' },
  { tag: 'MOVSTOCK', type: 'text' },
  { tag: 'OBSANA', type: 'text' },
  { tag: 'CUITTRAN', type: 'text' },
  { tag: 'DOCUME', type: 'text' },
  { tag: 'NOMCONDUC', type: 'text' },
  { tag: 'PATACO', type: 'text' },
  { tag: 'KMSASFA', type: 'num' },
  { tag: 'KMSTIER', type: 'num' },
  { tag: 'TARIKMS', type: 'num' },
  { tag: 'TARITIE', type: 'num' },
  { tag: 'KGSSERVZARAN', type: 'num' },
  { tag: 'KGSSERVFUMIG', type: 'num' },
  { tag: 'KGSSERVAIREA', type: 'num' },
  { tag: 'KGSSERVSECAD', type: 'num' },
  { tag: 'NROCAU', type: 'text' },
  { tag: 'FECVTOCAU', type: 'text', fixedDefault: '00000000' },
  { tag: 'ANULADO', type: 'text' },
  { tag: 'CTG', type: 'text' },
];
