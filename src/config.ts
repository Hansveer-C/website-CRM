/**
 * Configuration manager for environment variables.
 * Uses Vite's import.meta.env for loading.
 */

export interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  sending_phone_number: string;
}

export interface AuthConfig {
  jwt_secret: string;
}

export const twilioConfig: TwilioConfig = {
  // Use VITE_ variables in browser, and TWILIO_ (more secure) in Node.
  account_sid: (typeof process !== 'undefined' && process.env.TWILIO_ACCOUNT_SID) ||
               (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TWILIO_ACCOUNT_SID) || 
               (typeof process !== 'undefined' && process.env.VITE_TWILIO_ACCOUNT_SID) || '',
               
  auth_token: (typeof process !== 'undefined' && process.env.TWILIO_AUTH_TOKEN) ||
              (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TWILIO_AUTH_TOKEN) || 
              (typeof process !== 'undefined' && process.env.VITE_TWILIO_AUTH_TOKEN) || '',
              
  sending_phone_number: (typeof process !== 'undefined' && process.env.TWILIO_PHONE_NUMBER) ||
                        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TWILIO_PHONE_NUMBER) || 
                        (typeof process !== 'undefined' && process.env.VITE_TWILIO_PHONE_NUMBER) || '',
};

export const authConfig: AuthConfig = {
  // If in browser, use VITE_ variable. In Node (tests), use process.env. Default to 'dev_secret' for easy testing.
  jwt_secret: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_JWT_SECRET) || 
               (typeof process !== 'undefined' && process.env.JWT_SECRET) || 
               'antigravity_safe_default_secret_123'
};

/**
 * Validates that Twilio credentials are loaded.
 * Logs masked values for security.
 */
export function validateTwilioConfig() {
  const { account_sid, auth_token, sending_phone_number } = twilioConfig;
  
  const isSidValid = account_sid && account_sid.startsWith('AC');
  const isTokenValid = !!auth_token;
  const isPhoneValid = !!sending_phone_number;

  console.group('%c 📲 Twilio Configuration Validation ', 'background: #F22F46; color: white; font-weight: bold;');
  
  if (isSidValid && isTokenValid && isPhoneValid) {
    console.log('✅ Account SID:', maskValue(account_sid, 4, 4));
    console.log('✅ Auth Token:', maskValue(auth_token, 0, 4));
    console.log('✅ Phone Number:', sending_phone_number);
    console.log('%cTwilio credentials loaded successfully.', 'color: green;');
  } else {
    if (!isSidValid) console.error('❌ Invalid or missing VITE_TWILIO_ACCOUNT_SID (Must start with "AC")');
    if (!isTokenValid) console.error('❌ Missing VITE_TWILIO_AUTH_TOKEN');
    if (!isPhoneValid) console.error('❌ Missing VITE_TWILIO_PHONE_NUMBER');
    console.warn('%cTwilio SMS integration might be disabled or fail at runtime.', 'color: orange;');
  }
  
  console.groupEnd();

  return isSidValid && isTokenValid && isPhoneValid;
}

/**
 * Masks sensitive strings for logging.
 */
function maskValue(val: string, showStart: number, showEnd: number): string {
  if (!val) return 'MISSING';
  if (val.length <= showStart + showEnd) return '*'.repeat(val.length);
  return val.slice(0, showStart) + '*'.repeat(val.length - showStart - showEnd) + val.slice(-showEnd);
}
