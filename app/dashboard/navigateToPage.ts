export type Page =
  | { type: 'dashboard' }
  | { type: 'discover' }
  | { type: 'tenants' }
  | { type: 'maintenance' }
  | { type: 'list-property' }
  | { type: 'property-detail'; propertyId: string }
  | { type: 'tenant-detail'; leaseId: string }
  | { type: 'maintenance-detail'; requestId: string }
  | { type: 'maintenance-request-form' }
  | { type: 'property-application'; propertyId: string }
  | { type: 'schedule-viewing'; propertyId: string }
  | { type: 'messages' }
  | { type: 'vendor-jobs' }
  | { type: 'vendor-invoices' }
  | { type: 'vendor-job-detail'; jobId: string }
  | { type: 'vendor-create-invoice'; jobId: string }
  | { type: 'add-tenant' }
  | { type: 'payment-history' }
  | { type: 'landlord-features' }
  | { type: 'tenant-features' }
  | { type: 'vendor-features' }
  | { type: 'tenant-maintenance' }
  | { type: 'neighbourhood-report' }
  | { type: 'breakdown'; breakdownType: string }
  | { type: 'admin-breakdown'; breakdownType: string }
  | { type: 'reports' };

interface RouterLike {
  push: (href: string) => void;
}

/**
 * Central mapping from the old in-memory Page union (App.tsx's former
 * client-side router) to real routes. Passed as the `onNavigate` handler
 * to every dashboard/board component so none of their internals had to
 * change during the pages-separation migration.
 */
export function navigateToPage(router: RouterLike, page: Page) {
  switch (page.type) {
    case 'dashboard':
      router.push('/dashboard');
      return;
    case 'discover':
      router.push('/dashboard/discover');
      return;
    case 'tenants':
      router.push('/dashboard/tenants');
      return;
    case 'maintenance':
      router.push('/dashboard/maintenance');
      return;
    case 'list-property':
      router.push('/dashboard/properties/new');
      return;
    case 'property-detail':
      router.push(`/dashboard/properties/${page.propertyId}`);
      return;
    case 'tenant-detail':
      router.push(`/dashboard/tenants/${page.leaseId}`);
      return;
    case 'maintenance-detail':
      router.push(`/dashboard/maintenance/${page.requestId}`);
      return;
    case 'maintenance-request-form':
      router.push('/dashboard/maintenance-request/new');
      return;
    case 'property-application':
      router.push(`/dashboard/properties/${page.propertyId}/apply`);
      return;
    case 'schedule-viewing':
      router.push(`/dashboard/properties/${page.propertyId}/schedule-viewing`);
      return;
    case 'messages':
      router.push('/dashboard/messages');
      return;
    case 'vendor-jobs':
    case 'vendor-invoices':
      // Both variants render the same VendorDashboard content today (see
      // App.tsx's pre-migration comment "Can create separate invoices page
      // later") — collapsed into one route rather than propagating the dup.
      router.push('/dashboard');
      return;
    case 'vendor-job-detail':
      router.push(`/dashboard/vendor/jobs/${page.jobId}`);
      return;
    case 'vendor-create-invoice':
      router.push(`/dashboard/vendor/jobs/${page.jobId}/invoice`);
      return;
    case 'add-tenant':
      router.push('/dashboard/tenants/add');
      return;
    case 'payment-history':
      router.push('/dashboard/payment-history');
      return;
    case 'tenant-maintenance':
      router.push('/dashboard/tenant-maintenance');
      return;
    case 'neighbourhood-report':
      router.push('/dashboard/neighbourhood-report');
      return;
    case 'breakdown':
      router.push(`/dashboard/breakdown/${page.breakdownType}`);
      return;
    case 'admin-breakdown':
      router.push(`/admin/breakdown/${page.breakdownType}`);
      return;
    case 'reports':
      router.push('/admin/reports');
      return;
    case 'landlord-features':
      router.push('/for-landlords');
      return;
    case 'tenant-features':
      router.push('/for-tenants');
      return;
    case 'vendor-features':
      router.push('/for-vendors');
      return;
  }
}
