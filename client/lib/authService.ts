import { supabase } from './supabase';
import { getOrCreateDeviceId, storeDeviceTrust } from './offline/deviceTrust';
import { API_BASE_URL } from './apiConfig';

export async function registerChef(data: {
  cin: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  can: string;
  phone: string;
  password: string;
  email: string;
  referenceCode: string;
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cin: data.cin.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        dateOfBirth: data.dateOfBirth || null,
        can: data.can.trim(),
        phone: data.phone.trim(),
        password: data.password,
        email: data.email.trim().toLowerCase(),
        referenceCode: data.referenceCode.trim(),
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result) {
      return {
        error: result?.error || 'Erreur lors de l\'inscription',
        data: null,
      };
    }

    return {
      error: null,
      data: result.data,
    };
  } catch (err) {
    console.error('Registration error:', err);
    return {
      error: 'Erreur lors de l\'inscription',
      data: null,
    };
  }
}

/**
 * Point 5: sends (or resends) the 6-digit confirmation PIN to the
 * given e-mail, via the same SMTP as App-membre (see
 * server/routes/email.ts).
 */
export async function sendVerificationPin(email: string, firstName?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-verification-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), firstName }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      return { error: result?.error || "Impossible d'envoyer le code de confirmation" };
    }
    return { error: null };
  } catch (err) {
    console.error('sendVerificationPin error:', err);
    return { error: "Impossible d'envoyer le code de confirmation" };
  }
}

export async function verifyEmailPin(email: string, pin: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), pin: pin.trim() }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      return { error: result?.error || 'Code invalide' };
    }
    return { error: null };
  } catch (err) {
    console.error('verifyEmailPin error:', err);
    return { error: 'Impossible de vérifier le code' };
  }
}

export async function loginChef(cin: string, password: string, firstName = '', lastName = '', rememberMe = false) {
  try {
    // Best-effort: a stable local device_id lets the server issue a
    // 10-day offline trust token in the same login response (see
    // server/routes/auth.ts). If IndexedDB is unavailable for any
    // reason, login must still proceed online-only — this device
    // simply won't get offline access.
    let deviceId: string | undefined;
    try {
      deviceId = await getOrCreateDeviceId();
    } catch (deviceIdError) {
      console.warn('[offline] Could not create device_id, continuing without device trust:', deviceIdError);
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cin,
        password,
        firstName,
        lastName,
        rememberMe,
        ...(deviceId ? { device_id: deviceId } : {}),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      return {
        error: result.error || 'CIN ou mot de passe incorrect',
        errorCode: result.error_code as string | undefined,
        email: result.email as string | undefined,
        data: null,
      };
    }

    const sessionData = {
      id: result.data.id,
      cin: result.data.cin,
      firstName: result.data.first_name,
      lastName: result.data.last_name,
      role: result.data.role,
    };

    localStorage.setItem('chef_session', JSON.stringify(sessionData));
    localStorage.removeItem('chef_token');
    if (typeof result.token === 'string' && result.token) {
      localStorage.setItem('chef_token', result.token);
    }

    // Persist device trust for offline use, if the server issued one.
    // Never blocks or fails the login itself.
    if (result.device && typeof result.device.token === 'string') {
      try {
        await storeDeviceTrust({
          chefId: String(result.data.id),
          rawToken: result.device.token,
          signedEnvelope: result.device.signed_envelope,
          expiresAt: result.device.expires_at,
        });
      } catch (trustError) {
        console.warn('[offline] Could not store device trust:', trustError);
      }
    }

    return {
      error: null,
      data: result.data,
    };
  } catch (err) {
    console.error('[ERROR] Exception dans loginChef:', err);
    return {
      error: 'Erreur lors de la connexion',
      data: null,
    };
  }
}

export function logoutChef() {
  localStorage.removeItem('chef_session');
  localStorage.removeItem('chef_token');
  localStorage.removeItem('user');
}

export function getCurrentChef() {
  const session = localStorage.getItem('chef_session');
  if (session) {
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }
  return null;
}

export function isChefLoggedIn(): boolean {
  return !!getCurrentChef();
}
