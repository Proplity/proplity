import { useState } from 'react';
import { ArrowLeft, CreditCard, Lock, CheckCircle, AlertCircle, X } from 'lucide-react';
import { LogoIcon } from './Logo';
import { useCheckoutSubscription } from '@/hooks/useSubscription';
import { usePayInvoice } from '@/hooks/useInvoices';
import { useMySubscription } from '@/hooks/useSubscription';

interface CheckoutProps {
  plan: {
    tier: 'FREE' | 'PRO';
    name: string;
    price: string;
    units: string;
    features: string[];
  };
  onBack: () => void;
  onComplete: () => void;
}

interface DowngradeConfirmModalProps {
  paidUntil: Date;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function DowngradeConfirmModal({
  paidUntil,
  onConfirm,
  onCancel,
  isLoading = false,
}: DowngradeConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
          <AlertCircle className="h-6 w-6 text-amber-600" />
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Confirm Subscription Downgrade
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          You have already paid for your current subscription until{' '}
          <span className="font-semibold text-gray-900">
            {paidUntil.toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </span>
          .
        </p>
        <div className="mb-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p>
            • Switching to <strong>Free</strong> keeps your current plan active until the end of your billing period.
          </p>
          <p>
            • Your account will not be billed again, and will transition to Free on {paidUntil.toLocaleDateString(undefined, { dateStyle: 'medium' })}.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Keep My Plan
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            {isLoading ? 'Downgrading…' : 'Confirm Downgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Checkout({ plan, onBack, onComplete }: CheckoutProps) {
  const [step, setStep] = useState(1);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: '',
    cardName: '',
    billingAddress: '',
    city: '',
    state: '',
    agreeToTerms: false,
  });
  const {
    submit: checkoutSubscription,
    submitting: checkingOut,
    error: checkoutError,
  } = useCheckoutSubscription();
  const { submit: payInvoice, submitting: paying, error: payError } = usePayInvoice();
  const { data: currentPlan } = useMySubscription();

  const executeCheckout = async (confirmedDowngrade = false) => {
    try {
      const result = await checkoutSubscription({
        tier: plan.tier,
        billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
        ...(confirmedDowngrade ? { confirmDowngrade: true } : {}),
      });

      if ('activated' in result) {
        // Free plan -- nothing to pay, show the in-app success screen.
        setStep(2);
        setTimeout(() => onComplete(), 2000);
        return;
      }

      // Paid plan -- redirect to Paystack's real hosted checkout. There is
      // no in-app "success" screen for this path: success only happens once
      // Paystack redirects back after a real charge, confirmed server-side
      // by the webhook (see payments/webhook/route.ts), not by this form.
      const { authorizationUrl } = await payInvoice(result.invoiceId);
      window.location.href = authorizationUrl;
    } catch {
      // error state is already surfaced via the hooks' `error`
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Switching to Free while a paid period is still running keeps the paid plan
    // until that period ends; ask first so nobody thinks it stops today.
    const paidUntil = currentPlan?.currentPeriodEnd ? new Date(currentPlan.currentPeriodEnd) : null;
    const downgrading =
      plan.tier === 'FREE' && currentPlan?.tier !== 'FREE' && !!paidUntil && paidUntil > new Date();
    if (downgrading) {
      setShowDowngradeModal(true);
      return;
    }
    await executeCheckout(false);
  };

  const calculatePrice = () => {
    const monthlyPrice = parseInt(plan.price.replace(/[^0-9]/g, '')) || 0;
    if (billingCycle === 'yearly') {
      return monthlyPrice * 12 * 0.85; // 15% discount for yearly
    }
    return monthlyPrice;
  };

  if (step === 2) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 via-white to-green-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Payment Successful!</h2>
            <p className="mb-6 text-gray-600">
              Welcome to Proplity {plan.name}! Your account is being set up.
            </p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                We&apos;ve sent a confirmation email to <strong>{formData.email}</strong>
              </p>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              You&apos;ll be redirected to your dashboard in a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Plans
          </button>
          <div className="flex items-center gap-3">
            <LogoIcon size={40} />
            <h1 className="text-2xl font-bold">Complete Your Purchase</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Information */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold">Account Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@company.com"
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Company/Business Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Your Company Ltd"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Payment Information</h2>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Lock className="h-4 w-4" />
                    Secure Payment
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Card Number *
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cardNumber: e.target.value,
                          })
                        }
                        placeholder="1234 5678 9012 3456"
                        required
                        className="w-full rounded-lg border border-gray-300 py-2.5 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Expiry Date *
                      </label>
                      <input
                        type="text"
                        value={formData.cardExpiry}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cardExpiry: e.target.value,
                          })
                        }
                        placeholder="MM/YY"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">CVC *</label>
                      <input
                        type="text"
                        value={formData.cardCVC}
                        onChange={(e) => setFormData({ ...formData, cardCVC: e.target.value })}
                        placeholder="123"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Cardholder Name *
                    </label>
                    <input
                      type="text"
                      value={formData.cardName}
                      onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold">Billing Address</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={formData.billingAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingAddress: e.target.value,
                        })
                      }
                      placeholder="123 Main Street"
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">City *</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Lagos"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        State *
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="Lagos"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  required
                />
                <span className="ml-2 text-sm text-gray-700">
                  I agree to the{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700">
                    Terms of Service
                  </a>{' '}
                  and understand that my subscription will auto-renew unless cancelled.
                </span>
              </label>

              {(checkoutError || payError) && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {checkoutError || payError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!formData.agreeToTerms || checkingOut || paying}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock className="h-5 w-5" />
                {paying
                  ? 'Redirecting to Paystack…'
                  : checkingOut
                    ? 'Processing…'
                    : 'Complete Purchase'}
              </button>

              <p className="text-center text-xs text-gray-500">
                Your payment is secured with 256-bit SSL encryption
              </p>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

              <div className="mb-4">
                <p className="text-lg font-medium">{plan.name} Plan</p>
                <p className="text-sm text-gray-600">{plan.units}</p>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="mb-4 rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-sm font-medium">Billing Cycle</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                      billingCycle === 'monthly'
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                      billingCycle === 'yearly'
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    Yearly
                    <span className="mt-0.5 block text-xs opacity-80">Save 15%</span>
                  </button>
                </div>
              </div>

              {/* Features List */}
              <div className="mb-4 border-b border-gray-200 pb-4">
                <p className="mb-2 text-sm font-medium">Included Features:</p>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price Breakdown */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₦{calculatePrice().toLocaleString()}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>Yearly Discount (15%)</span>
                    <span>
                      -₦
                      {(parseInt(plan.price.replace(/[^0-9]/g, '')) * 12 * 0.15).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">VAT (7.5%)</span>
                  <span className="font-medium">
                    ₦{(calculatePrice() * 0.075).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">Total Due Today</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₦{(calculatePrice() * 1.075).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Billed {billingCycle === 'yearly' ? 'annually' : 'monthly'}
                </p>
              </div>

              {/* Money-back Guarantee */}
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-medium text-green-800">✓ 14-day money-back guarantee</p>
                <p className="mt-1 text-xs text-green-700">Cancel anytime. No questions asked.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDowngradeModal && currentPlan?.currentPeriodEnd && (
        <DowngradeConfirmModal
          paidUntil={new Date(currentPlan.currentPeriodEnd)}
          onConfirm={async () => {
            setShowDowngradeModal(false);
            await executeCheckout(true);
          }}
          onCancel={() => setShowDowngradeModal(false)}
          isLoading={checkingOut}
        />
      )}
    </div>
  );
}
