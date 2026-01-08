import React, { useState, useMemo } from 'react';

// --- Configuration ---
const PRICING_CONFIG = {
    BASE_SETUP_FEE: 150,
    COST_PER_POINT: 10, // Lowered from 40
    
    // Points represent relative complexity/effort
    FEATURE_POINTS: {
        auth: 8,        // User Authentication (Login, Register, Reset) - was 10
        profile: 6,     // User Profiles & Settings - was 8
        cms: 18,        // Basic CMS / Admin Panel - was 15
        ecommerce: 35,  // E-commerce with Payments - was 30
        api: 15,        // 3rd Party API Integration - was 12
        dashboard: 22,  // Data Visualization Dashboard - was 20
        realtime: 28,   // Real-time features (e.g., chat) - was 25
        search: 12,     // Advanced Search & Filtering - was 10
    },

    // Multiplier based on client's business stage
    CLIENT_PROFILE_MULTIPLIER: {
        startup: 1.0,   // Solo founders, startups
        smb: 1.5,       // Small Businesses (2-10 employees)
        established: 2.2, // Larger companies (10+ employees)
    },

    // Multiplier based on project urgency
    TIMELINE_MULTIPLIER: {
        standard: 1.0,    // 8-12 Weeks
        expedited: 1.25,  // 4-7 Weeks
        urgent: 1.5,      // 2-3 Weeks
    },
    
    PLATFORM_MULTIPLIER: {
        ios: 1.2,       // Slightly more expensive
        android: 1.0,   // Baseline
        both: 2.0,      // Combined with a slight discount
    },
    MATES_RATES_DISCOUNT: 0.20, // 20%
};

type ProjectType = 'website' | 'webapp' | 'mobileapp';
type ClientProfile = 'startup' | 'smb' | 'established';
type MobilePlatform = 'ios' | 'android' | 'both';
type Timeline = 'standard' | 'expedited' | 'urgent';

// --- Helper & Reusable Components ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between cursor-pointer">
        <span className="font-medium text-slate-300">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
            <div className={`block w-14 h-8 rounded-full transition ${checked ? 'bg-cyan-500' : 'bg-slate-600'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${checked ? 'translate-x-6' : ''}`}></div>
        </div>
    </label>
);

const FeatureCheckbox: React.FC<{ id: string; label: string; points: number; checked: boolean; onChange: (id: string, checked: boolean) => void }> = ({ id, label, points, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center p-4 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors has-[:checked]:bg-cyan-500/10 has-[:checked]:border-cyan-500/50">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(id, e.target.checked)} className="h-5 w-5 rounded border-slate-500 text-cyan-600 focus:ring-cyan-500" />
        <div className="ml-3 flex-grow">
            <span className="block text-white font-semibold">{label}</span>
            <span className="block text-sm text-slate-400">{points} points</span>
        </div>
    </label>
);


const QuoteCalculatorPage: React.FC = () => {
    // --- State Management ---
    const [projectType, setProjectType] = useState<ProjectType>('website');
    const [clientProfile, setClientProfile] = useState<ClientProfile>('startup');
    const [mobilePlatform, setMobilePlatform] = useState<MobilePlatform>('ios');
    const [timeline, setTimeline] = useState<Timeline>('standard');
    const [features, setFeatures] = useState({
        auth: false,
        profile: false,
        cms: false,
        ecommerce: false,
        api: false,
        dashboard: false,
        realtime: false,
        search: false,
    });
    const [matesRates, setMatesRates] = useState(false);

    // --- Calculation Logic ---
    const priceBreakdown = useMemo(() => {
        let totalPoints = 0;
        
        for (const [key, value] of Object.entries(features)) {
            if (value) {
                totalPoints += PRICING_CONFIG.FEATURE_POINTS[key as keyof typeof PRICING_CONFIG.FEATURE_POINTS];
            }
        }
        
        const featureCost = totalPoints * PRICING_CONFIG.COST_PER_POINT;
        const subtotalBeforeMultipliers = PRICING_CONFIG.BASE_SETUP_FEE + featureCost;
        
        const timelineMultiplier = PRICING_CONFIG.TIMELINE_MULTIPLIER[timeline];
        const platformMultiplier = projectType === 'mobileapp' ? PRICING_CONFIG.PLATFORM_MULTIPLIER[mobilePlatform] : 1;
        const clientProfileMultiplier = PRICING_CONFIG.CLIENT_PROFILE_MULTIPLIER[clientProfile];
        
        const subtotal = subtotalBeforeMultipliers * timelineMultiplier * platformMultiplier * clientProfileMultiplier;
        
        const discount = matesRates ? subtotal * PRICING_CONFIG.MATES_RATES_DISCOUNT : 0;
        
        const finalPrice = subtotal - discount;
        const priceRange = {
            low: finalPrice * 0.9,
            high: finalPrice * 1.1,
        };

        return { totalPoints, featureCost, platformMultiplier, clientProfileMultiplier, timelineMultiplier, subtotal, discount, finalPrice, priceRange };

    }, [projectType, clientProfile, mobilePlatform, timeline, features, matesRates]);
    
    const clientProfileLabels: Record<ClientProfile, string> = { 'startup': 'Startup / Solo', 'smb': 'Small Business', 'established': 'Established Co.' };
    const platformLabels: Record<MobilePlatform, string> = { 'ios': 'iOS', 'android': 'Android', 'both': 'iOS & Android' };
    const timelineLabels: Record<Timeline, string> = { 'standard': 'Standard', 'expedited': 'Expedited', 'urgent': 'Urgent' };
    const timelineDescriptions: Record<Timeline, string> = { 'standard': '8-12 Weeks', 'expedited': '4-7 Weeks', 'urgent': '2-3 Weeks' };


    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Quote Calculator</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* --- Left Column: Inputs --- */}
                <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-6">
                    {/* Client & Project Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Client Profile</h3>
                            <div className="flex gap-2 bg-slate-900/50 border border-slate-700 rounded-lg p-1">
                                {(['startup', 'smb', 'established'] as ClientProfile[]).map(profile => (
                                    <button key={profile} onClick={() => setClientProfile(profile)} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${clientProfile === profile ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                                        {clientProfileLabels[profile]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Project Type</h3>
                            <div className="flex gap-2 bg-slate-900/50 border border-slate-700 rounded-lg p-1">
                                {(['website', 'webapp', 'mobileapp'] as ProjectType[]).map(type => (
                                    <button key={type} onClick={() => setProjectType(type)} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors capitalize ${projectType === type ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Mobile Platform Selection */}
                    {projectType === 'mobileapp' && (
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Platform</h3>
                             <div className="flex gap-2 bg-slate-900/50 border border-slate-700 rounded-lg p-1">
                                {(['ios', 'android', 'both'] as MobilePlatform[]).map(platform => (
                                     <button key={platform} onClick={() => setMobilePlatform(platform)} className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors capitalize ${mobilePlatform === platform ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                                        {platformLabels[platform]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Core Features */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Core Features</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FeatureCheckbox id="auth" label="User Authentication" points={PRICING_CONFIG.FEATURE_POINTS.auth} checked={features.auth} onChange={() => setFeatures(f => ({...f, auth: !f.auth}))} />
                            <FeatureCheckbox id="profile" label="User Profiles" points={PRICING_CONFIG.FEATURE_POINTS.profile} checked={features.profile} onChange={() => setFeatures(f => ({...f, profile: !f.profile}))} />
                            <FeatureCheckbox id="cms" label="Admin / CMS" points={PRICING_CONFIG.FEATURE_POINTS.cms} checked={features.cms} onChange={() => setFeatures(f => ({...f, cms: !f.cms}))} />
                            <FeatureCheckbox id="ecommerce" label="E-commerce" points={PRICING_CONFIG.FEATURE_POINTS.ecommerce} checked={features.ecommerce} onChange={() => setFeatures(f => ({...f, ecommerce: !f.ecommerce}))} />
                            <FeatureCheckbox id="api" label="API Integrations" points={PRICING_CONFIG.FEATURE_POINTS.api} checked={features.api} onChange={() => setFeatures(f => ({...f, api: !f.api}))} />
                            <FeatureCheckbox id="dashboard" label="Data Dashboard" points={PRICING_CONFIG.FEATURE_POINTS.dashboard} checked={features.dashboard} onChange={() => setFeatures(f => ({...f, dashboard: !f.dashboard}))} />
                            <FeatureCheckbox id="realtime" label="Real-time Chat/Data" points={PRICING_CONFIG.FEATURE_POINTS.realtime} checked={features.realtime} onChange={() => setFeatures(f => ({...f, realtime: !f.realtime}))} />
                            <FeatureCheckbox id="search" label="Advanced Search" points={PRICING_CONFIG.FEATURE_POINTS.search} checked={features.search} onChange={() => setFeatures(f => ({...f, search: !f.search}))} />
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Project Timeline</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {(['standard', 'expedited', 'urgent'] as Timeline[]).map(t => (
                                <label key={t} className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                    <input type="radio" name="timeline" value={t} checked={timeline === t} onChange={() => setTimeline(t)} className="sr-only" />
                                    <span className="text-white font-bold capitalize">{timelineLabels[t]}</span>
                                    <span className="block text-sm text-slate-400">{timelineDescriptions[t]}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- Right Column: Results --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
                        <Toggle label="Mates Rates Discount" checked={matesRates} onChange={setMatesRates} />
                    </div>

                    <div className="bg-slate-800 border-2 border-slate-700 rounded-lg p-6 sticky top-8">
                        <h3 className="text-xl font-bold text-white mb-4">Price Estimate</h3>
                        
                        <div className="space-y-2 text-slate-300 border-b border-slate-700 pb-4 mb-4">
                             <div className="flex justify-between"><span>Base Setup Fee</span> <span>{formatCurrency(PRICING_CONFIG.BASE_SETUP_FEE)}</span></div>
                             <div className="flex justify-between">
                                <span>Feature Cost ({priceBreakdown.totalPoints} points)</span> 
                                <span>{formatCurrency(priceBreakdown.featureCost)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 pl-4">
                                <span>@ {formatCurrency(PRICING_CONFIG.COST_PER_POINT)} / point</span>
                            </div>
                        </div>

                         <div className="space-y-2 text-slate-300 border-b border-slate-700 pb-4 mb-4">
                            <div className="flex justify-between font-semibold"><span>Subtotal</span> <span>{formatCurrency(PRICING_CONFIG.BASE_SETUP_FEE + priceBreakdown.featureCost)}</span></div>
                            {priceBreakdown.timelineMultiplier > 1 && <div className="flex justify-between"><span>Timeline ({timelineLabels[timeline]})</span> <span>&times;{priceBreakdown.timelineMultiplier}</span></div>}
                            {priceBreakdown.platformMultiplier > 1 && <div className="flex justify-between"><span>Platform ({platformLabels[mobilePlatform]})</span> <span>&times;{priceBreakdown.platformMultiplier}</span></div>}
                             <div className="flex justify-between"><span>Client Profile ({clientProfileLabels[clientProfile]})</span> <span>&times;{priceBreakdown.clientProfileMultiplier}</span></div>
                        </div>
                        
                        <div className="space-y-2 text-slate-300">
                             <div className="flex justify-between font-semibold"><span>Adjusted Subtotal</span> <span>{formatCurrency(priceBreakdown.subtotal)}</span></div>
                            {priceBreakdown.discount > 0 && <div className="flex justify-between text-green-400"><span>Mates Rates (20%)</span> <span>-{formatCurrency(priceBreakdown.discount)}</span></div>}
                        </div>

                        <div className="mt-6 pt-6 border-t-2 border-cyan-500/50 text-center">
                            <p className="text-slate-400 text-sm">Estimated Price</p>
                            <p className="text-4xl font-extrabold text-cyan-400 my-1">
                                {formatCurrency(priceBreakdown.priceRange.low)} - {formatCurrency(priceBreakdown.priceRange.high)}
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-4">
                           This is a preliminary estimate for budgeting purposes only and does not constitute a formal quote.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteCalculatorPage;