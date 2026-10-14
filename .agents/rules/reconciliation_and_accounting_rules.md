# DEEN Commerce — Reconciliation & Accounting Mathematical Rules

These authoritative rules govern the Knapsack DP subset-sum solver, COD delivery fee accounting, whole integer constraints, paid return propagation, and unit economics calculations.

---

## 1. Knapsack / Subset-Sum Partial Matching Algorithm

When couriers report a partial delivery on a multi-item order, they collect a cash amount at the doorstep:
$$\text{Collected COD} = \sum_{i \in \text{Kept}} \text{ItemPrice}_i + \text{DeliveryCharge}$$

### 1.1 Item Flattening
* Multi-quantity order lines are flattened into discrete single units (`qty = 1`) with their respective unit prices.

### 1.2 Territory Delivery Charges
Candidate shipping fees deducted before solving:
* **Inside Dhaka Metro**:
  * Primary: ৳50
  * Fallbacks: ৳60, ৳0
* **Outside Dhaka**:
  * Primary: ৳90
  * Fallbacks: ৳100, ৳120, ৳0

### 1.3 Matching Tolerances
* **Exact Match**: $\left|\sum_{i \in \text{Kept}} \text{Price}_i - (\text{COD} - \text{DeliveryFee})\right| \le 2\text{ TK}$
* **Tolerance Match**: Candidate subset total within $\pm 25\text{ TK}$.
* **Closest Match**: Deterministic subset minimizing absolute deviation.

### 1.4 Unbreakable Integer Constraint
* **Returned quantity CANNOT be a float (e.g. 0.5 is strictly forbidden).**
* Every item line is partitioned into discrete integer units:
  $$\text{KeptQty} \in \mathbb{Z}_{\ge 0}, \quad \text{ReturnedQty} \in \mathbb{Z}_{\ge 0}, \quad \text{KeptQty} + \text{ReturnedQty} = \text{TotalQty}$$

---

## 2. Multi-Parcel Paid Return Propagation Rule

In omnichannel retail, orders may dispatch via multiple consignments (e.g. split branch parcels):
$$\text{isPaidReturn}_{\text{order}} = \bigvee_{p \in \text{parcels}} \text{isPaidReturn}_p$$

* **Rule**: If **at least one parcel** in an order is confirmed as a `Paid Return` (COD collected for shipping/return fees), **all returned parcels** belonging to that order inherit `Paid Return` classification.
* **Non-Paid Return**: Only applied when all parcels in the order are returned with zero customer payment collected.

---

## 3. Split Multi-Parcel Delivery Rule

$$\text{isDelivered}_{\text{order}} = \bigwedge_{p \in \text{parcels}} \text{isDelivered}_p$$

* An order is classified as `DELIVERED` if and only if **every** branch parcel was successfully delivered.
* If one branch parcel was delivered and another parcel was returned, the overall order outcome is classified as `PARTIAL`.

---

## 4. Financial Unit Economics Formulations

### 4.1 Invoiced vs Realized Revenue
* **Gross Invoiced GMV**: Total value of all dispatched orders before customer delivery or returns.
* **Net Realized Revenue**: Total value of accepted merchandise kept by customers:
  $$\text{Net Revenue} = \sum \text{Delivered Item Value} + \sum \text{Partial Kept Item Value}$$

### 4.2 Estimated Cost of Goods Sold (COGS)
* Modeled at $42\%$ to $45\%$ of retail merchandise value (representing fabric milling, dyeing, cutting, and stitching costs).

### 4.3 Net Courier Logistics Burden
$$\text{Net Courier Burden} = \text{Pathao Gross Charges} - \text{Paid Return Collected COD} - \text{Customer Delivery Fees Collected}$$

### 4.4 Packaging Sunk Loss
* Fixed sunk cost of **৳25** per returned or partial order (poly bags, flyer packaging, garment re-tagging, inspection labor).

### 4.5 Meta Performance Marketing Ad Spend
* Performance marketing acquisition budget deployed across Facebook and Instagram ads.
* **Blended ROAS (Return on Ad Spend)**:
  $$\text{ROAS} = \frac{\text{Clean Realized Net Sales}}{\text{Meta Ad Spend}}$$
* **Blended CAC (Customer Acquisition Cost per Kept Order)**:
  $$\text{CAC} = \frac{\text{Meta Ad Spend}}{\text{Full Delivered Orders}}$$

### 4.6 Net Contribution Margin (CM3)
* **Pre-Marketing Contribution Margin (CM2)**:
  $$\text{CM2} = \text{Gross Product Margin} - \text{Net Courier Burden} - \text{Packaging Loss}$$
* **True Net Operating Contribution Margin (CM3)**:
  $$\text{Net Contribution Margin (CM3)} = \text{CM2} - \text{Meta Ad Spend}$$
  $$\text{Net Margin Percentage} = \frac{\text{Net Contribution Margin}}{\text{Clean Realized Net Sales}} \times 100$$
