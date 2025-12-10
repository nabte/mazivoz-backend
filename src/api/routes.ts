import express, { Request, Response, Router } from 'express';
import { wppManager } from '../wpp/manager';
import { queueProcessor } from '../queue/processor';
import { Logger } from '../utils/logger';
import { formatWhatsAppNumber } from '../utils/phone';
import { generateMessageVariations, processVariations } from '../utils/variations';
import { calculatePause } from '../utils/pauses';
import db from '../config/database';

const router = Router();

/**
 * POST /api/instances
 * Crear nueva instancia
 */
router.post('/instances', async (req: Request, res: Response) => {
  try {
    const { instance_name, user_id } = req.body;

    Logger.info(`📨 POST /api/instances - instance_name: ${instance_name}, user_id: ${user_id}`);

    if (!instance_name) {
      return res.status(400).json({ error: 'instance_name es requerido' });
    }

    // Verificar si ya existe en BD
    try {
      const [existing] = await db.query(
        'SELECT id FROM instances WHERE instance_name = ?',
        [instance_name]
      ) as any[];

      if (existing.length > 0) {
        Logger.info(`Instancia ${instance_name} ya existe en BD, recuperando sesión...`);
        // Instancia ya existe, intentar recuperar sesión
        const status = await wppManager.createSession({ instanceName: instance_name, userId: user_id });
        return res.json({
          success: true,
          instance_name: instance_name,
          status: status.status,
          qr_code: status.qrCode,
          message: 'Instancia recuperada'
        });
      }
    } catch (dbError: any) {
      Logger.error('Error al consultar BD', dbError);
      return res.status(500).json({ 
        error: 'Error al consultar base de datos', 
        details: dbError.message 
      });
    }

    // Crear sesión
    Logger.info(`Creando nueva sesión para ${instance_name}`);
    const status = await wppManager.createSession({ instanceName: instance_name, userId: user_id });

    res.json({
      success: true,
      instance_name: instance_name,
      status: status.status,
      qr_code: status.qrCode,
      message: 'Instancia creada exitosamente'
    });
  } catch (error: any) {
    Logger.error('Error al crear instancia', error);
    Logger.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Error al crear instancia',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/instances/:name/qr
 * Obtener QR code de una instancia
 */
router.get('/instances/:name/qr', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const status = wppManager.getSessionStatus(name);

    if (!status) {
      // Intentar crear sesión si no existe
      try {
        const newStatus = await wppManager.createSession({ instanceName: name });
        return res.json({
          success: true,
          qr_code: newStatus.qrCode,
          status: newStatus.status
        });
      } catch (error: any) {
        return res.status(404).json({ error: 'Instancia no encontrada' });
      }
    }

    // Si está conectada, no hay QR
    if (status.status === 'connected') {
      return res.json({
        success: true,
        qr_code: null,
        status: 'connected',
        message: 'Instancia ya está conectada'
      });
    }

    res.json({
      success: true,
      qr_code: status.qrCode,
      status: status.status
    });
  } catch (error: any) {
    Logger.error('Error al obtener QR', error);
    res.status(500).json({ error: error.message || 'Error al obtener QR' });
  }
});

/**
 * GET /api/instances
 * Listar todas las sesiones
 */
router.get('/instances', async (req: Request, res: Response) => {
  try {
    const sessions = wppManager.getAllSessions();
    res.json({ success: true, sessions });
  } catch (error: any) {
    Logger.error('Error al listar instancias', error);
    res.status(500).json({ error: error.message || 'Error al listar instancias' });
  }
});

/**
 * GET /api/instances/:name/status
 * Obtener estado de una sesión
 */
router.get('/instances/:name/status', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    let status = wppManager.getSessionStatus(name);
    let isConnected = false;

    // Si no hay status en memoria, verificar en BD
    if (!status) {
      try {
        const [instances] = await db.query(
          'SELECT instance_name, status, telefono FROM instances WHERE instance_name = ?',
          [name]
        ) as any[];

        if (instances.length > 0) {
          const instance = instances[0];
          // Si está en BD como connected, intentar recuperar sesión
          if (instance.status === 'connected') {
            Logger.info(`Instancia ${name} encontrada en BD como connected, intentando recuperar sesión...`);
            try {
              status = await wppManager.createSession({ instanceName: name });
              isConnected = await wppManager.isConnected(name);
            } catch (err: any) {
              Logger.warn(`No se pudo recuperar sesión para ${name}, usando estado de BD`);
              isConnected = true; // Si está en BD como connected, asumir que está conectada
            }
          } else {
            return res.status(404).json({ error: 'Instancia no encontrada o no conectada' });
          }
        } else {
          return res.status(404).json({ error: 'Instancia no encontrada' });
        }
      } catch (dbError: any) {
        Logger.error('Error al consultar BD', dbError);
        return res.status(500).json({ error: 'Error al consultar base de datos' });
      }
    } else {
      // Si hay status en memoria, verificar conexión real
      isConnected = await wppManager.isConnected(name);
    }

    res.json({
      success: true,
      instance_name: name,
      status: status?.status || 'unknown',
      phone: status?.phone,
      is_connected: isConnected,
      last_seen: status?.lastSeen
    });
  } catch (error: any) {
    Logger.error('Error al obtener estado', error);
    res.status(500).json({ error: error.message || 'Error al obtener estado' });
  }
});

/**
 * DELETE /api/instances/:name
 * Desconectar/apagar sesión
 */
router.delete('/instances/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const destroyed = await wppManager.destroySession(name);

    if (!destroyed) {
      return res.status(404).json({ error: 'Instancia no encontrada' });
    }

    res.json({ success: true, message: 'Sesión destruida exitosamente' });
  } catch (error: any) {
    Logger.error('Error al destruir sesión', error);
    res.status(500).json({ error: error.message || 'Error al destruir sesión' });
  }
});

/**
 * POST /api/messages/send
 * Enviar mensaje individual (añade a cola)
 */
router.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const { instance_name, to, message, contact_name, media_url, media_type, campaign_id, contact_id } = req.body;

    Logger.info('📨 Recibido mensaje individual', {
      instance: instance_name,
      to: to,
      hasMedia: !!media_url
    });

    if (!instance_name || !to || !message) {
      Logger.error('❌ Datos incompletos en mensaje individual');
      return res.status(400).json({ error: 'instance_name, to y message son requeridos' });
    }

    // Verificar que la instancia esté conectada
    const isConnected = await wppManager.isConnected(instance_name);
    if (!isConnected) {
      Logger.warn(`⚠️ Instancia ${instance_name} no está conectada`);
      return res.status(400).json({ error: 'Instancia no conectada' });
    }

    // Procesar variaciones del mensaje
    const processedMessage = processVariations(message);
    
    // Añadir a la cola
    const messageId = await queueProcessor.enqueue({
      instanceName: instance_name,
      to,
      message: processedMessage,
      mediaUrl: media_url,
      mediaType: media_type,
      campaignId: campaign_id,
      contactId: contact_id,
      maxRetries: 3
    });

    Logger.info(`✅ Mensaje ${messageId} añadido a la cola`);

    res.json({
      success: true,
      message_id: messageId,
      queued: true,
      message: 'Mensaje añadido a la cola'
    });
  } catch (error: any) {
    Logger.error('❌ Error al enviar mensaje', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Error al enviar mensaje' });
  }
});

/**
 * POST /api/messages/bulk
 * Envío masivo (reemplaza webhook de n8n)
 * Implementa la misma lógica que el workflow de n8n: variaciones, pausas, personalización
 */
router.post('/messages/bulk', async (req: Request, res: Response) => {
  try {
    const { distribution, contacts, message, media_url, media_type, campaign_id } = req.body;

    Logger.info('📨 Recibido envío masivo', {
      campaignId: campaign_id,
      totalContacts: contacts?.length || 0,
      distributionCount: distribution?.length || 0,
      hasMedia: !!media_url
    });

    if (!distribution || !contacts || !message) {
      Logger.error('❌ Datos incompletos en envío masivo', { distribution, contacts: contacts?.length, message: !!message });
      return res.status(400).json({ error: 'distribution, contacts y message son requeridos' });
    }

    // Generar variaciones del mensaje (como en n8n)
    const messageVariations = generateMessageVariations(message, 4);
    Logger.info(`✅ Generadas ${messageVariations.length} variaciones del mensaje`);

    let totalQueued = 0;
    const results: any[] = [];
    let globalContactIndex = 0;

    // Procesar cada instancia en la distribución
    for (const dist of distribution) {
      const { instance_name, messages: messageCount } = dist;

      Logger.info(`📤 Procesando instancia ${instance_name} con ${messageCount} mensajes`);

      // Verificar que la instancia esté conectada
      const isConnected = await wppManager.isConnected(instance_name);
      if (!isConnected) {
        Logger.warn(`⚠️ Instancia ${instance_name} no está conectada`);
        results.push({
          instance_name,
          status: 'error',
          error: 'Instancia no conectada'
        });
        continue;
      }

      // Obtener contactos para esta instancia
      const instanceContacts = contacts.slice(globalContactIndex, globalContactIndex + messageCount);
      let instanceQueued = 0;

      Logger.info(`📋 Procesando ${instanceContacts.length} contactos para ${instance_name}`);

      for (let i = 0; i < instanceContacts.length; i++) {
        const contact = instanceContacts[i];
        const loopIndex = globalContactIndex + i;

        try {
          // Seleccionar variación del mensaje (rotar según índice)
          const selectedVariation = messageVariations[loopIndex % messageVariations.length];
          
          // Calcular pausa según motor de pausas
          const pause = calculatePause(loopIndex, instance_name);
          
          Logger.info(`📝 Encolando mensaje ${loopIndex + 1} para ${contact.telefono}`, {
            instance: instance_name,
            pauseType: pause.type,
            pauseDuration: pause.duration
          });

          await queueProcessor.enqueue({
            instanceName: instance_name,
            to: contact.telefono,
            message: selectedVariation, // Mensaje con variaciones ya procesadas
            mediaUrl: media_url,
            mediaType: media_type,
            campaignId: campaign_id,
            contactId: contact.id,
            loopIndex: loopIndex,
            pauseBefore: pause.duration, // Pausa antes de enviar
            maxRetries: 3
          });
          
          instanceQueued++;
          totalQueued++;
        } catch (error: any) {
          Logger.error(`❌ Error al encolar mensaje para ${contact.telefono}`, {
            error: error.message,
            contact: contact
          });
        }
      }

      globalContactIndex += instanceContacts.length;

      Logger.info(`✅ Instancia ${instance_name}: ${instanceQueued} mensajes encolados`);

      results.push({
        instance_name,
        status: 'success',
        queued: instanceQueued
      });
    }

    Logger.info(`🎉 Envío masivo completado: ${totalQueued} mensajes encolados en total`);

    res.json({
      success: true,
      total_queued: totalQueued,
      results
    });
  } catch (error: any) {
    Logger.error('❌ Error en envío masivo', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Error en envío masivo' });
  }
});

/**
 * GET /api/messages/queue
 * Estado de la cola
 */
router.get('/messages/queue', async (req: Request, res: Response) => {
  try {
    const stats = queueProcessor.getStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    Logger.error('Error al obtener estado de cola', error);
    res.status(500).json({ error: error.message || 'Error al obtener estado de cola' });
  }
});

/**
 * GET /api/queue/stats
 * Obtener estadísticas de la cola de mensajes
 */
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = queueProcessor.getStats();
    const queueSizes: Record<string, number> = {};
    
    // Obtener tamaños de cola por instancia
    const allSessions = wppManager.getAllSessions();
    for (const session of allSessions) {
      queueSizes[session.instanceName] = queueProcessor.getQueueSize(session.instanceName);
    }
    
    res.json({
      success: true,
      stats: {
        ...stats,
        queue_sizes: queueSizes
      }
    });
  } catch (error: any) {
    Logger.error('Error al obtener estadísticas de cola', error);
    res.status(500).json({ error: error.message || 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/admin/dashboard
 * Panel de administración con estado de todas las sesiones
 */
router.get('/admin/dashboard', async (req: Request, res: Response) => {
  try {
    const sessions = wppManager.getAllSessions();
    const queueStats = queueProcessor.getStats();

    // Obtener instancias de BD
    const [instances] = await db.query(
      'SELECT id, instance_name, status, telefono, created_at FROM instances ORDER BY created_at DESC'
    ) as any[];

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        ...s,
        is_connected: wppManager.getClient(s.instanceName) !== null
      })),
      queue: queueStats,
      instances: instances
    });
  } catch (error: any) {
    Logger.error('Error al obtener dashboard', error);
    res.status(500).json({ error: error.message || 'Error al obtener dashboard' });
  }
});

export default router;

