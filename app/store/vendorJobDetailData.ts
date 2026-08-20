export const mockVendorJobs: Record<number, any> = {
  1: {
    id: 1,
    title: 'Broken Water Pipe',
    description:
      'Main water pipe leaking in kitchen. Water is dripping from under the sink and needs urgent attention.',
    category: 'Plumbing',
    priority: 'high',
    status: 'in_progress',
    property: 'Lekki Phase 1, Apt 203',
    fullAddress: 'Block 15, Flat 203, Lekki Phase 1, Lagos',
    assignedDate: '2 hours ago',
    acceptedDate: '1.5 hours ago',
    estimatedPay: '₦20,000',
    propertyManager: {
      name: 'Proplity Management',
      phone: '+234 803 456 7890',
      email: 'manager@proplity.com',
    },
    tenant: {
      name: 'Adewale Johnson',
      phone: '+234 803 456 7890',
    },
    scheduledDate: 'Today, 2:00 PM',
    timeline: [
      {
        time: '2 hours ago',
        event: 'Job assigned to you',
        status: 'completed',
      },
      {
        time: '1.5 hours ago',
        event: 'You accepted the job',
        status: 'completed',
      },
      {
        time: '1 hour ago',
        event: 'En route to property',
        status: 'completed',
      },
      { time: 'Current', event: 'Work in progress', status: 'current' },
      { time: 'Pending', event: 'Mark as completed', status: 'pending' },
    ],
    materials: [
      { item: 'PVC Pipe (2m)', cost: 3000 },
      { item: 'Pipe Fittings', cost: 1500 },
      { item: 'Plumber Tape', cost: 500 },
    ],
  },
};
