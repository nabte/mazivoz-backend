/**
 * Limpia y normaliza número de teléfono
 */
export function cleanPhoneNumber(phone: string): string {
  // Remover todo excepto dígitos
  let cleaned = phone.replace(/\D/g, '');
  
  // Si no tiene código de país, agregar +52 (México)
  if (cleaned.length === 10) {
    cleaned = '52' + cleaned;
  }
  
  return cleaned;
}

/**
 * Formatea número para WhatsApp según el formato usado en n8n
 * Usa @s.whatsapp.net para envíos, pero puede usar @c.us también
 */
export function formatWhatsAppNumber(phone: string, useSWhatsapp: boolean = false): string {
  let tel = phone.toString().replace(/\D/g, '');
  
  if (!tel) return '';
  
  // Asegurar formato correcto
  if (tel.startsWith('52')) {
    if (!tel.startsWith('521')) {
      tel = '521' + tel.substring(2);
    }
  } else if (tel.length === 10) {
    tel = '521' + tel;
  } else if (tel.length === 12 && tel.startsWith('1')) {
    tel = '52' + tel;
  }
  
  // n8n usa @s.whatsapp.net, pero WPPConnect puede usar @c.us
  return useSWhatsapp ? `${tel}@s.whatsapp.net` : `${tel}@c.us`;
}

/**
 * Obtiene solo el número sin el sufijo @
 */
export function getPhoneNumberOnly(phone: string): string {
  return phone.split('@')[0];
}

