export interface SessionStatus {
  instanceName: string;
  status: 'pending' | 'connected' | 'disconnected' | 'scanning' | 'error';
  phone?: string;
  qrCode?: string;
  lastSeen?: Date;
}

export interface CreateSessionOptions {
  instanceName: string;
  userId?: number;
}

export interface WPPClient {
  sendText: (to: string, message: string) => Promise<any>;
  sendImage: (to: string, imagePath: string, caption?: string) => Promise<any>;
  sendVideo: (to: string, videoPath: string, caption?: string) => Promise<any>;
  sendFile: (to: string, filePath: string, fileName?: string) => Promise<any>;
  logout: () => Promise<void>;
  close: () => Promise<void>;
  getState: () => Promise<string>;
  isConnected: () => boolean;
}

