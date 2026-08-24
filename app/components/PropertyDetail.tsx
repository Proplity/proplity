import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Square,
  DollarSign,
  User,
  Phone,
  Mail,
  CheckCircle,
  Zap,
  Droplet,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProperty } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useApplications, useReviewApplication } from '@/hooks/useApplications';
import type { Application } from '@/lib/api/types';

interface PropertyDetailProps {
  propertyId: string;
  onBack: () => void;
  onNavigate?: (page: any) => void;
}

const MANAGE_ROLES = ['manager', 'landlord', 'admin'];

function ApplicationRow({ application, onReviewed }: { application: Application; onReviewed: () => void }) {
  const { submit: review, submitting } = useReviewApplication(application.id);
  const details = application.details as Record<string, unknown>;
  const name = [details.firstName, details.lastName].filter(Boolean).join(' ') || 'Applicant';

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await review({ status });
      onReviewed();
    } catch {
      // errors are rare here (409 if already reviewed) -- refetch either way
      onReviewed();
    }
  };

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-gray-500">
            Unit {application.unit?.unitNumber} · {details.email as string}
          </p>
        </div>
        <span className="text-xs text-gray-400">{new Date(application.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleReview('APPROVED')}
          disabled={submitting}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          onClick={() => handleReview('REJECTED')}
          disabled={submitting}
          className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

export function PropertyDetail({ propertyId, onBack, onNavigate }: PropertyDetailProps) {
  const auth = useAuth();
  const { data: property, loading } = useProperty(propertyId);
  const { data: leases } = useLeases();
  const { data: invoices } = useInvoices();
  const { data: maintenanceRequests } = useMaintenanceRequests();
  const { data: pendingApplications, refetch: refetchApplications } = useApplications({ status: 'PENDING' });

  if (loading) {
    return <div className="p-6 text-gray-500">Loading property…</div>;
  }

  if (!property) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <p className="text-gray-500">Property not found.</p>
      </div>
    );
  }

  // Role + ownership gate: the underlying leases/invoices/maintenance hooks
  // are already server-scoped to the caller's own data, so a tenant Browse
  // this page never actually receives another tenant's records -- this gate
  // is what decides whether to *render* the manager-only sections at all.
  const canManage =
    !!auth.user &&
    MANAGE_ROLES.includes(auth.user.role) &&
    (auth.user.role === 'admin' || auth.user.id === property.managerId || auth.user.id === property.landlordId);

  const propertyLeases = leases.filter((l) => l.unit?.propertyId === propertyId);
  const propertyApplications = pendingApplications.filter((a) => a.unit?.property.id === propertyId);
  const propertyInvoices = invoices.filter((i) => i.lease?.unit.property.id === propertyId);
  const propertyMaintenance = maintenanceRequests
    .filter((r) => r.unit?.propertyId === propertyId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const collected = propertyInvoices.flatMap((i) => i.payments).reduce((sum, p) => sum + p.amount, 0);
  const pending = propertyInvoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)), 0);
  const maintenanceCosts = propertyMaintenance
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + (r.finalCost ?? 0), 0);
  const totalListedRent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);
  const netIncome = collected - maintenanceCosts;

  const amenities = Array.from(new Set(property.units.flatMap((u) => u.amenities)));
  const anyVacant = property.units.some((u) => u.status === 'VACANT');
  const verified = property.moderationStatus === 'APPROVED';
  const cheapestUnit = [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];

  const neighborhood = {
    safety: property.securityRating != null ? Math.round(property.securityRating / 10) : null,
    accessibility: property.roadConditionScore != null ? Math.round(property.roadConditionScore / 10) : null,
    powerReliability: property.powerReliabilityScore != null ? Math.round(property.powerReliabilityScore / 10) : null,
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-5 w-5" />
        Back
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-semibold">{property.name}</h1>
            <div className="mb-2 flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                {property.address}, {property.city}
                {property.state ? `, ${property.state}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {verified && (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                <Shield className="h-4 w-4" />
                AI Verified
              </div>
            )}
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                anyVacant ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {anyVacant ? 'Has Vacancy' : 'Fully Occupied'}
            </span>
          </div>
        </div>

        {/* Property Stats */}
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{cheapestUnit?.bedrooms ?? 0} Bedrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{cheapestUnit?.bathrooms ?? 0} Bathrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{cheapestUnit?.sqft ? `${cheapestUnit.sqft.toLocaleString()} sq ft` : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-600">
              ₦{(cheapestUnit?.rentAmount ?? 0).toLocaleString()}/{(cheapestUnit?.listedPaymentFrequency ?? 'year').toLowerCase()}
            </span>
          </div>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {property.units.length} unit{property.units.length === 1 ? '' : 's'} total ·{' '}
          {property.units.filter((u) => u.status === 'VACANT').length} vacant
        </p>

        {/* Trust Score */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <span className="text-lg font-bold text-green-600">{property.trustScore ?? '—'}</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Trust Score</p>
              <p className="text-sm font-medium text-green-600">
                {property.reviewStats.count > 0
                  ? `${property.reviewStats.averageRating?.toFixed(1)} avg (${property.reviewStats.count} reviews)`
                  : 'No reviews yet'}
              </p>
            </div>
          </div>

          {/* Action Buttons for Tenants browsing a vacant property */}
          {!canManage && onNavigate && anyVacant && (
            <div className="flex gap-3">
              <button
                onClick={() => onNavigate({ type: 'schedule-viewing', propertyId: property.id })}
                className="rounded-lg border-2 border-blue-600 px-6 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              >
                Schedule Viewing
              </button>
              <button
                onClick={() => onNavigate({ type: 'property-application', propertyId: property.id })}
                className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
              >
                Apply Now
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Units & Tenants -- manager/landlord/admin only */}
          {canManage && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Units & Tenants</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {property.units.map((unit) => {
                  const lease = propertyLeases.find((l) => l.unitId === unit.id && l.status === 'ACTIVE');
                  return (
                    <div key={unit.id} className="p-6">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-semibold">Unit {unit.unitNumber}</p>
                        <span className="text-xs text-gray-500">
                          {unit.bedrooms} bed · {unit.bathrooms} bath · ₦{unit.rentAmount.toLocaleString()}/
                          {unit.listedPaymentFrequency.toLowerCase()}
                        </span>
                      </div>
                      {lease && lease.tenant ? (
                        <>
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                                {lease.tenant.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{lease.tenant.name}</p>
                                <p className="text-sm text-gray-600">{lease.tenant.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => onNavigate?.({ type: 'tenant-detail', leaseId: lease.id })}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                            >
                              View Tenant
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Phone</p>
                              <p className="font-medium">{lease.tenant.phoneNumber ?? 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Lease End</p>
                              <p className="font-medium">{new Date(lease.endDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">
                          {unit.status === 'VACANT' ? 'Vacant' : `No active lease (${unit.status.toLowerCase()})`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rental Applications -- manager/landlord/admin only */}
          {canManage && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Rental Applications</h2>
                <p className="text-sm text-gray-500">Pending applications for units on this property</p>
              </div>
              <div className="divide-y divide-gray-200">
                {propertyApplications.map((application) => (
                  <ApplicationRow key={application.id} application={application} onReviewed={refetchApplications} />
                ))}
                {propertyApplications.length === 0 && (
                  <p className="p-6 text-sm text-gray-400">No pending applications.</p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {property.description && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 font-semibold">Description</h2>
              <p className="text-gray-700">{property.description}</p>
            </div>
          )}

          {/* Amenities */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Amenities & Features</h2>
            {amenities.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No amenities listed.</p>
            )}
          </div>

          {/* Neighborhood Intelligence */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Neighborhood Intelligence</h2>
            <div className="space-y-4">
              {(
                [
                  { label: 'Safety Rating', value: neighborhood.safety, Icon: Shield, color: 'bg-green-500' },
                  { label: 'Accessibility', value: neighborhood.accessibility, Icon: MapPin, color: 'bg-blue-500' },
                  { label: 'Power Reliability', value: neighborhood.powerReliability, Icon: Zap, color: 'bg-yellow-500' },
                ] as const
              ).map(
                ({ label, value, Icon, color }) =>
                  value != null && (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-600" />
                          <span className="text-sm">{label}</span>
                        </div>
                        <span className="text-sm font-semibold">{value}/10</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 10}%` }}></div>
                      </div>
                    </div>
                  ),
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Droplet className="h-4 w-4" />
                Water Supply: {property.waterSupplyType.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar -- manager/landlord/admin only */}
        {canManage && (
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold">Financial Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Total Listed Rent</span>
                  <span className="font-semibold">₦{totalListedRent.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Collected</span>
                  <span className="font-semibold text-green-600">₦{collected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="font-semibold">₦{pending.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Maintenance Costs</span>
                  <span className="font-semibold text-red-600">₦{maintenanceCosts.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold">Net Income</span>
                  <span className="font-bold text-green-600">₦{netIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Maintenance History */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Recent Maintenance</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {propertyMaintenance.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className="font-medium">
                        {item.finalCost != null ? `₦${item.finalCost.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
                {propertyMaintenance.length === 0 && (
                  <p className="p-4 text-sm text-gray-400">No maintenance history yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
