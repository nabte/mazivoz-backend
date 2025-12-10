export interface QueuedMessage {
  id: string;
  instanceName: string;
  to: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  campaignId?: number;
  contactId?: number;
  loopIndex?: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  pauseBefore?: number; // segundos de pausa antes de enviar
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byInstance: Record<string, number>;
}

