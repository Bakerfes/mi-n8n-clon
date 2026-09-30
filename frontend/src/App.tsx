import { useCallback, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Edge, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNodeCard from './WorkflowNodeCard.tsx';
import type { NodeEvent, SalidaNodo, WorkflowNode, WorkflowNodeData } from './types.ts';

const API_URL = 'http://localhost:3001/api/execute';

const nodeTypes = { workflow: WorkflowNodeCard };

const nodosIniciales: WorkflowNode[] = [
  {
    id: '1',
    type: 'workflow',
    position: { x: 30, y: 140 },
    data: {
      titulo: 'Lector Web (Scraper)',
      icono: '📰',
      descripcion: 'Extrae titulares e imágenes con Axios + Cheerio.',
      color: '#38bdf8',
      estado: 'idle',
      url: 'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREZzY3pJU0JtVnpMVFF4T1NnQVAB?hl=es-419&gl=CO&ceid=CO%3Aes-419',
      cantidad: 5,
      evitarRepetidas: true,
    },
  },
  {
    id: '2',
    type: 'workflow',
    position: { x: 370, y: 140 },
    data: {
      titulo: 'Procesador Inteligente',
      icono: '🤖',
      descripcion: 'El bot analiza el contenido y genera copy y hashtags.',
      color: '#a855f7',
      estado: 'idle',
    },
  },
  {
    id: '3',
    type: 'workflow',
    position: { x: 710, y: 140 },
    data: {
      titulo: 'Generador Gráfico',
      icono: '🎨',
      descripcion: 'Renderiza la tarjeta PNG infográfica vertical (1080x1350).',
      color: '#ec4899',
      estado: 'idle',
      colorAcento: '#0284c7',
    },
  },
  {
    id: '4',
    type: 'workflow',
    position: { x: 1050, y: 140 },
    data: {
      titulo: 'Publicador Buffer',
      icono: '📢',
      descripcion: 'Programa y encola las publicaciones en Buffer (Noticontrol8).',
      color: '#6366f1',
      estado: 'idle',
      canalNombre: 'Noticontrol8',
      bufferModo: 'queue',
    },
  },
];

const aristasIniciales: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
];

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const estiloCaja = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: 12,
} as const;

function VistaNodo({ id, salida, indice = 0 }: { id: string; salida: SalidaNodo | undefined; indice?: number }) {
  const itemIndex = Math.min(Math.max(0, indice), (salida?.length ?? 1) - 1);
  const dato = salida?.[itemIndex];
  if (!dato) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Este nodo aún no se ha ejecutado.</div>;
  }

  if (id === '1') {
    const imagenNoticia = texto(dato.imagenNoticiaUrl);
    const enlace = texto(dato.enlace);
    return (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {imagenNoticia && (
          <img
            src={imagenNoticia}
            alt="Imagen extraída"
            style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #334155' }}
          />
        )}
        <div style={{ ...estiloCaja, flex: 1, minWidth: 280, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ color: '#38bdf8', fontSize: 11, fontWeight: 700 }}>TÍTULO EXTRAÍDO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>{texto(dato.titulo)}</div>
          {texto(dato.descripcion) && (
            <div style={{ color: '#cbd5e1', marginBottom: 8 }}>{texto(dato.descripcion)}</div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 12 }}>
            {texto(dato.medio) && <span>Medio: <strong style={{ color: '#f8fafc' }}>{texto(dato.medio)}</strong></span>}
            {texto(dato.categoria) && <span>Categoría: <strong style={{ color: '#38bdf8' }}>{texto(dato.categoria)}</strong></span>}
            {enlace && (
              <a href={enlace} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                🔗 Abrir noticia original ↗
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (id === '2') {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...estiloCaja, flex: 1, minWidth: 280 }}>
          <div style={{ color: '#a855f7', fontSize: 11, marginBottom: 6, fontWeight: 700 }}>COPY GENERADO POR EL BOT</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: '#f8fafc' }}>
            {texto(dato.textoRedes)}
          </div>
        </div>
        <div style={{ ...estiloCaja, minWidth: 220 }}>
          <div style={{ color: '#a855f7', fontSize: 11, marginBottom: 6, fontWeight: 700 }}>HASHTAGS RECOMENDADOS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {lista(dato.hashtags).map((h) => (
              <span key={h} style={{ background: '#334155', color: '#38bdf8', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (id === '3') {
    const ruta = texto(dato.imagenPath);
    const vista = texto(dato.vistaPrevia);
    return (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {vista && (
          <img
            src={vista}
            alt="Vista previa del post generado"
            style={{ height: 160, borderRadius: 8, border: '1px solid #334155' }}
          />
        )}
        <div style={{ ...estiloCaja, flex: 1, minWidth: 280 }}>
          <div style={{ color: '#ec4899', fontSize: 11, fontWeight: 700 }}>ARCHIVO INFOGRÁFICO GENERADO</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, margin: '6px 0', wordBreak: 'break-all', color: '#f8fafc' }}>
            {ruta}
          </div>
          <button
            onClick={() => void navigator.clipboard.writeText(ruta)}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #475569', background: '#1e293b', color: '#f8fafc', cursor: 'pointer' }}
          >
            Copiar ruta
          </button>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
            {texto(dato.imagenNombre)} · {String(dato.tamanoKB ?? '?')} KB · Formato Vertical (1080x1350)
          </div>
        </div>
      </div>
    );
  }

  // id === '4' (Buffer)
  const estado = texto(dato.estadoBuffer) || 'simulado';
  const canal = texto(dato.canal) || texto(dato.bufferCanalNombre) || 'Noticontrol8';
  const updateId = texto(dato.bufferUpdateId) || 'buf_123';
  const mensaje = texto(dato.mensaje);
  const textoEnviado = texto(dato.textoEnviado) || texto(dato.textoRedes);
  const scheduled = texto(dato.scheduledAt);
  const fechaLegible = texto(dato.fechaFormateada) || (scheduled ? new Date(scheduled).toLocaleString() : '');
  const vista = texto(dato.vistaPrevia);
  const modoEnvio = texto(dato.modoEnvio);
  const modo = modoEnvio === 'now' ? '⚡ Publicación Inmediata' : modoEnvio === 'schedule' ? '📅 Programado en Calendario' : '📥 Encolado en Buffer';

  const colorBadge =
    estado === 'publicado'
      ? '#22c55e'
      : estado === 'programado'
        ? '#6366f1'
        : estado === 'encolado'
          ? '#38bdf8'
          : estado === 'error'
            ? '#ef4444'
            : '#818cf8';

  const textoBadge =
    estado === 'publicado'
      ? 'PUBLICADO'
      : estado === 'programado'
        ? 'PROGRAMADO'
        : estado === 'encolado'
          ? 'EN COLA BUFFER'
          : estado === 'error'
            ? 'ERROR API'
            : 'PROGRAMADO (SANDBOX)';

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {vista && (
        <img
          src={vista}
          alt="Tarjeta adjunta al post de Buffer"
          style={{ height: 160, borderRadius: 8, border: '1px solid #334155' }}
        />
      )}
      <div style={{ ...estiloCaja, flex: 1, minWidth: 290 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                color: colorBadge,
                border: `1px solid ${colorBadge}`,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {textoBadge}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Canal: <strong style={{ color: '#f8fafc' }}>{canal}</strong></span>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>ID: {updateId}</span>
        </div>

        <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
          {mensaje}
        </div>

        <div style={{ background: '#090d16', padding: 10, borderRadius: 6, border: '1px solid #1e293b', marginBottom: 10 }}>
          <div style={{ color: '#818cf8', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>TEXTO ENVIADO A BUFFER</div>
          <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#e2e8f0', maxHeight: 80, overflowY: 'auto' }}>
            {textoEnviado}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#94a3b8' }}>
          <span>Modo: <strong style={{ color: '#f8fafc' }}>{modo}</strong></span>
          {fechaLegible && (
            <span style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: 6, color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
              📅 <strong>{fechaLegible}</strong>
            </span>
          )}
          <button
            onClick={() => void navigator.clipboard.writeText(textoEnviado)}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            Copiar copy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(nodosIniciales);
  const [edges, setEdges] = useState<Edge[]>(aristasIniciales);
  const [salidas, setSalidas] = useState<Record<string, SalidaNodo>>({});
  const [pestana, setPestana] = useState<string>('1');
  const [ejecutando, setEjecutando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [noticia, setNoticia] = useState(0);

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const actualizarNodo = useCallback((id: string, parcial: Partial<WorkflowNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...parcial } } : n))
    );
  }, []);

  // Aristas animadas según el estado de los nodos
  const aristasVisuales = useMemo(() => {
    const estado = new Map(nodes.map((n) => [n.id, n.data.estado]));
    return edges.map((e) => ({
      ...e,
      animated: estado.get(e.target) === 'running',
      style: {
        stroke: estado.get(e.source) === 'success' ? '#22c55e' : '#475569',
        strokeWidth: 2,
      },
    }));
  }, [edges, nodes]);

  const procesarEvento = (ev: NodeEvent) => {
    if (ev.type === 'done') return;

    if (ev.status === 'running') {
      actualizarNodo(ev.nodeId, { estado: 'running' });
    } else if (ev.status === 'success') {
      actualizarNodo(ev.nodeId, { estado: 'success', duracionMs: ev.durationMs });
      setSalidas((prev) => ({ ...prev, [ev.nodeId]: ev.output }));
      setPestana(ev.nodeId);
    } else {
      actualizarNodo(ev.nodeId, { estado: 'error', duracionMs: ev.durationMs, error: ev.error });
      setErrorGlobal(`Nodo ${ev.nodeId}: ${ev.error}`);
      setPestana(ev.nodeId);
    }
  };

  const ejecutarFlujo = async () => {
    if (ejecutando) return;
    setEjecutando(true);
    setErrorGlobal(null);
    setSalidas({});
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, estado: 'idle', duracionMs: undefined, error: undefined },
      }))
    );

    // Se envían los parámetros configurados de cada nodo
    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        data: {
          url: n.data.url,
          cantidad: n.data.cantidad,
          evitarRepetidas: n.data.evitarRepetidas,
          colorAcento: n.data.colorAcento,
          bufferAccessToken: n.data.bufferAccessToken,
          bufferProfileId: n.data.bufferProfileId,
          bufferModo: n.data.bufferModo,
          bufferFechaProgramada: n.data.bufferFechaProgramada,
          canalNombre: n.data.canalNombre,
        },
      })),
      connections: edges,
    };

    try {
      const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!respuesta.ok || !respuesta.body) {
        throw new Error(`El servidor respondió con estado ${respuesta.status}`);
      }

      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        buffer += decodificador.decode(value, { stream: true });
        const lineas = buffer.split('\n');
        buffer = lineas.pop() ?? '';
        for (const linea of lineas) {
          if (linea.trim()) procesarEvento(JSON.parse(linea) as NodeEvent);
        }
      }
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'Error desconocido';
      setErrorGlobal(
        detalle === 'Failed to fetch'
          ? 'No se pudo conectar con el motor en http://localhost:3001. ¿Está encendido el backend?'
          : detalle
      );
    } finally {
      setEjecutando(false);
    }
  };

  const hayPanel = Object.keys(salidas).length > 0 || errorGlobal !== null;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#f8fafc' }}>
      {/* Barra superior */}
      <div style={{ height: 60, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ fontWeight: 'bold', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚡ n8n Local Studio</span>
          <span style={{ fontSize: 12, background: '#334155', padding: '2px 8px', borderRadius: 12, color: '#38bdf8' }}>
            {ejecutando ? 'Ejecutando…' : 'Modo Interactivo'}
          </span>
        </div>
        <button
          onClick={() => void ejecutarFlujo()}
          disabled={ejecutando}
          style={{ padding: '8px 16px', backgroundColor: ejecutando ? '#475569' : '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 6, cursor: ejecutando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {ejecutando ? '⏳ Ejecutando…' : '▶ Ejecutar Flujo'}
        </button>
      </div>

      {/* Lienzo */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={aristasVisuales}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#1e293b" gap={24} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Panel inferior */}
      {hayPanel && (
        <div style={{ height: 270, background: '#1e293b', borderTop: '1px solid #334155', padding: 12, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: '1', nombre: '📰 Nodo 1 · Extracción' },
                { id: '2', nombre: '🤖 Nodo 2 · Bot' },
                { id: '3', nombre: '🎨 Nodo 3 · Tarjeta' },
                { id: '4', nombre: '📢 Nodo 4 · Buffer' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPestana(p.id);
                    setNoticia(0);
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: '1px solid #475569',
                    background: pestana === p.id ? '#38bdf8' : '#0f172a',
                    color: pestana === p.id ? '#0f172a' : '#f8fafc',
                    fontWeight: pestana === p.id ? 700 : 400,
                  }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>

            {salidas[pestana] && salidas[pestana].length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Noticia:</span>
                {salidas[pestana].map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNoticia(idx)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      border: '1px solid #475569',
                      background: noticia === idx ? '#38bdf8' : '#0f172a',
                      color: noticia === idx ? '#0f172a' : '#f8fafc',
                      cursor: 'pointer',
                      fontWeight: noticia === idx ? 700 : 400,
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {errorGlobal && (
            <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#fecaca', fontSize: 13 }}>
              ✖ {errorGlobal}
            </div>
          )}

          <VistaNodo id={pestana} salida={salidas[pestana]} indice={noticia} />

          



      
        </div>
      )}
    </div>
  );
}