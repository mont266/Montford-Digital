import { supabase } from './supabaseClient';

export interface PricingConfig {
  costPerPoint: number;
  discountPercent: number;
  baseSetupFee: {
    website: number;
    webapp: number;
    mobileapp: number;
    combo: number;
  };
  typeMultiplier: {
    website: number;
    webapp: number;
    mobileapp: number;
    combo: number;
  };
  clientProfileMultiplier: {
    startup: number;
    smb: number;
    established: number;
  };
  timelineMultiplier: {
    flexible: number;
    standard: number;
    expedited: number;
    urgent: number;
  };
  mobilePlatformMultiplier: {
    ios: number;
    android: number;
    both: number;
  };
  comboPlatformMultiplier: {
    web_ios: number;
    web_android: number;
    web_both: number;
  };
  featurePoints: Record<string, number>;
  maintenanceTiers: Record<
    string,
    { price: number; label: string; desc: string }
  >;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  costPerPoint: 14,
  discountPercent: 0.20,
  baseSetupFee: {
    website: 200,
    webapp: 350,
    mobileapp: 450,
    combo: 600,
  },
  typeMultiplier: {
    website: 0.65,
    webapp: 1.0,
    mobileapp: 1.15,
    combo: 1.55,
  },
  clientProfileMultiplier: {
    startup: 1.0,     // Baseline rate for startups & solo founders (higher & sustainable)
    smb: 1.25,        // Small to medium business
    established: 1.75, // Enterprise scale
  },
  timelineMultiplier: {
    flexible: 0.85,
    standard: 1.0,
    expedited: 1.25,
    urgent: 1.6,
  },
  mobilePlatformMultiplier: {
    ios: 1.0,
    android: 1.0,
    both: 1.45,
  },
  comboPlatformMultiplier: {
    web_ios: 1.0,
    web_android: 1.0,
    web_both: 1.25,
  },
  featurePoints: {
    auth: 5,
    roles: 6,
    profile: 4,
    cms: 10,
    ecommerce: 18,
    api: 8,
    dashboard: 14,
    realtime: 16,
    search: 6,
    seo: 4,
    multilingual: 8,
    notifications: 6,
    offline: 10,
    animations: 5,
  },
  maintenanceTiers: {
    none: { price: 0, label: 'Self-Managed', desc: 'Client handles own hosting, backups, and security.' },
    basic: { price: 25, label: 'Basic Hosting & Security', desc: 'Managed cloud hosting, SSL, daily backups, and security patches.' },
    standard: { price: 80, label: 'Standard Support', desc: 'Managed hosting + bug fixes & minor updates (up to 2 hrs/mo).' },
    premium: { price: 250, label: 'Premium Retainer', desc: 'Priority support SLA + feature additions (up to 8 hrs/mo).' },
  },
};

const LOCAL_STORAGE_KEY = 'montford_digital_calculator_settings';

export const getLocalPricingConfig = (): PricingConfig => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_PRICING_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRICING_CONFIG,
      ...parsed,
      baseSetupFee: { ...DEFAULT_PRICING_CONFIG.baseSetupFee, ...(parsed.baseSetupFee || {}) },
      typeMultiplier: { ...DEFAULT_PRICING_CONFIG.typeMultiplier, ...(parsed.typeMultiplier || {}) },
      clientProfileMultiplier: { ...DEFAULT_PRICING_CONFIG.clientProfileMultiplier, ...(parsed.clientProfileMultiplier || {}) },
      timelineMultiplier: { ...DEFAULT_PRICING_CONFIG.timelineMultiplier, ...(parsed.timelineMultiplier || {}) },
      mobilePlatformMultiplier: { ...DEFAULT_PRICING_CONFIG.mobilePlatformMultiplier, ...(parsed.mobilePlatformMultiplier || {}) },
      comboPlatformMultiplier: { ...DEFAULT_PRICING_CONFIG.comboPlatformMultiplier, ...(parsed.comboPlatformMultiplier || {}) },
      featurePoints: { ...DEFAULT_PRICING_CONFIG.featurePoints, ...(parsed.featurePoints || {}) },
      maintenanceTiers: { ...DEFAULT_PRICING_CONFIG.maintenanceTiers, ...(parsed.maintenanceTiers || {}) },
    };
  } catch (e) {
    console.warn('Error reading local pricing config:', e);
    return DEFAULT_PRICING_CONFIG;
  }
};

export const fetchPricingConfig = async (): Promise<{ config: PricingConfig; isRemote: boolean }> => {
  const localConfig = getLocalPricingConfig();
  try {
    const { data, error } = await supabase
      .from('calculator_settings')
      .select('config')
      .eq('id', 'default')
      .single();

    if (!error && data?.config) {
      const merged: PricingConfig = {
        ...DEFAULT_PRICING_CONFIG,
        ...data.config,
        baseSetupFee: { ...DEFAULT_PRICING_CONFIG.baseSetupFee, ...(data.config.baseSetupFee || {}) },
        typeMultiplier: { ...DEFAULT_PRICING_CONFIG.typeMultiplier, ...(data.config.typeMultiplier || {}) },
        clientProfileMultiplier: { ...DEFAULT_PRICING_CONFIG.clientProfileMultiplier, ...(data.config.clientProfileMultiplier || {}) },
        timelineMultiplier: { ...DEFAULT_PRICING_CONFIG.timelineMultiplier, ...(data.config.timelineMultiplier || {}) },
        mobilePlatformMultiplier: { ...DEFAULT_PRICING_CONFIG.mobilePlatformMultiplier, ...(data.config.mobilePlatformMultiplier || {}) },
        comboPlatformMultiplier: { ...DEFAULT_PRICING_CONFIG.comboPlatformMultiplier, ...(data.config.comboPlatformMultiplier || {}) },
        featurePoints: { ...DEFAULT_PRICING_CONFIG.featurePoints, ...(data.config.featurePoints || {}) },
        maintenanceTiers: { ...DEFAULT_PRICING_CONFIG.maintenanceTiers, ...(data.config.maintenanceTiers || {}) },
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      return { config: merged, isRemote: true };
    }
  } catch (err) {
    console.warn('Could not fetch remote calculator_settings, using local:', err);
  }

  return { config: localConfig, isRemote: false };
};

export const savePricingConfig = async (
  newConfig: PricingConfig
): Promise<{ success: boolean; savedToRemote: boolean; error?: string }> => {
  // Always persist locally
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
  } catch (e) {
    console.warn('Error saving config locally:', e);
  }

  // Attempt to save to Supabase
  try {
    const { error } = await supabase.from('calculator_settings').upsert({
      id: 'default',
      config: newConfig,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Notice saving to Supabase calculator_settings:', error.message);
      return { success: true, savedToRemote: false, error: error.message };
    }

    return { success: true, savedToRemote: true };
  } catch (err: any) {
    console.warn('Error saving to Supabase calculator_settings:', err);
    return { success: true, savedToRemote: false, error: err?.message };
  }
};
