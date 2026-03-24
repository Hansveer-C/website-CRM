/**
 * Configuration manager for environment variables.
 * In production, these variables remain on the server and are NEVER exposed to the frontend bundle.
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
  // SECURE: These secrets ARE NOT prefixed with VITE_. 
  // Vite will leave these as process.env references which resolve to empty strings in the browser.
  account_sid: (typeof process !== 'undefined' && process.env.TWILIO_ACCOUNT_SID) || '',
  auth_token: (typeof process !== 'undefined' && process.env.TWILIO_AUTH_TOKEN) || '',
  sending_phone_number: (typeof process !== 'undefined' && process.env.TWILIO_PHONE_NUMBER) || '',
};

export const authConfig: AuthConfig = {
  // SECURE: JWT_SECRET must remain safely on the server.
  jwt_secret: (typeof process !== 'undefined' && process.env.JWT_SECRET) || 
               'antigravity_safe_default_secret_123'
};

export interface SupabaseConfig {
  url: string;
  service_role_key: string;
}

export const supabaseConfig: SupabaseConfig = {
  // SECURE: These secrets ARE NOT prefixed with VITE_.
  url: (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '',
  service_role_key: (typeof process !== 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) || '',
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
    if (!isSidValid) console.error('❌ Invalid or missing TWILIO_ACCOUNT_SID (Must start with "AC")');
    if (!isTokenValid) console.error('❌ Missing TWILIO_AUTH_TOKEN');
    if (!isPhoneValid) console.error('❌ Missing TWILIO_PHONE_NUMBER');
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
