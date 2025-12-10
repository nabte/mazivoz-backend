import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';
import apiRoutes from './api/routes';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Error no manejado', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor - escuchar en 0.0.0.0 para ser accesible desde fuera del contenedor
app.listen(PORT, '0.0.0.0', () => {
  Logger.info(`Servidor WPPConnect iniciado en puerto ${PORT}`);
  Logger.info(`Health check: http://0.0.0.0:${PORT}/health`);
  Logger.info(`API disponible en: http://0.0.0.0:${PORT}/api`);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  Logger.info('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

