"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Target,
  Calendar,
  DollarSign,
  Users,
  Tag,
  Package,
  Flame,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Info,
  CalendarDays,
  FileSpreadsheet,
  Globe,
  X,
} from 'lucide-react';
import { ReconciledOrderRow, SummaryMetrics } from '@/types';
import { DateScope, CustomDateRange, DateScopeCounts } from '@/lib/dateFilter';
import { MarketingAnalyticsTab } from './MarketingAnalyticsTab';
import {
  Campaign,
  SpendingThresholdTier,
  BudgetSimulationInput,
  ProductOpportunityGroup,
} from '@/types/campaign';
import {
  evaluateThresholdSustainability,
  generateBundleProposals,
  detectPromotionConflicts,
  simulateMarketingBudgetScenarios,
  analyzeProductOpportunities,
  segmentCustomersByRfm,
  aggregateCampaignPerformance,
  generateCreativeBriefsForCampaign,
} from '@/lib/campaignEngine';
import {
  getStoredCampaigns,
  saveSingleCampaign,
  deleteStoredCampaign,
  resetCampaignsToDefault,
  seedExampleCampaignTemplates,
  DEFAULT_SPENDING_THRESHOLDS,
  INITIAL_WINTER_CAMPAIGNS,
} from '@/lib/campaignStore';
import {
  InteractiveAreaTrendChart,
  InteractiveDonutChart,
} from '@/components/charts';

export interface CampaignIntelligenceTabProps {
  orders: ReconciledOrderRow[];
  summary?: SummaryMetrics;
  onOpenAssistantWithQuery?: (query: string) => void;
  configuredMetaCost?: number;
  initialSubView?: SubView;
  activeScope?: DateScope;
  customRange?: CustomDateRange;
  onScopeChange?: (scope: DateScope, customRange?: CustomDateRange) => void;
  counts?: DateScopeCounts;
  subLabel?: string;
  minDateIso?: string;
  maxDateIso?: string;
}

export type SubView =
  | 'overview'
  | 'planner'
  | 'promotions'
  | 'opportunities'
  | 'segments'
  | 'simulator'
  | 'calendar'
  | 'attribution'
  | 'live_ads'
  | 'creative_studio';

export function CampaignIntelligenceTab({
  orders = [],
  summary: _summary,
  onOpenAssistantWithQuery,
  configuredMetaCost = 185000,
  initialSubView,
  activeScope,
  customRange,
  onScopeChange,
  counts,
  subLabel,
  minDateIso,
  maxDateIso,
}: CampaignIntelligenceTabProps) {
  const [activeSubView, setActiveSubView] = useState<SubView>(initialSubView || 'overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load campaigns from persistent store (starts clean, no mock data)
  useEffect(() => {
    const loaded = getStoredCampaigns();
    setCampaigns(loaded);
    if (loaded.length > 0) {
      setSelectedCampaignId(loaded[0].id);
    }
  }, []);

  const handleLoadTemplates = () => {
    const seeded = seedExampleCampaignTemplates();
    setCampaigns(seeded);
    if (seeded.length > 0) {
      setSelectedCampaignId(seeded[0].id);
    }
  };

  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
  }, [campaigns, selectedCampaignId]);

  // Analytical aggregates
  const performanceData = useMemo(() => {
    return aggregateCampaignPerformance(orders, configuredMetaCost);
  }, [orders, configuredMetaCost]);

  const { overviewKpis, channelMetrics } = performanceData;

  const productOpportunityData = useMemo(() => {
    return analyzeProductOpportunities(orders);
  }, [orders]);

  const rfmData = useMemo(() => {
    return segmentCustomersByRfm(orders);
  }, [orders]);

  // Promotions & Bundles State
  const [bundleDiscountPct, setBundleDiscountPct] = useState<number>(18);
  const bundleProposals = useMemo(() => {
    return generateBundleProposals(orders, bundleDiscountPct);
  }, [orders, bundleDiscountPct]);

  // Buy More Save More Thresholds State
  const [thresholdTiers, setThresholdTiers] = useState<SpendingThresholdTier[]>(DEFAULT_SPENDING_THRESHOLDS);
  const thresholdEvaluations = useMemo(() => {
    return thresholdTiers.map((tier) => evaluateThresholdSustainability(tier, orders, 55, 80));
  }, [thresholdTiers, orders]);

  // Promotion Conflict State
  const [testRegularPrice, setTestRegularPrice] = useState<number>(3200);
  const [testSaleDiscount, setTestSaleDiscount] = useState<number>(15);
  const [testCouponDiscount, setTestCouponDiscount] = useState<number>(200);
  const [testBundleDiscount, setTestBundleDiscount] = useState<number>(10);
  const [testFreeShipping, setTestFreeShipping] = useState<boolean>(true);

  const conflictResult = useMemo(() => {
    return detectPromotionConflicts({
      regularPrice: testRegularPrice,
      saleDiscountPercent: testSaleDiscount,
      couponDiscountAmount: testCouponDiscount,
      bundleDiscountPercent: testBundleDiscount,
      freeShippingCost: testFreeShipping ? 90 : 0,
    });
  }, [testRegularPrice, testSaleDiscount, testCouponDiscount, testBundleDiscount, testFreeShipping]);

  // Budget Simulator State
  const [simBudget, setSimBudget] = useState<number>(180000);
  const [simDuration, setSimDuration] = useState<number>(15);
  const [simCpc, setSimCpc] = useState<number>(12);
  const [simConvRate, setSimConvRate] = useState<number>(2.4);
  const [simAov, setSimAov] = useState<number>(3100);
  const [simMargin, setSimMargin] = useState<number>(55);
  const [simDiscount, setSimDiscount] = useState<number>(180);
  const [simSubsidy, setSimSubsidy] = useState<number>(75);
  const [simRetention, setSimRetention] = useState<number>(84);

  const budgetScenarios = useMemo(() => {
    const input: BudgetSimulationInput = {
      monthlyAdBudget: simBudget,
      campaignDurationDays: simDuration,
      expectedCpc: simCpc,
      conversionRatePercent: simConvRate,
      expectedAov: simAov,
      productGrossMarginPercent: simMargin,
      discountPerOrder: simDiscount,
      deliverySubsidyPerOrder: simSubsidy,
      deliveryRetentionRatePercent: simRetention,
      returnPackagingCost: 25,
    };
    return simulateMarketingBudgetScenarios(input);
  }, [simBudget, simDuration, simCpc, simConvRate, simAov, simMargin, simDiscount, simSubsidy, simRetention]);

  // Creative Briefs for active campaign
  const creativeBriefs = useMemo(() => {
    return generateCreativeBriefsForCampaign(activeCampaign);
  }, [activeCampaign]);

  // Campaign Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formCampaign, setFormCampaign] = useState<Partial<Campaign>>({});

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const handleOpenCreateModal = () => {
    setFormCampaign({
      id: `camp-${Date.now()}`,
      name: 'New Winter Promotion',
      tagline: 'Stay Warm. Dress Sharp.',
      objective: 'CONVERSION',
      templateType: 'WINTER_SALE',
      status: 'DRAFT',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      targetAudience: 'Fashion-forward men in major Bangladesh cities',
      targetSegments: ['REPEAT', 'FIRST_DELIVERED'],
      adBudget: 100000,
      expectedOrders: 850,
      expectedDeliveredRevenue: 2600000,
      expectedContributionMargin: 950000,
      discountType: 'TIERED_SPEND',
      discountValue: 15,
      spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
      eligibleCategories: ['Jackets', 'Hoodies'],
      notes: '',
      tags: ['Winter 26/27'],
    });
    setIsModalOpen(true);
  };

  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCampaign.name) return;
    const toSave: Campaign = {
      id: formCampaign.id || `camp-${Date.now()}`,
      name: formCampaign.name || 'Untitled Campaign',
      tagline: formCampaign.tagline || '',
      objective: formCampaign.objective || 'CONVERSION',
      templateType: formCampaign.templateType || 'WINTER_SALE',
      status: formCampaign.status || 'ACTIVE',
      startDate: formCampaign.startDate || '2026-11-03',
      endDate: formCampaign.endDate || '2026-11-30',
      targetAudience: formCampaign.targetAudience || 'Bangladesh Shoppers',
      targetSegments: formCampaign.targetSegments || ['REPEAT'],
      adBudget: Number(formCampaign.adBudget) || 100000,
      expectedOrders: Number(formCampaign.expectedOrders) || 800,
      expectedDeliveredRevenue: Number(formCampaign.expectedDeliveredRevenue) || 2400000,
      expectedContributionMargin: Number(formCampaign.expectedContributionMargin) || 900000,
      discountType: formCampaign.discountType || 'PERCENTAGE',
      discountValue: Number(formCampaign.discountValue) || 15,
      spendingThresholds: formCampaign.spendingThresholds || DEFAULT_SPENDING_THRESHOLDS,
      eligibleCategories: formCampaign.eligibleCategories || ['Jackets', 'Jeans'],
      utmCampaign: formCampaign.utmCampaign || 'winter_campaign',
      utmSource: formCampaign.utmSource || 'meta_ads',
      utmMedium: formCampaign.utmMedium || 'cpc',
      notes: formCampaign.notes || '',
      tags: formCampaign.tags || ['Winter 26/27'],
      isWeatherTriggered: Boolean(formCampaign.isWeatherTriggered),
      weatherCondition: formCampaign.weatherCondition || '',
      createdAt: formCampaign.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = saveSingleCampaign(toSave);
    setCampaigns(updated);
    setSelectedCampaignId(toSave.id);
    setIsModalOpen(false);
  };

  const handleDeleteCampaign = (id: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      const updated = deleteStoredCampaign(id);
      setCampaigns(updated);
      if (selectedCampaignId === id && updated.length > 0) {
        setSelectedCampaignId(updated[0].id);
      }
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all campaigns and thresholds to default Winter 2026-2027 configurations?')) {
      const defs = resetCampaignsToDefault();
      setCampaigns(defs);
      setSelectedCampaignId(defs[0].id);
      setThresholdTiers(DEFAULT_SPENDING_THRESHOLDS);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // SubView navigation definitions
  const subViews: Array<{ id: SubView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Campaign Overview', icon: BarChart3 },
    { id: 'planner', label: 'Winter Planner', icon: Target },
    { id: 'promotions', label: 'Promotions & Bundles', icon: Package },
    { id: 'opportunities', label: 'Product Opportunities', icon: Flame },
    { id: 'segments', label: 'Customer Retention', icon: Users },
    { id: 'simulator', label: 'Budget Simulator', icon: DollarSign },
    { id: 'calendar', label: 'Seasonal Calendar', icon: CalendarDays },
    { id: 'attribution', label: 'Attribution & Channels', icon: TrendingUp },
    { id: 'live_ads', label: 'Live Ads & Traffic (GA4 / Meta)', icon: Globe },
    { id: 'creative_studio', label: 'Creative Studio (EN/বাংলা)', icon: Sparkles },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-deepBlack-card via-deepBlack-elevated to-deepBlack-card border border-deepBlack-border rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Winter 2026–2027 Strategic Engine
              </span>
              <span className="text-xs text-neutral-400">Bangladesh Men&apos;s Fashion</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Campaign Strategy & Marketing
            </h1>
            <p className="text-sm text-neutral-400 max-w-3xl">
              Transforming historical sales, delivery success, COGS, returns, and customer retention into profitable promotional decisions. Optimized strictly for delivered realized net profit.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onOpenAssistantWithQuery?.('Which 10 products should we promote this week for Winter Upgrade?')}
              className="px-3.5 py-2 rounded-lg bg-deepBlack-hover hover:bg-deepBlack-border text-xs font-medium text-white border border-deepBlack-border transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Ask AI Strategist
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-dark text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Campaign
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Reset to default winter campaigns"
              aria-label="Reset to default winter campaigns"
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg bg-deepBlack-hover hover:bg-deepBlack-border text-neutral-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-deepBlack-border/70 pt-4 scrollbar-thin">
          {subViews.map((sv) => {
            const Icon = sv.icon;
            const isActive = activeSubView === sv.id;
            return (
              <button
                key={sv.id}
                onClick={() => setActiveSubView(sv.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-deepBlack-hover'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                {sv.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBVIEW 1: CAMPAIGN OVERVIEW */}
      {activeSubView === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Delivered Net Revenue</span>
              <div className="text-xl font-bold text-white mt-1">৳{overviewKpis.deliveredCampaignRevenue.toLocaleString()}</div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Realized Delivered Cash
              </span>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Delivered ROAS</span>
              <div className="text-xl font-bold text-primary mt-1">{overviewKpis.deliveredRoas.toFixed(2)}x</div>
              <span className="text-[10px] text-neutral-400 mt-1 block">vs ৳{overviewKpis.campaignAdSpend.toLocaleString()} Ad Spend</span>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Contribution Margin</span>
              <div className={`text-xl font-bold mt-1 ${overviewKpis.campaignContributionMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ৳{overviewKpis.campaignContributionMargin.toLocaleString()}
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">{overviewKpis.netMarginPercent}% Net Realized Yield</span>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Average Order Value</span>
              <div className="text-xl font-bold text-white mt-1">৳{overviewKpis.averageOrderValue.toLocaleString()}</div>
              <span className="text-[10px] text-neutral-400 mt-1 block">Delivered AOV</span>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Delivery Retention</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{overviewKpis.deliveryRetentionRate}%</div>
              <span className="text-[10px] text-neutral-400 mt-1 block">{overviewKpis.deliveredOrdersCount} of {overviewKpis.placedOrdersCount} orders</span>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">Blended CAC</span>
              <div className="text-xl font-bold text-white mt-1">৳{overviewKpis.customerAcquisitionCost.toLocaleString()}</div>
              <span className="text-[10px] text-neutral-400 mt-1 block">Per Delivered Customer</span>
            </div>
          </div>

          {/* Visual Trend & Breakdown Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Delivered Revenue vs Advertising Spend</h3>
                  <p className="text-xs text-neutral-400">Verifying realized bottom-line performance over time</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary font-medium border border-primary/20">
                  Target ROAS: 3.50x
                </span>
              </div>
              <div className="h-64">
                <InteractiveAreaTrendChart
                  title="Delivered Revenue Trajectory"
                  data={[
                    { date: 'Nov 3', value: 120000, secondaryValue: 25000 },
                    { date: 'Nov 6', value: 240000, secondaryValue: 50000 },
                    { date: 'Nov 9', value: 380000, secondaryValue: 85000 },
                    { date: 'Nov 12', value: 520000, secondaryValue: 115000 },
                    { date: 'Nov 15', value: 710000, secondaryValue: 145000 },
                    { date: 'Nov 18', value: 920000, secondaryValue: 185000 },
                  ]}
                  primaryLabel="Delivered Revenue"
                  secondaryLabel="Meta Ad Spend"
                  formatValue={(v) => `৳${v.toLocaleString()}`}
                  formatSecondaryValue={(v) => `৳${v.toLocaleString()}`}
                />
              </div>
            </div>

            <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Sales by Marketing Channel</h3>
                <p className="text-xs text-neutral-400">Attributed realized revenue share</p>
              </div>
              <div className="h-64 flex flex-col justify-center">
                <InteractiveDonutChart
                  slices={channelMetrics.map((c) => ({
                    id: c.channel,
                    label: c.channelLabel.split(' ')[0],
                    value: c.realizedRevenue,
                    color: c.channel === 'META_ADS' ? '#EB5A19' : c.channel === 'INSTAGRAM' ? '#9333EA' : '#0EA5E9',
                  }))}
                  centerTotalLabel="Realized Sales"
                  formatValue={(v) => `৳${v.toLocaleString()}`}
                />
              </div>
            </div>
          </div>

          {/* Strategic Insight Callout */}
          <div className="bg-deepBlack-elevated border-l-4 border-primary rounded-r-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 space-y-1">
              <p className="font-semibold text-white">Financial Grounding Standard for Executive Decisions:</p>
              <p>
                In Bangladesh apparel e-commerce, gross placed order volume is heavily distorted by COD cancellations and return transit. All metrics above strictly isolate realized delivered cash (৳{overviewKpis.deliveredCampaignRevenue.toLocaleString()}) after deducting actual catalog-verified SKU COGS (where available), two-way courier burden, packaging loss (৳25/return), and discount costs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: WINTER PLANNER 2026-2027 */}
      {activeSubView === 'planner' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Seasonal Campaign Directory (Winter 2026–2027)</h2>
              <p className="text-xs text-neutral-400">Manage campaign objectives, budgets, spending tiers, and delivery targets</p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-xs font-semibold text-white transition-colors flex items-center gap-1.5 self-start"
            >
              <Plus className="w-3.5 h-3.5" /> Create Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.length === 0 ? (
              <div className="col-span-full p-8 border border-dashed border-deepBlack-border rounded-xl text-center bg-deepBlack-elevated/40">
                <Target className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-white mb-1">No Active Campaigns</h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto mb-4">
                  Create a custom marketing campaign tailored to your active collections, or load verified seasonal templates to get started.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Campaign
                  </button>
                  <button
                    onClick={handleLoadTemplates}
                    className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Load Seasonal Templates
                  </button>
                </div>
              </div>
            ) : (
              campaigns.map((camp) => {
              const isSelected = camp.id === selectedCampaignId;
              const statusColors = {
                ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                SCHEDULED: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                COMPLETED: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
                PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                ARCHIVED: 'bg-neutral-800 text-neutral-400 border-neutral-700',
                DRAFT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
              };

              return (
                <div
                  key={camp.id}
                  onClick={() => setSelectedCampaignId(camp.id)}
                  className={`bg-deepBlack-card border rounded-xl p-4.5 cursor-pointer transition-all hover:border-primary/50 relative ${
                    isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-deepBlack-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[camp.status]}`}>
                      {camp.status}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {camp.startDate} to {camp.endDate}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-2.5">{camp.name}</h3>
                  <p className="text-xs text-primary font-medium">{camp.tagline}</p>
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{camp.targetAudience}</p>

                  <div className="mt-4 pt-3 border-t border-deepBlack-border grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Budget</span>
                      <span className="text-xs font-semibold text-white">৳{(camp.adBudget / 1000).toFixed(0)}k</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Target Orders</span>
                      <span className="text-xs font-semibold text-white">{camp.expectedOrders}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Exp. Net Margin</span>
                      <span className="text-xs font-semibold text-emerald-400">৳{(camp.expectedContributionMargin / 1000).toFixed(0)}k</span>
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between text-xs pt-2">
                    <span className="text-[11px] text-neutral-400">
                      Offer: <strong className="text-neutral-200">{camp.discountType === 'TIERED_SPEND' ? 'Tiered Spend' : `${camp.discountValue}% Off`}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCampaignId(camp.id);
                          setActiveSubView('creative_studio');
                        }}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Creatives
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(camp.id);
                        }}
                        className="text-neutral-500 hover:text-rose-400 p-1"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* SUBVIEW 3: SMART PROMOTIONS & BUNDLE BUILDER */}
      {activeSubView === 'promotions' && (
        <div className="space-y-8">
          {/* Part A: Buy More, Save More Configurator */}
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Buy More, Save More: Tier Threshold Sustainability
                </h3>
                <p className="text-xs text-neutral-400">
                  Pre-flight financial modeling: ensures discounts and free shipping do not erode contribution margin below the 22% target floor.
                </p>
              </div>
              <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 flex items-center gap-1.5 self-start">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Discrete Knapsack Grounding
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {thresholdEvaluations.map((evalItem, idx) => {
                const tier = evalItem.tier;
                return (
                  <div
                    key={tier.id}
                    className={`border rounded-xl p-4 transition-all ${
                      evalItem.isSustainable
                        ? 'bg-deepBlack-elevated border-deepBlack-border hover:border-emerald-500/40'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Tier {idx + 1}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          evalItem.isSustainable
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {evalItem.isSustainable ? 'SUSTAINABLE' : 'MARGIN RISK'}
                      </span>
                    </div>

                    <div className="text-lg font-bold text-primary mt-2">{tier.label}</div>
                    <div className="text-xs text-neutral-300 mt-0.5">Min Spend: ৳{tier.minSpend.toLocaleString()}</div>

                    <div className="mt-3.5 space-y-1.5 text-xs border-t border-deepBlack-border pt-3">
                      <div className="flex justify-between text-neutral-400">
                        <span>Eligible Orders:</span>
                        <span className="text-white font-medium">{evalItem.eligibleOrdersCount}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Estimated AOV Lift:</span>
                        <span className="text-emerald-400 font-medium">+৳{evalItem.estimatedIncrementalAov}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Discount Cost:</span>
                        <span className="text-neutral-300 font-medium">৳{evalItem.discountExpenditure.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Delivery Subsidy:</span>
                        <span className="text-neutral-300 font-medium">৳{evalItem.deliverySubsidy.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400 pt-1 border-t border-deepBlack-border/50">
                        <span className="font-semibold text-white">Contribution Margin:</span>
                        <span className={`font-bold ${evalItem.marginPercent >= 22 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {evalItem.marginPercent}% (৳{evalItem.projectedContributionMargin.toLocaleString()})
                        </span>
                      </div>
                    </div>

                    {evalItem.warning && (
                      <div className="mt-3 text-[11px] text-rose-300 bg-rose-900/30 p-2 rounded border border-rose-800/30 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{evalItem.warning}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Part B: Intelligent Product Bundles */}
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Winter Product Bundles (Apriori Co-Occurrence & Margin Modeling)
                </h3>
                <p className="text-xs text-neutral-400">
                  Coordinated outfit pairings dynamically computed from product-level COGS, return rates, and companion purchase frequency.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start">
                <span className="text-xs text-neutral-400">Bundle Discount:</span>
                <select
                  value={bundleDiscountPct}
                  onChange={(e) => setBundleDiscountPct(Number(e.target.value))}
                  className="bg-deepBlack-elevated border border-deepBlack-border text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-primary outline-none"
                >
                  <option value={15}>15% Off</option>
                  <option value={18}>18% Off (Recommended)</option>
                  <option value={20}>20% Off</option>
                  <option value={25}>25% Off</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bundleProposals.map((bundle) => {
                const badgeColor =
                  bundle.status === 'PROFITABLE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : bundle.status === 'BORDERLINE'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                return (
                  <div key={bundle.id} className="bg-deepBlack-elevated border border-deepBlack-border rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${badgeColor}`}>
                          {bundle.status}
                        </span>
                        {bundle.coPurchaseLift && (
                          <span className="text-[11px] text-primary font-semibold">
                            {bundle.coPurchaseLift.toFixed(1)}x Co-Purchase Lift
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white mt-2">{bundle.name}</h4>
                      <p className="text-xs text-neutral-400">{bundle.tagline}</p>

                      <div className="mt-3 space-y-1.5">
                        {bundle.items.map((item) => (
                          <div key={item.productId} className="flex items-center justify-between text-xs bg-deepBlack-card p-2 rounded border border-deepBlack-border/50">
                            <span className="text-neutral-300 font-medium truncate max-w-[170px]">{item.title}</span>
                            <span className="text-neutral-400">৳{item.regularPrice.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3.5 space-y-1 text-xs border-t border-deepBlack-border pt-2.5">
                        <div className="flex justify-between text-neutral-400">
                          <span>Combined Regular Price:</span>
                          <span className="line-through">৳{bundle.totalRegularPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Bundle Price ({bundle.bundleDiscountPercent}% Off):</span>
                          <span className="text-primary font-bold">৳{bundle.finalBundlePrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Total Item COGS:</span>
                          <span>-৳{bundle.totalEstimatedCogs.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Courier & Packaging:</span>
                          <span>-৳{bundle.deliveryAndOpsCost}</span>
                        </div>
                        <div className="flex justify-between text-white font-semibold pt-1 border-t border-deepBlack-border/60">
                          <span>Net Cash Yield:</span>
                          <span className={bundle.netContribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            ৳{bundle.netContribution.toLocaleString()} ({bundle.netMarginPercent}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-neutral-400 bg-deepBlack-card p-2 rounded border border-deepBlack-border/40">
                      {bundle.reasoning}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Part C: Promotion Conflict Detector */}
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Promotion Conflict & Stacking Simulator
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Simulate customer cart offers to verify that coupons, sale markdowns, and free shipping do not combine dangerously.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3 bg-deepBlack-elevated p-4 rounded-xl border border-deepBlack-border">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configure Offer Stacking</h4>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Product Regular MRP (৳)</label>
                  <input
                    type="number"
                    value={testRegularPrice}
                    onChange={(e) => setTestRegularPrice(Number(e.target.value))}
                    className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Site Sale Discount (%)</label>
                  <input
                    type="number"
                    value={testSaleDiscount}
                    onChange={(e) => setTestSaleDiscount(Number(e.target.value))}
                    className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Coupon Voucher (৳)</label>
                  <input
                    type="number"
                    value={testCouponDiscount}
                    onChange={(e) => setTestCouponDiscount(Number(e.target.value))}
                    className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Bundle Discount (%)</label>
                  <input
                    type="number"
                    value={testBundleDiscount}
                    onChange={(e) => setTestBundleDiscount(Number(e.target.value))}
                    className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="freeShipCheck"
                    checked={testFreeShipping}
                    onChange={(e) => setTestFreeShipping(e.target.checked)}
                    className="rounded border-deepBlack-border text-primary focus:ring-0"
                  />
                  <label htmlFor="freeShipCheck" className="text-xs text-neutral-300">Include Free Shipping Subsidy (৳90)</label>
                </div>
              </div>

              <div className="lg:col-span-2 bg-deepBlack-elevated p-4 rounded-xl border border-deepBlack-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Stacking Audit Outcome</h4>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                        conflictResult.hasConflict
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {conflictResult.hasConflict ? 'UNSAFE STACKING DETECTED' : 'CLEAN & SAFE PROMOTION'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-center">
                    <div className="bg-deepBlack-card p-2.5 rounded border border-deepBlack-border">
                      <span className="text-[10px] text-neutral-400 block">Total Benefit Value</span>
                      <span className="text-sm font-bold text-white">৳{conflictResult.totalDiscountAmount.toLocaleString()}</span>
                    </div>
                    <div className="bg-deepBlack-card p-2.5 rounded border border-deepBlack-border">
                      <span className="text-[10px] text-neutral-400 block">Effective Discount Depth</span>
                      <span className={`text-sm font-bold ${conflictResult.effectiveDiscountPercent > 35 ? 'text-rose-400' : 'text-primary'}`}>
                        {conflictResult.effectiveDiscountPercent}%
                      </span>
                    </div>
                    <div className="bg-deepBlack-card p-2.5 rounded border border-deepBlack-border">
                      <span className="text-[10px] text-neutral-400 block">Net Realized Margin</span>
                      <span className={`text-sm font-bold ${conflictResult.netMarginPercent >= 20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {conflictResult.netMarginPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {conflictResult.warnings.length > 0 ? (
                      conflictResult.warnings.map((w, i) => (
                        <div key={i} className="text-xs text-rose-300 bg-rose-950/30 p-2.5 rounded border border-rose-800/40 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-emerald-300 bg-emerald-950/30 p-2.5 rounded border border-emerald-800/40 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>All promotional margins are within healthy bounds (&gt;20% net margin). Safe to execute.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400 mt-4 pt-3 border-t border-deepBlack-border">
                  Tip: In WooCommerce settings, enable &quot;Individual use only&quot; on high-value coupons to automatically block stacking against bundle deals.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 4: PRODUCT OPPORTUNITY FINDER */}
      {activeSubView === 'opportunities' && (
        <div className="space-y-6">
          {/* Top 10 Recommended Products Panel */}
          <div className="bg-gradient-to-r from-deepBlack-card via-deepBlack-elevated to-deepBlack-card border border-primary/30 rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" />
                  Promote These 10 Products This Week
                </h3>
                <p className="text-xs text-neutral-400">
                  Algorithmic scoring: Prioritizes high gross margin, rapid daily velocity, and low return rates. Never promotes items with poor delivery retention.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                Grounded BI Ranking
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {productOpportunityData.top10Recommendations.map((rec, i) => (
                <div key={rec.productId} className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary">#{i + 1} Rec</span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Score: {rec.recommendationScore}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-2" title={rec.title}>
                      {rec.title}
                    </h4>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">{rec.category} • ৳{rec.avgPrice.toLocaleString()}</span>

                    <div className="mt-2 text-[10px] space-y-0.5 text-neutral-400">
                      <div className="flex justify-between">
                        <span>Delivered:</span>
                        <span className="text-white font-medium">{rec.deliveredUnits} pcs (৳{rec.deliveredSales.toLocaleString()})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Margin / Return:</span>
                        <span className="text-emerald-400 font-medium">{rec.marginPercent}% / {rec.returnRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-deepBlack-border text-[10px] text-neutral-300">
                    <strong className="text-primary block">Why:</strong> {rec.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Product Opportunity Table with 6 Classifications */}
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Full Product Catalog Opportunity Audit</h3>
                <p className="text-xs text-neutral-400">Classified into 6 actionable strategic groups</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {(Object.keys(productOpportunityData.groupCounts) as ProductOpportunityGroup[]).map((grp) => (
                  <span key={grp} className="px-2 py-0.5 rounded bg-deepBlack-elevated text-neutral-300 border border-deepBlack-border text-[11px]">
                    {grp}: <strong className="text-white">{productOpportunityData.groupCounts[grp]}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-deepBlack-border text-neutral-400 text-[11px]">
                    <th className="py-2.5 px-3">Product Title</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-2 text-right">Avg Price</th>
                    <th className="py-2.5 px-2 text-right">Delivered Units</th>
                    <th className="py-2.5 px-2 text-right">Return %</th>
                    <th className="py-2.5 px-2 text-right">Margin %</th>
                    <th className="py-2.5 px-3">Strategic Action & Offer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-deepBlack-border/60">
                  {productOpportunityData.opportunities.slice(0, 15).map((item) => (
                    <tr key={item.productId} className="hover:bg-deepBlack-hover transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate" title={item.title}>
                        {item.title}
                      </td>
                      <td className="py-2.5 px-2 text-neutral-400">{item.category}</td>
                      <td className="py-2.5 px-2 text-right text-white">৳{item.avgPrice.toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-right text-emerald-400 font-semibold">{item.deliveredUnits}</td>
                      <td className={`py-2.5 px-2 text-right font-medium ${item.returnRate >= 25 ? 'text-rose-400' : 'text-neutral-300'}`}>
                        {item.returnRate.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2 text-right text-white">{item.marginPercent}%</td>
                      <td className="py-2.5 px-3">
                        <div className="text-[11px] text-neutral-300">
                          <span className="font-semibold text-primary">{item.group}:</span> {item.action}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 5: CUSTOMER SEGMENTATION & RETENTION */}
      {activeSubView === 'segments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                RFM Customer Segmentation & Retention Playbook
              </h3>
              <p className="text-xs text-neutral-400">
                Segmented across {rfmData.totalCustomers.toLocaleString()} verified buyers based on Recency, Frequency, Monetary Value, and Delivery Success.
              </p>
            </div>
            <span className="text-xs text-neutral-400 bg-deepBlack-card px-3 py-1 rounded-lg border border-deepBlack-border self-start">
              Privacy Masked (Zero PII Exposure)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rfmData.segments.map((seg) => (
              <div key={seg.type} className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-4.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{seg.name}</h4>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {seg.customerCount} Buyers
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{seg.description}</p>

                  <div className="mt-3.5 space-y-1.5 text-xs bg-deepBlack-elevated p-2.5 rounded-lg border border-deepBlack-border/70">
                    <div className="flex justify-between text-neutral-400">
                      <span>Realized Sales:</span>
                      <span className="text-white font-medium">৳{seg.totalRealizedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Average AOV:</span>
                      <span className="text-white font-medium">৳{seg.avgAov.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Delivery Return Rate:</span>
                      <span className={`font-medium ${seg.avgReturnRate >= 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {seg.avgReturnRate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-deepBlack-border space-y-1 text-xs">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">Suggested Campaign</span>
                  <div className="text-xs font-semibold text-white">{seg.suggestedCampaign}</div>
                  <div className="text-[11px] text-primary mt-1">{seg.suggestedOffer}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBVIEW 6: MARKETING BUDGET & PROFITABILITY SIMULATOR */}
      {activeSubView === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
              <Sliders className="w-4 h-4 text-primary" />
              Interactive Marketing Budget & Delivered ROAS Simulator
            </h3>
            <p className="text-xs text-neutral-400 mb-5">
              Model paid Meta & Instagram advertising campaigns against realistic Bangladesh delivery retention rates, COD fees, and contribution margins.
            </p>

            {/* Configurable Sliders & Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-deepBlack-elevated p-4 rounded-xl border border-deepBlack-border">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Ad Budget (৳)</label>
                <input
                  type="number"
                  step="10000"
                  value={simBudget}
                  onChange={(e) => setSimBudget(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={simDuration}
                  onChange={(e) => setSimDuration(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Expected CPC (৳)</label>
                <input
                  type="number"
                  step="0.5"
                  value={simCpc}
                  onChange={(e) => setSimCpc(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Conversion Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={simConvRate}
                  onChange={(e) => setSimConvRate(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Expected AOV (৳)</label>
                <input
                  type="number"
                  step="100"
                  value={simAov}
                  onChange={(e) => setSimAov(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Gross Margin (%)</label>
                <input
                  type="number"
                  value={simMargin}
                  onChange={(e) => setSimMargin(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Discount / Order (৳)</label>
                <input
                  type="number"
                  value={simDiscount}
                  onChange={(e) => setSimDiscount(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Delivery Subsidy (৳)</label>
                <input
                  type="number"
                  value={simSubsidy}
                  onChange={(e) => setSimSubsidy(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Delivery Retention (%)</label>
                <input
                  type="number"
                  value={simRetention}
                  onChange={(e) => setSimRetention(Number(e.target.value))}
                  className="w-full bg-deepBlack-card border border-deepBlack-border rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* 3 Comparative Scenarios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {budgetScenarios.map((scen) => {
                const isExpected = scen.scenarioName === 'EXPECTED';
                return (
                  <div
                    key={scen.scenarioName}
                    className={`rounded-xl p-5 border transition-all ${
                      isExpected
                        ? 'bg-deepBlack-elevated border-primary ring-1 ring-primary/30'
                        : 'bg-deepBlack-card border-deepBlack-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {scen.scenarioName} SCENARIO
                      </span>
                      {isExpected && (
                        <span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded">
                          BASE CASE
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-neutral-400">
                        <span>Ad Spend:</span>
                        <span className="text-white font-medium">৳{scen.adSpend.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Estimated Clicks:</span>
                        <span className="text-white font-medium">{scen.clicks.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Placed Orders:</span>
                        <span className="text-white font-medium">{scen.orders.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Delivered Orders:</span>
                        <span className="text-emerald-400 font-bold">{scen.deliveredOrders.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Delivered Realized Sales:</span>
                        <span className="text-white font-bold">৳{scen.deliveredRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Delivered ROAS:</span>
                        <span className="text-primary font-bold">{scen.roas.toFixed(2)}x</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Delivered CAC:</span>
                        <span className="text-white font-medium">৳{scen.cac}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Break-Even ROAS:</span>
                        <span className="text-neutral-300 font-medium">{scen.breakEvenRoas.toFixed(2)}x</span>
                      </div>
                      <div className="flex justify-between text-white font-semibold pt-2 border-t border-deepBlack-border">
                        <span>Net Contribution Margin:</span>
                        <span className={scen.netContributionMargin >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          ৳{scen.netContributionMargin.toLocaleString()} ({scen.roiPercent}% ROI)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 7: SEASONAL CAMPAIGN CALENDAR */}
      {activeSubView === 'calendar' && (
        <div className="space-y-6">
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-primary" />
              Winter 2026–2027 Seasonal Timeline & Milestones
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Coordinated calendar mapping awareness, conversion, holiday gift surges, northern cold waves, and inventory liquidation.
            </p>

            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-deepBlack-border">
              {campaigns.length === 0 ? (
                <div className="p-8 border border-dashed border-deepBlack-border rounded-xl text-center bg-deepBlack-elevated/40">
                  <p className="text-xs text-neutral-400">No scheduled campaigns on calendar yet.</p>
                </div>
              ) : (
                campaigns.map((camp) => (
                  <div key={camp.id} className="relative pl-8 flex items-start gap-4">
                    <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-deepBlack-card shadow-sm" />
                    <div className="bg-deepBlack-elevated border border-deepBlack-border rounded-xl p-4 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{camp.name}</h4>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold border border-primary/20">
                            {camp.templateType}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-400 font-medium">
                          {camp.startDate} — {camp.endDate}
                        </span>
                      </div>

                      <p className="text-xs text-primary font-medium mt-1">{camp.tagline}</p>
                      <p className="text-xs text-neutral-300 mt-1.5">{camp.notes || camp.targetAudience}</p>

                      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
                        <span>Budget: <strong className="text-white">৳{camp.adBudget.toLocaleString()}</strong></span>
                        <span>Target Orders: <strong className="text-white">{camp.expectedOrders}</strong></span>
                        <span>Exp. Revenue: <strong className="text-emerald-400">৳{camp.expectedDeliveredRevenue.toLocaleString()}</strong></span>
                        {camp.isWeatherTriggered && (
                          <span className="text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 text-[11px]">
                            ❄️ Weather Trigger: {camp.weatherCondition || 'Temp < 14°C'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 8: ATTRIBUTION & MARKETING CHANNELS */}
      {activeSubView === 'attribution' && (
        <div className="space-y-6">
          <div className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Marketing Channel Attribution & Delivered ROAS
                </h3>
                <p className="text-xs text-neutral-400">
                  Separating gross placed revenue from net realized cash yield by acquisition channel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert('Offline Ad Report Import: Drag & drop your Meta/Google Ads CSV export here to update manual spend figures.')}
                  className="px-3 py-1.5 rounded-lg bg-deepBlack-elevated hover:bg-deepBlack-hover text-xs font-medium text-white border border-deepBlack-border transition-colors flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                  Import Ads CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-deepBlack-border text-neutral-400 text-[11px]">
                    <th className="py-2.5 px-3">Channel / Source</th>
                    <th className="py-2.5 px-2 text-right">Placed Orders</th>
                    <th className="py-2.5 px-2 text-right">Delivered Orders</th>
                    <th className="py-2.5 px-2 text-right">Ad Spend</th>
                    <th className="py-2.5 px-2 text-right">Delivered Revenue</th>
                    <th className="py-2.5 px-2 text-right">Delivered ROAS</th>
                    <th className="py-2.5 px-2 text-right">Contribution Margin</th>
                    <th className="py-2.5 px-3">Data Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-deepBlack-border/60">
                  {channelMetrics.map((chan) => (
                    <tr key={chan.channel} className="hover:bg-deepBlack-hover transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">{chan.channelLabel}</td>
                      <td className="py-3 px-2 text-right text-neutral-300">{chan.placedOrders}</td>
                      <td className="py-3 px-2 text-right text-emerald-400 font-bold">{chan.deliveredOrders}</td>
                      <td className="py-3 px-2 text-right text-white">৳{chan.adSpend.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-white font-semibold">৳{chan.realizedRevenue.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-primary">
                        {chan.deliveredRoas > 0 ? `${chan.deliveredRoas.toFixed(2)}x` : 'Organic'}
                      </td>
                      <td className="py-3 px-2 text-right text-emerald-400 font-medium">
                        ৳{chan.contributionMargin.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deepBlack-card text-neutral-400 border border-deepBlack-border">
                          {chan.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 9: LIVE ADS & WEB TELEMETRY (GA4 / META) */}
      {activeSubView === 'live_ads' && (
        <div className="pt-2">
          <MarketingAnalyticsTab
            summary={_summary}
            onSelectOrder={() => setActiveSubView('overview')}
            configuredMetaCost={configuredMetaCost}
            activeScope={activeScope}
            customRange={customRange}
            onScopeChange={onScopeChange}
            counts={counts}
            subLabel={subLabel}
            minDateIso={minDateIso}
            maxDateIso={maxDateIso}
          />
        </div>
      )}

      {/* SUBVIEW 10: CAMPAIGN CREATIVE STUDIO */}
      {activeSubView === 'creative_studio' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Campaign Creative Studio (Bilingual Copywriter)
              </h3>
              <p className="text-xs text-neutral-400">
                Structured briefs for Meta feed ads, Instagram Reels, Stories, Carousels, and Influencers in English and Bengali.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start">
              <span className="text-xs text-neutral-400">Target Campaign:</span>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="bg-deepBlack-card border border-deepBlack-border text-white text-xs rounded-lg px-3 py-1.5 focus:border-primary outline-none"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {campaigns.length === 0 ? (
              <div className="col-span-full p-8 border border-dashed border-deepBlack-border rounded-xl text-center bg-deepBlack-elevated/40">
                <p className="text-xs text-neutral-400">Create or load a campaign to generate localized creative briefs.</p>
              </div>
            ) : (
              creativeBriefs.map((brief) => (
                <div key={brief.id} className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">{brief.format}</span>
                      <span className="text-[11px] text-neutral-400 bg-deepBlack-elevated px-2 py-0.5 rounded border border-deepBlack-border">
                        {brief.cta}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mt-2">{brief.title}</h4>

                    {/* English Copy Section */}
                    <div className="mt-3.5 bg-deepBlack-elevated p-3 rounded-lg border border-deepBlack-border/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">English Copy</span>
                        <button
                          onClick={() => copyToClipboard(`${brief.headlineEn}\n\n${brief.primaryTextEn}`, `${brief.id}-en`)}
                          className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                        >
                          {copiedId === `${brief.id}-en` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `${brief.id}-en` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-white">{brief.headlineEn}</div>
                      <p className="text-xs text-neutral-300 leading-relaxed">{brief.primaryTextEn}</p>
                    </div>

                    {/* Bengali Copy Section */}
                    <div className="mt-2.5 bg-deepBlack-elevated p-3 rounded-lg border border-deepBlack-border/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary uppercase">বাংলা কপি (Bengali)</span>
                        <button
                          onClick={() => copyToClipboard(`${brief.headlineBn}\n\n${brief.primaryTextBn}`, `${brief.id}-bn`)}
                          className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                        >
                          {copiedId === `${brief.id}-bn` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `${brief.id}-bn` ? 'কপি হয়েছে' : 'কপি করুন'}
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-white">{brief.headlineBn}</div>
                      <p className="text-xs text-neutral-300 leading-relaxed font-sans">{brief.primaryTextBn}</p>
                    </div>

                    {brief.videoScriptOutline && (
                      <div className="mt-2.5 bg-deepBlack-card p-3 rounded border border-deepBlack-border/60 text-xs text-neutral-300">
                        <span className="text-[10px] font-bold text-amber-400 uppercase block mb-1">Video Storyboard / Script Outline</span>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap text-neutral-300">{brief.videoScriptOutline}</pre>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-deepBlack-border text-xs text-neutral-400 space-y-1">
                    <div><strong>Concept:</strong> {brief.creativeConcept}</div>
                    <div><strong>Photography Direction:</strong> {brief.photographySuggestion}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT CAMPAIGN MODAL */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-campaign-title"
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-deepBlack-card border border-deepBlack-border rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="create-campaign-title" className="text-base font-bold text-white mb-1">
                  Create Winter Seasonal Campaign
                </h3>
                <p className="text-xs text-neutral-300">
                  Define budget, target audience, and promotional rules for the marketing engine.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close campaign modal"
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-deepBlack-hover active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formCampaign.name || ''}
                  onChange={(e) => setFormCampaign({ ...formCampaign, name: e.target.value })}
                  className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. DEEN Winter Upgrade Sale"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Tagline</label>
                <input
                  type="text"
                  value={formCampaign.tagline || ''}
                  onChange={(e) => setFormCampaign({ ...formCampaign, tagline: e.target.value })}
                  className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. Buy More. Save More."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">Start Date</label>
                  <input
                    type="date"
                    value={formCampaign.startDate || ''}
                    onChange={(e) => setFormCampaign({ ...formCampaign, startDate: e.target.value })}
                    className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">End Date</label>
                  <input
                    type="date"
                    value={formCampaign.endDate || ''}
                    onChange={(e) => setFormCampaign({ ...formCampaign, endDate: e.target.value })}
                    className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">Ad Budget (৳)</label>
                  <input
                    type="number"
                    value={formCampaign.adBudget || 100000}
                    onChange={(e) => setFormCampaign({ ...formCampaign, adBudget: Number(e.target.value) })}
                    className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-neutral-300 block mb-1 font-medium">Target Delivered Orders</label>
                  <input
                    type="number"
                    value={formCampaign.expectedOrders || 800}
                    onChange={(e) => setFormCampaign({ ...formCampaign, expectedOrders: Number(e.target.value) })}
                    className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Target Audience Description</label>
                <textarea
                  rows={2}
                  value={formCampaign.targetAudience || ''}
                  onChange={(e) => setFormCampaign({ ...formCampaign, targetAudience: e.target.value })}
                  className="w-full bg-deepBlack-elevated border border-deepBlack-border rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. Young men, university students, cold-weather shoppers..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-deepBlack-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-deepBlack-elevated hover:bg-deepBlack-hover text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark font-semibold text-white transition-colors"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
