import express from 'express';
import cors from 'cors';
import { ejecutarNodoNoticias, ejecutarNodoGeminiLocal, ejecutarNodoGeneradorImagen } from './engine/workflowEngine.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json());

app.post('/api/execute', async (req, res) => {
  const { nodes, connections } = req.body;
  
  console.log('\n========================================');
  console.log('🚀 INICIANDO EJECUCIÓN DEL FLUJO DE REDES');
  console.log('========================================');
  console.log(`Nodos en el lienzo: ${nodes.length}`);

  try {
    const salidaNodo1 = await ejecutarNodoNoticias(nodes);
    const salidaNodo2 = await ejecutarNodoGeminiLocal(salidaNodo1);
    const salidaFinal = await ejecutarNodoGeneradorImagen(salidaNodo2);

    console.log('✅ ¡Flujo completado con éxito!');
    
    res.json({ 
      success: true, 
      message: 'Flujo ejecutado correctamente',
      data: salidaFinal 
    });

  } catch (error) {
    console.error('❌ Error ejecutando el flujo:', error);
    res.status(500).json({ success: false, error: 'Fallo en la ejecución del motor' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Motor de ejecución corriendo en http://localhost:${PORT}`);
});