import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Square,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  Edit,
  CheckCircle,
  Star,
  Zap,
  Droplet,
  Shield,
  TrendingUp,
} from 'lucide-react';

interface PropertyDetailProps {
  propertyId: number;
  onBack: () => void;
  onNavigate?: (page: any) => void;
}

export function PropertyDetail({ propertyId, onBack, onNavigate }: PropertyDetailProps) {
  // Mock property data - in real app, fetch based on propertyId
  const property = {
    id: propertyId,
    title: '3 Bedroom Luxury Apartment',
    address: 'Block 15, Flat 203, Lekki Phase 1',
    city: 'Lagos',
    state: 'Lagos',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1200,
    rentAmount: 850000,
    rentFrequency: 'yearly',
    status: propertyId === 1 ? 'Available' : 'Occupied', // Property 1 is available for demo
    trustScore: 95,
    verified: true,
    currentTenant: {
      name: 'Adewale Johnson',
      email: 'adewale.j@email.com',
      phone: '+234 803 456 7890',
      moveInDate: 'Apr 15, 2026',
      leaseEnd: 'Apr 14, 2027',
      rentStatus: 'Paid',
      paymentHistory: 'Excellent',
    },
    amenities: ['24/7 Power Supply', 'Borehole', 'Security/CCTV', 'Parking Space', 'Generator'],
    utilities: ['Water Included'],
    description:
      'Beautiful 3-bedroom apartment in the heart of Lekki Phase 1. Features modern finishes, spacious rooms, and excellent security. Close to schools, shopping centers, and major roads.',
    neighborhood: {
      safety: 9,
      accessibility: 8,
      powerReliability: 7,
      waterSupply: 9,
    },
    maintenanceHistory: [
      {
        date: '2 weeks ago',
        issue: 'AC Servicing',
        cost: '₦15,000',
        status: 'Completed',
      },
      {
        date: '1 month ago',
        issue: 'Plumbing Repair',
        cost: '₦8,000',
        status: 'Completed',
      },
      {
        date: '3 months ago',
        issue: 'Painting Touch-up',
        cost: '₦12,000',
        status: 'Completed',
      },
    ],
    financials: {
      yearlyRent: 850000,
      collected: 850000,
      pending: 0,
      maintenanceCosts: 35000,
      netIncome: 815000,
    },
  };

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-semibold">{property.title}</h1>
            <div className="mb-2 flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                {property.address}, {property.city}, {property.state}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {property.verified && (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                <Shield className="h-4 w-4" />
                AI Verified
              </div>
            )}
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                property.status === 'Occupied'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {property.status}
            </span>
            <button className="rounded-lg p-2 hover:bg-gray-100">
              <Edit className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Property Stats */}
        <div className="mb-4 grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{property.bedrooms} Bedrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{property.bathrooms} Bathrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{property.sqft} sq ft</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-600">
              ₦{property.rentAmount.toLocaleString()}/{property.rentFrequency}
            </span>
          </div>
        </div>

        {/* Trust Score */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <span className="text-lg font-bold text-green-600">{property.trustScore}</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trust Score</p>
                <p className="text-sm font-medium text-green-600">Excellent Rating</p>
              </div>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>

          {/* Action Buttons for Tenants */}
          {onNavigate && property.status === 'Available' && (
            <div className="flex gap-3">
              <button
                onClick={() =>
                  onNavigate({
                    type: 'schedule-viewing',
                    propertyId: property.id,
                    propertyTitle: property.title,
                    propertyAddress: `${property.address}, ${property.city}`,
                  })
                }
                className="rounded-lg border-2 border-blue-600 px-6 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              >
                Schedule Viewing
              </button>
              <button
                onClick={() =>
                  onNavigate({
                    type: 'property-application',
                    propertyId: property.id,
                    propertyTitle: property.title,
                    propertyPrice: `₦${property.rentAmount.toLocaleString()}/${property.rentFrequency}`,
                  })
                }
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
          {/* Current Tenant */}
          {property.currentTenant && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Current Tenant</h2>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">
                      {property.currentTenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{property.currentTenant.name}</p>
                      <p className="text-sm text-gray-600">{property.currentTenant.email}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      property.currentTenant.rentStatus === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {property.currentTenant.rentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-medium">{property.currentTenant.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Move-in Date</p>
                    <p className="font-medium">{property.currentTenant.moveInDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Lease End</p>
                    <p className="font-medium">{property.currentTenant.leaseEnd}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Payment History</p>
                    <p className="font-medium text-green-600">
                      {property.currentTenant.paymentHistory}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <Phone className="h-4 w-4" />
                    Call
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Description</h2>
            <p className="text-gray-700">{property.description}</p>
          </div>

          {/* Amenities */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Amenities & Features</h2>
            <div className="grid grid-cols-2 gap-3">
              {property.amenities.map((amenity, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm">{amenity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Neighborhood Intelligence */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Neighborhood Intelligence</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Safety Rating</span>
                  </div>
                  <span className="text-sm font-semibold">{property.neighborhood.safety}/10</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${property.neighborhood.safety * 10}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Accessibility</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {property.neighborhood.accessibility}/10
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${property.neighborhood.accessibility * 10}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Power Reliability</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {property.neighborhood.powerReliability}/10
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-yellow-500"
                    style={{
                      width: `${property.neighborhood.powerReliability * 10}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Water Supply</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {property.neighborhood.waterSupply}/10
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${property.neighborhood.waterSupply * 10}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Financial Summary</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-sm text-gray-600">Yearly Rent</span>
                <span className="font-semibold">
                  ₦{property.financials.yearlyRent.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-sm text-gray-600">Collected</span>
                <span className="font-semibold text-green-600">
                  ₦{property.financials.collected.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-semibold">
                  ₦{property.financials.pending.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-sm text-gray-600">Maintenance Costs</span>
                <span className="font-semibold text-red-600">
                  ₦{property.financials.maintenanceCosts.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold">Net Income</span>
                <span className="font-bold text-green-600">
                  ₦{property.financials.netIncome.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Maintenance History */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Recent Maintenance</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {property.maintenanceHistory.map((item, index) => (
                <div key={index} className="p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-medium">{item.issue}</p>
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{item.date}</span>
                    <span className="font-medium">{item.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Schedule Inspection
              </button>
              <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Generate Report
              </button>
              <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Documents
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
