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
    position: { x: 50, y: 150 },
    data: {
      titulo: 'Lector Web (Scraper)',
      icono: '📰',
      descripcion: 'Extrae el título de la página con Axios + Cheerio.',
      color: '#38bdf8',
      estado: 'idle',
      url: 'https://news.ycombinator.com/',
    },
  },
  {
    id: '2',
    type: 'workflow',
    position: { x: 390, y: 150 },
    data: {
      titulo: 'Procesador Inteligente',
      icono: '🤖',
      descripcion: 'El bot analiza el título y genera copy y hashtags.',
      color: '#a855f7',
      estado: 'idle',
    },
  },
  {
    id: '3',
    type: 'workflow',
    position: { x: 730, y: 150 },
    data: {
      titulo: 'Generador Gráfico',
      icono: '🎨',
      descripcion: 'Renderiza la tarjeta PNG y la guarda en el Escritorio.',
      color: '#ec4899',
      estado: 'idle',
    },
  },
];

const aristasIniciales: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
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

function VistaNodo({ id, salida }: { id: string; salida: SalidaNodo | undefined }) {
  const dato = salida?.[0];
  if (!dato) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Este nodo aún no se ha ejecutado.</div>;
  }

  if (id === '1') {
    return (
      <div style={{ ...estiloCaja, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ color: '#38bdf8', fontSize: 11 }}>TÍTULO EXTRAÍDO</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{texto(dato.titulo)}</div>
        {texto(dato.descripcion) && (
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}>{texto(dato.descripcion)}</div>
        )}
        <div style={{ color: '#94a3b8' }}>Fuente: {texto(dato.fuente)}</div>
        <div style={{ color: '#94a3b8' }}>Fecha: {texto(dato.fecha)}</div>
      </div>
    );
  }

  if (id === '2') {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...estiloCaja, flex: 1, minWidth: 280 }}>
          <div style={{ color: '#a855f7', fontSize: 11, marginBottom: 6 }}>COPY GENERADO POR EL BOT</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
            {texto(dato.textoRedes)}
          </div>
        </div>
        <div style={{ ...estiloCaja, minWidth: 220 }}>
          <div style={{ color: '#a855f7', fontSize: 11, marginBottom: 6 }}>HASHTAGS</div>
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

  const ruta = texto(dato.imagenPath);
  const vista = texto(dato.vistaPrevia);
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {vista && (
        <img
          src={vista}
          alt="Vista previa del post generado"
          style={{ height: 150, borderRadius: 8, border: '1px solid #334155' }}
        />
      )}
      <div style={{ ...estiloCaja, flex: 1, minWidth: 280 }}>
        <div style={{ color: '#ec4899', fontSize: 11 }}>ARCHIVO GENERADO</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, margin: '6px 0', wordBreak: 'break-all' }}>
          {ruta}
        </div>
        <button
          onClick={() => void navigator.clipboard.writeText(ruta)}
          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #475569', background: '#1e293b', color: '#f8fafc', cursor: 'pointer' }}
        >
          Copiar ruta
        </button>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
          {texto(dato.imagenNombre)} · {String(dato.tamanoKB ?? '?')} KB
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

    // Se envía solo lo necesario (id y url), no todo el estado visual
    const payload = {
      nodes: nodes.map((n) => ({ id: n.id, data: { url: n.data.url } })),
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[
              { id: '1', nombre: '📰 Nodo 1 · Extracción' },
              { id: '2', nombre: '🤖 Nodo 2 · Bot' },
              { id: '3', nombre: '🎨 Nodo 3 · Archivo' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPestana(p.id)}
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

          {errorGlobal && (
            <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#fecaca', fontSize: 13 }}>
              ✖ {errorGlobal}
            </div>
          )}

          <VistaNodo id={pestana} salida={salidas[pestana]} />

          



      
        </div>
      )}
    </div>
  );
}