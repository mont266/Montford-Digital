import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  Estimate,
  ProjectType,
  ClientProfile,
  MobilePlatform,
  ComboPlatform,
  Timeline,
  MaintenanceTier,
  saveEstimate,
  fetchAllEstimates,
  deleteEstimate,
  encodeEstimateToDataUrl,
} from '../lib/estimates';
import {
  PricingConfig,
  DEFAULT_PRICING_CONFIG,
  fetchPricingConfig,
} from '../lib/pricingConfig';
import { QuoteSettingsView } from '../components/QuoteSettingsView';
import { ConvertToInvoiceModal } from '../components/ConvertToInvoiceModal';
import { ExactQuoteCalibrationModal } from '../components/ExactQuoteCalibrationModal';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

interface ClientOption {
  id: string;
  name: string;
  email?: string;
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="font-medium text-slate-300 text-sm">{label}</span>
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`block w-12 h-7 rounded-full transition ${checked ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
      <div
        className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition transform ${
          checked ? 'translate-x-5' : ''
        }`}
      ></div>
    </div>
  </label>
);

const FeatureCheckbox: React.FC<{
  id: string;
  label: string;
  description: string;
  points: number;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
}> = ({ id, label, description, points, checked, onChange }) => (
  <label
    htmlFor={id}
    className={`flex items-start p-3.5 border rounded-xl cursor-pointer transition-all ${
      checked
        ? 'bg-cyan-950/25 border-cyan-500/60 shadow-sm shadow-cyan-950/30'
        : 'bg-slate-900/40 border-slate-700/80 hover:bg-slate-800/50 hover:border-slate-600'
    }`}
  >
    <div className="mt-0.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(id, e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
      />
    </div>
    <div className="ml-3 flex-grow">
      <div className="flex justify-between items-baseline gap-2">
        <span className="block text-white font-medium text-sm">{label}</span>
        <span className="block text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full whitespace-nowrap">
          {points} pts
        </span>
      </div>
      <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</span>
    </div>
  </label>
);

const PROJECT_TYPE_METAS = {
  website: {
    label: 'Website',
    badge: 'Static / Landing Page',
    description: 'Fast, lightweight marketing sites and conversion landing pages.',
  },
  webapp: {
    label: 'Web App',
    badge: 'Dynamic / Full-Stack',
    description: 'Custom database applications, portals, and SaaS dashboards.',
  },
  mobileapp: {
    label: 'Mobile App',
    badge: 'iOS / Android Native',
    description: 'Dedicated smartphone applications for the Apple App Store and Google Play.',
  },
  combo: {
    label: 'Web App + Mobile App',
    badge: 'Cross-Platform Suite',
    description: 'Unified web app plus native mobile apps with shared cloud backend.',
  },
};

const QuoteCalculatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // --- View Mode ---
  const [activeTab, setActiveTab] = useState<'calculator' | 'history' | 'settings'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history' || tabParam === 'settings') return tabParam;
    return 'calculator';
  });

  // --- Dynamic Pricing Configuration State ---
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [isRemoteConfig, setIsRemoteConfig] = useState(false);

  // --- Clients State ---
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    searchParams.get('clientId') || searchParams.get('client_id') || ''
  );
  const [customClientName, setCustomClientName] = useState<string>('');
  const [customClientEmail, setCustomClientEmail] = useState<string>('');
  const [estimateTitle, setEstimateTitle] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');

  // --- Exact Quoted Price State ---
  const [userExactQuotedPrice, setUserExactQuotedPrice] = useState<number | null>(null);

  // --- Calculator Scoping State ---
  const [projectType, setProjectType] = useState<ProjectType>('webapp');
  const [clientProfile, setClientProfile] = useState<ClientProfile>('startup');
  const [mobilePlatform, setMobilePlatform] = useState<MobilePlatform>('both');
  const [comboPlatform, setComboPlatform] = useState<ComboPlatform>('web_both');
  const [timeline, setTimeline] = useState<Timeline>('standard');
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [maintenanceTier, setMaintenanceTier] = useState<MaintenanceTier>('none');

  const [features, setFeatures] = useState<Record<string, boolean>>({
    auth: true,
    roles: false,
    profile: true,
    cms: true,
    ecommerce: false,
    api: true,
    dashboard: false,
    realtime: false,
    search: false,
    seo: true,
    multilingual: false,
    notifications: false,
    offline: false,
    animations: true,
  });

  // --- Saved Estimates State ---
  const [savedEstimates, setSavedEstimates] = useState<Estimate[]>([]);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // --- Modal States ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeEstimateForShare, setActiveEstimateForShare] = useState<Estimate | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Convert to Invoice Modal
  const [convertModalEstimate, setConvertModalEstimate] = useState<Estimate | null>(null);
  const [calibratingEstimate, setCalibratingEstimate] = useState<Estimate | null>(null);

  // Fetch initial config, clients, and estimates
  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. Fetch dynamic pricing config
      const { config, isRemote } = await fetchPricingConfig();
      setPricingConfig(config);
      setIsRemoteConfig(isRemote);

      // 2. Fetch clients
      try {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, email')
          .order('name');
        if (clientsData) {
          setClients(clientsData as ClientOption[]);

          // Check if clientId was passed in URL query param
          const paramClientId = searchParams.get('clientId') || searchParams.get('client_id');
          if (paramClientId) {
            setSelectedClientId(paramClientId);
            const found = (clientsData as ClientOption[]).find((c) => c.id === paramClientId);
            if (found) {
              setCustomClientName(found.name);
              setCustomClientEmail(found.email || '');
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching clients:', err);
      }

      // 3. Fetch saved estimates
      const estimatesList = await fetchAllEstimates();
      setSavedEstimates(estimatesList);
    };

    fetchInitialData();
  }, [searchParams]);

  // Set default title based on project archetype if empty
  useEffect(() => {
    if (!estimateTitle || estimateTitle.includes('Estimate') || estimateTitle.includes('Scope')) {
      const typeLabel = PROJECT_TYPE_METAS[projectType]?.label || 'Project';
      const clientName = selectedClientId
        ? clients.find((c) => c.id === selectedClientId)?.name
        : customClientName;
      setEstimateTitle(clientName ? `${clientName} - ${typeLabel} Scope` : `${typeLabel} Estimate`);
    }
  }, [projectType, selectedClientId, customClientName, clients]);

  const featureLabels: Record<string, string> = {
    auth: 'User Authentication',
    roles: 'Roles & Permissions',
    profile: 'User Profiles',
    cms: 'Admin / CMS',
    ecommerce: 'E-commerce',
    api: 'API Integrations',
    dashboard: 'Data Dashboard',
    realtime: 'Real-time Data',
    search: 'Advanced Search',
    seo: 'SEO Optimization',
    multilingual: 'Multi-language',
    notifications: 'Push/Email Alerts',
    offline: 'Offline/PWA',
    animations: 'Custom Animations',
  };

  // --- Dynamic Calculation Logic using live PricingConfig ---
  const priceBreakdown = useMemo(() => {
    let totalPoints = 0;
    const selectedFeaturesList = [];

    for (const [key, value] of Object.entries(features)) {
      if (value) {
        const points = pricingConfig.featurePoints[key] || 0;
        totalPoints += points;
        selectedFeaturesList.push({ key, label: featureLabels[key] || key, points });
      }
    }

    const baseSetupFee = pricingConfig.baseSetupFee[projectType] || 200;
    const typeMultiplier = pricingConfig.typeMultiplier[projectType] || 1.0;
    const clientProfileMultiplier = pricingConfig.clientProfileMultiplier[clientProfile] || 1.0;

    const effectiveCostPerPoint =
      pricingConfig.costPerPoint * typeMultiplier * clientProfileMultiplier;

    const featureCost = totalPoints * effectiveCostPerPoint;
    const subtotalBeforeMultipliers = baseSetupFee + featureCost;

    const timelineMultiplier = pricingConfig.timelineMultiplier[timeline] || 1.0;

    let platformMultiplier = 1;
    if (projectType === 'mobileapp') {
      platformMultiplier = pricingConfig.mobilePlatformMultiplier[mobilePlatform] || 1.0;
    } else if (projectType === 'combo') {
      platformMultiplier = pricingConfig.comboPlatformMultiplier[comboPlatform] || 1.25;
    }

    const subtotal = subtotalBeforeMultipliers * timelineMultiplier * platformMultiplier;
    const discount = applyDiscount ? subtotal * pricingConfig.discountPercent : 0;
    const finalPrice = subtotal - discount;

    const priceRange = {
      low: Math.round(finalPrice * 0.9),
      high: Math.round(finalPrice * 1.1),
    };

    const monthlyMaintenance = pricingConfig.maintenanceTiers[maintenanceTier]?.price || 0;
    const yearlyMaintenance = monthlyMaintenance * 12;

    return {
      baseSetupFee,
      totalPoints,
      selectedFeaturesList,
      effectiveCostPerPoint,
      featureCost,
      typeMultiplier,
      platformMultiplier,
      clientProfileMultiplier,
      timelineMultiplier,
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      finalPrice: Math.round(finalPrice),
      priceRange,
      monthlyMaintenance,
      yearlyMaintenance,
    };
  }, [
    pricingConfig,
    projectType,
    clientProfile,
    mobilePlatform,
    comboPlatform,
    timeline,
    features,
    applyDiscount,
    maintenanceTier,
  ]);

  // Exact chosen quote amount
  const effectiveExactQuote = userExactQuotedPrice ?? priceBreakdown.finalPrice;

  const currentEstimateObject = useMemo<Estimate>(() => {
    const matchedClient = clients.find((c) => c.id === selectedClientId);
    return {
      id: 'est-' + Date.now(),
      title: estimateTitle || `${PROJECT_TYPE_METAS[projectType]?.label} Scope`,
      client_id: selectedClientId || null,
      client_name: matchedClient?.name || customClientName || '',
      client_email: matchedClient?.email || customClientEmail || '',
      project_type: projectType,
      mobile_platform: projectType === 'mobileapp' ? mobilePlatform : undefined,
      combo_platform: projectType === 'combo' ? comboPlatform : undefined,
      client_profile: clientProfile,
      timeline,
      maintenance_tier: maintenanceTier,
      features,
      custom_notes: customNotes,
      total_points: priceBreakdown.totalPoints,
      subtotal: priceBreakdown.subtotal,
      discount: priceBreakdown.discount,
      estimated_low: priceBreakdown.priceRange.low,
      estimated_high: priceBreakdown.priceRange.high,
      quoted_amount: effectiveExactQuote,
      monthly_maintenance: priceBreakdown.monthlyMaintenance,
      yearly_maintenance: priceBreakdown.yearlyMaintenance,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
  }, [
    estimateTitle,
    selectedClientId,
    customClientName,
    customClientEmail,
    clients,
    projectType,
    mobilePlatform,
    comboPlatform,
    clientProfile,
    timeline,
    maintenanceTier,
    features,
    customNotes,
    priceBreakdown,
    effectiveExactQuote,
  ]);

  const handleSaveCurrentEstimate = async () => {
    setSavingStatus('Saving...');
    try {
      await saveEstimate(currentEstimateObject);
      const updatedList = await fetchAllEstimates();
      setSavedEstimates(updatedList);
      setSavingStatus('Saved!');
      setTimeout(() => setSavingStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setSavingStatus('Saved locally!');
      setTimeout(() => setSavingStatus(null), 2500);
    }
  };

  const handleOpenShareModal = (est?: Estimate) => {
    const target = est || currentEstimateObject;
    setActiveEstimateForShare(target);
    setShareModalOpen(true);
    setCopiedLink(false);
    setCopiedText(false);
  };

  const handleOpenConvertModal = (est?: Estimate) => {
    const target = est || currentEstimateObject;
    setConvertModalEstimate(target);
  };

  const handleInvoiceGeneratedSuccess = (invoiceId: string, invoiceNumber: string) => {
    fetchAllEstimates().then(setSavedEstimates);
  };

  const generateShareUrl = (est: Estimate) => {
    const baseUrl = `${window.location.origin}/#/estimate`;
    const encoded = encodeEstimateToDataUrl(est);
    return `${baseUrl}?id=${est.id}&data=${encoded}`;
  };

  const copyShareLink = (est: Estimate) => {
    const url = generateShareUrl(est);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyProposalText = (est: Estimate) => {
    const activeFeats = Object.entries(est.features || {})
      .filter(([_, v]) => Boolean(v))
      .map(([k]) => featureLabels[k] || k)
      .join(', ');

    const text = `Montford Digital - Project Estimate & Scope
Project: ${est.title}
Client: ${est.client_name || 'Prospective Client'}
Classification: ${PROJECT_TYPE_METAS[est.project_type]?.label || est.project_type}
Estimated Range: ${formatCurrency(est.estimated_low)} - ${formatCurrency(est.estimated_high)}
${est.quoted_amount ? `Agreed Fixed Quote: ${formatCurrency(est.quoted_amount)}\n` : ''}Timeline: ${est.timeline}
Included Features: ${activeFeats || 'Standard baseline scope'}
Ongoing Upkeep: ${est.monthly_maintenance > 0 ? `${formatCurrency(est.monthly_maintenance)}/mo` : 'Self-managed'}
${est.discount > 0 ? `Discount: -${formatCurrency(est.discount)}` : ''}

View full interactive scope breakdown:
${generateShareUrl(est)}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleLoadEstimate = (est: Estimate) => {
    setEstimateTitle(est.title);
    setSelectedClientId(est.client_id || '');
    setCustomClientName(est.client_name || '');
    setCustomClientEmail(est.client_email || '');
    setProjectType(est.project_type);
    if (est.mobile_platform) setMobilePlatform(est.mobile_platform);
    if (est.combo_platform) setComboPlatform(est.combo_platform);
    setClientProfile(est.client_profile);
    setTimeline(est.timeline);
    setMaintenanceTier(est.maintenance_tier);
    setApplyDiscount(est.discount > 0);
    setFeatures(est.features || {});
    setCustomNotes(est.custom_notes || '');
    if (est.quoted_amount) setUserExactQuotedPrice(est.quoted_amount);
    setActiveTab('calculator');
  };

  const handleDeleteEstimate = async (id: string) => {
    if (confirm('Are you sure you want to delete this saved estimate?')) {
      await deleteEstimate(id);
      setSavedEstimates((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const clientProfileLabels: Record<ClientProfile, string> = {
    startup: `Startup / Solo (${pricingConfig.clientProfileMultiplier.startup}×)`,
    smb: `Small Business (${pricingConfig.clientProfileMultiplier.smb}×)`,
    established: `Enterprise (${pricingConfig.clientProfileMultiplier.established}×)`,
  };

  const timelineLabels: Record<Timeline, string> = {
    flexible: 'Flexible',
    standard: 'Standard',
    expedited: 'Expedited',
    urgent: 'Urgent',
  };

  const timelineDescriptions: Record<Timeline, string> = {
    flexible: '12+ Weeks (15% Off)',
    standard: '8-12 Weeks',
    expedited: '4-7 Weeks',
    urgent: '2-3 Weeks (Rush)',
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/80 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Quote &amp; Scope Calculator</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Architectural pricing engine with client scope sharing, exact quote calibration, and one-click customer invoicing.
          </p>
        </div>

        {/* Tab Controls: Calculator | Saved Estimates | Settings */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'calculator'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Saved Estimates</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {savedEstimates.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Pricing Settings</span>
          </button>
        </div>
      </div>

      {/* --- SETTINGS VIEW --- */}
      {activeTab === 'settings' && (
        <QuoteSettingsView
          config={pricingConfig}
          onConfigChange={(newCfg) => setPricingConfig(newCfg)}
          isRemote={isRemoteConfig}
        />
      )}

      {/* --- HISTORY VIEW --- */}
      {activeTab === 'history' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Historical Estimates &amp; Quotes</h3>
              <p className="text-xs text-slate-400">
                Browse, reload, share preliminary scopes, or convert quotes directly into customer invoices.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('calculator')}
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Create New Estimate
            </button>
          </div>

          {savedEstimates.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 border border-slate-700/50 rounded-xl">
              <p className="text-slate-400 text-sm">No estimates saved yet.</p>
              <button
                onClick={() => setActiveTab('calculator')}
                className="mt-3 text-cyan-400 hover:text-cyan-300 text-xs font-medium"
              >
                Configure an estimate in the calculator &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedEstimates.map((est) => (
                <div
                  key={est.id}
                  className="bg-slate-900/60 border border-slate-700/80 hover:border-slate-600 rounded-xl p-5 space-y-3 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                          {PROJECT_TYPE_METAS[est.project_type]?.label || est.project_type}
                        </span>
                        <h4 className="text-base font-bold text-white mt-0.5">{est.title}</h4>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(est.created_at)}</span>
                    </div>

                    <div className="mt-2 text-xs text-slate-300 space-y-1.5">
                      {est.client_name && (
                        <p>
                          <span className="text-slate-500">Client: </span>
                          <span className="font-semibold text-slate-200">{est.client_name}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-slate-500">Scope Range: </span>
                        <span className="font-semibold text-slate-300">
                          {formatCurrency(est.estimated_low)} &ndash; {formatCurrency(est.estimated_high)}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-slate-500">Agreed Exact Quote: </span>
                        {est.quoted_amount ? (
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(est.quoted_amount)}
                          </span>
                        ) : (
                          <span className="text-amber-400 italic text-[11px]">Not set yet</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCalibratingEstimate(est)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold ml-1"
                        >
                          {est.quoted_amount ? 'Change' : 'Set Exact Amount'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
                    <button
                      onClick={() => handleLoadEstimate(est)}
                      className="text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Load in Calculator
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setCalibratingEstimate(est)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 font-semibold"
                      >
                        Set Exact Quote
                      </button>

                      {est.invoice_number ? (
                        <a
                          href={`/#/invoice/${est.invoice_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 px-2.5 py-1 rounded border border-emerald-800/40 font-semibold"
                        >
                          ✓ Invoiced ({est.invoice_number})
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenConvertModal(est)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded font-bold shadow-sm flex items-center gap-1"
                        >
                          <span>Turn into Invoice</span>
                          {est.quoted_amount && (
                            <span className="font-normal opacity-90">({formatCurrency(est.quoted_amount)})</span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenShareModal(est)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded border border-slate-700"
                      >
                        Share
                      </button>
                      <a
                        href={generateShareUrl(est)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 px-2.5 py-1 rounded border border-cyan-800/40"
                      >
                        Public Link
                      </a>
                      <button
                        onClick={() => handleDeleteEstimate(est.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Delete estimate"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CALCULATOR VIEW --- */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">
          {/* TOP QUICK QUOTING & INVOICING ACTION BAR */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Agreed Customer Quote &amp; Invoicing
                </span>
                <span className="text-xs text-slate-400">
                  Calculated Scope: <strong className="text-slate-200">{formatCurrency(priceBreakdown.priceRange.low)} &ndash; {formatCurrency(priceBreakdown.priceRange.high)}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-sm font-bold text-white">Exact Quoted Amount to Bill:</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">£</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={effectiveExactQuote}
                      onChange={(e) => setUserExactQuotedPrice(parseFloat(e.target.value) || 0)}
                      className="bg-slate-900 border border-emerald-500/60 rounded-xl pl-7 pr-3 py-1.5 text-emerald-400 font-extrabold text-lg w-36 text-right focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.priceRange.low)}
                      className={`px-2 py-1 text-[10px] rounded border font-semibold ${
                        effectiveExactQuote === priceBreakdown.priceRange.low
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Set to lower bound"
                    >
                      Low
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.finalPrice)}
                      className={`px-2 py-1 text-[10px] rounded border font-semibold ${
                        effectiveExactQuote === priceBreakdown.finalPrice
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Set to mid target"
                    >
                      Mid
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.priceRange.high)}
                      className={`px-2 py-1 text-[10px] rounded border font-semibold ${
                        effectiveExactQuote === priceBreakdown.priceRange.high
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Set to upper bound"
                    >
                      High
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenConvertModal()}
              className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Turn Quote into Invoice ({formatCurrency(effectiveExactQuote)})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* --- Left Column: Inputs & Scoping --- */}
            <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-7 space-y-7 shadow-lg">
              {/* 1. Client Attachment & Title */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                    1. Client &amp; Estimate Details
                  </h3>
                  <span className="text-xs text-slate-400">Assign customer for invoice and proposal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Select Client
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value);
                        if (e.target.value) {
                          const c = clients.find((item) => item.id === e.target.value);
                          if (c) {
                            setCustomClientName(c.name);
                            setCustomClientEmail(c.email || '');
                          }
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Choose Client or Enter Name Below --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.email ? `(${c.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Estimate / Scope Title
                    </label>
                    <input
                      type="text"
                      value={estimateTitle}
                      onChange={(e) => setEstimateTitle(e.target.value)}
                      placeholder="e.g. Acme Web & Mobile App MVP"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {!selectedClientId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Client / Customer Name
                      </label>
                      <input
                        type="text"
                        value={customClientName}
                        onChange={(e) => setCustomClientName(e.target.value)}
                        placeholder="e.g. John Doe / Tech Labs Ltd"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Client Contact Email
                      </label>
                      <input
                        type="email"
                        value={customClientEmail}
                        onChange={(e) => setCustomClientEmail(e.target.value)}
                        placeholder="e.g. john@example.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Project Classification (Website vs Web App vs Mobile vs Combo) */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-base font-bold text-white">2. Project Classification</h3>
                  <span className="text-xs text-slate-400">Defines engineering overhead &amp; base</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(Object.keys(PROJECT_TYPE_METAS) as ProjectType[]).map((type) => {
                    const cfg = PROJECT_TYPE_METAS[type];
                    const isSelected = projectType === type;
                    const setupFee = pricingConfig.baseSetupFee[type] || 200;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setProjectType(type)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-cyan-950/30 border-cyan-500 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-white text-sm">{cfg.label}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                        </div>
                        <span className="inline-block text-[10px] font-semibold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full mb-2">
                          {cfg.badge}
                        </span>
                        <p className="text-[11px] text-slate-400 leading-snug">{cfg.description}</p>
                        <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-medium flex justify-between">
                          <span>Base setup:</span>
                          <span className="text-white font-semibold">{formatCurrency(setupFee)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Platform Configuration for Mobile or Combo */}
              {projectType === 'mobileapp' && (
                <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-white">Target Mobile Platform</h4>
                    <span className="text-xs text-cyan-400">Native iOS &amp; Android</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ios', 'android', 'both'] as MobilePlatform[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMobilePlatform(p)}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                          mobilePlatform === p
                            ? 'bg-cyan-500 text-white border-cyan-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {p === 'ios' ? 'Apple iOS' : p === 'android' ? 'Google Android' : 'Dual (iOS & Android)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {projectType === 'combo' && (
                <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-white">Cross-Platform Suite Inclusions</h4>
                    <span className="text-xs text-emerald-400 font-medium">Shared Backend Architecture Included</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['web_ios', 'web_android', 'web_both'] as ComboPlatform[]).map((cp) => (
                      <button
                        key={cp}
                        type="button"
                        onClick={() => setComboPlatform(cp)}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                          comboPlatform === cp
                            ? 'bg-cyan-500 text-white border-cyan-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {cp === 'web_ios'
                          ? 'Web App + iOS'
                          : cp === 'web_android'
                          ? 'Web App + Android'
                          : 'Web App + iOS & Android'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Client Commercial Profile */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-base font-bold text-white">3. Client Commercial Profile</h3>
                  <span className="text-xs text-slate-400">
                    Credits: {formatCurrency(priceBreakdown.effectiveCostPerPoint)} / pt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['startup', 'smb', 'established'] as ClientProfile[]).map((prof) => (
                    <button
                      key={prof}
                      type="button"
                      onClick={() => setClientProfile(prof)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        clientProfile === prof
                          ? 'bg-cyan-950/30 border-cyan-500 shadow-sm'
                          : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm capitalize">{prof}</span>
                        <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                          &times;{pricingConfig.clientProfileMultiplier[prof]}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block">{clientProfileLabels[prof]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Core Features Checklist */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-base font-bold text-white">4. Engineering Features &amp; Architecture</h3>
                  <span className="text-xs text-cyan-400 font-semibold">{priceBreakdown.totalPoints} points selected</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Select the modular features required for the project. Point values are calibrated in Pricing Settings.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FeatureCheckbox
                    id="auth"
                    label="User Authentication"
                    description="Secure login, registration, password recovery, and session handling."
                    points={pricingConfig.featurePoints.auth || 5}
                    checked={features.auth}
                    onChange={() => setFeatures((f) => ({ ...f, auth: !f.auth }))}
                  />
                  <FeatureCheckbox
                    id="roles"
                    label="Roles &amp; Permissions"
                    description="Role-based access controls (e.g. admin, manager, customer)."
                    points={pricingConfig.featurePoints.roles || 6}
                    checked={features.roles}
                    onChange={() => setFeatures((f) => ({ ...f, roles: !f.roles }))}
                  />
                  <FeatureCheckbox
                    id="profile"
                    label="User Profiles"
                    description="User-editable profile data, avatar uploads, and preferences."
                    points={pricingConfig.featurePoints.profile || 4}
                    checked={features.profile}
                    onChange={() => setFeatures((f) => ({ ...f, profile: !f.profile }))}
                  />
                  <FeatureCheckbox
                    id="cms"
                    label="Admin / CMS"
                    description="Content management panel to easily edit copy, articles, or records."
                    points={pricingConfig.featurePoints.cms || 10}
                    checked={features.cms}
                    onChange={() => setFeatures((f) => ({ ...f, cms: !f.cms }))}
                  />
                  <FeatureCheckbox
                    id="ecommerce"
                    label="E-commerce &amp; Checkout"
                    description="Product catalog, shopping cart, and Stripe payment gateway."
                    points={pricingConfig.featurePoints.ecommerce || 18}
                    checked={features.ecommerce}
                    onChange={() => setFeatures((f) => ({ ...f, ecommerce: !f.ecommerce }))}
                  />
                  <FeatureCheckbox
                    id="api"
                    label="API Integrations"
                    description="Connecting with third-party webhooks, REST services, and tools."
                    points={pricingConfig.featurePoints.api || 8}
                    checked={features.api}
                    onChange={() => setFeatures((f) => ({ ...f, api: !f.api }))}
                  />
                  <FeatureCheckbox
                    id="dashboard"
                    label="Data Dashboard"
                    description="Visual metric charts, interactive reports, and data visualization."
                    points={pricingConfig.featurePoints.dashboard || 14}
                    checked={features.dashboard}
                    onChange={() => setFeatures((f) => ({ ...f, dashboard: !f.dashboard }))}
                  />
                  <FeatureCheckbox
                    id="realtime"
                    label="Real-time Live Sync"
                    description="Live state streaming, WebSockets, or collaborative updates."
                    points={pricingConfig.featurePoints.realtime || 16}
                    checked={features.realtime}
                    onChange={() => setFeatures((f) => ({ ...f, realtime: !f.realtime }))}
                  />
                  <FeatureCheckbox
                    id="search"
                    label="Advanced Search"
                    description="Faceted search, multi-field filters, and responsive sorting."
                    points={pricingConfig.featurePoints.search || 6}
                    checked={features.search}
                    onChange={() => setFeatures((f) => ({ ...f, search: !f.search }))}
                  />
                  <FeatureCheckbox
                    id="seo"
                    label="SEO &amp; Social Cards"
                    description="OpenGraph tags, Schema.org JSON-LD, sitemaps, and speed optimization."
                    points={pricingConfig.featurePoints.seo || 4}
                    checked={features.seo}
                    onChange={() => setFeatures((f) => ({ ...f, seo: !f.seo }))}
                  />
                  <FeatureCheckbox
                    id="multilingual"
                    label="Multi-language Support"
                    description="Internationalization (i18n), regional routing, and language selector."
                    points={pricingConfig.featurePoints.multilingual || 8}
                    checked={features.multilingual}
                    onChange={() => setFeatures((f) => ({ ...f, multilingual: !f.multilingual }))}
                  />
                  <FeatureCheckbox
                    id="notifications"
                    label="Push &amp; Email Alerts"
                    description="Automated transactional emails and native mobile push alerts."
                    points={pricingConfig.featurePoints.notifications || 6}
                    checked={features.notifications}
                    onChange={() => setFeatures((f) => ({ ...f, notifications: !f.notifications }))}
                  />
                  <FeatureCheckbox
                    id="offline"
                    label="Offline / PWA"
                    description="Progressive Web App support with service worker offline caching."
                    points={pricingConfig.featurePoints.offline || 10}
                    checked={features.offline}
                    onChange={() => setFeatures((f) => ({ ...f, offline: !f.offline }))}
                  />
                  <FeatureCheckbox
                    id="animations"
                    label="Custom UI Motion"
                    description="Physics-based transitions, micro-interactions, and visual flair."
                    points={pricingConfig.featurePoints.animations || 5}
                    checked={features.animations}
                    onChange={() => setFeatures((f) => ({ ...f, animations: !f.animations }))}
                  />
                </div>
              </div>

              {/* 6. Timeline */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-base font-bold text-white">5. Project Delivery Timeline</h3>
                  <span className="text-xs text-slate-400">Flexibility reward available</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(['flexible', 'standard', 'expedited', 'urgent'] as Timeline[]).map((t) => (
                    <label
                      key={t}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        timeline === t
                          ? 'bg-cyan-950/30 border-cyan-500 shadow-sm'
                          : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="timeline"
                        value={t}
                        checked={timeline === t}
                        onChange={() => setTimeline(t)}
                        className="sr-only"
                      />
                      <span className="text-white font-bold text-sm block">{timelineLabels[t]}</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">{timelineDescriptions[t]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 7. Ongoing Maintenance */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-base font-bold text-white">6. Ongoing Support &amp; Hosting Retainer</h3>
                  <span className="text-xs text-slate-400">Post-launch maintenance</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(pricingConfig.maintenanceTiers) as MaintenanceTier[]).map((tier) => {
                    const tCfg = pricingConfig.maintenanceTiers[tier];
                    if (!tCfg) return null;
                    const isSelected = maintenanceTier === tier;
                    return (
                      <label
                        key={tier}
                        className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between transition-colors ${
                          isSelected
                            ? 'bg-cyan-950/30 border-cyan-500 shadow-sm'
                            : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <input
                            type="radio"
                            name="maintenance"
                            value={tier}
                            checked={isSelected}
                            onChange={() => setMaintenanceTier(tier)}
                            className="sr-only"
                          />
                          <span className="text-white font-bold text-sm block">{tCfg.label}</span>
                          <span className="text-xs text-slate-400 mt-1 block leading-relaxed">{tCfg.desc}</span>
                        </div>
                        <span className="block mt-3 text-cyan-400 font-bold text-sm">
                          {tCfg.price === 0 ? 'Self-Managed (Free)' : `${formatCurrency(tCfg.price)} / mo`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 8. Custom Scope Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Custom Scope Notes (Optional client context)
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Scope assumes client provides brand assets and copy. Includes 30 days post-launch warranty."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs leading-relaxed focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* --- Right Column: Results, Exact Quoting & Actions --- */}
            <div className="lg:col-span-1 space-y-5">
              {/* Discount Toggle Card */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
                <Toggle
                  label={`Apply Discount (${Math.round(pricingConfig.discountPercent * 100)}%)`}
                  checked={applyDiscount}
                  onChange={setApplyDiscount}
                />
              </div>

              {/* Price Estimate Card */}
              <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-6 shadow-xl sticky top-8 space-y-5">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <h3 className="text-lg font-bold text-white">Price Estimate &amp; Quote</h3>
                  <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                    {PROJECT_TYPE_METAS[projectType]?.badge}
                  </span>
                </div>

                {/* EXACT QUOTE CALIBRATION SECTION */}
                <div className="p-4 bg-emerald-950/25 border-2 border-emerald-500/40 rounded-xl space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Agreed Exact Quote Amount
                    </span>
                    <span className="text-[10px] text-slate-400">Target to invoice</span>
                  </div>

                  {/* Quick-pick chips */}
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.priceRange.low)}
                      className={`py-1 px-1 rounded border text-[11px] font-semibold transition-colors ${
                        effectiveExactQuote === priceBreakdown.priceRange.low
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Low: {formatCurrency(priceBreakdown.priceRange.low)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.finalPrice)}
                      className={`py-1 px-1 rounded border text-[11px] font-semibold transition-colors ${
                        effectiveExactQuote === priceBreakdown.finalPrice
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Mid: {formatCurrency(priceBreakdown.finalPrice)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserExactQuotedPrice(priceBreakdown.priceRange.high)}
                      className={`py-1 px-1 rounded border text-[11px] font-semibold transition-colors ${
                        effectiveExactQuote === priceBreakdown.priceRange.high
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      High: {formatCurrency(priceBreakdown.priceRange.high)}
                    </button>
                  </div>

                  {/* Exact Amount Input */}
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">£</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={effectiveExactQuote}
                      onChange={(e) => setUserExactQuotedPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg pl-7 pr-3 py-1.5 text-emerald-400 font-extrabold text-lg text-right focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* Line items */}
                <div className="space-y-2 text-xs text-slate-300 border-b border-slate-700 pb-4">
                  <div className="flex justify-between">
                    <span>Base Setup ({PROJECT_TYPE_METAS[projectType]?.label})</span>
                    <span className="font-medium text-white">{formatCurrency(priceBreakdown.baseSetupFee)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Features ({priceBreakdown.totalPoints} pts @ {formatCurrency(priceBreakdown.effectiveCostPerPoint)}/pt)
                    </span>
                    <span className="font-medium text-white">{formatCurrency(priceBreakdown.featureCost)}</span>
                  </div>

                  {projectType === 'website' && (
                    <div className="text-[11px] text-emerald-400 pl-2">
                      &bull; Static website credit multiplier applied ({pricingConfig.typeMultiplier.website}&times;)
                    </div>
                  )}
                </div>

                {/* Multipliers & Subtotal */}
                <div className="space-y-2 text-xs text-slate-300 border-b border-slate-700 pb-4">
                  <div className="flex justify-between font-semibold text-white">
                    <span>Subtotal</span>
                    <span>{formatCurrency(priceBreakdown.baseSetupFee + priceBreakdown.featureCost)}</span>
                  </div>

                  {priceBreakdown.timelineMultiplier !== 1 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Timeline ({timelineLabels[timeline]})</span>
                      <span>&times;{priceBreakdown.timelineMultiplier}</span>
                    </div>
                  )}

                  {priceBreakdown.platformMultiplier !== 1 && (
                    <div className="flex justify-between text-slate-400">
                      <span>
                        Platform Bundle (
                        {projectType === 'combo'
                          ? comboPlatform === 'web_both'
                            ? 'Web + Dual Mobile'
                            : 'Web + Single Mobile'
                          : mobilePlatform === 'both'
                          ? 'Dual Mobile'
                          : 'Single Mobile'}
                        )
                      </span>
                      <span>&times;{priceBreakdown.platformMultiplier}</span>
                    </div>
                  )}
                </div>

                {/* Discount line item */}
                <div className="space-y-2 text-xs text-slate-300 border-b border-slate-700 pb-4">
                  <div className="flex justify-between font-semibold">
                    <span>Adjusted Subtotal</span>
                    <span className="text-white">{formatCurrency(priceBreakdown.subtotal)}</span>
                  </div>

                  {priceBreakdown.discount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Discount ({Math.round(pricingConfig.discountPercent * 100)}%)</span>
                      <span>-{formatCurrency(priceBreakdown.discount)}</span>
                    </div>
                  )}
                </div>

                {/* Estimated Range Envelope */}
                <div className="text-center bg-slate-900/60 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    Estimated Delivery Envelope
                  </p>
                  <p className="text-xl font-bold text-slate-300">
                    {formatCurrency(priceBreakdown.priceRange.low)} &ndash; {formatCurrency(priceBreakdown.priceRange.high)}
                  </p>
                  <p className="text-[10px] text-slate-500">&plusmn;10% contingency window</p>
                </div>

                {/* Maintenance */}
                {priceBreakdown.monthlyMaintenance > 0 && (
                  <div className="p-3 bg-slate-900/40 border border-slate-700/60 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Ongoing Retainer:</span>
                      <span className="font-bold text-cyan-400">
                        {formatCurrency(priceBreakdown.monthlyMaintenance)} / mo
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Billed Annually:</span>
                      <span>{formatCurrency(priceBreakdown.yearlyMaintenance)} / yr</span>
                    </div>
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="space-y-2.5 pt-1">
                  {/* 1. Turn Quote Into Invoice (ALWAYS VISIBLE & PROMINENT) */}
                  <button
                    type="button"
                    onClick={() => handleOpenConvertModal()}
                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transform hover:scale-[1.01]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Turn Quote into Invoice ({formatCurrency(effectiveExactQuote)})</span>
                  </button>

                  {/* 2. Save Estimate Historically */}
                  <button
                    type="button"
                    onClick={handleSaveCurrentEstimate}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                    {savingStatus || 'Save Quote Historically'}
                  </button>

                  {/* 3. Share & Public View */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenShareModal()}
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      Share Scope
                    </button>

                    <a
                      href={generateShareUrl(currentEstimateObject)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-slate-900 hover:bg-slate-700/80 text-cyan-400 border border-cyan-800/40 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      Public View
                    </a>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 text-center leading-tight">
                  Preliminary engineering estimate for planning purposes. Subject to specification sign-off.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SHARE ESTIMATE MODAL --- */}
      {shareModalOpen && activeEstimateForShare && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">
                  Client Proposal &amp; Scope Link
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{activeEstimateForShare.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Investment: {formatCurrency(activeEstimateForShare.estimated_low)} &ndash;{' '}
                  {formatCurrency(activeEstimateForShare.estimated_high)}
                  {activeEstimateForShare.quoted_amount && (
                    <span className="text-emerald-400 font-bold ml-2">
                      | Fixed Quote: {formatCurrency(activeEstimateForShare.quoted_amount)}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Direct Link Share */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Shareable Client Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generateShareUrl(activeEstimateForShare)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 truncate"
                />
                <button
                  type="button"
                  onClick={() => copyShareLink(activeEstimateForShare)}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
                >
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Clients can view the scope breakdown, feature inclusions, and investment range without needing to log in.
              </p>
            </div>

            {/* Action options */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => copyProposalText(activeEstimateForShare)}
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-xs font-bold text-white">
                    {copiedText ? 'Copied to Clipboard!' : 'Copy Proposal Text'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Ready to paste directly into email or messaging.</p>
              </button>

              <a
                href={generateShareUrl(activeEstimateForShare)}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition-colors block"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span className="text-xs font-bold text-white">Open Public View</span>
                </div>
                <p className="text-[11px] text-slate-400">Preview the exact scope presentation your client sees.</p>
              </a>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              {!activeEstimateForShare.invoice_number && (
                <button
                  type="button"
                  onClick={() => {
                    setShareModalOpen(false);
                    handleOpenConvertModal(activeEstimateForShare);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold"
                >
                  Turn this Quote into an Invoice &rarr;
                </button>
              )}
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONVERT TO INVOICE MODAL --- */}
      {convertModalEstimate && (
        <ConvertToInvoiceModal
          estimate={convertModalEstimate}
          onClose={() => setConvertModalEstimate(null)}
          onSuccess={handleInvoiceGeneratedSuccess}
        />
      )}

      {/* --- EXACT QUOTE CALIBRATION MODAL --- */}
      {calibratingEstimate && (
        <ExactQuoteCalibrationModal
          estimate={calibratingEstimate}
          onClose={() => setCalibratingEstimate(null)}
          onSaved={(updated) => {
            setSavedEstimates((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
          onConvertToInvoice={(updated) => {
            setCalibratingEstimate(null);
            handleOpenConvertModal(updated);
          }}
        />
      )}
    </div>
  );
};

export default QuoteCalculatorPage;
