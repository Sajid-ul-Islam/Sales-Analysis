# Feature Development Brief: DEEN Commerce Campaign Intelligence & Marketing Strategy Engine

## Project

**Repository:** https://github.com/Sajid-ul-Islam/Sales-Analysis  
**Business:** DEEN Commerce — https://deencommerce.com  
**Market:** Bangladesh  
**Season:** Winter 2026–2027  
**Primary objective:** Generate maximum profitable delivered sales through data-driven campaign planning, promotional optimization, customer segmentation, and marketing intelligence.

---

# 1. Your Mission

Act as a senior full-stack engineer, product architect, data analyst, and e-commerce growth strategist.

Your task is to analyze and extend the existing DEEN Commerce Sales Analysis application with a comprehensive **Campaign Intelligence & Marketing Strategy module**.

This is not a request to build another generic marketing dashboard.

The objective is to transform DEEN's existing sales, product, customer, delivery, return, and financial data into actionable marketing decisions.

The system should help DEEN's management answer questions such as:

- Which products should we promote this winter?
- Which products should be bundled together?
- What discount can we offer without destroying profit margins?
- Which customers are most likely to purchase again?
- Which customers should receive personalized promotions?
- Which products have high sales but poor delivery retention?
- Which products have excessive inventory or slow-moving stock?
- What is the optimal promotional threshold to increase average order value?
- How much should we spend on Facebook and Instagram advertising?
- Which campaigns are generating actual delivered revenue rather than just placed orders?
- Which promotional strategy generates the highest contribution margin?

**Core principle: Optimize for profitable delivered sales, not gross order volume, clicks, or vanity ROAS.**

---

# 2. First: Understand the Existing Architecture

Before implementing anything, thoroughly inspect the repository.

Read and follow:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/DESIGN.md`
- `.agents/rules/`
- `src/types/`
- `src/lib/`
- `src/app/`
- `src/components/`

Understand the existing:

- WooCommerce integration.
- Pathao courier integration.
- Sales reconciliation engine.
- Product and SKU classification.
- Customer delivery rating and risk intelligence.
- Unit economics calculations.
- Return and exchange accounting.
- Outlet and channel segmentation.
- Existing AI copilot.
- Authentication and role-based access.
- Dashboard navigation and responsive design.

Do not create duplicate functionality that already exists.

Do not modify existing reconciliation business rules unless absolutely necessary.

Do not break existing APIs, data contracts, exports, or dashboard modules.

Reuse the existing architecture, components, utilities, and data models wherever possible.

---

# 3. New Module: Campaign Intelligence

Create a dedicated top-level dashboard module:

**Campaign Intelligence**

It should have the following submodules:

1. Campaign Overview
2. Campaign Planner
3. Promotion & Bundle Builder
4. Product Opportunity Finder
5. Customer Segmentation
6. Marketing Budget Simulator
7. Seasonal Campaign Calendar
8. Campaign Performance & Attribution
9. AI Marketing Strategist

The experience should feel like a modern enterprise marketing intelligence platform, not a collection of disconnected charts.

---

# 4. Campaign Overview Dashboard

Create an executive marketing overview.

## Primary KPIs

Display:

- Total Campaign Revenue
- Delivered Campaign Revenue
- Campaign Contribution Margin
- Campaign Advertising Spend
- Marketing ROI
- Delivered ROAS
- Average Order Value
- Customer Acquisition Cost
- Campaign Delivery Retention Rate
- Repeat Purchase Rate
- Discount Cost
- Return and Cancellation Rate

Distinguish carefully between:

- Placed order revenue.
- Dispatched order value.
- Delivered revenue.
- Returned order value.
- Net realized revenue.
- Contribution margin.

Use the existing reconciliation engine as the source of truth for delivered and returned sales.

Never count cancelled, returned, exchanged, or undelivered orders as successfully realized campaign sales.

Where advertising attribution is unavailable, clearly indicate that the metric is estimated, unavailable, or based on manually entered data.

## Visualizations

Include:

- Campaign revenue trend.
- Advertising spend versus delivered revenue.
- Campaign profitability comparison.
- Product category performance.
- New versus returning customers.
- Sales by marketing channel.
- Discount impact on contribution margin.
- Campaign delivery retention.

Allow filtering by:

- Date range.
- Campaign.
- Product category.
- Product.
- Marketing channel.
- Customer segment.
- Fulfillment outlet.

---

# 5. Winter Campaign Planner 2026–2027

Build an interactive seasonal campaign planner specifically designed for Bangladesh's men's fashion market.

The initial campaign should be:

## DEEN WINTER UPGRADE

**Tagline:** Buy More. Save More.

Campaign positioning:

Upgrade your winter wardrobe with jackets, hoodies, sweatshirts, jeans, and coordinated outfits at attractive prices.

### Campaign calendar

Create a calendar with configurable campaign periods:

| Campaign              | Proposed Period | Primary Objective         |
| --------------------- | --------------- | ------------------------- |
| Winter Is Coming      | Nov 3–15        | Awareness and acquisition |
| Winter Upgrade Sale   | Nov 16–30       | Conversion and AOV growth |
| The Winter Drop       | Dec 1–15        | Product sales             |
| Year-End Winter Deals | Dec 16–31       | Sales acceleration        |
| Cold Wave Flash Sale  | Jan 1–20        | Weather-responsive sales  |
| Winter Clearance      | Jan 21–Feb 15   | Inventory liquidation     |

These dates are initial planning assumptions, not fixed business rules.

The planner should allow administrators to modify dates, budgets, campaign objectives, promotional rules, and eligible products.

### Campaign templates

Include reusable templates for:

- Winter Sale.
- Flash Sale.
- Bundle Offers.
- Buy More, Save More.
- New Arrivals.
- Clearance Sale.
- Referral Campaign.
- Customer Retention.
- Repeat Purchase.
- Product Launch.
- Seasonal Lookbook.
- Outlet-Specific Promotions.

Each campaign should have:

- Campaign name.
- Campaign objective.
- Start and end date.
- Target audience.
- Selected products.
- Discount configuration.
- Advertising budget.
- Expected orders.
- Expected delivered revenue.
- Expected contribution margin.
- Campaign status.
- Performance targets.

---

# 6. Smart Promotion & Bundle Builder

This should be one of the most valuable features.

Create an interactive promotion engine that helps management design offers based on real product economics.

## A. Buy More, Save More

Support configurable spending thresholds.

Example initial proposal:

| Cart Value | Additional Benefit  |
| ---------- | ------------------- |
| ৳2,500+    | Free shipping       |
| ৳3,500+    | Additional ৳150 off |
| ৳5,000+    | Additional ৳350 off |
| ৳7,000+    | Additional ৳600 off |

These are illustrative promotional rules, not mandatory defaults.

The system must calculate whether each threshold is financially sustainable.

Show:

- Eligible orders.
- Estimated incremental AOV.
- Discount expenditure.
- Delivery subsidy.
- Expected contribution margin.
- Break-even order volume.
- Projected profitability.

Prevent users from accidentally stacking incompatible discounts.

## B. Intelligent Product Bundles

Recommend combinations such as:

- Hoodie + T-shirt.
- Denim Jacket + Jeans.
- Sweatshirt + Jeans.
- Jacket + T-shirt.
- Shirt + Jeans.

Use actual product data.

Do not hardcode these combinations as the only possible bundles.

Analyze:

- Product category.
- SKU.
- Product price.
- Sales frequency.
- Purchase combinations.
- Available stock.
- Gross margin.
- Delivery retention.
- Return rate.

Recommend bundles that have a realistic commercial advantage.

Example:

**Complete Winter Look**

TIFFOSI Denim Jacket + American Eagle Jeans.

The system should dynamically calculate:

- Individual product prices.
- Combined regular price.
- Existing discounts.
- Proposed bundle discount.
- Final bundle price.
- Estimated product cost.
- Gross contribution.
- Delivery and operational costs.
- Expected net contribution.

Allow management to adjust the bundle discount and immediately see its financial impact.

## C. Promotion Conflict Detection

Detect:

- Existing sale discounts.
- Additional coupon discounts.
- Bundle discounts.
- Free shipping.
- Loyalty rewards.

Calculate the combined discount and warn administrators when an offer becomes unprofitable.

---

# 7. Product Opportunity Finder

Create a product intelligence engine that identifies which products deserve promotional investment.

Analyze every product using:

- Total units sold.
- Delivered units.
- Gross sales.
- Net realized revenue.
- Gross margin.
- Return rate.
- Delivery retention rate.
- Average selling price.
- Available stock.
- Historical demand.
- Sales velocity.

Classify products into actionable groups:

### Best Sellers

Products with consistently high delivered sales and healthy margins.

### High-Margin Opportunities

Products with attractive contribution margins that could support advertising investment.

### Slow-Moving Inventory

Products with low sales velocity and excess available stock.

### High Return Products

Products generating orders but suffering from poor delivery retention.

### Bundle Opportunities

Products that are frequently purchased together or complement each other.

### Clearance Candidates

Products requiring controlled inventory liquidation.

Create a recommendation panel:

"Promote these 10 products this week."

Each recommendation must explain WHY it was selected.

Avoid recommending a product solely because it has high gross sales.

---

# 8. Customer Segmentation & Retention Intelligence

Use existing customer and order history.

Build actionable customer segments.

## Recommended segments

1. New Customers
2. First-Time Delivered Customers
3. Repeat Customers
4. High-Value Customers
5. Loyal Customers
6. Inactive Customers
7. Discount-Sensitive Customers
8. High Return-Risk Customers

Use RFM analysis:

- Recency.
- Frequency.
- Monetary Value.

Also consider:

- Number of successfully delivered orders.
- Total realized customer revenue.
- Average order value.
- Purchase categories.
- Repeat purchase intervals.
- Return history.
- Lifetime contribution.

Existing Pathao delivery ratings and store-history customer risk calculations must remain separate from marketing customer value.

A customer with a high delivery success rate is not automatically a high-value customer.

## Segment-specific campaign recommendations

Examples:

| Segment              | Suggested Campaign          |
| -------------------- | --------------------------- |
| New customers        | First Order Offer           |
| First-time delivered | Second Purchase Incentive   |
| Repeat customers     | Loyalty Rewards             |
| High-value customers | VIP Winter Collection       |
| Inactive customers   | Win-Back Campaign           |
| Jacket buyers        | Jeans and Hoodie Cross-Sell |
| Hoodie buyers        | Winter Outfit Bundle        |

The system should generate actionable audience counts and suggested promotional strategies.

Protect customer privacy. Do not expose phone numbers or personal information in marketing reports unnecessarily.

---

# 9. Marketing Budget & Profitability Simulator

Create an interactive financial simulator.

Management should be able to change:

- Monthly advertising budget.
- Campaign duration.
- Expected CPC.
- Expected conversion rate.
- Expected order volume.
- Average order value.
- Product gross margin.
- Discount amount.
- Delivery subsidy.
- Advertising cost per acquisition.
- Delivery retention rate.

Generate three scenarios:

1. Conservative.
2. Expected.
3. Optimistic.

Calculate:

- Estimated clicks.
- Estimated orders.
- Estimated delivered orders.
- Expected revenue.
- Expected delivered revenue.
- Advertising expenditure.
- Discount expenditure.
- Return and cancellation impact.
- Contribution margin.
- Break-even ROAS.
- Break-even CAC.
- Estimated marketing ROI.

Clearly label every user-entered assumption.

Do not present projections as actual performance.

## Important financial distinction

Maintain these separate metrics:

**Gross Revenue:** Value of orders before returns and reconciliation.

**Realized Revenue:** Revenue from successfully delivered items and accepted partial orders.

**Gross Profit:** Realized revenue minus product costs.

**Contribution Margin:** Gross profit minus attributable advertising, discounts, delivery costs, return costs, and other applicable variable costs.

Do not blindly reuse the existing estimated 42% COGS assumption for every product.

Prefer actual product-level costs where available.

If actual costs are unavailable, use configurable estimates and visibly identify them.

Avoid double-counting courier expenses, delivery subsidies, discounts, or return losses.

---

# 10. Campaign Performance & Attribution

Build a campaign performance tracking system.

Campaign records should support:

- Meta/Facebook.
- Instagram.
- Google Ads.
- Organic Social.
- Influencer.
- Referral.
- Direct.
- Other.

Support UTM parameters:

- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term

Provide campaign-level order attribution using available WooCommerce order metadata, landing-page information, coupon codes, or imported marketing reports.

Where integrations do not exist, support CSV/Excel imports and manual data entry.

Do not claim precise attribution without supporting data.

## Performance reporting

Show:

- Attributed placed orders.
- Attributed delivered orders.
- Attributed realized revenue.
- Advertising spend.
- Delivered ROAS.
- CAC.
- Contribution margin.
- Return rate.
- Cancellation rate.

Support campaign comparison and date-range filtering.

---

# 11. AI Marketing Strategist

Extend the existing DEEN Assistant architecture rather than creating a completely separate AI system.

Introduce a dedicated marketing intelligence mode.

Example user questions:

- Which 10 products should we promote this week?
- Create a profitable winter bundle.
- What is the maximum discount we can offer on this jacket?
- Which customers should receive a repeat-purchase offer?
- Why did campaign profitability decline?
- Which products should be cleared before February?
- What campaign should we run with a ৳50,000 advertising budget?
- How much should we spend on Meta Ads?
- Which product categories have the best delivery retention?
- Recommend a campaign to increase AOV by 15%.

The AI should:

1. Retrieve relevant verified data.
2. Analyze actual sales and delivery performance.
3. Consider product-level profitability.
4. Identify opportunities and risks.
5. Generate actionable recommendations.
6. Explain the reasoning behind every recommendation.
7. Provide confidence and data-availability indicators.

### Zero-Hallucination Requirements

The AI must never invent:

- Sales figures.
- Product costs.
- Stock availability.
- Customer counts.
- Advertising performance.
- Campaign conversions.
- Profit margins.

Separate verified facts, calculated metrics, assumptions, and forecasts.

If a required metric is unavailable, explicitly say so.

Provide a deterministic fallback when external AI providers are unavailable, consistent with the existing copilot architecture.

---

# 12. Bangladesh-Specific Marketing Intelligence

The platform must be designed around Bangladesh's e-commerce and apparel market.

Use:

- Bangladeshi Taka (৳).
- Bangladesh Standard Time.
- Local seasonal campaign periods.
- Cash on Delivery considerations.
- Pathao delivery economics.
- Inside Dhaka versus outside Dhaka delivery costs.
- Mobile-first shopping behavior.
- Facebook and Instagram advertising.
- Bengali and English marketing content.

Include configurable campaign themes:

- Winter Upgrade.
- Victory Day Offers.
- Year-End Deals.
- New Year Collection.
- Cold Wave Flash Sale.
- Winter Clearance.

Weather-responsive campaigns should use verified weather information or manually configured triggers. Never invent weather conditions.

Allow AI-generated campaign copy in both English and Bangla.

---

# 13. Campaign Creative Studio

Create a creative planning section.

The system should generate structured creative briefs for:

- Facebook feed advertisements.
- Instagram Reels.
- Facebook Stories.
- Product carousels.
- Promotional banners.
- Influencer collaborations.
- Lookbook content.

For every campaign, generate:

- Headline.
- Primary text.
- CTA.
- Target audience.
- Creative concept.
- Suggested product photography.
- Video script outline.
- Recommended format.
- Offer details.

Include Bangla and English copy generation.

Do not automatically publish ads or spend advertising budgets. Creative generation and external advertising execution must remain separate.

---

# 14. Technical Architecture & Data Integrity

Implement the new functionality using the existing stack:

- Next.js 14 App Router.
- React 18.
- TypeScript.
- Tailwind CSS.
- Existing charting and visualization architecture.
- Existing WooCommerce and Pathao clients.
- Existing reconciliation and unit economics utilities.

Before adding dependencies, inspect whether an existing library or utility already solves the requirement.

## Data architecture

Create appropriate TypeScript contracts for:

- Campaign.
- CampaignProduct.
- PromotionRule.
- Bundle.
- CampaignPerformance.
- MarketingExpense.
- CustomerSegment.
- CampaignAttribution.
- CampaignForecast.
- CampaignRecommendation.

Separate:

1. Source data.
2. Calculated analytics.
3. User-configured campaign data.
4. Forecasts and assumptions.

Persist campaign configuration and marketing expenses safely using an appropriate existing or newly justified storage mechanism.

Do not treat transient React state as permanent campaign storage.

Do not introduce an entirely new database infrastructure without first evaluating the existing deployment architecture.

## Existing system invariants

Preserve:

- Strict order reconciliation.
- Delivered versus returned sales distinctions.
- Partial order accounting.
- Exchange isolation.
- POS versus ecommerce separation.
- Pathao consignment matching rules.
- Existing customer delivery ratings.
- Branch attribution.
- Existing API security.

The campaign engine must use commercial ecommerce sales and physical POS sales as distinct channels, while allowing management to analyze them together when appropriate.

Never count exchange replacements as new commercial revenue.

---

# 15. UX/UI Requirements

The new module must match the existing DEEN enterprise dashboard design system.

Maintain:

- Brand orange: #EB5A19.
- Existing light and dark themes.
- Plus Jakarta Sans and Inter typography.
- Existing semantic status colors.
- Consistent spacing and card hierarchy.
- Existing sidebar navigation.
- Existing mobile navigation architecture.

The UI should feel modern, clean, professional, and data-rich without becoming visually overwhelming.

## Desktop

- Executive-level overview.
- Multi-column KPI cards.
- Interactive charts.
- Advanced data tables.
- Side-by-side promotion comparisons.
- Rich campaign configuration interfaces.

## Mobile

- Fully responsive layout.
- Mobile-friendly campaign cards.
- Touch-friendly filters.
- Bottom navigation compatibility.
- No horizontal page overflow.
- Simplified chart presentations.
- Accessible campaign creation and editing.

Use reusable components and avoid duplicating existing dashboard components.

Follow `docs/DESIGN.md` and all CSS architecture constraints.

---

# 16. Suggested Implementation Phases

Do not implement everything as one massive change.

### Phase 1 — Data Foundation

- Audit existing product, order, customer, and unit economics data.
- Define campaign data contracts.
- Implement reliable marketing metrics.
- Implement campaign configuration persistence.
- Add tests for financial calculations.

### Phase 2 — Campaign Intelligence Dashboard

- Create Campaign Overview.
- Create Campaign Planner.
- Implement seasonal calendar.
- Implement campaign CRUD operations.
- Add campaign filtering.

### Phase 3 — Promotion & Bundle Engine

- Implement Buy More, Save More.
- Implement bundle recommendations.
- Implement discount calculations.
- Implement promotion conflict detection.
- Implement profitability simulator.

### Phase 4 — Product & Customer Intelligence

- Implement product opportunity finder.
- Implement RFM segmentation.
- Implement repeat-purchase recommendations.
- Implement cross-selling suggestions.

### Phase 5 — Marketing Performance

- Implement campaign attribution.
- Implement UTM tracking.
- Implement marketing expense management.
- Implement delivered ROAS and campaign profitability.
- Support marketing CSV/Excel imports.

### Phase 6 — AI Marketing Strategist

- Extend existing AI copilot.
- Implement grounded marketing queries.
- Add deterministic fallback.
- Generate campaign briefs and recommendations.

### Phase 7 — UX, Testing & Optimization

- Complete responsive implementation.
- Validate all calculations.
- Test campaign creation and editing.
- Test persistence.
- Test exports.
- Test existing reconciliation workflows.
- Run lint, type-check, unit tests, and production build.

---

# 17. Acceptance Criteria

The feature is complete only when:

- [ ] Campaigns can be created, edited, archived, and filtered.
- [ ] Campaign calendars support configurable dates.
- [ ] Product recommendations use actual sales and profitability data.
- [ ] Bundle pricing is calculated dynamically.
- [ ] Promotion discounts cannot silently create negative contribution margins.
- [ ] Marketing budget scenarios calculate correctly.
- [ ] Customer segments use verified historical order data.
- [ ] Delivered revenue is distinguished from placed order revenue.
- [ ] Marketing attribution clearly communicates data limitations.
- [ ] Campaign performance can be compared.
- [ ] AI recommendations cite the actual underlying metrics.
- [ ] Missing data never produces fabricated results.
- [ ] Existing dashboard functionality remains intact.
- [ ] All new features work on desktop and mobile.
- [ ] Financial calculation tests pass.
- [ ] TypeScript checks pass.
- [ ] Production build succeeds.

---

# 18. Final Product Vision

The long-term vision is to make the DEEN Commerce dashboard a complete decision-support platform.

It should evolve through three levels:

**Level 1 — Descriptive Analytics**

What happened?

Sales, revenue, returns, deliveries, margins, and customer behavior.

**Level 2 — Diagnostic & Predictive Intelligence**

Why did it happen, and what is likely to happen next?

Product opportunities, customer segmentation, campaign forecasting, and profitability analysis.

**Level 3 — Prescriptive Intelligence**

What should management do next?

Recommended promotions, optimized bundles, marketing budgets, seasonal campaigns, and customer retention strategies.

The ultimate experience should allow DEEN's management to open the dashboard and immediately understand:

1. What is happening in the business?
2. Where are we losing money?
3. Which products should we promote?
4. Which customers should we target?
5. Which campaign should we launch?
6. How much should we spend?
7. What financial outcome can we realistically expect?

**Build this as a production-quality extension of the existing application, not a standalone prototype.**

Prioritize correctness, maintainability, financial accuracy, usability, and actionable business intelligence over feature quantity.

Before implementation, produce a concise architecture assessment identifying reusable components, required data contracts, missing data, and implementation dependencies. Then execute the phases systematically.
