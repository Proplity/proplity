import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Shield,
  Zap,
  Car,
  Droplet,
  MapPin,
  Users,
  Building2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useActiveLease } from '@/hooks/useLeases';
import { useProperty } from '@/hooks/useProperties';

interface NeighbourhoodReportProps {
  onBack: () => void;
}

// Each section is a loosely-typed JSON blob (NeighbourhoodReport model,
// property.prisma) -- read fields defensively since nothing enforces their
// exact shape at the DB layer beyond "however it was entered".
type Section = Record<string, any>;

function num(section: Section | null, key: string): number | undefined {
  const v = section?.[key];
  return typeof v === 'number' ? v : undefined;
}

function getRatingColor(rating: number) {
  if (rating >= 8) return 'text-green-600 bg-green-50';
  if (rating >= 6) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

// Kept as an icon-per-item helper (present in the underlying seed comment
// as `[{name, available}]`) but the actual seeded JSON stores security
// features as a flat string[] -- every listed item is a present feature,
// there's no "unavailable" entry to render, so this always resolves true.
function getStatusIcon(available: boolean) {
  return available ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : (
    <XCircle className="h-4 w-4 text-red-600" />
  );
}

function toLabel(key: string) {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// The schema deliberately leaves each section's JSON shape unspecified
// ("however it was entered" -- property.prisma). The seeded data uses a
// different, sparser key set per property than any single fixed layout
// could assume (e.g. Highland Park's electricity has powerAvailabilityHours
// + gridType, Lekki Heights has neither) -- rendered generically here so
// every real key shows up instead of only ones a hardcoded layout guessed.
function renderFields(section: Section, exclude: string[]) {
  const entries = Object.entries(section).filter(
    ([key, value]) =>
      !exclude.includes(key) &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
  );
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="mb-1 text-sm text-gray-600">{toLabel(key)}</p>
          <p className="font-medium">
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function NeighbourhoodReport({ onBack }: NeighbourhoodReportProps) {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { data: lease, loading: leaseLoading } = useActiveLease();
  const propertyId = lease?.unit?.propertyId ?? null;
  const { data: property, loading: propertyLoading } = useProperty(propertyId);
  const report = property?.neighbourhoodReports[0] ?? null;

  const handleDownloadPDF = () => {
    if (!isPremiumUser) {
      setShowPaymentModal(true);
      return;
    }
    alert(
      'Downloading Neighbourhood Report as PDF...\n\nThis feature would generate a comprehensive PDF report with all the neighbourhood insights.',
    );
  };

  const handleUpgradeToPremium = () => {
    alert(
      'Redirecting to payment gateway...\n\nAfter successful payment, you will have unlimited access to neighbourhood reports and other premium features.',
    );
    setShowPaymentModal(false);
    setIsPremiumUser(true);
  };

  if (leaseLoading || propertyLoading) {
    return <div className="p-6 text-gray-500">Loading your neighbourhood report…</div>;
  }

  if (!lease) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <button onClick={onBack} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-gray-500">You need an active lease to view a neighbourhood report.</p>
      </div>
    );
  }

  const security = (report?.security ?? null) as Section | null;
  const electricity = (report?.electricity ?? null) as Section | null;
  const roadNetwork = (report?.roadNetwork ?? null) as Section | null;
  const flooding = (report?.flooding ?? null) as Section | null;
  const amenities = (report?.amenities ?? null) as Section | null;
  const demographics = (report?.demographics ?? null) as Section | null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-lg p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">Neighbourhood Report</h1>
            <p className="text-gray-600">Comprehensive insights about your area</p>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {/* Premium Service Banner -- Subscription model exists in the schema
          but isn't wired to any real gating (CLAUDE.md: "not in the PRD,
          confirm with product before building"), so this stays local demo
          state exactly as before, not backed by a real entitlement check. */}
      {!isPremiumUser && (
        <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold">Premium Service</h3>
                <p className="mb-3 text-gray-600">
                  Neighbourhood Reports are a premium feature. Upgrade now to access detailed
                  insights about security, infrastructure, and amenities in your area.
                </p>
                <ul className="mb-4 space-y-1 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Unlimited report generation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    PDF download capability
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Monthly updated data
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Historical trend analysis
                  </li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="rounded-lg bg-purple-600 px-6 py-3 font-medium whitespace-nowrap text-white hover:bg-purple-700"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}

      {!report ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
          No neighbourhood report has been generated for your property yet.
        </div>
      ) : (
        <>
          {/* Report Header */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {property?.address}, {property?.city}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Generated on {new Date(report.generatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {isPremiumUser && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                  Premium Report
                </span>
              )}
            </div>
          </div>

          {/* Security Section */}
          {security && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Security Assessment</h3>
                      <p className="text-sm text-gray-600">Safety and security infrastructure</p>
                    </div>
                  </div>
                  {num(security, 'rating') !== undefined && (
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(num(security, 'rating')!)}`}
                      >
                        <span className="text-2xl font-semibold">{security.rating}</span>
                        <span className="text-sm">/10</span>
                      </div>
                      {security.status && (
                        <p className="mt-1 text-sm text-gray-600">{security.status}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {Array.isArray(security.features) && security.features.length > 0 && (
                    <div>
                      <h4 className="mb-3 font-medium">Security Features</h4>
                      <div className="space-y-2">
                        {security.features.map((feature: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            {getStatusIcon(true)}
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    {renderFields(security, ['rating', 'status', 'notes', 'features'])}
                  </div>
                </div>
                {security.notes && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                      <p className="text-sm text-gray-700">{security.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Electricity Section */}
          {electricity && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
                      <Zap className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Electricity & Power Supply</h3>
                      <p className="text-sm text-gray-600">Power reliability and infrastructure</p>
                    </div>
                  </div>
                  {num(electricity, 'rating') !== undefined && (
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(num(electricity, 'rating')!)}`}
                      >
                        <span className="text-2xl font-semibold">{electricity.rating}</span>
                        <span className="text-sm">/10</span>
                      </div>
                      {electricity.status && (
                        <p className="mt-1 text-sm text-gray-600">{electricity.status}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  {renderFields(electricity, ['rating', 'status', 'notes'])}
                </div>
                {electricity.notes && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                      <p className="text-sm text-gray-700">{electricity.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Road Network Section */}
          {roadNetwork && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                      <Car className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Road Network & Transportation</h3>
                      <p className="text-sm text-gray-600">Infrastructure and connectivity</p>
                    </div>
                  </div>
                  {num(roadNetwork, 'rating') !== undefined && (
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(num(roadNetwork, 'rating')!)}`}
                      >
                        <span className="text-2xl font-semibold">{roadNetwork.rating}</span>
                        <span className="text-sm">/10</span>
                      </div>
                      {roadNetwork.status && (
                        <p className="mt-1 text-sm text-gray-600">{roadNetwork.status}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  {renderFields(roadNetwork, ['rating', 'status', 'notes'])}
                </div>
                {roadNetwork.notes && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                      <p className="text-sm text-gray-700">{roadNetwork.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flooding Risk Section */}
          {flooding && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <Droplet className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Flooding Risk Assessment</h3>
                      <p className="text-sm text-gray-600">Drainage and flood history</p>
                    </div>
                  </div>
                  {num(flooding, 'rating') !== undefined && (
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(num(flooding, 'rating')!)}`}
                      >
                        <span className="text-2xl font-semibold">{flooding.rating}</span>
                        <span className="text-sm">/10</span>
                      </div>
                      {flooding.status && (
                        <p className="mt-1 text-sm text-gray-600">{flooding.status}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  {renderFields(flooding, [
                    'rating',
                    'status',
                    'notes',
                    'historicalFlooding',
                    'mitigationMeasures',
                  ])}
                </div>

                {Array.isArray(flooding.historicalFlooding) &&
                  flooding.historicalFlooding.length > 0 && (
                    <div className="mb-6">
                      <h4 className="mb-3 font-medium">Historical Flooding Events</h4>
                      <div className="space-y-2">
                        {flooding.historicalFlooding.map(
                          (
                            event: { year: string | number; severity: string; duration: string },
                            index: number,
                          ) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                <span className="font-medium">{event.year}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{event.severity} flooding</p>
                                <p className="text-xs text-gray-600">Duration: {event.duration}</p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {Array.isArray(flooding.mitigationMeasures) &&
                  flooding.mitigationMeasures.length > 0 && (
                    <div className="mb-6">
                      <h4 className="mb-3 font-medium">Mitigation Measures in Place</h4>
                      <div className="space-y-2">
                        {flooding.mitigationMeasures.map((measure: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{measure}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {flooding.notes && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                      <p className="text-sm text-gray-700">{flooding.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amenities & Services Section */}
          {amenities && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                    <Building2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Nearby Amenities & Services</h3>
                    <p className="text-sm text-gray-600">Essential facilities and services</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    ['Schools', amenities.schools, 'bg-blue-600'],
                    ['Healthcare', amenities.hospitals, 'bg-red-600'],
                    ['Shopping Centers', amenities.shopping, 'bg-green-600'],
                    ['Recreation', amenities.recreation, 'bg-purple-600'],
                  ]
                    .filter(([, list]) => Array.isArray(list) && (list as string[]).length > 0)
                    .map(([label, list, dot]) => (
                      <div key={label as string}>
                        <h4 className="mb-3 font-medium">{label}</h4>
                        <ul className="space-y-2">
                          {(list as string[]).map((item, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <div className={`h-1.5 w-1.5 rounded-full ${dot}`}></div>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Demographics Section */}
          {demographics && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Community Demographics</h3>
                    <p className="text-sm text-gray-600">Neighbourhood profile and lifestyle</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    ['Population Density', demographics.population],
                    ['Average Age Range', demographics.averageAge],
                    ['Family Friendliness', demographics.familyFriendly],
                    ['Expat Community', demographics.expatCommunity],
                    ['Noise Level', demographics.noiseLevel],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <p className="mb-1 text-sm text-gray-600">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-600">
              This report is generated based on data collected from various sources and user
              feedback. Information is subject to change and should be verified independently.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Last updated: {new Date(report.generatedAt).toLocaleDateString()} | © 2026 ProplityTMS
            </p>
          </div>
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-semibold">Upgrade to Premium</h3>
            <p className="mb-6 text-gray-600">
              Get unlimited access to neighbourhood reports and other premium features for only{' '}
              <span className="font-semibold text-blue-600">₦2,500/month</span>.
            </p>

            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <h4 className="mb-3 font-medium">Premium Features Include:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Unlimited neighbourhood reports
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  PDF download capability
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Monthly updated data
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Historical trend analysis
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Priority customer support
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Maybe Later
              </button>
              <button
                onClick={handleUpgradeToPremium}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
