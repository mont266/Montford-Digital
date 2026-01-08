import React, { useState, useMemo } from 'react';

// --- Configuration ---
const PRICING_CONFIG = {
    BASE_COST: {
        website: 400,
        webapp: 1500,
        mobileapp: 2500,
    },
    PER_PAGE_COST: { // "Page" also means "Screen" for apps
        website: 100,
        webapp: 300,
        mobileapp: 450,
    },
    DESIGN_COST: {
        template: 0,
        bespoke: 800,
    },
    FEATURE_COST: {
        ecommerce: 1200,
        auth: 600,
        cms: 750,
        api: 900,
    },
    COMPLEXITY_MULTIPLIER: {
        '1': 1.0, // Simple
        '2': 1.5, // Standard
        '3': 2.5, // Complex
    },
    PLATFORM_MULTIPLIER: {
        ios: 1.0,
        android: 1.0,
        both: 1.8, // Not quite 2x to account for shared logic
    },
    MATES_RATES_DISCOUNT: 0.20, // 20%
};

type ProjectType = 'website' | 'webapp' | 'mobileapp';
type DesignType = 'template' | 'bespoke';
type ComplexityLevel = '1' | '2' | '3';
type MobilePlatform = 'ios' | 'android' | 'both';

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

const FeatureCheckbox: React.FC<{ id: string; label: string; cost: number; checked: boolean; onChange: (id: string, checked: boolean) => void }> = ({ id, label, cost, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center p-4 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors has-[:checked]:bg-cyan-500/10 has-[:checked]:border-cyan-500/50">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(id, e.target.checked)} className="h-5 w-5 rounded border-slate-500 text-cyan-600 focus:ring-cyan-500" />
        <div className="ml-3 flex-grow">
            <span className="block text-white font-semibold">{label}</span>
            <span className="block text-sm text-slate-400">+{formatCurrency(cost)}</span>
        </div>
    </label>
);


const QuoteCalculatorPage: React.FC = () => {
    // --- State Management ---
    const [projectType, setProjectType] = useState<ProjectType>('website');
    const [mobilePlatform, setMobilePlatform] = useState<MobilePlatform>('ios');
    const [pageCount, setPageCount] = useState<number>(5);
    const [complexity, setComplexity] = useState<ComplexityLevel>('2');
    const [designType, setDesignType] = useState<DesignType>('bespoke');
    const [features, setFeatures] = useState({
        ecommerce: false,
        auth: false,
        cms: false,
        api: false,
    });
    const [matesRates, setMatesRates] = useState(false);

    // --- Calculation Logic ---
    const priceBreakdown = useMemo(() => {
        const baseCost = PRICING_CONFIG.BASE_COST[projectType];
        const pageCost = pageCount * PRICING_CONFIG.PER_PAGE_COST[projectType];
        const designCost = PRICING_CONFIG.DESIGN_COST[designType];
        
        let featuresCost = 0;
        for (const [key, value] of Object.entries(features)) {
            if (value) {
                featuresCost += PRICING_CONFIG.FEATURE_COST[key as keyof typeof PRICING_CONFIG.FEATURE_COST];
            }
        }

        const subtotalBeforeMultipliers = baseCost + pageCost + designCost + featuresCost;
        
        const platformMultiplier = projectType === 'mobileapp' ? PRICING_CONFIG.PLATFORM_MULTIPLIER[mobilePlatform] : 1;
        const platformAdjustedTotal = subtotalBeforeMultipliers * platformMultiplier;

        const complexityMultiplier = PRICING_CONFIG.COMPLEXITY_MULTIPLIER[complexity];
        const subtotal = platformAdjustedTotal * complexityMultiplier;
        
        const discount = matesRates ? subtotal * PRICING_CONFIG.MATES_RATES_DISCOUNT : 0;
        
        const finalPrice = subtotal - discount;
        const priceRange = {
            low: finalPrice * 0.9,
            high: finalPrice * 1.1,
        };

        return { baseCost, pageCost, designCost, featuresCost, platformMultiplier, complexityMultiplier, subtotal, discount, finalPrice, priceRange };

    }, [projectType, mobilePlatform, pageCount, complexity, designType, features, matesRates]);
    
    const complexityLabels: Record<ComplexityLevel, string> = { '1': 'Simple', '2': 'Standard', '3': 'Complex' };
    const platformLabels: Record<MobilePlatform, string> = { 'ios': 'iOS', 'android': 'Android', 'both': 'iOS & Android' };


    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Quote Calculator</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* --- Left Column: Inputs --- */}
                <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-6">
                    {/* Project Type */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Project Type</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                <input type="radio" name="projectType" value="website" checked={projectType === 'website'} onChange={() => setProjectType('website')} className="sr-only" />
                                <span className="text-white font-bold">Website</span>
                                <span className="block text-sm text-slate-400">Marketing or brochure site.</span>
                            </label>
                             <label className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                <input type="radio" name="projectType" value="webapp" checked={projectType === 'webapp'} onChange={() => setProjectType('webapp')} className="sr-only" />
                                <span className="text-white font-bold">Web App</span>
                                <span className="block text-sm text-slate-400">Dashboards, user accounts.</span>
                            </label>
                            <label className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                <input type="radio" name="projectType" value="mobileapp" checked={projectType === 'mobileapp'} onChange={() => setProjectType('mobileapp')} className="sr-only" />
                                <span className="text-white font-bold">Mobile App</span>
                                <span className="block text-sm text-slate-400">Native iOS & Android apps.</span>
                            </label>
                        </div>
                    </div>
                    
                    {/* Mobile Platform Selection */}
                    {projectType === 'mobileapp' && (
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Platform</h3>
                            <div className="flex gap-4">
                                <label className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                    <input type="radio" name="mobilePlatform" value="ios" checked={mobilePlatform === 'ios'} onChange={() => setMobilePlatform('ios')} className="sr-only" />
                                    <span className="text-white font-bold text-center block">iOS</span>
                                </label>
                                <label className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                    <input type="radio" name="mobilePlatform" value="android" checked={mobilePlatform === 'android'} onChange={() => setMobilePlatform('android')} className="sr-only" />
                                    <span className="text-white font-bold text-center block">Android</span>
                                </label>
                                 <label className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                    <input type="radio" name="mobilePlatform" value="both" checked={mobilePlatform === 'both'} onChange={() => setMobilePlatform('both')} className="sr-only" />
                                    <span className="text-white font-bold text-center block">Both</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Pages & Complexity */}
                    <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                             <label htmlFor="pageCount" className="text-lg font-semibold text-white mb-2 block">{projectType === 'website' ? 'Number of Pages' : 'Number of Screens'}</label>
                            <input type="number" id="pageCount" value={pageCount} onChange={e => setPageCount(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600 focus:border-cyan-500 outline-none" />
                        </div>
                         <div>
                            <label htmlFor="complexity" className="text-lg font-semibold text-white mb-2 block">Project Complexity <span className="text-cyan-400 font-bold">{complexityLabels[complexity]}</span></label>
                            <input type="range" id="complexity" min="1" max="3" step="1" value={complexity} onChange={e => setComplexity(e.target.value as ComplexityLevel)} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-thumb:bg-cyan-500" />
                        </div>
                    </div>

                    {/* Design Type */}
                     <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Design</h3>
                        <div className="flex gap-4">
                             <label className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                <input type="radio" name="designType" value="template" checked={designType === 'template'} onChange={() => setDesignType('template')} className="sr-only" />
                                <span className="text-white font-bold">Template-based</span>
                            </label>
                             <label className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/10">
                                <input type="radio" name="designType" value="bespoke" checked={designType === 'bespoke'} onChange={() => setDesignType('bespoke')} className="sr-only" />
                                <span className="text-white font-bold">Bespoke UI/UX</span>
                            </label>
                        </div>
                    </div>
                    
                    {/* Features */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Additional Features</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <FeatureCheckbox id="ecommerce" label="E-commerce" cost={PRICING_CONFIG.FEATURE_COST.ecommerce} checked={features.ecommerce} onChange={() => setFeatures(f => ({...f, ecommerce: !f.ecommerce}))} />
                            <FeatureCheckbox id="auth" label="User Logins" cost={PRICING_CONFIG.FEATURE_COST.auth} checked={features.auth} onChange={() => setFeatures(f => ({...f, auth: !f.auth}))} />
                            <FeatureCheckbox id="cms" label="Admin Dashboard / CMS" cost={PRICING_CONFIG.FEATURE_COST.cms} checked={features.cms} onChange={() => setFeatures(f => ({...f, cms: !f.cms}))} />
                            <FeatureCheckbox id="api" label="Third-party API Integrations" cost={PRICING_CONFIG.FEATURE_COST.api} checked={features.api} onChange={() => setFeatures(f => ({...f, api: !f.api}))} />
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
                             <div className="flex justify-between"><span>Base Cost</span> <span>{formatCurrency(priceBreakdown.baseCost)}</span></div>
                            <div className="flex justify-between"><span>{projectType === 'website' ? `${pageCount} Pages` : `${pageCount} Screens`}</span> <span>{formatCurrency(priceBreakdown.pageCost)}</span></div>
                            {priceBreakdown.designCost > 0 && <div className="flex justify-between"><span>Bespoke Design</span> <span>{formatCurrency(priceBreakdown.designCost)}</span></div>}
                            {priceBreakdown.featuresCost > 0 && <div className="flex justify-between"><span>Additional Features</span> <span>{formatCurrency(priceBreakdown.featuresCost)}</span></div>}
                            {priceBreakdown.platformMultiplier > 1 && <div className="flex justify-between"><span>Platform ({platformLabels[mobilePlatform]})</span> <span>&times;{priceBreakdown.platformMultiplier}</span></div>}
                            {priceBreakdown.complexityMultiplier > 1 && <div className="flex justify-between"><span>Complexity ({complexityLabels[complexity]})</span> <span>&times;{priceBreakdown.complexityMultiplier}</span></div>}
                        </div>
                        
                        <div className="space-y-2 text-slate-300">
                             <div className="flex justify-between font-semibold"><span>Subtotal</span> <span>{formatCurrency(priceBreakdown.subtotal)}</span></div>
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
