import fs from 'fs';
import path from 'path';
import { anonymizeDataset, auditDatasetPII } from '../src/lib/dataAudit';

const samplePath = path.resolve('src/data/baselineSample.json');
console.log('Reading baseline sample from:', samplePath);

const rawJson = fs.readFileSync(samplePath, 'utf8');
const data = JSON.parse(rawJson);

console.log('--- BEFORE ANONYMIZATION AUDIT ---');
console.log('Orders PII:', auditDatasetPII(data.orders));
console.log('Returns PII:', auditDatasetPII(data.returns));
console.log('Partials PII:', auditDatasetPII(data.partials));
console.log('Exchanges PII:', auditDatasetPII(data.exchanges));
console.log('PathaoDelivery PII:', auditDatasetPII(data.pathaoDelivery));

const anonymized = {
  orders: anonymizeDataset(data.orders || []),
  returns: anonymizeDataset(data.returns || []),
  partials: anonymizeDataset(data.partials || []),
  exchanges: anonymizeDataset(data.exchanges || []),
  pathaoDelivery: anonymizeDataset(data.pathaoDelivery || []),
};

console.log('--- AFTER ANONYMIZATION AUDIT ---');
const postOrders = auditDatasetPII(anonymized.orders);
const postReturns = auditDatasetPII(anonymized.returns);
const postPartials = auditDatasetPII(anonymized.partials);
const postExchanges = auditDatasetPII(anonymized.exchanges);
const postPathao = auditDatasetPII(anonymized.pathaoDelivery);

console.log('Orders PII:', postOrders);
console.log('Returns PII:', postReturns);
console.log('Partials PII:', postPartials);
console.log('Exchanges PII:', postExchanges);
console.log('PathaoDelivery PII:', postPathao);

// Verify total counts and financial metrics preserved
console.log('Order count before:', data.orders.length, 'after:', anonymized.orders.length);
const totalCostBefore = data.orders.reduce((sum: number, r: any) => sum + (parseFloat(r['Item Cost']) || 0), 0);
const totalCostAfter = anonymized.orders.reduce((sum: number, r: any) => sum + (parseFloat(r['Item Cost']) || 0), 0);
console.log('Total item cost before:', totalCostBefore, 'after:', totalCostAfter);
console.log('Cost diff:', Math.abs(totalCostBefore - totalCostAfter));

fs.writeFileSync(samplePath, JSON.stringify(anonymized, null, 2), 'utf8');
console.log('Successfully wrote sanitized baseline sample to disk!');
