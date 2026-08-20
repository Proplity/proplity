export const mockTenantDetails: Record<number, any> = {
  1: {
    id: 1,
    name: 'Adewale Johnson',
    email: 'adewale.j@email.com',
    phone: '+234 803 456 7890',
    property: 'Lekki Phase 1, Apt 203',
    rentAmount: 850000,
    rentStatus: 'paid',
    nextDue: 'Oct 15, 2026',
    leaseStart: 'Apr 15, 2026',
    leaseEnd: 'Apr 14, 2027',
    paymentHistory: 'Excellent',
    riskScore: 'low',
    emergencyContact: {
      name: 'Funmi Johnson',
      relationship: 'Spouse',
      phone: '+234 805 123 4567',
    },
    paymentRecords: [
      {
        date: 'Apr 15, 2026',
        amount: 850000,
        status: 'Paid',
        method: 'Bank Transfer',
      },
      {
        date: 'Apr 15, 2025',
        amount: 750000,
        status: 'Paid',
        method: 'Online Payment',
      },
      {
        date: 'Apr 15, 2024',
        amount: 700000,
        status: 'Paid',
        method: 'Bank Transfer',
      },
    ],
    maintenanceRequests: [
      {
        date: '2 weeks ago',
        issue: 'AC Servicing',
        status: 'Completed',
        priority: 'Medium',
      },
      {
        date: '1 month ago',
        issue: 'Leaking Faucet',
        status: 'Completed',
        priority: 'Low',
      },
      {
        date: '3 months ago',
        issue: 'Door Lock',
        status: 'Completed',
        priority: 'High',
      },
    ],
    documents: [
      { name: 'Lease Agreement 2026', date: 'Apr 15, 2026', type: 'PDF' },
      { name: 'ID Verification', date: 'Apr 10, 2026', type: 'PDF' },
      { name: 'Proof of Employment', date: 'Apr 10, 2026', type: 'PDF' },
    ],
    notes: [
      { date: 'Apr 20, 2026', note: 'Always pays on time, excellent tenant' },
      { date: 'Jun 15, 2025', note: 'Requested early lease renewal' },
    ],
  },
};
