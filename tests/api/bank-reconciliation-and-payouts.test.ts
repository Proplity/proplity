import { beforeAll, describe, expect, it } from 'vitest';
import { Role, InvoiceType, InvoiceStatus } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  createInvoice,
  createMaintenanceRequest,
  createBankAccount,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('ISS-012: Bank-Transfer Reconciliation & Vendor Payouts', () => {
  beforeAll(async () => {
    await resetDb();
  });

  describe('Part 1: Bank-Transfer Reconciliation Flow', () => {
    it('allows a tenant to submit bank transfer proof for their invoice and prevents duplicate references', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const tenant = await createUser(Role.TENANT);
      const otherTenant = await createUser(Role.TENANT);

      const property = await createProperty({
        landlordId: landlord.id,
        managerId: manager.id,
      });
      const unit = await createUnit(property.id);
      const rent = await createRent(unit.id, tenant.id);
      const invoice = await createInvoice({
        rentId: rent.id,
        amount: 50_000,
        type: InvoiceType.RENT,
        status: InvoiceStatus.UNPAID,
      });

      const tenantCookie = await authCookie(tenant.id, tenant.role);
      const otherCookie = await authCookie(otherTenant.id, otherTenant.role);

      // 1. Unrelated tenant cannot submit for someone else's invoice
      const unauthorized = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: otherCookie,
        body: {
          invoiceId: invoice.id,
          amount: 50_000,
          bankName: 'Access Bank',
          senderAccountName: 'Stranger Danger',
          referenceNumber: 'REF-BANK-001',
          paymentDate: new Date().toISOString(),
        },
      });
      expect(unauthorized.status).toBe(403);

      // 2. Tenant cannot submit amount exceeding balance
      const excessive = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: tenantCookie,
        body: {
          invoiceId: invoice.id,
          amount: 60_000,
          bankName: 'Access Bank',
          senderAccountName: 'Test Tenant',
          referenceNumber: 'REF-BANK-001',
          paymentDate: new Date().toISOString(),
        },
      });
      expect(excessive.status).toBe(400);
      expect(excessive.body.error).toContain('exceeds invoice balance');

      // 3. Valid submission
      const submitRes = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: tenantCookie,
        body: {
          invoiceId: invoice.id,
          amount: 50_000,
          bankName: 'Guaranty Trust Bank',
          senderAccountName: 'Test Tenant',
          senderAccountNumber: '0123456789',
          referenceNumber: 'REF-BANK-001',
          paymentDate: new Date().toISOString(),
          notes: 'Paid via mobile banking app',
        },
      });
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.status).toBe('PENDING');
      expect(submitRes.body.data.amount).toBe(50_000);

      // 4. Duplicate reference rejection
      const duplicate = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: tenantCookie,
        body: {
          invoiceId: invoice.id,
          amount: 50_000,
          bankName: 'Zenith Bank',
          senderAccountName: 'Test Tenant',
          referenceNumber: 'REF-BANK-001',
          paymentDate: new Date().toISOString(),
        },
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error).toContain('already been recorded');

      // 5. Query submission list scoped by tenant
      const listRes = await apiFetch('/api/v1/bank-transfers', { cookie: tenantCookie });
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].referenceNumber).toBe('REF-BANK-001');

      // Other tenant sees nothing in their list
      const otherList = await apiFetch('/api/v1/bank-transfers', { cookie: otherCookie });
      expect(otherList.status).toBe(200);
      expect(otherList.body.data.length).toBe(0);
    });

    it('allows property manager/landlord to reconcile and approve a bank transfer, creating Payment and marking invoice PAID', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const tenant = await createUser(Role.TENANT);
      const stranger = await createUser(Role.LANDLORD);

      const property = await createProperty({
        landlordId: landlord.id,
        managerId: manager.id,
      });
      const unit = await createUnit(property.id);
      const rent = await createRent(unit.id, tenant.id);
      const invoice = await createInvoice({
        rentId: rent.id,
        amount: 120_000,
        type: InvoiceType.RENT,
        status: InvoiceStatus.UNPAID,
      });

      const tenantCookie = await authCookie(tenant.id, tenant.role);
      const managerCookie = await authCookie(manager.id, manager.role);
      const strangerCookie = await authCookie(stranger.id, stranger.role);

      const submissionRes = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: tenantCookie,
        body: {
          invoiceId: invoice.id,
          amount: 120_000,
          bankName: 'First Bank',
          senderAccountName: 'Tenant Bank Account',
          referenceNumber: 'FB-SESSION-999',
          paymentDate: new Date().toISOString(),
        },
      });
      expect(submissionRes.status).toBe(201);
      const submissionId = submissionRes.body.data.id;

      // 1. Stranger landlord cannot reconcile
      const forbiddenReconcile = await apiFetch(
        `/api/v1/bank-transfers/${submissionId}/reconcile`,
        {
          method: 'POST',
          cookie: strangerCookie,
          body: { action: 'APPROVE' },
        },
      );
      expect(forbiddenReconcile.status).toBe(403);

      // 2. Manager approves and reconciles
      const approveRes = await apiFetch(`/api/v1/bank-transfers/${submissionId}/reconcile`, {
        method: 'POST',
        cookie: managerCookie,
        body: { action: 'APPROVE', notes: 'Verified in bank statement' },
      });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.newStatus).toBe('PAID');
      expect(approveRes.body.data.submission.status).toBe('APPROVED');

      // Verify database records
      const updatedInvoice = await testPrisma.invoice.findUnique({
        where: { id: invoice.id },
        include: { payments: true },
      });
      expect(updatedInvoice?.status).toBe('PAID');
      expect(updatedInvoice?.payments.length).toBe(1);
      expect(updatedInvoice?.payments[0].amount).toBe(120_000);
      expect(updatedInvoice?.payments[0].transactionRef).toBe('FB-SESSION-999');
      expect(updatedInvoice?.payments[0].paymentMethod).toBe('BANK_TRANSFER');

      // Verify Audit Log
      const auditLog = await testPrisma.auditLog.findFirst({
        where: {
          entityType: 'BankTransferSubmission',
          entityId: submissionId,
          action: 'BANK_TRANSFER_RECONCILED',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(manager.id);
    });

    it('allows manager/landlord to reject a submission with a reason', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const tenant = await createUser(Role.TENANT);

      const property = await createProperty({ landlordId: landlord.id });
      const unit = await createUnit(property.id);
      const rent = await createRent(unit.id, tenant.id);
      const invoice = await createInvoice({
        rentId: rent.id,
        amount: 80_000,
        type: InvoiceType.RENT,
        status: InvoiceStatus.UNPAID,
      });

      const tenantCookie = await authCookie(tenant.id, tenant.role);
      const landlordCookie = await authCookie(landlord.id, landlord.role);

      const submissionRes = await apiFetch('/api/v1/bank-transfers', {
        method: 'POST',
        cookie: tenantCookie,
        body: {
          invoiceId: invoice.id,
          amount: 80_000,
          bankName: 'UBA',
          senderAccountName: 'Tenant UBA',
          referenceNumber: 'UBA-REF-404',
          paymentDate: new Date().toISOString(),
        },
      });
      const submissionId = submissionRes.body.data.id;

      // Reject without reason fails
      const noReason = await apiFetch(`/api/v1/bank-transfers/${submissionId}/reconcile`, {
        method: 'POST',
        cookie: landlordCookie,
        body: { action: 'REJECT' },
      });
      expect(noReason.status).toBe(400);

      // Reject with valid reason
      const rejectRes = await apiFetch(`/api/v1/bank-transfers/${submissionId}/reconcile`, {
        method: 'POST',
        cookie: landlordCookie,
        body: { action: 'REJECT', rejectionReason: 'Transfer not reflecting in bank statement' },
      });
      expect(rejectRes.status).toBe(200);

      const dbSub = await testPrisma.bankTransferSubmission.findUnique({
        where: { id: submissionId },
      });
      expect(dbSub?.status).toBe('REJECTED');
      expect(dbSub?.rejectionReason).toBe('Transfer not reflecting in bank statement');

      // Invoice remains UNPAID
      const dbInvoice = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(dbInvoice?.status).toBe('UNPAID');
    });
  });

  describe('Part 2: Vendor Payouts Flow', () => {
    it('manages complete vendor payout lifecycle: initiate, approve, and process disbursement', async () => {
      const admin = await createUser(Role.ADMIN);
      const landlord = await createUser(Role.LANDLORD);
      const manager = await createUser(Role.MANAGER);
      const vendor = await createUser(Role.VENDOR);
      const tenant = await createUser(Role.TENANT);

      // Create vendor bank account
      const bankAccount = await createBankAccount(vendor.id, {
        accountNumber: '2049182341',
        bankCode: '057',
        bankName: 'Zenith Bank',
        accountName: 'Reliable Plumbers Ltd',
      });

      const property = await createProperty({
        landlordId: landlord.id,
        managerId: manager.id,
      });
      const unit = await createUnit(property.id);
      const maintenanceRequest = await createMaintenanceRequest(unit.id, tenant.id, {
        vendorId: vendor.id,
        title: 'Emergency Pipe Repair',
      });

      const invoice = await createInvoice({
        maintenanceRequestId: maintenanceRequest.id,
        amount: 45_000,
        type: InvoiceType.MAINTENANCE,
        status: InvoiceStatus.PAID,
      });

      const managerCookie = await authCookie(manager.id, manager.role);
      const landlordCookie = await authCookie(landlord.id, landlord.role);
      const vendorCookie = await authCookie(vendor.id, vendor.role);
      const adminCookie = await authCookie(admin.id, admin.role);

      // 1. Manager initiates payout -> starts PENDING_APPROVAL
      const initRes = await apiFetch('/api/v1/vendor-payouts', {
        method: 'POST',
        cookie: managerCookie,
        body: {
          vendorId: vendor.id,
          invoiceId: invoice.id,
          maintenanceRequestId: maintenanceRequest.id,
          amount: 45_000,
          bankAccountId: bankAccount.id,
          notes: 'Payout for completed pipe repair',
        },
      });
      expect(initRes.status).toBe(201);
      expect(initRes.body.data.status).toBe('PENDING_APPROVAL');
      expect(initRes.body.data.payoutNumber).toMatch(/^PO-[A-Z0-9]{8}$/);
      const payoutId = initRes.body.data.id;

      // 2. Vendor cannot approve or process their own payout
      const vendorTamper = await apiFetch(`/api/v1/vendor-payouts/${payoutId}`, {
        method: 'PATCH',
        cookie: vendorCookie,
        body: { action: 'APPROVE' },
      });
      expect(vendorTamper.status).toBe(403);

      // 3. Landlord approves payout
      const approveRes = await apiFetch(`/api/v1/vendor-payouts/${payoutId}`, {
        method: 'PATCH',
        cookie: landlordCookie,
        body: { action: 'APPROVE' },
      });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // 4. Manager processes payout (disbursement execution)
      const processRes = await apiFetch(`/api/v1/vendor-payouts/${payoutId}`, {
        method: 'PATCH',
        cookie: managerCookie,
        body: { action: 'PROCESS' },
      });
      expect(processRes.status).toBe(200);
      expect(processRes.body.data.status).toBe('COMPLETED');
      expect(processRes.body.data.reference).toMatch(/^TRF-MOCK-/);

      // 5. Vendor lists their payouts and sees completed payout
      const vendorList = await apiFetch('/api/v1/vendor-payouts', { cookie: vendorCookie });
      expect(vendorList.status).toBe(200);
      expect(vendorList.body.data.length).toBe(1);
      expect(vendorList.body.data[0].id).toBe(payoutId);
      expect(vendorList.body.data[0].status).toBe('COMPLETED');

      // Admin sees the payout in global listing
      const adminList = await apiFetch('/api/v1/vendor-payouts', { cookie: adminCookie });
      expect(adminList.status).toBe(200);
      expect(adminList.body.data.some((p: { id: string }) => p.id === payoutId)).toBe(true);

      // 6. Verify audit logs
      const completedAudit = await testPrisma.auditLog.findFirst({
        where: {
          entityType: 'VendorPayout',
          entityId: payoutId,
          action: 'VENDOR_PAYOUT_COMPLETED',
        },
      });
      expect(completedAudit).not.toBeNull();
    });

    it('enforces total payout limit against invoice amount', async () => {
      const landlord = await createUser(Role.LANDLORD);
      const vendor = await createUser(Role.VENDOR);
      const tenant = await createUser(Role.TENANT);
      await createBankAccount(vendor.id);

      const property = await createProperty({ landlordId: landlord.id });
      const unit = await createUnit(property.id);
      const mr = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
      const invoice = await createInvoice({
        maintenanceRequestId: mr.id,
        amount: 20_000,
        type: InvoiceType.MAINTENANCE,
        status: InvoiceStatus.PAID,
      });

      const landlordCookie = await authCookie(landlord.id, landlord.role);

      // Payout greater than invoice amount is rejected
      const excessive = await apiFetch('/api/v1/vendor-payouts', {
        method: 'POST',
        cookie: landlordCookie,
        body: {
          vendorId: vendor.id,
          invoiceId: invoice.id,
          amount: 25_000,
        },
      });
      expect(excessive.status).toBe(400);
      expect(excessive.body.error).toContain('cannot exceed invoice amount');
    });
  });
});
