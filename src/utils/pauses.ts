/**
 * Motor de pausas por instancia
 * Implementa pausas cortas y largas según el índice del mensaje
 */
export interface PauseConfig {
  type: 'corta' | 'larga';
  duration: number; // en segundos
}

/**
 * Calcula el tipo de pausa y duración según el índice del mensaje
 */
export function calculatePause(loopIndex: number, instanceName: string): PauseConfig {
  // Batch size aleatorio pero consistente por instancia (8-15 mensajes)
  const instanceSeed = instanceName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const batchSize = 8 + (instanceSeed % 8);
  
  let pauseType: 'corta' | 'larga' = 'corta';
  
  // Pausa larga cada batchSize mensajes
  if ((loopIndex + 1) % batchSize === 0 && loopIndex > 0) {
    pauseType = 'larga';
  }
  
  // Calcular duración
  let duration: number;
  if (pauseType === 'larga') {
    // Pausa larga: 50-120 segundos (aleatorio)
    duration = Math.floor(Math.random() * (120 - 50 + 1)) + 50;
  } else {
    // Pausa corta: 2-8 segundos (aleatorio)
    duration = Math.floor(Math.random() * (8 - 2 + 1)) + 2;
  }
  
  return {
    type: pauseType,
    duration
  };
}

