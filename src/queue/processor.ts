import { wppManager } from '../wpp/manager';
import { Logger } from '../utils/logger';
import { formatWhatsAppNumber, getPhoneNumberOnly } from '../utils/phone';
import { processVariations } from '../utils/variations';
import { calculatePause } from '../utils/pauses';
import { QueuedMessage, QueueStats } from './types';
import db from '../config/database';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export class MessageQueueProcessor {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private stats: QueueStats = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    byInstance: {}
  };
  private delayMin: number;
  private delayMax: number;
  private maxMessagesPerInstanceDaily: number;

  constructor() {
    this.delayMin = parseInt(process.env.DELAY_MIN_MS || '2000');
    this.delayMax = parseInt(process.env.DELAY_MAX_MS || '8000');
    this.maxMessagesPerInstanceDaily = parseInt(process.env.MAX_MESSAGES_PER_INSTANCE_DAILY || '50');

    // Iniciar procesadores por instancia
    setInterval(() => this.processQueues(), 1000);
  }

  /**
   * Añade un mensaje a la cola
   */
  async enqueue(message: Omit<QueuedMessage, 'id' | 'retries' | 'createdAt'>): Promise<string> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedMessage: QueuedMessage = {
      ...message,
      id,
      retries: 0,
      maxRetries: message.maxRetries || 3,
      createdAt: new Date()
    };

    if (!this.queues.has(message.instanceName)) {
      this.queues.set(message.instanceName, []);
      this.stats.byInstance[message.instanceName] = 0;
    }

    this.queues.get(message.instanceName)!.push(queuedMessage);
    this.stats.total++;
    this.stats.pending++;
    this.stats.byInstance[message.instanceName]++;

    Logger.info(`Mensaje añadido a cola: ${id} para ${message.instanceName}`);

    return id;
  }

  /**
   * Procesa las colas de todas las instancias
   */
  private async processQueues() {
    for (const [instanceName, queue] of this.queues.entries()) {
      if (queue.length === 0) continue;
      if (this.processing.get(instanceName)) continue; // Ya está procesando

      // Verificar si la instancia está conectada
      const isConnected = await wppManager.isConnected(instanceName);
      if (!isConnected) {
        Logger.warn(`Instancia ${instanceName} no conectada, saltando cola`);
        continue;
      }

      // Procesar siguiente mensaje
      this.processNextMessage(instanceName);
    }
  }

  /**
   * Procesa el siguiente mensaje de una instancia
   */
  private async processNextMessage(instanceName: string) {
    const queue = this.queues.get(instanceName);
    if (!queue || queue.length === 0) return;

    this.processing.set(instanceName, true);
    this.stats.processing++;
    this.stats.pending--;

    const message = queue.shift()!;
    const client = wppManager.getClient(instanceName);

    if (!client) {
      Logger.error(`[${instanceName}] Cliente no encontrado para mensaje ${message.id}`);
      this.handleMessageFailure(message, 'Cliente no encontrado');
      this.processing.set(instanceName, false);
      this.stats.processing--;
      return;
    }

    try {
      // Aplicar pausa antes de enviar (si está configurada)
      if (message.pauseBefore && message.pauseBefore > 0) {
        Logger.info(`[${instanceName}] Pausa de ${message.pauseBefore}s antes de enviar mensaje ${message.id} (índice ${message.loopIndex || 0})`);
        await new Promise(resolve => setTimeout(resolve, message.pauseBefore! * 1000));
      }

      // Procesar variaciones del mensaje (no se personaliza con nombres)
      const finalMessage = processVariations(message.message);

      // Formatear número de teléfono (WPPConnect usa @c.us)
      const phoneNumber = formatWhatsAppNumber(message.to, false);
      const phoneOnly = getPhoneNumberOnly(phoneNumber);

      Logger.info(`[${instanceName}] Enviando mensaje ${message.id} a ${phoneOnly} (índice ${message.loopIndex || 0})`);

      // Enviar mensaje según tipo
      if (message.mediaUrl && message.mediaType) {
        await this.sendMediaMessage(client, phoneNumber, message, finalMessage);
      } else {
        // Delay aleatorio adicional para texto (1-2.5 segundos como en n8n)
        const textDelay = Math.floor(1000 + Math.random() * 1500);
        await new Promise(resolve => setTimeout(resolve, textDelay));
        await client.sendText(phoneNumber, finalMessage);
      }

      Logger.info(`[${instanceName}] ✅ Mensaje ${message.id} enviado exitosamente a ${phoneOnly}`);

      // Actualizar BD
      await this.updateCampaignLog(message, 'sent');

      this.stats.completed++;
      this.stats.byInstance[instanceName]--;

      // Delay aleatorio antes del siguiente mensaje (solo si no hay pausa configurada)
      if (!message.pauseBefore) {
        const delay = this.delayMin + Math.random() * (this.delayMax - this.delayMin);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error: any) {
      Logger.error(`[${instanceName}] ❌ Error al enviar mensaje ${message.id} a ${message.to}`, {
        error: error.message,
        stack: error.stack
      });
      
      // Reintentar si no se excedió el límite
      if (message.retries < message.maxRetries) {
        message.retries++;
        queue.unshift(message); // Volver a la cola
        this.stats.pending++;
        Logger.warn(`[${instanceName}] Reintentando mensaje ${message.id} (intento ${message.retries}/${message.maxRetries})`);
      } else {
        this.handleMessageFailure(message, error.message || 'Error desconocido');
      }
    } finally {
      this.processing.set(instanceName, false);
      this.stats.processing--;
    }
  }

  /**
   * Envía mensaje con multimedia
   */
  private async sendMediaMessage(client: any, phoneNumber: string, message: QueuedMessage, finalMessage: string) {
    if (!message.mediaUrl) {
      throw new Error('URL de multimedia no proporcionada');
    }

    Logger.info(`[${message.instanceName}] Descargando multimedia desde ${message.mediaUrl} para mensaje ${message.id}`);
    
    // Descargar archivo temporalmente
    const tempPath = await this.downloadMedia(message.mediaUrl);

    try {
      // Delay aleatorio adicional para multimedia (1-2.5 segundos como en n8n)
      const mediaDelay = Math.floor(1000 + Math.random() * 1500);
      await new Promise(resolve => setTimeout(resolve, mediaDelay));

      switch (message.mediaType) {
        case 'image':
          Logger.info(`[${message.instanceName}] Enviando imagen para mensaje ${message.id}`);
          await client.sendImage(phoneNumber, tempPath, finalMessage);
          break;
        case 'video':
          Logger.info(`[${message.instanceName}] Enviando video para mensaje ${message.id}`);
          await client.sendVideo(phoneNumber, tempPath, finalMessage);
          break;
        case 'document':
          Logger.info(`[${message.instanceName}] Enviando documento para mensaje ${message.id}`);
          await client.sendFile(phoneNumber, tempPath, undefined, finalMessage);
          break;
        default:
          throw new Error(`Tipo de multimedia no soportado: ${message.mediaType}`);
      }
    } finally {
      // Limpiar archivo temporal
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
          Logger.info(`[${message.instanceName}] Archivo temporal eliminado: ${tempPath}`);
        } catch (err) {
          Logger.warn(`[${message.instanceName}] Error al eliminar archivo temporal: ${tempPath}`, err);
        }
      }
    }
  }

  /**
   * Descarga archivo multimedia desde URL
   */
  private async downloadMedia(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'stream' });
    const ext = path.extname(url) || '.tmp';
    const tempPath = path.join(__dirname, '../../temp', `media_${Date.now()}${ext}`);

    // Crear directorio temp si no existe
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(tempPath));
      writer.on('error', reject);
    });
  }

  /**
   * Maneja fallo de mensaje
   */
  private async handleMessageFailure(message: QueuedMessage, error: string) {
    Logger.error(`[${message.instanceName}] ❌ Mensaje ${message.id} falló después de ${message.maxRetries} intentos: ${error}`, {
      messageId: message.id,
      to: message.to,
      instanceName: message.instanceName,
      error: error
    });
    
    this.stats.failed++;
    this.stats.byInstance[message.instanceName]--;

    // Actualizar BD
    await this.updateCampaignLog(message, 'failed', error);
  }

  /**
   * Actualiza log de campaña en BD
   */
  private async updateCampaignLog(message: QueuedMessage, status: 'sent' | 'failed', error?: string) {
    if (!message.campaignId || !message.contactId) return;

    try {
      await db.query(
        `UPDATE campaign_logs 
         SET estado = ?, fecha_envio = NOW(), error = ? 
         WHERE campaign_id = ? AND contact_id = ?`,
        [status, error || null, message.campaignId, message.contactId]
      );

      // Actualizar contadores de campaña
      if (status === 'sent') {
        await db.query(
          'UPDATE campaigns SET enviados = enviados + 1 WHERE id = ?',
          [message.campaignId]
        );
      } else if (status === 'failed') {
        await db.query(
          'UPDATE campaigns SET fallidos = fallidos + 1 WHERE id = ?',
          [message.campaignId]
        );
      }
    } catch (error) {
      Logger.error('Error al actualizar log de campaña', error);
    }
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Obtiene tamaño de cola por instancia
   */
  getQueueSize(instanceName: string): number {
    return this.queues.get(instanceName)?.length || 0;
  }
}

// Singleton
export const queueProcessor = new MessageQueueProcessor();

