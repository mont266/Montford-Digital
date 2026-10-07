import React, { useState } from 'react';
import {
  PricingConfig,
  DEFAULT_PRICING_CONFIG,
  savePricingConfig,
} from '../lib/pricingConfig';

interface QuoteSettingsViewProps {
  config: PricingConfig;
  onConfigChange: (updated: PricingConfig) => void;
  isRemote: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const FEATURE_NAMES: Record<string, string> = {
  auth: 'User Authentication',
  roles: 'Roles & Permissions',
  profile: 'User Profiles',
  cms: 'Admin / CMS',
  ecommerce: 'E-commerce & Payments',
  api: 'API Integrations',
  dashboard: 'Analytics Dashboard',
  realtime: 'Real-time Live Sync',
  search: 'Advanced Search',
  seo: 'SEO & Social Cards',
  multilingual: 'Multi-language (i18n)',
  notifications: 'Push & Email Alerts',
  offline: 'Offline / PWA',
  animations: 'Custom UI Motion',
};

export const QuoteSettingsView: React.FC<QuoteSettingsViewProps> = ({
  config,
  onConfigChange,
  isRemote,
}) => {
  const [formData, setFormData] = useState<PricingConfig>(config);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateNumberField = (path: (string | number)[], val: number) => {
    setFormData((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      let current = clone;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = val;
      return clone;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const result = await savePricingConfig(formData);
      onConfigChange(formData);
      if (result.savedToRemote) {
        setStatusMessage({
          type: 'success',
          text: '✓ Pricing settings saved to backend database! All future quotes will use these figures.',
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: '✓ Settings saved locally and active now! (Run the SQL snippet in Supabase to sync across all devices).',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error saving settings: ' + (e?.message || 'Unknown error'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all pricing and credit figures to default values?')) {
      setFormData(DEFAULT_PRICING_CONFIG);
      setStatusMessage({
        type: 'info',
        text: 'Reset to defaults. Click "Save to Backend" to confirm.',
      });
    }
  };

  // Live Simulation for instant feedback
  const sampleStartupWebapp = (() => {
    const pts =
      formData.featurePoints.auth +
      formData.featurePoints.profile +
      formData.featurePoints.cms +
      formData.featurePoints.dashboard +
      formData.featurePoints.api;
    const effCost =
      formData.costPerPoint *
      formData.typeMultiplier.webapp *
      formData.clientProfileMultiplier.startup;
    const subtotal = formData.baseSetupFee.webapp + pts * effCost;
    return {
      points: pts,
      effectivePtRate: effCost,
      low: Math.round(subtotal * 0.9),
      high: Math.round(subtotal * 1.1),
      withDiscount: Math.round(subtotal * (1 - formData.discountPercent)),
    };
  })();

  const sampleStartupWebsite = (() => {
    const pts =
      formData.featurePoints.cms +
      formData.featurePoints.seo +
      formData.featurePoints.animations;
    const effCost =
      formData.costPerPoint *
      formData.typeMultiplier.website *
      formData.clientProfileMultiplier.startup;
    const subtotal = formData.baseSetupFee.website + pts * effCost;
    return {
      points: pts,
      effectivePtRate: effCost,
      low: Math.round(subtotal * 0.9),
      high: Math.round(subtotal * 1.1),
    };
  })();

  return (
    <div className="space-y-8">
      {/* Settings Top Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold text-white">Pricing & Credit System Settings</h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isRemote
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                  : 'bg-amber-950/60 text-amber-400 border-amber-800/40'
              }`}
            >
              {isRemote ? 'Backend Connected' : 'Local Cache Active'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fine-tune credit point rates, setup fees, commercial multipliers, and feature point weights.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 md:flex-none px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings to Backend'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : statusMessage.type === 'info'
              ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Grid: Left side inputs, Right side live simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Base Credit Rate & Profile Multipliers (Startup Fine-Tuning) */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5 shadow-lg">
            <div className="border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                1. Base Credit Rate & Client Commercial Profiles
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjust the base cost per credit point and fine-tune the rate for startups / solo founders.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base Cost Per Point (£ / credit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">£</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.costPerPoint}
                    onChange={(e) => updateNumberField(['costPerPoint'], parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Core point rate before stage and architecture multipliers.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Standard Discount Percentage
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={Math.round(formData.discountPercent * 100)}
                    onChange={(e) =>
                      updateNumberField(['discountPercent'], (parseFloat(e.target.value) || 0) / 100)
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-cyan-500"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Percentage deducted when the Discount toggle is switched on.
                </span>
              </div>
            </div>

            {/* Profile Multipliers */}
            <div className="pt-2">
              <h5 className="text-xs uppercase tracking-wider font-bold text-cyan-400 mb-3">
                Commercial Stage Multipliers
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Startup / Solo</span>
                    <span className="text-[11px] font-semibold text-cyan-400">
                      £{(formData.costPerPoint * formData.clientProfileMultiplier.startup).toFixed(2)}/pt
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={formData.clientProfileMultiplier.startup}
                    onChange={(e) =>
                      updateNumberField(
                        ['clientProfileMultiplier', 'startup'],
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-400 block leading-tight">
                    Multiplier for solo founders & pre-seed startups. (Increase to raise startup rates).
                  </span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Small Business (SMB)</span>
                    <span className="text-[11px] font-semibold text-cyan-400">
                      £{(formData.costPerPoint * formData.clientProfileMultiplier.smb).toFixed(2)}/pt
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={formData.clientProfileMultiplier.smb}
                    onChange={(e) =>
                      updateNumberField(
                        ['clientProfileMultiplier', 'smb'],
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-400 block leading-tight">
                    Standard commercial business rate.
                  </span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Enterprise / Established</span>
                    <span className="text-[11px] font-semibold text-cyan-400">
                      £{(formData.costPerPoint * formData.clientProfileMultiplier.established).toFixed(2)}/pt
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={formData.clientProfileMultiplier.established}
                    onChange={(e) =>
                      updateNumberField(
                        ['clientProfileMultiplier', 'established'],
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-400 block leading-tight">
                    Corporate & enterprise tier projects.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Setup Fees & Architecture Multipliers */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5 shadow-lg">
            <div className="border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                2. Project Archetype Setup Fees & Multipliers
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Differentiates static websites, full-stack web applications, mobile apps, and cross-platform suites.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Website */}
              <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3">
                <span className="text-xs font-bold text-white block">Website (Static)</span>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Base Setup (£)</label>
                  <input
                    type="number"
                    step="25"
                    value={formData.baseSetupFee.website}
                    onChange={(e) =>
                      updateNumberField(['baseSetupFee', 'website'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Point Multiplier (&times;)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.typeMultiplier.website}
                    onChange={(e) =>
                      updateNumberField(['typeMultiplier', 'website'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Web App */}
              <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3">
                <span className="text-xs font-bold text-white block">Web App (Dynamic)</span>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Base Setup (£)</label>
                  <input
                    type="number"
                    step="25"
                    value={formData.baseSetupFee.webapp}
                    onChange={(e) =>
                      updateNumberField(['baseSetupFee', 'webapp'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Point Multiplier (&times;)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.typeMultiplier.webapp}
                    onChange={(e) =>
                      updateNumberField(['typeMultiplier', 'webapp'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Mobile App */}
              <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3">
                <span className="text-xs font-bold text-white block">Mobile App</span>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Base Setup (£)</label>
                  <input
                    type="number"
                    step="25"
                    value={formData.baseSetupFee.mobileapp}
                    onChange={(e) =>
                      updateNumberField(['baseSetupFee', 'mobileapp'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Point Multiplier (&times;)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.typeMultiplier.mobileapp}
                    onChange={(e) =>
                      updateNumberField(['typeMultiplier', 'mobileapp'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Web + Mobile Combo */}
              <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3">
                <span className="text-xs font-bold text-white block">Web + Mobile Suite</span>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Base Setup (£)</label>
                  <input
                    type="number"
                    step="25"
                    value={formData.baseSetupFee.combo}
                    onChange={(e) =>
                      updateNumberField(['baseSetupFee', 'combo'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Point Multiplier (&times;)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.typeMultiplier.combo}
                    onChange={(e) =>
                      updateNumberField(['typeMultiplier', 'combo'], parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Feature Point Weightings */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4 shadow-lg">
            <div className="border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                3. Feature Points Weighting (Credits per Feature)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Define the points assigned to each modular engineering feature.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(formData.featurePoints).map(([key, pts]) => (
                <div
                  key={key}
                  className="p-3 bg-slate-900/50 border border-slate-700 rounded-xl flex justify-between items-center"
                >
                  <span className="text-xs font-medium text-slate-300">
                    {FEATURE_NAMES[key] || key}
                  </span>
                  <div className="flex items-center gap-1.5 w-20">
                    <input
                      type="number"
                      min="1"
                      value={pts}
                      onChange={(e) =>
                        updateNumberField(['featurePoints', key], parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-white font-bold"
                    />
                    <span className="text-[10px] text-slate-500">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Maintenance Retainers */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4 shadow-lg">
            <div className="border-b border-slate-700 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                4. Ongoing Upkeep Retainers (£ / month)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly pricing for hosting, backups, and maintenance packages.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['basic', 'standard', 'premium'] as const).map((tierKey) => (
                <div key={tierKey} className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-white block">
                    {formData.maintenanceTiers[tierKey]?.label || tierKey}
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">£</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={formData.maintenanceTiers[tierKey]?.price || 0}
                      onChange={(e) =>
                        updateNumberField(
                          ['maintenanceTiers', tierKey, 'price'],
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-white text-xs font-semibold"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block">per month</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Live Simulation Panel */}
        <div className="lg:col-span-1 sticky top-8 space-y-5">
          <div className="bg-slate-800 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl space-y-5">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-cyan-400 block">
                Live Calibration Simulator
              </span>
              <h4 className="text-lg font-bold text-white mt-0.5">Instant Quote Previews</h4>
              <p className="text-xs text-slate-400 mt-1">
                See in real-time how your fine-tuned figures impact sample customer scopes before saving.
              </p>
            </div>

            {/* Preview 1: Startup Web App */}
            <div className="p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-white">Startup Web App MVP</span>
                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/80 px-2 py-0.5 rounded">
                  {sampleStartupWebapp.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Auth, Profiles, Admin CMS, Analytics Dashboard & APIs.
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <div>
                  <span className="text-[11px] text-slate-500 block">Estimated Range:</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatCurrency(sampleStartupWebapp.low)} &ndash; {formatCurrency(sampleStartupWebapp.high)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">With 20% Discount:</span>
                  <span className="text-xs font-bold text-slate-300">
                    {formatCurrency(sampleStartupWebapp.withDiscount)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 block pt-1">
                Effective rate: £{sampleStartupWebapp.effectivePtRate.toFixed(2)}/pt + £
                {formData.baseSetupFee.webapp} base
              </span>
            </div>

            {/* Preview 2: Startup Landing Website */}
            <div className="p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-white">Startup Marketing Website</span>
                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/80 px-2 py-0.5 rounded">
                  {sampleStartupWebsite.points} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                High-speed landing page, CMS Blog, SEO & Custom Animations.
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <div>
                  <span className="text-[11px] text-slate-500 block">Estimated Range:</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatCurrency(sampleStartupWebsite.low)} &ndash; {formatCurrency(sampleStartupWebsite.high)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 block pt-1">
                Effective rate: £{sampleStartupWebsite.effectivePtRate.toFixed(2)}/pt + £
                {formData.baseSetupFee.website} base
              </span>
            </div>

            {/* Save Action Callout */}
            <div className="pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                {isSaving ? 'Saving...' : 'Apply & Save to Backend'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
