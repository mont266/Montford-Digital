import React, { useState, useMemo } from 'react';

// --- Configuration ---
const PRICING_CONFIG = {
    BASE_SETUP_FEE: 100, // Lowered base fee to be more attractive
    COST_PER_POINT: 12, // Balanced point cost
    
    // Granular points allow clients to pick exactly what they need
    FEATURE_POINTS: {
        auth: 5,        // User Authentication
        roles: 6,       // Roles & Permissions
        profile: 4,     // User Profiles
        cms: 12,        // Content Management
        ecommerce: 20,  // E-commerce/Payments
        api: 10,        // 3rd Party APIs
        dashboard: 15,  // Analytics/Dashboard
        realtime: 18,   // Real-time/WebSockets
        search: 8,      // Advanced Search
        seo: 4,         // SEO Optimization
        multilingual: 10, // Multi-language
        notifications: 6, // Push/Email Alerts
        offline: 12,    // Offline/PWA Support
        animations: 6,  // Advanced Animations
    },

    // Multiplier based on client's business stage
    CLIENT_PROFILE_MULTIPLIER: {
        startup: 0.85,  // 15% discount for startups/solo
        smb: 1.2,       // Standard SMB rate
        established: 1.8, // Enterprise rate
    },

    // Multiplier based on project urgency
    TIMELINE_MULTIPLIER: {
        flexible: 0.85,   // 12+ Weeks (15% discount for flexibility - great for your time!)
        standard: 1.0,    // 8-12 Weeks
        expedited: 1.25,  // 4-7 Weeks
        urgent: 1.6,      // 2-3 Weeks (Premium for rush jobs)
    },
    
    PLATFORM_MULTIPLIER: {
        ios: 1.1,       
        android: 1.1,   
        both: 1.7,      
    },
    MATES_RATES_DISCOUNT: 0.20, // 20%
    
    MAINTENANCE_TIERS: {
        none: { price: 0, label: 'No Maintenance', desc: 'Client handles all hosting, updates, and backups.' },
        basic: { price: 25, label: 'Basic Hosting & Security', desc: 'Managed hosting, SSL, daily backups, and security patches.' },
        standard: { price: 80, label: 'Standard Support', desc: 'Basic + bug fixes and minor content updates (up to 2hrs/mo).' },
        premium: { price: 250, label: 'Premium Retainer', desc: 'Standard + priority support and feature additions (up to 8hrs/mo).' },
    }
};

type ProjectType = 'website' | 'webapp' | 'mobileapp';
type ClientProfile = 'startup' | 'smb' | 'established';
type MobilePlatform = 'ios' | 'android' | 'both';
type Timeline = 'flexible' | 'standard' | 'expedited' | 'urgent';
type MaintenanceTier = 'none' | 'basic' | 'standard' | 'premium';

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

const FeatureCheckbox: React.FC<{ id: string; label: string; description: string; points: number; checked: boolean; onChange: (id: string, checked: boolean) => void }> = ({ id, label, description, points, checked, onChange }) => (
    <label htmlFor={id} className="flex items-start p-4 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors has-[:checked]:bg-cyan-500/10 has-[:checked]:border-cyan-500/50">
        <div className="mt-0.5">
            <input id={id} type="checkbox" checked={checked} onChange={e => onChange(id, e.target.checked)} className="h-5 w-5 rounded border-slate-500 text-cyan-600 focus:ring-cyan-500" />
        </div>
        <div className="ml-3 flex-grow">
            <div className="flex justify-between items-start">
                <span className="block text-white font-semibold">{label}</span>
                <span className="block text-xs font-medium text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">{points} pts</span>
            </div>
            <span className="block text-xs text-slate-400 mt-1 leading-relaxed">{description}</span>
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
        roles: false,
        profile: false,
        cms: false,
        ecommerce: false,
        api: false,
        dashboard: false,
        realtime: false,
        search: false,
        seo: false,
        multilingual: false,
        notifications: false,
        offline: false,
        animations: false,
    });
    const [matesRates, setMatesRates] = useState(false);
    const [maintenanceTier, setMaintenanceTier] = useState<MaintenanceTier>('none');

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

    // --- Calculation Logic ---
    const priceBreakdown = useMemo(() => {
        let totalPoints = 0;
        const selectedFeaturesList = [];
        
        for (const [key, value] of Object.entries(features)) {
            if (value) {
                const points = PRICING_CONFIG.FEATURE_POINTS[key as keyof typeof PRICING_CONFIG.FEATURE_POINTS];
                totalPoints += points;
                selectedFeaturesList.push({ key, label: featureLabels[key], points });
            }
        }
        
        const clientProfileMultiplier = PRICING_CONFIG.CLIENT_PROFILE_MULTIPLIER[clientProfile];
        const effectiveCostPerPoint = PRICING_CONFIG.COST_PER_POINT * clientProfileMultiplier;

        const featureCost = totalPoints * effectiveCostPerPoint;
        const subtotalBeforeMultipliers = PRICING_CONFIG.BASE_SETUP_FEE + featureCost;
        
        const timelineMultiplier = PRICING_CONFIG.TIMELINE_MULTIPLIER[timeline];
        const platformMultiplier = projectType === 'mobileapp' ? PRICING_CONFIG.PLATFORM_MULTIPLIER[mobilePlatform] : 1;
        
        const subtotal = subtotalBeforeMultipliers * timelineMultiplier * platformMultiplier;
        
        const discount = matesRates ? subtotal * PRICING_CONFIG.MATES_RATES_DISCOUNT : 0;
        
        const finalPrice = subtotal - discount;
        const priceRange = {
            low: finalPrice * 0.9,
            high: finalPrice * 1.1,
        };

        const monthlyMaintenance = PRICING_CONFIG.MAINTENANCE_TIERS[maintenanceTier].price;
        const yearlyMaintenance = monthlyMaintenance * 12;

        return { totalPoints, selectedFeaturesList, effectiveCostPerPoint, featureCost, platformMultiplier, clientProfileMultiplier, timelineMultiplier, subtotal, discount, finalPrice, priceRange, monthlyMaintenance, yearlyMaintenance };

    }, [projectType, clientProfile, mobilePlatform, timeline, features, matesRates, maintenanceTier]);
    
    const clientProfileLabels: Record<ClientProfile, string> = { 'startup': 'Startup / Solo', 'smb': 'Small Business', 'established': 'Established Co.' };
    const platformLabels: Record<MobilePlatform, string> = { 'ios': 'iOS', 'android': 'Android', 'both': 'iOS & Android' };
    const timelineLabels: Record<Timeline, string> = { 'flexible': 'Flexible', 'standard': 'Standard', 'expedited': 'Expedited', 'urgent': 'Urgent' };
    const timelineDescriptions: Record<Timeline, string> = { 'flexible': '12+ Weeks (15% Off)', 'standard': '8-12 Weeks', 'expedited': '4-7 Weeks', 'urgent': '2-3 Weeks' };


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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FeatureCheckbox id="auth" label="User Authentication" description="Secure login, registration, and password recovery." points={PRICING_CONFIG.FEATURE_POINTS.auth} checked={features.auth} onChange={() => setFeatures(f => ({...f, auth: !f.auth}))} />
                            <FeatureCheckbox id="roles" label="Roles & Permissions" description="Different access levels (e.g., admin, editor, user)." points={PRICING_CONFIG.FEATURE_POINTS.roles} checked={features.roles} onChange={() => setFeatures(f => ({...f, roles: !f.roles}))} />
                            <FeatureCheckbox id="profile" label="User Profiles" description="User-editable profiles, avatars, and account settings." points={PRICING_CONFIG.FEATURE_POINTS.profile} checked={features.profile} onChange={() => setFeatures(f => ({...f, profile: !f.profile}))} />
                            <FeatureCheckbox id="cms" label="Admin / CMS" description="Admin panel to easily manage website content and data." points={PRICING_CONFIG.FEATURE_POINTS.cms} checked={features.cms} onChange={() => setFeatures(f => ({...f, cms: !f.cms}))} />
                            <FeatureCheckbox id="ecommerce" label="E-commerce" description="Shopping cart, checkout, and secure payment processing." points={PRICING_CONFIG.FEATURE_POINTS.ecommerce} checked={features.ecommerce} onChange={() => setFeatures(f => ({...f, ecommerce: !f.ecommerce}))} />
                            <FeatureCheckbox id="api" label="API Integrations" description="Connecting your app with external services (Stripe, Maps, etc.)." points={PRICING_CONFIG.FEATURE_POINTS.api} checked={features.api} onChange={() => setFeatures(f => ({...f, api: !f.api}))} />
                            <FeatureCheckbox id="dashboard" label="Data Dashboard" description="Visual charts, graphs, and data reporting tools." points={PRICING_CONFIG.FEATURE_POINTS.dashboard} checked={features.dashboard} onChange={() => setFeatures(f => ({...f, dashboard: !f.dashboard}))} />
                            <FeatureCheckbox id="realtime" label="Real-time Data" description="Live updates, instant messaging, or collaborative features." points={PRICING_CONFIG.FEATURE_POINTS.realtime} checked={features.realtime} onChange={() => setFeatures(f => ({...f, realtime: !f.realtime}))} />
                            <FeatureCheckbox id="search" label="Advanced Search" description="Complex filtering, sorting, and fast search capabilities." points={PRICING_CONFIG.FEATURE_POINTS.search} checked={features.search} onChange={() => setFeatures(f => ({...f, search: !f.search}))} />
                            <FeatureCheckbox id="seo" label="SEO Optimization" description="Technical optimization to rank higher on search engines." points={PRICING_CONFIG.FEATURE_POINTS.seo} checked={features.seo} onChange={() => setFeatures(f => ({...f, seo: !f.seo}))} />
                            <FeatureCheckbox id="multilingual" label="Multi-language" description="Support for multiple languages and regional settings." points={PRICING_CONFIG.FEATURE_POINTS.multilingual} checked={features.multilingual} onChange={() => setFeatures(f => ({...f, multilingual: !f.multilingual}))} />
                            <FeatureCheckbox id="notifications" label="Push/Email Alerts" description="Automated email alerts or mobile push notifications." points={PRICING_CONFIG.FEATURE_POINTS.notifications} checked={features.notifications} onChange={() => setFeatures(f => ({...f, notifications: !f.notifications}))} />
                            <FeatureCheckbox id="offline" label="Offline/PWA" description="App continues to work without an internet connection." points={PRICING_CONFIG.FEATURE_POINTS.offline} checked={features.offline} onChange={() => setFeatures(f => ({...f, offline: !f.offline}))} />
                            <FeatureCheckbox id="animations" label="Custom Animations" description="Smooth, custom interactive animations and transitions." points={PRICING_CONFIG.FEATURE_POINTS.animations} checked={features.animations} onChange={() => setFeatures(f => ({...f, animations: !f.animations}))} />
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Project Timeline</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(['flexible', 'standard', 'expedited', 'urgent'] as Timeline[]).map(t => (
                                <label key={t} className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                    <input type="radio" name="timeline" value={t} checked={timeline === t} onChange={() => setTimeline(t)} className="sr-only" />
                                    <span className="text-white font-bold capitalize">{timelineLabels[t]}</span>
                                    <span className="block text-sm text-slate-400">{timelineDescriptions[t]}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Ongoing Maintenance */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Ongoing Maintenance & Support</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(Object.keys(PRICING_CONFIG.MAINTENANCE_TIERS) as MaintenanceTier[]).map(tier => (
                                <label key={tier} className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10 flex flex-col justify-between">
                                    <div>
                                        <input type="radio" name="maintenance" value={tier} checked={maintenanceTier === tier} onChange={() => setMaintenanceTier(tier)} className="sr-only" />
                                        <span className="text-white font-bold">{PRICING_CONFIG.MAINTENANCE_TIERS[tier].label}</span>
                                        <span className="block text-sm text-slate-400 mt-1">{PRICING_CONFIG.MAINTENANCE_TIERS[tier].desc}</span>
                                    </div>
                                    <span className="block mt-3 text-cyan-400 font-semibold">
                                        {PRICING_CONFIG.MAINTENANCE_TIERS[tier].price === 0 ? 'Free' : `${formatCurrency(PRICING_CONFIG.MAINTENANCE_TIERS[tier].price)} / mo`}
                                    </span>
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
                                <span>@ {formatCurrency(priceBreakdown.effectiveCostPerPoint)} / point (base: {formatCurrency(PRICING_CONFIG.COST_PER_POINT)}, multiplier: &times;{priceBreakdown.clientProfileMultiplier})</span>
                            </div>
                            {priceBreakdown.selectedFeaturesList.length > 0 && (
                                <div className="mt-2 pl-4 border-l border-slate-700 space-y-1">
                                    {priceBreakdown.selectedFeaturesList.map(feat => (
                                        <div key={feat.key} className="flex justify-between text-xs text-slate-400">
                                            <span>- {feat.label}</span>
                                            <span>{formatCurrency(feat.points * priceBreakdown.effectiveCostPerPoint)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                         <div className="space-y-2 text-slate-300 border-b border-slate-700 pb-4 mb-4">
                            <div className="flex justify-between font-semibold"><span>Subtotal</span> <span>{formatCurrency(PRICING_CONFIG.BASE_SETUP_FEE + priceBreakdown.featureCost)}</span></div>
                            {priceBreakdown.timelineMultiplier > 1 && <div className="flex justify-between"><span>Timeline ({timelineLabels[timeline]})</span> <span>&times;{priceBreakdown.timelineMultiplier}</span></div>}
                            {priceBreakdown.platformMultiplier > 1 && <div className="flex justify-between"><span>Platform ({platformLabels[mobilePlatform]})</span> <span>&times;{priceBreakdown.platformMultiplier}</span></div>}
                        </div>
                        
                        <div className="space-y-2 text-slate-300">
                             <div className="flex justify-between font-semibold"><span>Adjusted Subtotal</span> <span>{formatCurrency(priceBreakdown.subtotal)}</span></div>
                            {priceBreakdown.discount > 0 && <div className="flex justify-between text-green-400"><span>Mates Rates (20%)</span> <span>-{formatCurrency(priceBreakdown.discount)}</span></div>}
                        </div>

                        <div className="mt-6 pt-6 border-t-2 border-cyan-500/50 text-center">
                            <p className="text-slate-400 text-sm">Estimated Project Price</p>
                            <p className="text-4xl font-extrabold text-cyan-400 my-1">
                                {formatCurrency(priceBreakdown.priceRange.low)} - {formatCurrency(priceBreakdown.priceRange.high)}
                            </p>
                        </div>

                        {priceBreakdown.monthlyMaintenance > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-700">
                                <h4 className="text-lg font-bold text-white mb-3">Ongoing Upkeep</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>Monthly Cost</span>
                                        <span className="font-semibold text-cyan-400">{formatCurrency(priceBreakdown.monthlyMaintenance)} <span className="text-sm font-normal text-slate-400">/mo</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-400 text-sm">
                                        <span>Yearly (Billed Annually)</span>
                                        <span>{formatCurrency(priceBreakdown.yearlyMaintenance)} <span className="text-xs">/yr</span></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-slate-500 text-center mt-6">
                           This is a preliminary estimate for budgeting purposes only and does not constitute a formal quote.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteCalculatorPage;