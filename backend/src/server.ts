import express from 'express';
import cors from 'cors';
import {
  ejecutarNodoNoticias,
  ejecutarNodoGeminiLocal,
  ejecutarNodoGeneradorImagen,
  ejecutarNodoBuffer,
  renderizarTarjeta,
} from './engine/workflowEngine.js';
import type { CanvasNode, NodeEvent, WorkflowItem } from './engine/types.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

const pausa = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

app.post('/api/render-card', async (req, res) => {
  try {
    const { datos, indice = 0, total = 1, opciones = {} } = req.body ?? {};
    if (!datos) {
      return res.status(400).json({ error: 'Faltan los datos de la tarjeta' });
    }
    const resultado = await renderizarTarjeta(datos, Number(indice) || 0, Number(total) || 1, opciones);
    return res.json({ success: true, resultado });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al renderizar tarjeta';
    console.error('❌ Error en /api/render-card:', mensaje);
    return res.status(500).json({ error: mensaje });
  }
});

app.post('/api/execute', async (req, res) => {
  const nodes: CanvasNode[] = Array.isArray(req.body?.nodes) ? req.body.nodes : [];

  console.log('\n========================================');
  console.log('🚀 INICIANDO EJECUCIÓN DEL FLUJO');
  console.log('========================================');

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const emitir = (evento: NodeEvent) => {
    res.write(`${JSON.stringify(evento)}\n`);
  };

  const todosLosPasos: { id: string; run: (entrada: WorkflowItem[]) => Promise<WorkflowItem[]> }[] = [
    { id: '1', run: () => ejecutarNodoNoticias(nodes) },
    { id: '2', run: (entrada) => ejecutarNodoGeminiLocal(entrada) },
    { id: '3', run: (entrada) => ejecutarNodoGeneradorImagen(entrada, nodes) },
    { id: '4', run: (entrada) => ejecutarNodoBuffer(entrada, nodes) },
  ];

  const pasos = nodes.length > 0
    ? todosLosPasos.filter((p) => nodes.some((n) => n.id === p.id))
    : todosLosPasos;

  let datos: WorkflowItem[] = [];

  for (const paso of pasos) {
    emitir({ type: 'node', nodeId: paso.id, status: 'running' });
    await pausa(500); // solo para que se aprecie la animación; puedes quitarla
    const inicio = Date.now();

    try {
      datos = await paso.run(datos);
      emitir({
        type: 'node',
        nodeId: paso.id,
        status: 'success',
        durationMs: Date.now() - inicio,
        output: datos.map((d) => d.json),
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ Nodo ${paso.id} falló:`, mensaje);
      emitir({
        type: 'node',
        nodeId: paso.id,
        status: 'error',
        durationMs: Date.now() - inicio,
        error: mensaje,
      });
      emitir({ type: 'done', success: false });
      res.end();
      return;
    }
  }

  console.log('✅ ¡Flujo completado con éxito!');
  emitir({ type: 'done', success: true });
  res.end();
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Motor de ejecución corriendo en http://localhost:${PORT}`);
});