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
  const [canalNombre, setCanalNombre] = useState(data.canalNombre ?? 'Noticontrol8');
  const [bufferModo, setBufferModo] = useState(data.bufferModo ?? 'queue');
  const [bufferToken, setBufferToken] = useState(data.bufferAccessToken ?? '');
  const [imgbbKey, setImgbbKey] = useState(data.imgbbApiKey ?? '');

  const getFechaDefault = () => {
    const d = new Date(Date.now() + 3600000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  };

  const [bufferFecha, setBufferFecha] = useState(data.bufferFechaProgramada ?? getFechaDefault());

  // Sync with external data changes
  useEffect(() => {
    setUrl(data.url ?? '');
    setCantidad(data.cantidad ?? 5);
    setCanalNombre(data.canalNombre ?? 'Noticontrol8');
    setBufferModo(data.bufferModo ?? 'queue');
    setBufferToken(data.bufferAccessToken ?? '');
    setImgbbKey(data.imgbbApiKey ?? '');
    setBufferFecha(data.bufferFechaProgramada ?? getFechaDefault());
  }, [data.url, data.cantidad, data.canalNombre, data.bufferModo, data.bufferAccessToken, data.imgbbApiKey, data.bufferFechaProgramada]);

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

      {id === '4' && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, color: '#94a3b8' }}>Canal Buffer:</label>
          <input
            className="nodrag nodo__input"
            type="text"
            value={canalNombre}
            disabled={data.estado === 'running'}
            placeholder="ej. Noticontrol8"
            onChange={(e) => setCanalNombre(e.target.value)}
            onBlur={() => updateNodeData(id, { canalNombre })}
          />

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>Modo de publicación:</label>
            <select
              className="nodrag nodo__input"
              value={bufferModo}
              disabled={data.estado === 'running'}
              onChange={(e) => {
                const modo = e.target.value as 'queue' | 'schedule' | 'now';
                setBufferModo(modo);
                updateNodeData(id, { bufferModo: modo });
              }}
              style={{ background: '#0f172a', color: '#f8fafc', padding: '4px 8px', width: '100%', marginTop: 2 }}
            >
              <option value="schedule">📅 Programar Fecha y Hora (Calendario)</option>
              <option value="queue">📥 Añadir a la cola estándar (Buffer Queue)</option>
              <option value="now">⚡ Publicar de inmediato (Share Now)</option>
            </select>
          </div>

          {bufferModo === 'schedule' && (
            <div style={{ marginTop: 8, background: 'rgba(99, 102, 241, 0.1)', padding: 8, borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <label style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                📅 Fecha y hora de lanzamiento:
              </label>
              <input
                className="nodrag nodo__input"
                type="datetime-local"
                value={bufferFecha}
                disabled={data.estado === 'running'}
                onChange={(e) => {
                  setBufferFecha(e.target.value);
                  updateNodeData(id, { bufferFechaProgramada: e.target.value });
                }}
                onBlur={() => updateNodeData(id, { bufferFechaProgramada: bufferFecha })}
                style={{
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid #6366f1',
                  borderRadius: 4,
                  padding: '5px 8px',
                  width: '100%',
                  fontSize: 12,
                  colorScheme: 'dark',
                }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="nodrag"
                  onClick={() => {
                    const hoy18 = new Date();
                    hoy18.setHours(18, 0, 0, 0);
                    if (hoy18.getTime() <= Date.now()) hoy18.setDate(hoy18.getDate() + 1);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const val = `${hoy18.getFullYear()}-${pad(hoy18.getMonth() + 1)}-${pad(hoy18.getDate())}T18:00`;
                    setBufferFecha(val);
                    updateNodeData(id, { bufferFechaProgramada: val });
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#c7d2fe', border: '1px solid #4338ca', cursor: 'pointer' }}
                >
                  Hoy 6:00 PM
                </button>
                <button
                  type="button"
                  className="nodrag"
                  onClick={() => {
                    const manana = new Date(Date.now() + 86400000);
                    manana.setHours(9, 0, 0, 0);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const val = `${manana.getFullYear()}-${pad(manana.getMonth() + 1)}-${pad(manana.getDate())}T09:00`;
                    setBufferFecha(val);
                    updateNodeData(id, { bufferFechaProgramada: val });
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#c7d2fe', border: '1px solid #4338ca', cursor: 'pointer' }}
                >
                  Mañana 9:00 AM
                </button>
                <button
                  type="button"
                  className="nodrag"
                  onClick={() => {
                    const en2h = new Date(Date.now() + 7200000);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const val = `${en2h.getFullYear()}-${pad(en2h.getMonth() + 1)}-${pad(en2h.getDate())}T${pad(en2h.getHours())}:${pad(en2h.getMinutes())}`;
                    setBufferFecha(val);
                    updateNodeData(id, { bufferFechaProgramada: val });
                  }}
                  style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#c7d2fe', border: '1px solid #4338ca', cursor: 'pointer' }}
                >
                  En 2 Horas
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>Access Token (API):</label>
            <input
              className="nodrag nodo__input"
              type="password"
              value={bufferToken}
              disabled={data.estado === 'running'}
              placeholder="Opcional (Sandbox si está vacío)"
              onChange={(e) => setBufferToken(e.target.value)}
              onBlur={() => updateNodeData(id, { bufferAccessToken: bufferToken })}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>
              🖼️ imgbb API Key <span style={{ color: '#64748b' }}>(para adjuntar imagen PNG generada)</span>:
            </label>
            <input
              className="nodrag nodo__input"
              type="password"
              value={imgbbKey}
              disabled={data.estado === 'running'}
              placeholder="Obtén gratis en imgbb.com/api"
              onChange={(e) => setImgbbKey(e.target.value)}
              onBlur={() => updateNodeData(id, { imgbbApiKey: imgbbKey })}
            />
          </div>

          <div style={{ fontSize: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: bufferToken ? '#22c55e' : '#818cf8' }}>
              {bufferToken ? '🟢 Token Buffer Configurado' : `🧪 Modo Sandbox (${canalNombre || 'Noticontrol8'})`}
            </span>
            <span style={{ color: imgbbKey ? '#22c55e' : '#f59e0b' }}>
              {imgbbKey ? '🖼️ Imagen PNG lista para adjuntar' : '⚠️ Sin imgbb key: se usará URL de la noticia'}
            </span>
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