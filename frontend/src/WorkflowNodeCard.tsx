import { memo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { EstadoNodo, WorkflowNode } from './types.ts';

const ETIQUETAS: Record<EstadoNodo, { texto: string; color: string }> = {
  idle: { texto: 'En espera', color: '#94a3b8' },
  running: { texto: 'Ejecutando…', color: '#facc15' },
  success: { texto: 'Completado', color: '#22c55e' },
  error: { texto: 'Error', color: '#ef4444' },
};

export default memo(function WorkflowNodeCard({ id, data }: NodeProps<WorkflowNode>) {
  const { updateNodeData } = useReactFlow<WorkflowNode>();
  const etiqueta = ETIQUETAS[data.estado];
  
  // Local state for interactive inputs to prevent focus loss during typing
  const [url, setUrl] = useState(data.url ?? '');
  const [cantidad, setCantidad] = useState(data.cantidad ?? 5);

  // Sync with external data changes
  useEffect(() => {
    setUrl(data.url ?? '');
    setCantidad(data.cantidad ?? 5);
  }, [data.url, data.cantidad]);

  const estiloTarjeta = { '--acento': data.color } as CSSProperties;

  return (
    <div className={`nodo nodo--${data.estado}`} style={estiloTarjeta}>
      <Handle type="target" position={Position.Left} />

      <div className="nodo__titulo">
        <span>{data.icono}</span>
        <strong>{data.titulo}</strong>
      </div>

      <div className="nodo__descripcion">{data.descripcion}</div>

      {id === '1' && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, color: '#94a3b8' }}>URL a extraer:</label>
          <input
            className="nodrag nodo__input"
            type="text"
            value={url}
            disabled={data.estado === 'running'}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => updateNodeData(id, { url })}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>Noticias a procesar:</label>
            <input
              className="nodrag nodo__input"
              type="number"
              min={1}
              max={10}
              value={cantidad}
              disabled={data.estado === 'running'}
              onChange={(e) => setCantidad(Number(e.target.value))}
              onBlur={() => {
                const val = Math.min(10, Math.max(1, cantidad || 1));
                setCantidad(val);
                updateNodeData(id, { cantidad: val });
              }}
              style={{ width: 60, marginTop: 0 }}
            />
          </div>

          <label
            className="nodrag"
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={data.evitarRepetidas ?? true}
              disabled={data.estado === 'running'}
              onChange={(e) => updateNodeData(id, { evitarRepetidas: e.target.checked })}
            />
            Evitar noticias ya publicadas
          </label>
        </div>
      )}

      {id === '3' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Color de la tarjeta:</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['#38bdf8', '#a855f7', '#ec4899', '#10b981', '#f59e0b'].map((col) => (
              <button
                key={col}
                type="button"
                className="nodrag"
                onClick={() => updateNodeData(id, { colorAcento: col })}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: col,
                  border: (data.colorAcento || '#38bdf8') === col ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transform: (data.colorAcento || '#38bdf8') === col ? 'scale(1.25)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                  padding: 0,
                }}
                title={col}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: data.colorAcento || '#38bdf8', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🔗 Enlaces y editor activos</span>
          </div>
        </div>
      )}

      <div className="nodo__estado" style={{ color: etiqueta.color }}>
        {data.estado === 'running' && <span className="spinner" />}
        {data.estado === 'success' && <span>✔</span>}
        {data.estado === 'error' && <span>✖</span>}
        <span>{etiqueta.texto}</span>
        {data.duracionMs !== undefined && data.estado !== 'running' && (
          <span style={{ color: '#64748b' }}>· {data.duracionMs} ms</span>
        )}
      </div>

      {data.estado === 'error' && data.error && (
        <div className="nodo__error">{data.error}</div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
});