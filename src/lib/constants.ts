// Lab configuration constants
// 10 Labs, each with 31 PCs
// Lab 1: LAB100-LAB130, Lab 2: LAB200-LAB230, ..., Lab 10: LAB1000-LAB1030

export interface LabConfig {
  id: number;
  name: string;
  prefix: number;
  pcStart: number;
  pcEnd: number;
  pcs: string[];
}

export const LABS: LabConfig[] = Array.from({ length: 10 }, (_, i) => {
  const labNumber = i + 1;
  const prefix = labNumber * 100;
  const pcCount = (labNumber === 5 || labNumber === 7) ? 36 : 31;
  const pcs = Array.from({ length: pcCount }, (_, j) => `LAB${prefix + j}`);

  return {
    id: labNumber,
    name: `LAB ${labNumber}`,
    prefix,
    pcStart: prefix,
    pcEnd: prefix + (pcCount - 1),
    pcs,
  };
});

export const TOTAL_PCS = LABS.reduce((acc, lab) => acc + lab.pcs.length, 0);

export const MAINTENANCE_REASONS = [
  'Não liga',
  'Tela azul / erro de sistema',
  'Sem internet / rede',
  'Teclado com defeito',
  'Mouse com defeito',
  'Monitor com defeito',
  'Lento / travando',
  'Software não funciona',
  'HD / SSD com problema',
  'Fonte com problema',
  'Memória RAM com defeito',
  'Cabo solto / danificado',
  'Outro',
] as const;

export type MaintenanceReason = (typeof MAINTENANCE_REASONS)[number];

export type PCStatus = 'ok' | 'maintenance';

export interface PCRecord {
  id: string;
  pc_name: string;
  lab_id: number;
  status: PCStatus;
  reported_by: string | null;
  reported_at: string | null;
  reason: string | null;
  notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface MaintenanceLog {
  id: string;
  pc_name: string;
  lab_id: number;
  status: PCStatus;
  reason: string;
  notes: string | null;
  reported_by: string;
  reported_by_email: string;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}
