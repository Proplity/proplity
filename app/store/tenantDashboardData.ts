export const mockTenantPaymentHistory = [
  { date: 'Apr 15, 2026', amount: '₦850,000', status: 'Paid' },
  { date: 'Apr 15, 2025', amount: '₦750,000', status: 'Paid' },
];

export const mockTenantMaintenanceRequests = [
  {
    title: 'AC Maintenance',
    status: 'Completed',
    date: '3 days ago',
    color: 'green',
  },
  {
    title: 'Bathroom Faucet Leak',
    status: 'In Progress',
    date: '1 week ago',
    color: 'blue',
  },
];

export const mockTenantAccessCodes = [
  { name: 'Main Gate', code: '#1234', expires: 'No expiry' },
  { name: 'Parking Garage', code: '#5678', expires: 'No expiry' },
  {
    name: 'Gym Access',
    code: '#9012',
    expires: 'Active until lease end',
  },
];

export const mockTenantDocuments = [
  { name: 'Lease Agreement', date: 'Apr 15, 2026' },
  { name: 'Receipt - Apr 2026', date: 'Apr 15, 2026' },
  { name: 'Move-in Checklist', date: 'Apr 14, 2026' },
];
