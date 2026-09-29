export interface WorkflowItem {
  json: Record<string, any>;
}

export interface CanvasNode {
  id: string;
  data?: { url?: string; cantidad?: number; evitarRepetidas?: boolean; colorAcento?: string };
}

export type NodeEvent =
  | { type: 'node'; nodeId: string; status: 'running' }
  | {
      type: 'node';
      nodeId: string;
      status: 'success';
      durationMs: number;
      output: Record<string, any>[];
    }
  | {
      type: 'node';
      nodeId: string;
      status: 'error';
      durationMs: number;
      error: string;
    }
  | { type: 'done'; success: boolean };