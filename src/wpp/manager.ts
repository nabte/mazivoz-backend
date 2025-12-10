import wppconnect from '@wppconnect-team/wppconnect';
import path from 'path';
import fs from 'fs';
import { Logger } from '../utils/logger';
import { SessionStatus, WPPClient, CreateSessionOptions } from './types';
import db from '../config/database';

export class WPPManager {
  private sessions: Map<string, any> = new Map();
  private sessionStatuses: Map<string, SessionStatus> = new Map();
  private sessionsPath: string;

  constructor() {
    this.sessionsPath = process.env.SESSIONS_PATH || path.join(__dirname, '../../sessions');
    
    // Crear directorio de sesiones si no existe
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }

    // Cargar sesiones existentes al iniciar
    this.loadExistingSessions();
  }

  /**
   * Carga sesiones existentes desde la base de datos
   */
  private async loadExistingSessions() {
    try {
      const [instances] = await db.query(
        'SELECT instance_name, status FROM instances WHERE status IN (?, ?)',
        ['connected', 'pending']
      ) as any[];

      Logger.info(`Cargando ${instances.length} instancias desde BD`);
      
      for (const instance of instances) {
        // Intentar recuperar sesión si existe en disco
        const sessionPath = path.join(this.sessionsPath, instance.instance_name);
        if (fs.existsSync(sessionPath)) {
          Logger.info(`Sesión encontrada para ${instance.instance_name}, intentando recuperar...`);
          // La sesión se recuperará automáticamente cuando se cree el cliente
        }
      }
    } catch (error) {
      Logger.error('Error al cargar sesiones existentes', error);
    }
  }

  /**
   * Crea una nueva sesión WPPConnect
   */
  async createSession(options: CreateSessionOptions): Promise<SessionStatus> {
    const { instanceName, userId } = options;

    if (this.sessions.has(instanceName)) {
      Logger.warn(`Sesión ${instanceName} ya existe`);
      const existingStatus = this.getSessionStatus(instanceName);
      if (existingStatus) {
        return existingStatus;
      }
    }

    Logger.info(`Creando sesión para ${instanceName}`);

    // Actualizar estado en BD
    try {
      await db.query(
        'UPDATE instances SET status = ? WHERE instance_name = ?',
        ['pending', instanceName]
      );
    } catch (error) {
      Logger.error('Error al actualizar BD', error);
    }

    // Inicializar estado
    const status: SessionStatus = {
      instanceName,
      status: 'scanning',
      lastSeen: new Date()
    };
    this.sessionStatuses.set(instanceName, status);

    try {
      const client = await wppconnect.create({
        session: instanceName,
        catchQR: (base64Qr, asciiQR) => {
          Logger.info(`[${instanceName}] 📱 QR generado - Listo para escanear`);
          status.qrCode = base64Qr;
          status.status = 'scanning';
          this.sessionStatuses.set(instanceName, status);
          
          // Actualizar QR en BD
          db.query(
            'UPDATE instances SET qr_code = ?, status = ? WHERE instance_name = ?',
            [base64Qr, 'pending', instanceName]
          ).then(() => {
            Logger.info(`[${instanceName}] ✅ QR guardado en BD`);
          }).catch((err: any) => Logger.error(`[${instanceName}] ❌ Error al actualizar QR en BD`, err));

          // Mostrar QR en terminal
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📱 QR Code para ${instanceName}:`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(asciiQR);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        },
        statusFind: (statusSession) => {
          Logger.info(`[${instanceName}] 🔄 Cambio de estado: ${statusSession}`);
          
          if (statusSession === 'isLogged') {
            Logger.info(`[${instanceName}] ✅ Sesión conectada exitosamente`);
            status.status = 'connected';
            status.qrCode = undefined;
            this.sessionStatuses.set(instanceName, status);
            
            // Obtener número de teléfono
            client.getHostDevice().then((device: any) => {
              const phone = device?.id?.user || device?.wid?.user || null;
              if (phone) {
                Logger.info(`[${instanceName}] 📱 Número de teléfono obtenido: ${phone}`);
                status.phone = phone;
                this.sessionStatuses.set(instanceName, status);
                
                // Actualizar BD con el número
                db.query(
                  'UPDATE instances SET status = ?, telefono = ?, qr_code = NULL WHERE instance_name = ?',
                  ['connected', phone, instanceName]
                ).then(() => {
                  Logger.info(`[${instanceName}] ✅ Estado actualizado en BD`);
                }).catch((err: any) => Logger.error(`[${instanceName}] ❌ Error al actualizar estado en BD`, err));
              } else {
                Logger.warn(`[${instanceName}] No se pudo obtener el número de teléfono`);
              }
            }).catch((err: any) => {
              Logger.error(`[${instanceName}] ❌ Error al obtener número`, err);
              // Continuar sin el número, la sesión está conectada
            });
          } else if (statusSession === 'notLogged') {
            Logger.info(`[${instanceName}] ⏳ Esperando escaneo de QR`);
            status.status = 'scanning';
            this.sessionStatuses.set(instanceName, status);
          } else if (statusSession === 'qrReadSuccess') {
            Logger.info(`[${instanceName}] ✅ QR escaneado exitosamente`);
            status.status = 'connected';
            status.qrCode = undefined;
            this.sessionStatuses.set(instanceName, status);
          }
        },
        headless: true,
        debug: false,
        useChrome: true,
        puppeteerOptions: {
          executablePath: process.env.CHROME_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        },
        folderNameToken: this.sessionsPath,
        autoClose: 0 // Nunca cerrar automáticamente
      });

      // Manejar desconexión después de crear el cliente
      client.onStateChange((state: string) => {
        if (state === 'DISCONNECTED' || state === 'UNPAIRED' || state === 'UNLAUNCHED') {
          Logger.warn(`[${instanceName}] Desconectado: ${state}`);
          
          status.status = 'disconnected';
          status.lastSeen = new Date();
          this.sessionStatuses.set(instanceName, status);
          
          // Actualizar BD
          db.query(
            'UPDATE instances SET status = ? WHERE instance_name = ?',
            ['disconnected', instanceName]
          ).catch((error: any) => {
            Logger.error('Error al actualizar estado desconectado en BD', error);
          });

          // Remover de sesiones activas
          this.sessions.delete(instanceName);

          // Intentar reconectar después de 30 segundos
          setTimeout(() => {
            Logger.info(`Intentando reconectar ${instanceName}...`);
            this.createSession(options).catch((err: any) => {
              Logger.error(`Error al reconectar ${instanceName}`, err);
            });
          }, 30000);
        }
      });

      this.sessions.set(instanceName, client);
      Logger.info(`Sesión ${instanceName} creada exitosamente`);

      return status;
    } catch (error: any) {
      Logger.error(`Error al crear sesión ${instanceName}`, error);
      status.status = 'error';
      this.sessionStatuses.set(instanceName, status);
      throw error;
    }
  }

  /**
   * Obtiene el cliente de una sesión
   */
  getClient(instanceName: string): WPPClient | null {
    return this.sessions.get(instanceName) || null;
  }

  /**
   * Obtiene el estado de una sesión
   */
  getSessionStatus(instanceName: string): SessionStatus | null {
    return this.sessionStatuses.get(instanceName) || null;
  }

  /**
   * Obtiene todas las sesiones
   */
  getAllSessions(): SessionStatus[] {
    return Array.from(this.sessionStatuses.values());
  }

  /**
   * Destruye una sesión
   */
  async destroySession(instanceName: string): Promise<boolean> {
    const client = this.sessions.get(instanceName);
    
    if (!client) {
      Logger.warn(`Sesión ${instanceName} no encontrada`);
      return false;
    }

    try {
      await client.logout();
      await client.close();
      
      this.sessions.delete(instanceName);
      this.sessionStatuses.delete(instanceName);

      // Actualizar BD
      await db.query(
        'UPDATE instances SET status = ? WHERE instance_name = ?',
        ['disconnected', instanceName]
      );

      Logger.info(`Sesión ${instanceName} destruida exitosamente`);
      return true;
    } catch (error) {
      Logger.error(`Error al destruir sesión ${instanceName}`, error);
      return false;
    }
  }

  /**
   * Verifica si una sesión está conectada
   */
  async isConnected(instanceName: string): Promise<boolean> {
    const client = this.sessions.get(instanceName);
    if (!client) return false;

    try {
      const state = await client.getState();
      return state === 'CONNECTED';
    } catch (error) {
      return false;
    }
  }
}

// Singleton
export const wppManager = new WPPManager();

