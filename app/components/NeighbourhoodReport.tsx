import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Shield,
  Zap,
  Car,
  Droplet,
  MapPin,
  TrendingUp,
  Users,
  Building2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { mockReportData as reportData } from '../store/mockData';

interface NeighbourhoodReportProps {
  onBack: () => void;
}

export function NeighbourhoodReport({ onBack }: NeighbourhoodReportProps) {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleGenerateReport = () => {
    if (!isPremiumUser) {
      setShowPaymentModal(true);
    }
  };

  const handleDownloadPDF = () => {
    if (!isPremiumUser) {
      setShowPaymentModal(true);
      return;
    }

    // In a real implementation, this would generate a PDF
    alert(
      'Downloading Neighbourhood Report as PDF...\n\nThis feature would generate a comprehensive PDF report with all the neighbourhood insights.',
    );
  };

  const handleUpgradeToPremium = () => {
    // In a real implementation, this would redirect to payment
    alert(
      'Redirecting to payment gateway...\n\nAfter successful payment, you will have unlimited access to neighbourhood reports and other premium features.',
    );
    setShowPaymentModal(false);
    setIsPremiumUser(true); // Simulate successful payment
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600 bg-green-50';
    if (rating >= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusIcon = (available: boolean) => {
    return available ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

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

      {/* Premium Service Banner */}
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

      {/* Report Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{reportData.location}</h2>
              <p className="text-sm text-gray-600">Generated on {reportData.generatedDate}</p>
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
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(reportData.security.rating)}`}
              >
                <span className="text-2xl font-semibold">{reportData.security.rating}</span>
                <span className="text-sm">/10</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{reportData.security.status}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-medium">Security Features</h4>
              <div className="space-y-2">
                {reportData.security.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {getStatusIcon(feature.available)}
                    <span className="text-sm">{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm text-gray-600">Crime Rate</p>
                <p className="font-medium">{reportData.security.crimeRate}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Police Presence</p>
                <p className="font-medium">{reportData.security.policePresence}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Emergency Response Time</p>
                <p className="font-medium">{reportData.security.emergencyResponse}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Recent Incidents (Last 6 months)</p>
                <p className="font-medium">
                  {reportData.security.recentIncidents} reported incidents
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-700">{reportData.security.notes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Electricity Section */}
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
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(reportData.electricity.rating)}`}
              >
                <span className="text-2xl font-semibold">{reportData.electricity.rating}</span>
                <span className="text-sm">/10</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{reportData.electricity.status}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="mb-1 text-3xl font-semibold text-blue-600">
                {reportData.electricity.reliability}
              </p>
              <p className="text-sm text-gray-600">Reliability Rate</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="mb-1 text-3xl font-semibold text-blue-600">
                {reportData.electricity.averageHoursPerDay}
              </p>
              <p className="text-sm text-gray-600">Hours/Day</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="mb-1 text-3xl font-semibold text-blue-600">2-3</p>
              <p className="text-sm text-gray-600">Outages/Week</p>
            </div>
          </div>
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-gray-600">Alternative Power</p>
              <p className="font-medium">
                {reportData.electricity.alternativePower ? 'Available' : 'Not Available'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Generator Backup</p>
              <p className="font-medium">{reportData.electricity.generatorBackup}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Prepaid Meter</p>
              <p className="font-medium">{reportData.electricity.prepaidMeter ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Average Monthly Cost</p>
              <p className="font-medium">{reportData.electricity.averageMonthlyCost}</p>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-700">{reportData.electricity.notes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Road Network Section */}
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
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(reportData.roadNetwork.rating)}`}
              >
                <span className="text-2xl font-semibold">{reportData.roadNetwork.rating}</span>
                <span className="text-sm">/10</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{reportData.roadNetwork.status}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-gray-600">Main Road Condition</p>
              <p className="font-medium">{reportData.roadNetwork.mainRoadCondition}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Internal Roads Condition</p>
              <p className="font-medium">{reportData.roadNetwork.internalRoadsCondition}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Traffic Level</p>
              <p className="font-medium">{reportData.roadNetwork.trafficLevel}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Peak Hour Traffic</p>
              <p className="font-medium">{reportData.roadNetwork.peakHourTraffic}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Drainage</p>
              <p className="font-medium">{reportData.roadNetwork.drainage}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Street Lighting</p>
              <p className="font-medium">{reportData.roadNetwork.streetLighting}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Parking</p>
              <p className="font-medium">{reportData.roadNetwork.parking}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Public Transport</p>
              <p className="font-medium">{reportData.roadNetwork.publicTransport}</p>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-700">{reportData.roadNetwork.notes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flooding Risk Section */}
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
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${getRatingColor(reportData.flooding.rating)}`}
              >
                <span className="text-2xl font-semibold">{reportData.flooding.rating}</span>
                <span className="text-sm">/10</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{reportData.flooding.status}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-gray-600">Flood Prone Level</p>
              <p className="font-medium">{reportData.flooding.floodProne}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Rainy Season Risk</p>
              <p className="font-medium">{reportData.flooding.rainySeasonRisk}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Drainage System</p>
              <p className="font-medium">{reportData.flooding.drainageSystem}</p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="mb-3 font-medium">Historical Flooding Events</h4>
            <div className="space-y-2">
              {reportData.flooding.historicalFlooding.map((event, index) => (
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
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h4 className="mb-3 font-medium">Mitigation Measures in Place</h4>
            <div className="space-y-2">
              {reportData.flooding.mitigationMeasures.map((measure, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{measure}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 text-blue-600" />
              <p className="text-sm text-gray-700">{reportData.flooding.notes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Amenities & Services Section */}
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
            <div>
              <h4 className="mb-3 font-medium">Schools</h4>
              <ul className="space-y-2">
                {reportData.amenities.schools.map((school, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                    {school}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Healthcare</h4>
              <ul className="space-y-2">
                {reportData.amenities.hospitals.map((hospital, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                    {hospital}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Shopping Centers</h4>
              <ul className="space-y-2">
                {reportData.amenities.shopping.map((shop, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600"></div>
                    {shop}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Recreation</h4>
              <ul className="space-y-2">
                {reportData.amenities.recreation.map((rec, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-600"></div>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Demographics Section */}
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
            <div>
              <p className="mb-1 text-sm text-gray-600">Population Density</p>
              <p className="font-medium">{reportData.demographics.population}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Average Age Range</p>
              <p className="font-medium">{reportData.demographics.averageAge}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Family Friendliness</p>
              <p className="font-medium">{reportData.demographics.familyFriendly}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Expat Community</p>
              <p className="font-medium">{reportData.demographics.expatCommunity}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Noise Level</p>
              <p className="font-medium">{reportData.demographics.noiseLevel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          This report is generated based on data collected from various sources and user feedback.
          Information is subject to change and should be verified independently.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Last updated: {reportData.generatedDate} | © 2026 ProplityTMS
        </p>
      </div>

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
