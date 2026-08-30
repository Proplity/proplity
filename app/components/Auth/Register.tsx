import { useState } from 'react';
import { LogoIcon } from '../Logo';
import { useAuth } from '@/context/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  Building2,
  Home,
  Wrench,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Briefcase,
  MapPin,
  FileText,
  Shield,
  Star,
  ChevronDown,
} from 'lucide-react';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT - Abuja',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

const SERVICE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC / Air Conditioning',
  'Painting',
  'Carpentry & Joinery',
  'Tiling & Flooring',
  'Roofing',
  'Security Systems',
  'Generator & Power',
  'Cleaning & Sanitation',
  'Landscaping & Gardening',
  'Interior Design',
  'Building & Civil Works',
  'Pest Control',
  'Elevator Maintenance',
  'Other',
];

type UserType = 'manager' | 'landlord' | 'tenant' | 'vendor' | '';

interface BaseForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  state: string;
  agreeToTerms: boolean;
}

interface ManagerForm extends BaseForm {
  landlordCode: string;
  companyName: string;
  yearsExperience: string;
  propertiesManaged: string;
  nin: string;
}

interface LandlordForm extends BaseForm {
  companyName: string;
  nin: string;
  totalProperties: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface TenantForm extends BaseForm {
  occupation: string;
  employer: string;
}

interface VendorForm extends BaseForm {
  businessName: string;
  serviceCategory: string;
  otherCategory: string;
  yearsExperience: string;
  coverageStates: string[];
  cacNumber: string;
  bio: string;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserType>('');

  // --- Manager state ---
  const [managerForm, setManagerForm] = useState<ManagerForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    state: '',
    agreeToTerms: false,
    landlordCode: '',
    companyName: '',
    yearsExperience: '',
    propertiesManaged: '',
    nin: '',
  });
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [verifiedLandlord, setVerifiedLandlord] = useState<{
    name: string;
    properties: number;
  } | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- Landlord state ---
  const [landlordForm, setLandlordForm] = useState<LandlordForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    state: '',
    agreeToTerms: false,
    companyName: '',
    nin: '',
    totalProperties: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  // --- Tenant state ---
  const [tenantForm, setTenantForm] = useState<TenantForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    state: '',
    agreeToTerms: false,
    occupation: '',
    employer: '',
  });

  // --- Vendor state ---
  const [vendorForm, setVendorForm] = useState<VendorForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    state: '',
    agreeToTerms: false,
    businessName: '',
    serviceCategory: '',
    otherCategory: '',
    yearsExperience: '',
    coverageStates: [],
    cacNumber: '',
    bio: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // step labels per role
  const getSteps = () => {
    if (userType === 'manager') return ['Account Type', 'Landlord Code', 'Your Details'];
    if (userType === 'landlord') return ['Account Type', 'Your Details', 'Property & Banking'];
    if (userType === 'vendor') return ['Account Type', 'Your Details', 'Business Info'];
    return ['Account Type', 'Your Details'];
  };
  const steps = getSteps();
  const totalSteps = steps.length;

  const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
    setStep(2);
  };

  const verifyLandlordCode = async () => {
    setCodeStatus('checking');
    try {
      const res = await fetch(
        `/api/v1/manager-codes/check?code=${encodeURIComponent(managerForm.landlordCode.trim())}`,
      );
      const body = await res.json();
      if (res.ok && body.valid) {
        setCodeStatus('valid');
        setVerifiedLandlord({ name: body.landlord.name, properties: body.propertiesManaged });
      } else {
        setCodeStatus('invalid');
        setVerifiedLandlord(null);
      }
    } catch {
      setCodeStatus('invalid');
      setVerifiedLandlord(null);
    }
  };

  const { register } = useAuth();

  const handleSubmit = async () => {
    // basic validation
    const pwd =
      userType === 'manager'
        ? managerForm.password
        : userType === 'landlord'
          ? landlordForm.password
          : userType === 'tenant'
            ? tenantForm.password
            : vendorForm.password;
    const cpwd =
      userType === 'manager'
        ? managerForm.confirmPassword
        : userType === 'landlord'
          ? landlordForm.confirmPassword
          : userType === 'tenant'
            ? tenantForm.confirmPassword
            : vendorForm.confirmPassword;
    const terms =
      userType === 'manager'
        ? managerForm.agreeToTerms
        : userType === 'landlord'
          ? landlordForm.agreeToTerms
          : userType === 'tenant'
            ? tenantForm.agreeToTerms
            : vendorForm.agreeToTerms;

    if (pwd !== cpwd) {
      alert('Passwords do not match!');
      return;
    }
    if (!terms) {
      alert('Please agree to the Terms of Service');
      return;
    }

    const activeForm =
      userType === 'manager'
        ? managerForm
        : userType === 'landlord'
          ? landlordForm
          : userType === 'tenant'
            ? tenantForm
            : vendorForm;

    const name = `${activeForm.firstName} ${activeForm.lastName}`.trim() || 'User';
    setSubmitError(null);
    setSubmitting(true);
    const res = await register({
      email: activeForm.email,
      password: pwd,
      name,
      role: userType,
      landlordCode: userType === 'manager' ? managerForm.landlordCode : undefined,
    });
    setSubmitting(false);

    if (res.success) {
      // No session exists yet -- the account is PENDING_VERIFICATION until
      // the emailed link is used, so there's nowhere in the app to send
      // them (onRegister implies an active dashboard to land on). Show the
      // confirmation in place instead.
      setRegisteredEmail(activeForm.email);
    } else {
      setSubmitError(res.error || 'Registration failed');
    }
  };

  // ── shared input helpers ──────────────────────────────────────────────────
  const inputCls =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  const inputIconCls =
    'w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  const PasswordField = ({
    value,
    onChange,
    label,
    show,
    onToggle,
  }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
    show: boolean;
    onToggle: () => void;
  }) => (
    <div>
      <label className={labelCls}>{label} *</label>
      <div className="relative">
        <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 py-2.5 pr-10 pl-10 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const StateSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className={labelCls}>State *</label>
      <div className="relative">
        <MapPin className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pr-8 pl-10 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Select state</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );

  const TermsCheckbox = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">
        I agree to the{' '}
        <a href="#" className="text-blue-600 hover:underline">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="text-blue-600 hover:underline">
          Privacy Policy
        </a>
      </span>
    </label>
  );

  // ── Step indicator ────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="mb-7 flex items-center justify-center gap-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step >= n;
        const current = step === n;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                } ${current ? 'ring-4 ring-blue-100' : ''}`}
              >
                {step > n ? <CheckCircle className="h-4 w-4" /> : n}
              </div>
              <span
                className={`mt-1 text-xs font-medium whitespace-nowrap ${active ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 mb-4 h-1 w-14 rounded-full transition-colors ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const NavButtons = ({
    onNext,
    onBack,
    nextLabel = 'Continue',
    nextDisabled = false,
    isSubmit = false,
  }: {
    onNext?: () => void;
    onBack?: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
    isSubmit?: boolean;
  }) => (
    <div className="flex gap-3 pt-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <button
        type={isSubmit ? 'submit' : 'button'}
        onClick={!isSubmit ? onNext : undefined}
        disabled={nextDisabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  // ── STEP 1: choose role ───────────────────────────────────────────────────
  const userTypes = [
    {
      id: 'manager' as UserType,
      label: 'Property Manager',
      description: 'Manage properties on behalf of landlords',
      icon: Building2,
      color: 'blue',
      badge: 'PREMIUM',
    },
    {
      id: 'landlord' as UserType,
      label: 'Landlord',
      description: 'I own rental properties',
      icon: Home,
      color: 'purple',
      badge: 'PREMIUM',
    },
    {
      id: 'tenant' as UserType,
      label: 'Tenant',
      description: 'Looking for or currently renting a property',
      icon: User,
      color: 'green',
      badge: 'FREE',
    },
    {
      id: 'vendor' as UserType,
      label: 'Service Provider',
      description: 'I offer maintenance & property services',
      icon: Wrench,
      color: 'orange',
      badge: 'FREE',
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  if (registeredEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Check Your Email</h2>
            <p className="mb-6 text-gray-600">
              We've sent a verification link to <strong>{registeredEmail}</strong>. Click it to
              activate your account, then sign in.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mb-3 flex justify-center">
            <LogoIcon size={52} />
          </div>
          <h1 className="mb-1 text-2xl font-bold">Create Your Account</h1>
          <p className="text-sm text-gray-500">
            {step === 1
              ? 'Choose your account type to get started'
              : userType === 'manager' && step === 2
                ? 'Enter your landlord invitation code'
                : userType === 'vendor' && step === 3
                  ? 'Tell us about your services'
                  : userType === 'landlord' && step === 3
                    ? 'Property & banking details'
                    : 'Complete your profile'}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <StepIndicator />

          {submitError && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* ── STEP 1: Role selection ── */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="mb-5 text-center text-lg font-semibold">I want to register as a...</h2>
              {userTypes.map((type) => {
                const Icon = type.icon;
                const badgeColor =
                  type.badge === 'FREE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700';
                return (
                  <button
                    key={type.id}
                    onClick={() => handleUserTypeSelect(type.id)}
                    className="group w-full rounded-xl border-2 border-gray-200 p-5 text-left transition-all hover:border-blue-400 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${type.color}-100 transition-transform group-hover:scale-105`}
                        >
                          <Icon className={`h-6 w-6 text-${type.color}-600`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{type.label}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{type.description}</p>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeColor}`}
                      >
                        {type.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              PROPERTY MANAGER FLOW
          ════════════════════════════════════════════════════════════════ */}

          {/* Manager — Step 2: Landlord Code */}
          {userType === 'manager' && step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      Landlord Invitation Code Required
                    </p>
                    <p className="mt-0.5 text-xs text-blue-700">
                      To register as a Property Manager you need a unique code from the Landlord
                      you'll be working with. Ask your landlord to share their code from their
                      ProplityTMS dashboard.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Landlord Invitation Code *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={managerForm.landlordCode}
                      onChange={(e) => {
                        setManagerForm({
                          ...managerForm,
                          landlordCode: e.target.value,
                        });
                        setCodeStatus('idle');
                        setVerifiedLandlord(null);
                      }}
                      placeholder="e.g. LLD-2847-XK or DEMO-CODE"
                      className={`${inputIconCls} font-mono tracking-widest uppercase ${
                        codeStatus === 'valid'
                          ? 'border-green-500 bg-green-50'
                          : codeStatus === 'invalid'
                            ? 'border-red-400 bg-red-50'
                            : ''
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={verifyLandlordCode}
                    disabled={!managerForm.landlordCode.trim() || codeStatus === 'checking'}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {codeStatus === 'checking' ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>

                {/* code feedback */}
                {codeStatus === 'valid' && verifiedLandlord && (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Code verified!</p>
                      <p className="mt-0.5 text-xs text-green-700">
                        You will be linked to{' '}
                        <span className="font-semibold">{verifiedLandlord.name}</span> (
                        {verifiedLandlord.properties}{' '}
                        {verifiedLandlord.properties === 1 ? 'property' : 'properties'}
                        ). Access can be revoked by the landlord at any time.
                      </p>
                    </div>
                  </div>
                )}
                {codeStatus === 'invalid' && (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">
                        Invalid or deactivated code
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">
                        This code doesn't match any active landlord account. Check the code and try
                        again, or ask your landlord to generate a new one.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                <p className="font-semibold text-amber-900">How landlord codes work</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    Each landlord generates a unique code from their dashboard under{' '}
                    <span className="font-medium">Settings → Manager Access</span>.
                  </li>
                  <li>
                    The code links your account to their portfolio — you'll only manage their
                    properties.
                  </li>
                  <li>
                    The landlord can deactivate the code at any time, which revokes your access
                    immediately.
                  </li>
                  <li>A landlord can issue multiple codes for multiple managers.</li>
                </ul>
              </div>

              <NavButtons
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                nextDisabled={codeStatus !== 'valid'}
                nextLabel="Continue to Details"
              />
            </div>
          )}

          {/* Manager — Step 3: Personal & professional details */}
          {userType === 'manager' && step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                <p className="text-xs text-green-800">
                  Linked to <span className="font-semibold">{verifiedLandlord?.name}</span> · Code:{' '}
                  <span className="font-mono">{managerForm.landlordCode.toUpperCase()}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={managerForm.firstName}
                      onChange={(e) =>
                        setManagerForm({
                          ...managerForm,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="First name"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={managerForm.lastName}
                    onChange={(e) =>
                      setManagerForm({
                        ...managerForm,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={managerForm.email}
                    onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                    placeholder="you@example.com"
                    className={inputIconCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      required
                      value={managerForm.phone}
                      onChange={(e) =>
                        setManagerForm({
                          ...managerForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+234 803 000 0000"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <StateSelect
                  value={managerForm.state}
                  onChange={(v) => setManagerForm({ ...managerForm, state: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Company / Agency Name</label>
                  <div className="relative">
                    <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={managerForm.companyName}
                      onChange={(e) =>
                        setManagerForm({
                          ...managerForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Optional"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Years of Experience</label>
                  <select
                    value={managerForm.yearsExperience}
                    onChange={(e) =>
                      setManagerForm({
                        ...managerForm,
                        yearsExperience: e.target.value,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    {['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years'].map(
                      (v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Properties Currently Managed</label>
                  <select
                    value={managerForm.propertiesManaged}
                    onChange={(e) =>
                      setManagerForm({
                        ...managerForm,
                        propertiesManaged: e.target.value,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    {['1–5', '6–15', '16–30', '31–50', '50+'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>NIN (National ID No.) *</label>
                  <div className="relative">
                    <Shield className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={managerForm.nin}
                      onChange={(e) => setManagerForm({ ...managerForm, nin: e.target.value })}
                      placeholder="12345678901"
                      maxLength={11}
                      className={inputIconCls}
                    />
                  </div>
                </div>
              </div>

              <PasswordField
                label="Password"
                value={managerForm.password}
                onChange={(v) => setManagerForm({ ...managerForm, password: v })}
                show={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
              />
              <PasswordField
                label="Confirm Password"
                value={managerForm.confirmPassword}
                onChange={(v) => setManagerForm({ ...managerForm, confirmPassword: v })}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((p) => !p)}
              />

              <TermsCheckbox
                checked={managerForm.agreeToTerms}
                onChange={(v) => setManagerForm({ ...managerForm, agreeToTerms: v })}
              />

              <NavButtons
                onBack={() => setStep(2)}
                isSubmit
                nextDisabled={submitting}
                nextLabel={submitting ? 'Creating Account…' : 'Create Account'}
              />
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════════
              LANDLORD FLOW
          ════════════════════════════════════════════════════════════════ */}

          {/* Landlord — Step 2: Personal details */}
          {userType === 'landlord' && step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(3);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={landlordForm.firstName}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="First name"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={landlordForm.lastName}
                    onChange={(e) =>
                      setLandlordForm({
                        ...landlordForm,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={landlordForm.email}
                    onChange={(e) =>
                      setLandlordForm({
                        ...landlordForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="you@example.com"
                    className={inputIconCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      required
                      value={landlordForm.phone}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+234 803 000 0000"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <StateSelect
                  value={landlordForm.state}
                  onChange={(v) => setLandlordForm({ ...landlordForm, state: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Company / Estate Name</label>
                  <div className="relative">
                    <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={landlordForm.companyName}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Optional"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>NIN (National ID No.) *</label>
                  <div className="relative">
                    <Shield className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={landlordForm.nin}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          nin: e.target.value,
                        })
                      }
                      placeholder="12345678901"
                      maxLength={11}
                      className={inputIconCls}
                    />
                  </div>
                </div>
              </div>

              <PasswordField
                label="Password"
                value={landlordForm.password}
                onChange={(v) => setLandlordForm({ ...landlordForm, password: v })}
                show={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
              />
              <PasswordField
                label="Confirm Password"
                value={landlordForm.confirmPassword}
                onChange={(v) => setLandlordForm({ ...landlordForm, confirmPassword: v })}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((p) => !p)}
              />

              <NavButtons onBack={() => setStep(1)} isSubmit nextLabel="Next: Property & Banking" />
            </form>
          )}

          {/* Landlord — Step 3: Property & banking */}
          {userType === 'landlord' && step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Total Properties Owned *</label>
                  <select
                    required
                    value={landlordForm.totalProperties}
                    onChange={(e) =>
                      setLandlordForm({
                        ...landlordForm,
                        totalProperties: e.target.value,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    {['1', '2–5', '6–10', '11–20', '20+'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <StateSelect
                  value={landlordForm.state}
                  onChange={(v) => setLandlordForm({ ...landlordForm, state: v })}
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Shield className="h-4 w-4 text-blue-500" /> Payout Bank Account
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Bank Name *</label>
                    <select
                      required
                      value={landlordForm.bankName}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          bankName: e.target.value,
                        })
                      }
                      className={inputCls}
                    >
                      <option value="">Select bank</option>
                      {[
                        'Access Bank',
                        'First Bank',
                        'GTBank',
                        'Zenith Bank',
                        'UBA',
                        'FCMB',
                        'Fidelity Bank',
                        'Stanbic IBTC',
                        'Sterling Bank',
                        'Union Bank',
                        'Wema Bank',
                        'Polaris Bank',
                        'Other',
                      ].map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Account Number *</label>
                    <input
                      type="text"
                      required
                      value={landlordForm.accountNumber}
                      onChange={(e) =>
                        setLandlordForm({
                          ...landlordForm,
                          accountNumber: e.target.value,
                        })
                      }
                      placeholder="10-digit account number"
                      maxLength={10}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Account Name *</label>
                  <input
                    type="text"
                    required
                    value={landlordForm.accountName}
                    onChange={(e) =>
                      setLandlordForm({
                        ...landlordForm,
                        accountName: e.target.value,
                      })
                    }
                    placeholder="Name as it appears on the account"
                    className={inputCls}
                  />
                </div>
              </div>

              <TermsCheckbox
                checked={landlordForm.agreeToTerms}
                onChange={(v) => setLandlordForm({ ...landlordForm, agreeToTerms: v })}
              />

              <NavButtons
                onBack={() => setStep(2)}
                isSubmit
                nextDisabled={submitting}
                nextLabel={submitting ? 'Creating Account…' : 'Create Account'}
              />
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════════
              TENANT FLOW  (single step)
          ════════════════════════════════════════════════════════════════ */}

          {userType === 'tenant' && step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={tenantForm.firstName}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="First name"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={tenantForm.lastName}
                    onChange={(e) => setTenantForm({ ...tenantForm, lastName: e.target.value })}
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={tenantForm.email}
                    onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                    placeholder="you@example.com"
                    className={inputIconCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      required
                      value={tenantForm.phone}
                      onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                      placeholder="+234 803 000 0000"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <StateSelect
                  value={tenantForm.state}
                  onChange={(v) => setTenantForm({ ...tenantForm, state: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Occupation</label>
                  <div className="relative">
                    <Briefcase className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={tenantForm.occupation}
                      onChange={(e) =>
                        setTenantForm({
                          ...tenantForm,
                          occupation: e.target.value,
                        })
                      }
                      placeholder="e.g. Software Engineer"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Employer / Business</label>
                  <input
                    type="text"
                    value={tenantForm.employer}
                    onChange={(e) => setTenantForm({ ...tenantForm, employer: e.target.value })}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </div>
              </div>

              <PasswordField
                label="Password"
                value={tenantForm.password}
                onChange={(v) => setTenantForm({ ...tenantForm, password: v })}
                show={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
              />
              <PasswordField
                label="Confirm Password"
                value={tenantForm.confirmPassword}
                onChange={(v) => setTenantForm({ ...tenantForm, confirmPassword: v })}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((p) => !p)}
              />

              <TermsCheckbox
                checked={tenantForm.agreeToTerms}
                onChange={(v) => setTenantForm({ ...tenantForm, agreeToTerms: v })}
              />

              <NavButtons
                onBack={() => setStep(1)}
                isSubmit
                nextDisabled={submitting}
                nextLabel={submitting ? 'Creating Account…' : 'Create Free Account'}
              />
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SERVICE PROVIDER FLOW
          ════════════════════════════════════════════════════════════════ */}

          {/* Vendor — Step 2: Personal details */}
          {userType === 'vendor' && step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(3);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={vendorForm.firstName}
                      onChange={(e) =>
                        setVendorForm({
                          ...vendorForm,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="First name"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={vendorForm.lastName}
                    onChange={(e) => setVendorForm({ ...vendorForm, lastName: e.target.value })}
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    placeholder="you@example.com"
                    className={inputIconCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      required
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      placeholder="+234 803 000 0000"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <StateSelect
                  value={vendorForm.state}
                  onChange={(v) => setVendorForm({ ...vendorForm, state: v })}
                />
              </div>

              <PasswordField
                label="Password"
                value={vendorForm.password}
                onChange={(v) => setVendorForm({ ...vendorForm, password: v })}
                show={showPassword}
                onToggle={() => setShowPassword((p) => !p)}
              />
              <PasswordField
                label="Confirm Password"
                value={vendorForm.confirmPassword}
                onChange={(v) => setVendorForm({ ...vendorForm, confirmPassword: v })}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((p) => !p)}
              />

              <NavButtons onBack={() => setStep(1)} isSubmit nextLabel="Next: Business Info" />
            </form>
          )}

          {/* Vendor — Step 3: Business details */}
          {userType === 'vendor' && step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Business / Trade Name *</label>
                  <div className="relative">
                    <Briefcase className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={vendorForm.businessName}
                      onChange={(e) =>
                        setVendorForm({
                          ...vendorForm,
                          businessName: e.target.value,
                        })
                      }
                      placeholder="e.g. AquaFix Plumbers"
                      className={inputIconCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Years in Business</label>
                  <select
                    value={vendorForm.yearsExperience}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        yearsExperience: e.target.value,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="">Select</option>
                    {['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years'].map(
                      (v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Service Category *</label>
                <div className="relative">
                  <Wrench className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    required
                    value={vendorForm.serviceCategory}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        serviceCategory: e.target.value,
                      })
                    }
                    className={`${inputIconCls} appearance-none`}
                  >
                    <option value="">Select your primary service</option>
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {vendorForm.serviceCategory === 'Other' && (
                <div>
                  <label className={labelCls}>Specify Service *</label>
                  <input
                    type="text"
                    required
                    value={vendorForm.otherCategory}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        otherCategory: e.target.value,
                      })
                    }
                    placeholder="Describe your service"
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>States You Cover *</label>
                <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-gray-300 p-3">
                  {NIGERIAN_STATES.map((s) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2 text-sm hover:text-blue-600"
                    >
                      <input
                        type="checkbox"
                        checked={vendorForm.coverageStates.includes(s)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...vendorForm.coverageStates, s]
                            : vendorForm.coverageStates.filter((x) => x !== s);
                          setVendorForm({
                            ...vendorForm,
                            coverageStates: updated,
                          });
                        }}
                        className="h-3.5 w-3.5 rounded text-blue-600"
                      />
                      {s}
                    </label>
                  ))}
                </div>
                {vendorForm.coverageStates.length > 0 && (
                  <p className="mt-1 text-xs text-blue-600">
                    {vendorForm.coverageStates.length} state
                    {vendorForm.coverageStates.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>CAC Registration Number</label>
                <div className="relative">
                  <FileText className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={vendorForm.cacNumber}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        cacNumber: e.target.value,
                      })
                    }
                    placeholder="RC-123456 (optional but builds trust)"
                    className={inputIconCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Short Bio / Service Description</label>
                <textarea
                  value={vendorForm.bio}
                  onChange={(e) => setVendorForm({ ...vendorForm, bio: e.target.value })}
                  placeholder="Briefly describe your services, experience and what sets you apart..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                <Star className="h-4 w-4 flex-shrink-0 text-orange-500" />
                Complete profiles with a CAC number and bio get{' '}
                <span className="ml-1 font-semibold">3× more job requests</span>.
              </div>

              <TermsCheckbox
                checked={vendorForm.agreeToTerms}
                onChange={(v) => setVendorForm({ ...vendorForm, agreeToTerms: v })}
              />

              <NavButtons
                onBack={() => setStep(2)}
                isSubmit
                nextDisabled={submitting}
                nextLabel={submitting ? 'Creating Account…' : 'Create Free Account'}
              />
            </form>
          )}

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
