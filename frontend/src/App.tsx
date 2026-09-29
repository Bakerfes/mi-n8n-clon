import { useCallback, useMemo, useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Edge, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNodeCard from './WorkflowNodeCard.tsx';
import type { NodeEvent, SalidaNodo, WorkflowNode, WorkflowNodeData } from './types.ts';

const API_URL = 'http://localhost:3001/api/execute';
const URL_GOOGLE_NOTICIAS_COLOMBIA = 'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREZzY3pJU0JtVnpMVFF4T1NnQVAB?hl=es-419&gl=CO&ceid=CO%3Aes-419';

const nodeTypes = { workflow: WorkflowNodeCard };

const nodosIniciales: WorkflowNode[] = [
  {
    id: '1',
    type: 'workflow',
    position: { x: 50, y: 150 },
    data: {
      titulo: 'Lector Web (Scraper)',
      icono: '📰',
      descripcion: 'Extrae titulares reales. Detecta Google Noticias y usa su feed RSS.',
      color: '#38bdf8',
      estado: 'idle',
      url: URL_GOOGLE_NOTICIAS_COLOMBIA,
      cantidad: 5,
      evitarRepetidas: true,
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
      titulo: 'Generador Gráfico & Editor',
      icono: '🎨',
      descripcion: 'Renderiza la tarjeta PNG con enlaces e incluye editor interactivo.',
      color: '#ec4899',
      colorAcento: '#38bdf8',
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

function EditorNodo3({
  dato,
  indice,
  total,
  onActualizarDato,
}: {
  dato: Record<string, unknown>;
  indice: number;
  total: number;
  onActualizarDato: (nuevo: Record<string, unknown>) => void;
}) {
  const [titulo, setTitulo] = useState(texto(dato.titulo));
  const [resumenBot, setResumenBot] = useState(texto(dato.resumenBot));
  const [categoria, setCategoria] = useState(texto(dato.categoria));
  const [medio, setMedio] = useState(texto(dato.medio));
  const [enlace, setEnlace] = useState(texto(dato.enlace || dato.fuente));
  const [hashtags, setHashtags] = useState(
    Array.isArray(dato.hashtags) ? dato.hashtags.join(' ') : texto(dato.hashtags)
  );
  const [colorAcento, setColorAcento] = useState(texto(dato.colorAcento) || '#38bdf8');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(texto(dato.titulo));
    setResumenBot(texto(dato.resumenBot));
    setCategoria(texto(dato.categoria));
    setMedio(texto(dato.medio));
    setEnlace(texto(dato.enlace || dato.fuente));
    setHashtags(Array.isArray(dato.hashtags) ? dato.hashtags.join(' ') : texto(dato.hashtags));
    setColorAcento(texto(dato.colorAcento) || '#38bdf8');
    setMensaje(null);
  }, [indice, dato]);

  const guardarYRegenerar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const arrHashtags = hashtags.split(/\s+/).filter(Boolean);
      const datosActualizados = {
        ...dato,
        titulo,
        resumenBot,
        categoria,
        medio,
        enlace,
        hashtags: arrHashtags,
        colorAcento,
      };

      const resp = await fetch('http://localhost:3001/api/render-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datos: datosActualizados,
          indice,
          total,
          opciones: { colorAcento },
        }),
      });

      if (!resp.ok) throw new Error('Error en el servidor al generar imagen');
      const json = await resp.json();
      if (json.resultado) {
        onActualizarDato({
          ...datosActualizados,
          ...json.resultado,
        });
        setMensaje('¡Tarjeta regenerada con éxito!');
        setTimeout(() => setMensaje(null), 3500);
      }
    } catch (e) {
      setMensaje(e instanceof Error ? `Error: ${e.message}` : 'Error al actualizar');
    } finally {
      setGuardando(false);
    }
  };

  const descargarImagen = () => {
    const vista = texto(dato.vistaPrevia);
    if (!vista) return;
    const a = document.createElement('a');
    a.href = vista;
    a.download = texto(dato.imagenNombre) || `post_${Date.now()}.png`;
    a.click();
  };

  const ruta = texto(dato.imagenPath);
  const vista = texto(dato.vistaPrevia);

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Columna Izquierda: Vista Previa y Acciones */}
      <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `2px solid ${colorAcento}`, background: '#0a0f1d' }}>
          {vista ? (
            <img
              src={vista}
              alt="Vista previa del post generado"
              onClick={() => {
                const w = window.open('');
                w?.document.write(`<body style="margin:0;background:#050810;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${vista}" style="max-height:95vh;box-shadow:0 10px 40px rgba(0,0,0,0.8);border-radius:12px;" /></body>`);
              }}
              title="Clic para ver en tamaño completo"
              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 310, objectFit: 'contain', cursor: 'zoom-in' }}
            />
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Sin imagen generada
            </div>
          )}
        </div>

        {/* Botón directo a la Noticia Original */}
        {enlace && (
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>🔗 Abrir Noticia Original</span>
            <span style={{ fontSize: 10 }}>↗</span>
          </a>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={descargarImagen}
            disabled={!vista}
            style={{
              flex: 1,
              padding: '7px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #0284c7',
              background: '#0284c7',
              color: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            📥 Descargar PNG
          </button>
          <button
            onClick={() => void navigator.clipboard.writeText(ruta)}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
            title="Copiar ruta absoluta"
          >
            📋 Copiar Ruta
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {texto(dato.imagenNombre)} · {String(dato.tamanoKB ?? '?')} KB
        </div>
      </div>

      {/* Columna Derecha: Editor interactivo de tarjeta */}
      <div style={{ ...estiloCaja, flex: 1, minWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: colorAcento, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✏️ EDITOR INTERACTIVO DE POST</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
              (Noticia {indice + 1} de {total})
            </span>
          </div>
          {mensaje && (
            <span style={{ fontSize: 11, color: mensaje.startsWith('Error') ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
              {mensaje}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Título del Post:</label>
            <input
              type="text"
              className="nodrag nodo__input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Resumen / Copy del Bot:</label>
            <textarea
              className="nodrag nodo__input"
              rows={2}
              value={resumenBot}
              onChange={(e) => setResumenBot(e.target.value)}
              style={{ width: '100%', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Categoría:</label>
              <input
                type="text"
                className="nodrag nodo__input"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Medio / Fuente:</label>
              <input
                type="text"
                className="nodrag nodo__input"
                value={medio}
                onChange={(e) => setMedio(e.target.value)}
                style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Enlace Directo de la Noticia:</label>
            <input
              type="text"
              className="nodrag nodo__input"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Hashtags:</label>
              <input
                type="text"
                className="nodrag nodo__input"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                style={{ width: '100%', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Color de Acento:</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#38bdf8', '#a855f7', '#ec4899', '#10b981', '#f59e0b'].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColorAcento(col)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: col,
                      border: colorAcento === col ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transform: colorAcento === col ? 'scale(1.25)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                      padding: 0,
                    }}
                    title={col}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={guardarYRegenerar}
              disabled={guardando}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 6,
                border: 'none',
                background: colorAcento,
                color: '#0f172a',
                fontWeight: 700,
                cursor: guardando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {guardando ? '⏳ Regenerando Tarjeta...' : '🔄 Actualizar y Regenerar Tarjeta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VistaNodo({
  id,
  salida,
  indice,
  onActualizarDato,
}: {
  id: string;
  salida: SalidaNodo | undefined;
  indice: number;
  onActualizarDato?: (nuevoDato: Record<string, unknown>) => void;
}) {
  const dato = salida ? salida[Math.min(indice, salida.length - 1)] : undefined;
  if (!dato) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Este nodo aún no se ha ejecutado.</div>;
  }

  if (id === '1') {
    const imgUrl = texto(dato.imagenNoticiaUrl);
    const enlaceReal = texto(dato.enlace || dato.fuente);
    return (
      <div style={{ ...estiloCaja, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700 }}>
            NOTICIA {String(dato.posicion ?? 1)} DE {String(dato.total ?? 1)}
            {Number(dato.omitidasPorHistorial) > 0 && (
              <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {String(dato.omitidasPorHistorial)} omitida(s) por ya publicadas</span>
            )}
          </div>
          {imgUrl && (
            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
              ✔ Imagen de noticia capturada
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {imgUrl ? (
            <div style={{ flex: '0 0 260px', position: 'relative' }}>
              <img
                src={imgUrl}
                alt="Imagen extraída de la noticia"
                onClick={() => window.open(imgUrl, '_blank')}
                title="Clic para ver en tamaño completo"
                style={{
                  width: '100%',
                  height: 160,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '2px solid #38bdf8',
                  cursor: 'zoom-in',
                  display: 'block',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                }}
              />
              <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(15, 23, 42, 0.85)', color: '#f8fafc', fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                📸 1080p Cover
              </span>
            </div>
          ) : (
            <div
              style={{
                flex: '0 0 240px',
                height: 150,
                background: '#0f172a',
                border: '1px dashed #475569',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: 12,
                gap: 4,
              }}
            >
              <span style={{ fontSize: 24 }}>📷</span>
              <span>Sin imagen detectada</span>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ color: '#38bdf8', fontSize: 11, fontWeight: 700 }}>TÍTULO EXTRAÍDO</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
              {texto(dato.titulo)}
            </div>
            {texto(dato.descripcion) && (
              <div style={{ color: '#cbd5e1', marginBottom: 10, fontSize: 13, lineHeight: 1.5 }}>
                {texto(dato.descripcion)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
              {enlaceReal && (
                <a
                  href={enlaceReal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span>🔗 Noticia Original en el Medio</span>
                  <span style={{ fontSize: 10 }}>↗</span>
                </a>
              )}
              {texto(dato.medio) && (
                <span style={{ background: '#334155', color: '#f8fafc', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>
                  Medio: {texto(dato.medio)}
                </span>
              )}
              {texto(dato.fecha) && (
                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                  Fecha: {new Date(texto(dato.fecha)).toLocaleDateString()}
                </span>
              )}
            </div>

            {lista(dato.cobertura).length > 0 && (
              <div style={{ color: '#94a3b8', marginTop: 8, fontSize: 12 }}>
                También lo cubren: {lista(dato.cobertura).slice(0, 4).join(', ')}
              </div>
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

  return (
    <EditorNodo3
      dato={dato}
      indice={indice}
      total={salida ? salida.length : 1}
      onActualizarDato={(nuevo) => onActualizarDato?.(nuevo)}
    />
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
    setNoticia(0);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, estado: 'idle', duracionMs: undefined, error: undefined },
      }))
    );

    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        data: {
          url: n.data.url,
          cantidad: n.data.cantidad,
          evitarRepetidas: n.data.evitarRepetidas,
          colorAcento: n.data.colorAcento,
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

  const totalNoticias = salidas[pestana]?.length ?? 0;

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
        <div style={{ height: 380, maxHeight: '48vh', background: '#1e293b', borderTop: '1px solid #334155', padding: 12, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[
              { id: '1', nombre: '📰 Nodo 1 · Extracción' },
              { id: '2', nombre: '🤖 Nodo 2 · Bot' },
              { id: '3', nombre: '🎨 Nodo 3 · Tarjeta & Editor' },
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

          {totalNoticias > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Noticia:</span>
              {Array.from({ length: totalNoticias }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setNoticia(i)}
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: '1px solid #475569',
                    background: noticia === i ? '#a855f7' : '#0f172a',
                    color: '#f8fafc',
                    fontWeight: noticia === i ? 700 : 400,
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <VistaNodo
            id={pestana}
            salida={salidas[pestana]}
            indice={noticia}
            onActualizarDato={(nuevo) => {
              setSalidas((prev) => {
                const arr = prev[pestana] ? [...prev[pestana]] : [];
                arr[noticia] = nuevo;
                return { ...prev, [pestana]: arr };
              });
            }}
          />
        </div>
      )}
    </div>
  );
}