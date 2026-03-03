/**
 * Normalize phone number to standard Thai format
 * Converts international format (+66) to local format (0)
 * 
 * Examples:
 * 
 * 
 * 
 * @param phone Phone number string (can include +, spaces, dashes)
 * @returns Normalized phone number (10 digits starting with 0) or original if invalid
 */
export function normalizePhone(phone: string): string {
  if (!phone) return phone;
  
  // Remove spaces, dashes, and other non-digit characters except +
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Handle +66 format (Thailand country code)
  if (cleaned.startsWith('+66')) {
    // Replace +66 with 0
    cleaned = '0' + cleaned.substring(3);
  }
  // Handle 0066 format (alternative international format)
  else if (cleaned.startsWith('0066')) {
    cleaned = '0' + cleaned.substring(4);
  }
  // Handle 66 format (without leading 0 or +)
  else if (cleaned.startsWith('66') && cleaned.length === 11) {
    cleaned = '0' + cleaned.substring(2);
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 * Accepts normalized phone numbers (9-10 digits, optionally starting with 0)
 * Also accepts international format (+66) which will be normalized first
 * 
 * @param phone Phone number string
 * @returns True if phone number is valid
 */
export function validatePhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  
  // Normalize first
  const normalized = normalizePhone(phone.trim());
  
  // Check if it's 9-10 digits (after normalization)
  const phoneRegex = /^[0-9]{9,10}$/;
  return phoneRegex.test(normalized);
}

/**
 * Format phone number for display
 * Adds dash for readability: 0812345678 -> 081-234-5678
 * 
 * @param phone Phone number string
 * @returns Formatted phone number
 */
export function formatPhone(phone: string): string {
  if (!phone) return phone;
  
  const normalized = normalizePhone(phone);
  
  // Format as 0XX-XXX-XXXX for 10 digits
  if (normalized.length === 10) {
    return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
  }
  
  // Format as 0XX-XXX-XXX for 9 digits
  if (normalized.length === 9) {
    return `${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`;
  }
  
  return normalized;
}
