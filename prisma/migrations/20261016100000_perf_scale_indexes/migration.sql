-- Performance and 100k+ Units Scaling Indexes (ISS-030)

-- CreateIndex on Property for published catalog discovery
CREATE INDEX "Property_isPublished_createdAt_idx" ON "Property"("isPublished", "createdAt" DESC);

-- CreateIndex on Property for duplicate merge resolution
CREATE INDEX "Property_mergedIntoId_idx" ON "Property"("mergedIntoId");

-- CreateIndex on Unit for foreign key lookups and filtering
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");
CREATE INDEX "Unit_status_idx" ON "Unit"("status");
CREATE INDEX "Unit_rentAmount_idx" ON "Unit"("rentAmount");

-- CreateIndex on Lease for active unit tenancy queries
CREATE INDEX "Lease_unitId_status_idx" ON "Lease"("unitId", "status");
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");

-- CreateIndex on Invoice for overdue and lease billing
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_leaseId_idx" ON "Invoice"("leaseId");

-- CreateIndex on Payment for invoice settlement lookups
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
