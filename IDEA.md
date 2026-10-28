# DEEN Commerce — Sales & Return Reconciliation Vision & Core Idea

## Overview

The **DEEN Commerce Reconciliation Engine** solves one of the most critical and non-linear problems in multi-channel apparel retail: **determining true net sales, inventory disposition, and courier economics** in the presence of:

1. **Partial Deliveries**: Customers ordering multiple apparel pieces (e.g. trying 2 sizes or styles) and keeping only one at the doorstep.
2. **Multi-Branch Fulfillment**: Single web orders split into branch courier dispatches (`17263 c` for Cumilla, `17263 w` for Wari, `17263 s` for Sylhet, `17263 m` for Mirpur Outlet) when the Central Warehouse is out of stock.
3. **Discrete Integer Inventory Attribution**: Applying knapsack dynamic programming subset sum algorithms to deduct doorstep shipping fees (50 TK inside Dhaka, 90 TK outside Dhaka) and attribute kept vs returned items strictly in whole integer units (never corrupting inventory with 0.5 quantities).
4. **Physical In-Store POS vs Online Ecommerce Isolation**: Maintaining strict commercial segregation between physical retail walk-in register sales (`isPos: true`, cash/terminal counter payments) and genuine web checkout dispatches.
5. **Real-Time Live Operations & Fulfillment Pace**: Streaming warehouse pack queues (`processing` + `hold`), tracking live Pathao courier delivery telemetry, and comparing hourly throughput against an integer-rounded 7-day rolling baseline.
6. **7-Sheet Month-End Net Sales Close Engine**: Generating audit-ready financial close workbooks (.xlsx) with universal column auto-fitting (`wch` auto-calculation) across P&L, category retention, SKU leaderboards, unmasked commercial orders, item-level returns, omnichannel allocations, and courier fee reconciliation.
7. **Omnipresent AI Copilot (DEEN Assistant)**: Grounded operations intelligence accessible via inline header search, global shortcut (<kbd>⌘J</kbd>), command palette (<kbd>⌘K</kbd>), and deep linking.
8. **Multi-Branch Security & Operator Governance**: Edge-guarded HMAC-SHA256 sessions, role-based authorization, and transparent operator privilege telemetry in Settings.
