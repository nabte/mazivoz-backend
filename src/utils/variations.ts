/**
 * Procesa variaciones manuales en el formato {{opción1|opción2|opción3}}
 * Con coherencia: bloques idénticos usan la misma opción
 */
export function processVariations(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Buscar todos los bloques {{...|...|...}}
  const variationPattern = /\{\{([^}]+)\}\}/g;
  
  // Mapa para agrupar bloques idénticos
  const blockMap = new Map<string, Array<{ match: string; options: string[] }>>();
  const allMatches: Array<{ match: string; blockKey: string }> = [];
  let match;

  // Resetear regex y encontrar todas las coincidencias
  variationPattern.lastIndex = 0;
  while ((match = variationPattern.exec(text)) !== null) {
    const content = match[1];
    const options = content.split('|').map(opt => opt.trim());
    
    // Crear clave única para bloques idénticos
    const blockKey = options.join('|');
    
    if (!blockMap.has(blockKey)) {
      blockMap.set(blockKey, []);
    }
    
    blockMap.get(blockKey)!.push({
      match: match[0],
      options: options
    });
    
    allMatches.push({
      match: match[0],
      blockKey: blockKey
    });
  }
  
  // Para cada grupo de bloques idénticos, elegir el mismo índice aleatorio
  const replacements = new Map<string, string>();
  
  blockMap.forEach((blockGroup, blockKey) => {
    // Elegir un índice aleatorio para este grupo de bloques idénticos
    const randomIndex = Math.floor(Math.random() * blockGroup[0].options.length);
    const selectedOption = blockGroup[0].options[randomIndex];
    
    // Guardar el reemplazo para este bloque
    replacements.set(blockKey, selectedOption);
  });
  
  // Aplicar todos los reemplazos - usar split/join para reemplazar TODAS las ocurrencias
  let result = text;
  blockMap.forEach((blockGroup, blockKey) => {
    const selectedOption = replacements.get(blockKey)!;
    // Para cada bloque en este grupo, reemplazar TODAS las ocurrencias usando split/join
    blockGroup.forEach(block => {
      // Usar split/join para reemplazar TODAS las ocurrencias (más seguro que replace)
      result = result.split(block.match).join(selectedOption);
    });
  });
  
  return result;
}

/**
 * Genera múltiples variaciones de un mensaje
 */
export function generateMessageVariations(message: string, count: number = 4): string[] {
  const variations: string[] = [];
  for (let i = 0; i < count; i++) {
    variations.push(processVariations(message));
  }
  return variations;
}

/**
 * Personaliza mensaje reemplazando %nombre% con el nombre del contacto
 * NOTA: Este sistema procesa números de desconocidos, así que no se usa personalización
 */
export function personalizeMessage(message: string, contactName?: string): string {
  // No personalizar, solo devolver el mensaje tal cual
  return message;
}

