import { supabase } from './supabaseClient';

export interface EstimateFeature {
  key: string;
  label: string;
  description: string;
  points: number;
}

export type ProjectType = 'website' | 'webapp' | 'mobileapp' | 'combo';
export type ClientProfile = 'startup' | 'smb' | 'established';
export type MobilePlatform = 'ios' | 'android' | 'both';
export type ComboPlatform = 'web_ios' | 'web_android' | 'web_both';
export type Timeline = 'flexible' | 'standard' | 'expedited' | 'urgent';
export type MaintenanceTier = 'none' | 'basic' | 'standard' | 'premium';

export interface Estimate {
  id: string;
  title: string;
  client_id?: string | null;
  client_name?: string;
  client_email?: string;
  project_type: ProjectType;
  mobile_platform?: MobilePlatform;
  combo_platform?: ComboPlatform;
  client_profile: ClientProfile;
  timeline: Timeline;
  maintenance_tier: MaintenanceTier;
  features: Record<string, boolean>;
  custom_notes?: string;
  total_points: number;
  subtotal: number;
  discount: number;
  estimated_low: number;
  estimated_high: number;
  quoted_amount?: number; // Exact amount Scott decided to quote the customer
  invoice_id?: string;    // ID of invoice generated from this quote
  invoice_number?: string; // Number of invoice generated
  monthly_maintenance: number;
  yearly_maintenance: number;
  status: 'draft' | 'sent' | 'quoted' | 'invoiced' | 'approved' | 'archived';
  created_at: string;
}

const LOCAL_STORAGE_KEY = 'montford_digital_estimates';

export const getLocalEstimates = (): Estimate[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local estimates:', e);
    return [];
  }
};

export const saveLocalEstimates = (estimates: Estimate[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(estimates));
  } catch (e) {
    console.error('Error saving local estimates:', e);
  }
};

export const fetchAllEstimates = async (): Promise<Estimate[]> => {
  const localList = getLocalEstimates();
  try {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet in Supabase
      return localList;
    }

    if (data && Array.isArray(data)) {
      // Merge remote and local (avoid duplicates by id)
      const remoteIds = new Set(data.map((d: any) => d.id));
      const filteredLocal = localList.filter((item) => !remoteIds.has(item.id));
      const combined = [...data, ...filteredLocal].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      saveLocalEstimates(combined);
      return combined;
    }
  } catch (err) {
    console.warn('Could not fetch remote estimates, using local cache:', err);
  }
  return localList;
};

export const saveEstimate = async (estimate: Estimate): Promise<Estimate> => {
  // Always update local cache first
  const current = getLocalEstimates();
  const existingIdx = current.findIndex((e) => e.id === estimate.id);
  let updatedList: Estimate[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = estimate;
  } else {
    updatedList = [estimate, ...current];
  }
  saveLocalEstimates(updatedList);

  // Attempt to write to Supabase if table is present
  try {
    const payload = {
      id: estimate.id,
      title: estimate.title,
      client_id: estimate.client_id || null,
      client_name: estimate.client_name || null,
      client_email: estimate.client_email || null,
      project_type: estimate.project_type,
      platform: estimate.mobile_platform || estimate.combo_platform || null,
      client_profile: estimate.client_profile,
      timeline: estimate.timeline,
      maintenance_tier: estimate.maintenance_tier,
      features: estimate.features,
      custom_notes: estimate.custom_notes || null,
      total_points: estimate.total_points,
      subtotal: estimate.subtotal,
      discount: estimate.discount,
      estimated_low: estimate.estimated_low,
      estimated_high: estimate.estimated_high,
      quoted_amount: estimate.quoted_amount || null,
      invoice_id: estimate.invoice_id || null,
      invoice_number: estimate.invoice_number || null,
      monthly_maintenance: estimate.monthly_maintenance,
      status: estimate.status,
      created_at: estimate.created_at,
    };

    const { error } = await supabase.from('estimates').upsert(payload);
    if (error) {
      console.warn('Supabase estimates upsert notice (fallback to local storage):', error.message);
    }
  } catch (err) {
    console.warn('Supabase estimates upsert failed:', err);
  }

  return estimate;
};

export const deleteEstimate = async (id: string): Promise<void> => {
  const current = getLocalEstimates();
  saveLocalEstimates(current.filter((e) => e.id !== id));

  try {
    await supabase.from('estimates').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting remote estimate:', err);
  }
};

export const encodeEstimateToDataUrl = (estimate: Estimate): string => {
  try {
    const minified = {
      i: estimate.id,
      t: estimate.title,
      cn: estimate.client_name,
      ce: estimate.client_email,
      cid: estimate.client_id,
      pt: estimate.project_type,
      mp: estimate.mobile_platform,
      cp: estimate.combo_platform,
      pr: estimate.client_profile,
      tm: estimate.timeline,
      mt: estimate.maintenance_tier,
      f: estimate.features,
      cnote: estimate.custom_notes,
      p: estimate.total_points,
      sub: estimate.subtotal,
      d: estimate.discount,
      l: estimate.estimated_low,
      h: estimate.estimated_high,
      qa: estimate.quoted_amount,
      inv_id: estimate.invoice_id,
      inv_num: estimate.invoice_number,
      mm: estimate.monthly_maintenance,
      ym: estimate.yearly_maintenance,
      st: estimate.status,
      ca: estimate.created_at,
    };
    const jsonStr = JSON.stringify(minified);
    return encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
  } catch (err) {
    console.error('Error encoding estimate:', err);
    return '';
  }
};

export const decodeEstimateFromDataUrl = (encoded: string): Estimate | null => {
  try {
    const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    const m = JSON.parse(jsonStr);
    return {
      id: m.i || 'est-' + Date.now(),
      title: m.t || 'Project Estimate',
      client_name: m.cn || '',
      client_email: m.ce || '',
      client_id: m.cid || null,
      project_type: m.pt || 'webapp',
      mobile_platform: m.mp,
      combo_platform: m.cp,
      client_profile: m.pr || 'startup',
      timeline: m.tm || 'standard',
      maintenance_tier: m.mt || 'none',
      features: m.f || {},
      custom_notes: m.cnote || '',
      total_points: m.p || 0,
      subtotal: m.sub || 0,
      discount: m.d || 0,
      estimated_low: m.l || 0,
      estimated_high: m.h || 0,
      quoted_amount: m.qa,
      invoice_id: m.inv_id,
      invoice_number: m.inv_num,
      monthly_maintenance: m.mm || 0,
      yearly_maintenance: m.ym || 0,
      status: m.st || 'sent',
      created_at: m.ca || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error decoding estimate data:', err);
    return null;
  }
};
