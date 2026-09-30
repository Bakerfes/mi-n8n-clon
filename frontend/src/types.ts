import type { Node } from '@xyflow/react';

export type EstadoNodo = 'idle' | 'running' | 'success' | 'error';

export type WorkflowNodeData = {
  titulo: string;
  icono: string;
  descripcion: string;
  color: string;
  estado: EstadoNodo;
  url?: string;
  cantidad?: number;
  evitarRepetidas?: boolean;
  colorAcento?: string;
  bufferAccessToken?: string;
  bufferProfileId?: string;
  bufferModo?: 'queue' | 'schedule' | 'now';
  bufferFechaProgramada?: string;
  canalNombre?: string;
  imgbbApiKey?: string;
  duracionMs?: number;
  error?: string;
};

export type WorkflowNode = Node<WorkflowNodeData, 'workflow'>;

export type SalidaNodo = Record<string, unknown>[];

export type NodeEvent =
  | { type: 'node'; nodeId: string; status: 'running' }
  | { type: 'node'; nodeId: string; status: 'success'; durationMs: number; output: SalidaNodo }
  | { type: 'node'; nodeId: string; status: 'error'; durationMs: number; error: string }
  | { type: 'done'; success: boolean };