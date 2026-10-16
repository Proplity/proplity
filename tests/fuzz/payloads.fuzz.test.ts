import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validate';
import { NextRequest } from 'next/server';

// Test Zod schemas representative of Proplity's core data models
const propertySchema = z.object({
  name: z.string().min(3).max(100),
  address: z.string().min(5),
  city: z.string().min(2),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE']),
  rentAmount: z.number().positive(),
  bedrooms: z.number().int().min(0).max(50),
  isPublished: z.boolean().optional(),
});

const paymentInitSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive().max(100_000_000),
  paymentMethod: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER']).default('DEBIT_CARD'),
});

describe('Fuzz Testing: Schema Validation and Payload Security', () => {
  const MALICIOUS_PAYLOADS = [
    // Prototype pollution
    JSON.parse('{"__proto__": {"isAdmin": true}}'),
    JSON.parse('{"constructor": {"prototype": {"role": "ADMIN"}}}'),
    // Type confusion
    { name: true, address: 12345, city: ['Lagos'], type: 'RESIDENTIAL', rentAmount: 'cheap' },
    { name: null, address: undefined, city: false },
    // Extreme / dangerous numeric anomalies
    { name: 'Penthouse', address: '1 Broad St', city: 'Lagos', type: 'RESIDENTIAL', rentAmount: -5000, bedrooms: 3 },
    { name: 'Penthouse', address: '1 Broad St', city: 'Lagos', type: 'RESIDENTIAL', rentAmount: NaN, bedrooms: 3 },
    { name: 'Penthouse', address: '1 Broad St', city: 'Lagos', type: 'RESIDENTIAL', rentAmount: Infinity, bedrooms: 3 },
    { name: 'Penthouse', address: '1 Broad St', city: 'Lagos', type: 'RESIDENTIAL', rentAmount: 1000, bedrooms: -1 },
    { name: 'Penthouse', address: '1 Broad St', city: 'Lagos', type: 'RESIDENTIAL', rentAmount: 1000, bedrooms: 999999 },
    // Length boundary violation
    { name: 'A'.repeat(100_000), address: 'B'.repeat(100_000), city: 'Lagos', type: 'RESIDENTIAL', rentAmount: 5000, bedrooms: 2 },
    // Missing required fields
    { name: 'Estate' },
  ];

  it('safely rejects all malformed and malicious property payloads via validateBody', async () => {
    for (const payload of MALICIOUS_PAYLOADS) {
      const req = new NextRequest('http://localhost:3000/api/v1/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const validation = await validateBody(req, propertySchema);
      // All invalid payloads should fail validation cleanly with status 400
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.response.status).toBe(400);
      }
    }
  });

  it('rejects invalid invoice and payment initialization payloads', async () => {
    const invalidPayments = [
      { invoiceId: 'not-a-uuid', amount: 5000 },
      { invoiceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', amount: -100 },
      { invoiceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', amount: 0 },
      { invoiceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', amount: 500_000_000 }, // Exceeds 100M cap
      { invoiceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', amount: 5000, paymentMethod: 'BITCOIN' },
    ];

    for (const payment of invalidPayments) {
      const req = new NextRequest('http://localhost:3000/api/v1/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment),
      });

      const validation = await validateBody(req, paymentInitSchema);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.response.status).toBe(400);
      }
    }
  });

  it('handles completely malformed non-JSON request bodies gracefully', async () => {
    const malformedBodies = [
      '{ this is not valid json }',
      '<<<XML>>>',
      '\0\0\0\0',
      '',
    ];

    for (const body of malformedBodies) {
      const req = new NextRequest('http://localhost:3000/api/v1/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const validation = await validateBody(req, propertySchema);
      expect(validation.success).toBe(false);
      if (!validation.success) {
        expect(validation.response.status).toBe(400);
      }
    }
  });
});
