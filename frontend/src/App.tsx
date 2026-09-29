import { useState, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import type { 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function App() {
  const [nodes, setNodes] = useNodesState([
    { 
      id: '1', 
      type: 'default',
      position: { x: 50, y: 150 }, 
      data: { 
        url: "https://news.ycombinator.com/",
        label: (
          <div style={{ padding: '4px' }}>
            <strong>📰 Lector Web (Scraper)</strong>
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <span>URL a extraer:</span>
              <input 
                type="text" 
                defaultValue="https://news.ycombinator.com/" 
                onChange={(e) => {
                  setNodes((nds) => 
                    nds.map((node) => node.id === '1' ? { ...node, data: { ...node.data, url: e.target.value } } : node)
                  );
                }}
                style={{ width: '100%', marginTop: '4px', padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        ) 
      },
      style: { background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '10px', padding: '10px', width: '240px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
    },
    { 
      id: '2', 
      type: 'default',
      position: { x: 360, y: 150 }, 
      data: { 
        label: (
          <div style={{ padding: '4px' }}>
            <strong>🤖 Procesador Gemini</strong>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
              Optimiza el contenido para redes.
            </div>
          </div>
        ) 
      },
      style: { background: '#ffffff', border: '2px solid #a855f7', borderRadius: '10px', padding: '10px', width: '240px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
    },
    { 
      id: '3', 
      type: 'default',
      position: { x: 670, y: 150 }, 
      data: { 
        label: (
          <div style={{ padding: '4px' }}>
            <strong>🎨 Generador Gráfico</strong>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
              Crea y guarda la imagen PNG.
            </div>
          </div>
        ) 
      },
      style: { background: '#ffffff', border: '2px solid #ec4899', borderRadius: '10px', padding: '10px', width: '240px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
    }
  ]);

  const [edges, setEdges] = useEdgesState([
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3', animated: true }
  ]);

  const [resultadoEjecucion, setResultadoEjecucion] = useState<any>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const ejecutarFlujoCompleto = async () => {
    const payload = { nodes, connections: edges };
    console.log("📤 Ejecutando flujo interactivo:", payload);
    
    try {
      const response = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setResultadoEjecucion(data.data);
      alert('¡Flujo ejecutado con éxito! Imagen creada en el Escritorio.');
    } catch (error) {
      console.error("❌ Error al ejecutar:", error);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      <div style={{ height: '60px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 10 }}>
        <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚡ n8n Local Studio</span>
          <span style={{ fontSize: '12px', background: '#334155', padding: '2px 8px', borderRadius: '12px', color: '#38bdf8' }}>Modo Interactivo</span>
        </div>
        <button 
          onClick={ejecutarFlujoCompleto}
          style={{ padding: '8px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ▶ Ejecutar Flujo
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onConnect={onConnect}
          fitView
        >
          <Background color="#1e293b" gap={24} />
          <Controls />
        </ReactFlow>

        {resultadoEjecucion && (
          <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '15px', color: '#f8fafc', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>📋 Datos de la Noticia Extraída (Última Ejecución):</h4>
            <pre style={{ margin: 0, fontSize: '12px', background: '#0f172a', padding: '10px', borderRadius: '6px', overflowX: 'auto' }}>
              {JSON.stringify(resultadoEjecucion, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}