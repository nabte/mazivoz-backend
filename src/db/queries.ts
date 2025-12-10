import db from '../config/database';
import { Logger } from '../utils/logger';

/**
 * Obtiene todas las instancias de un usuario
 */
export async function getUserInstances(userId: number) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM instances WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    ) as any[];
    return rows;
  } catch (error) {
    Logger.error('Error al obtener instancias de usuario', error);
    throw error;
  }
}

/**
 * Obtiene una instancia por nombre
 */
export async function getInstanceByName(instanceName: string) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM instances WHERE instance_name = ?',
      [instanceName]
    ) as any[];
    return rows[0] || null;
  } catch (error) {
    Logger.error('Error al obtener instancia por nombre', error);
    throw error;
  }
}

/**
 * Actualiza el estado de una instancia
 */
export async function updateInstanceStatus(instanceName: string, status: string, phone?: string, qrCode?: string | null) {
  try {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (phone !== undefined) {
      updates.push('telefono = ?');
      values.push(phone);
    }

    if (qrCode !== undefined) {
      updates.push('qr_code = ?');
      values.push(qrCode);
    }

    updates.push('updated_at = NOW()');
    values.push(instanceName);

    await db.query(
      `UPDATE instances SET ${updates.join(', ')} WHERE instance_name = ?`,
      values
    );
  } catch (error) {
    Logger.error('Error al actualizar estado de instancia', error);
    throw error;
  }
}

/**
 * Crea un log de campaña
 */
export async function createCampaignLog(campaignId: number, instanceId: number, contactId: number, phone: string) {
  try {
    await db.query(
      `INSERT INTO campaign_logs (campaign_id, instance_id, contact_id, telefono, estado) 
       VALUES (?, ?, ?, ?, 'pending')`,
      [campaignId, instanceId, contactId, phone]
    );
  } catch (error) {
    Logger.error('Error al crear log de campaña', error);
    throw error;
  }
}

/**
 * Actualiza un log de campaña
 */
export async function updateCampaignLog(campaignId: number, contactId: number, status: 'sent' | 'failed', error?: string) {
  try {
    await db.query(
      `UPDATE campaign_logs 
       SET estado = ?, fecha_envio = NOW(), error = ? 
       WHERE campaign_id = ? AND contact_id = ?`,
      [status, error || null, campaignId, contactId]
    );
  } catch (error) {
    Logger.error('Error al actualizar log de campaña', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de una campaña
 */
export async function getCampaignStats(campaignId: number) {
  try {
    const [rows] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'sent' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN estado = 'failed' THEN 1 ELSE 0 END) as fallidos,
        SUM(CASE WHEN estado = 'pending' THEN 1 ELSE 0 END) as pendientes
       FROM campaign_logs 
       WHERE campaign_id = ?`,
      [campaignId]
    ) as any[];
    return rows[0] || { total: 0, enviados: 0, fallidos: 0, pendientes: 0 };
  } catch (error) {
    Logger.error('Error al obtener estadísticas de campaña', error);
    throw error;
  }
}

