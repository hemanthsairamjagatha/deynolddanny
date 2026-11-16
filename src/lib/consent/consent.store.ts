import { atom } from 'nanostores';

export interface ConsentPreferences {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string | null;
}

const CONSENT_STORAGE_KEY = 'dd_dpdp_consent_v1';

const DEFAULT_CONSENT: ConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  updatedAt: null
};

export const $consent = atom<ConsentPreferences>(DEFAULT_CONSENT);
export const $consentDialogOpen = atom<boolean>(false);

let consentInitialized = false;

export function hasRecordedConsent(state: ConsentPreferences): boolean {
  return Boolean(state.updatedAt);
}

export function initConsentStore(): ConsentPreferences {
  if (typeof window === 'undefined') return DEFAULT_CONSENT;
  if (consentInitialized) return $consent.get();
  consentInitialized = true;

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
      if (parsed && typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0) {
        const hydrated: ConsentPreferences = {
          essential: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
          updatedAt: parsed.updatedAt
        };
        $consent.set(hydrated);
        return hydrated;
      }
    }
  } catch {
    // Ignore storage read errors in hardened browser modes
  }

  return $consent.get();
}

export function saveConsentPreferences(prefs: { analytics: boolean; marketing: boolean }): ConsentPreferences {
  const next: ConsentPreferences = {
    essential: true,
    analytics: Boolean(prefs.analytics),
    marketing: Boolean(prefs.marketing),
    updatedAt: new Date().toISOString()
  };
  $consent.set(next);
  $consentDialogOpen.set(false);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('dd:consent-updated', { detail: next }));
    } catch {
      // Ignore storage write errors
    }
  }
  return next;
}

export function acceptAllConsent(): ConsentPreferences {
  return saveConsentPreferences({ analytics: true, marketing: true });
}

export function acceptEssentialOnly(): ConsentPreferences {
  return saveConsentPreferences({ analytics: false, marketing: false });
}

export function openConsentPreferences(): void {
  $consentDialogOpen.set(true);
}

export function closeConsentPreferences(): void {
  $consentDialogOpen.set(false);
}

export function canTrackAnalytics(): boolean {
  return Boolean($consent.get().updatedAt && $consent.get().analytics);
}
