import { useState } from 'react';
import { ArrowLeft, DollarSign, Plus, Trash2, FileText, Send } from 'lucide-react';
import {
  mockInvoiceJobDetails,
  mockInvoiceVendorInfo as vendorInfo,
} from '../store/mockData';

interface VendorCreateInvoiceProps {
  jobId: number;
  onBack: () => void;
}

export function VendorCreateInvoice({ jobId, onBack }: VendorCreateInvoiceProps) {
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      description: 'Labor Cost',
      quantity: 4,
      rate: 3000,
      amount: 12000,
    },
    {
      id: 2,
      description: 'PVC Pipe (2m)',
      quantity: 1,
      rate: 3000,
      amount: 3000,
    },
    {
      id: 3,
      description: 'Pipe Fittings',
      quantity: 2,
      rate: 750,
      amount: 1500,
    },
  ]);

  const jobDetails = {
    ...mockInvoiceJobDetails,
    jobId,
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now(), description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (id: number) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: number, field: string, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.075; // 7.5% VAT
  const total = subtotal + tax;

  const handleSubmit = () => {
    alert('Invoice submitted successfully! Payment will be processed within 48 hours.');
    onBack();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </button>

      <div className="rounded-lg border border-gray-200 bg-white p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">INVOICE</h1>
              <p className="text-sm text-gray-600">
                Invoice #INV-{jobId.toString().padStart(6, '0')}
              </p>
              <p className="text-sm text-gray-600">
                Date:{' '}
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-sm text-gray-600">Status</p>
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                Draft
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* From */}
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-600">FROM</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{vendorInfo.name}</p>
                <p className="text-gray-600">{vendorInfo.address}</p>
                <p className="text-gray-600">{vendorInfo.phone}</p>
                <p className="text-gray-600">{vendorInfo.email}</p>
                <p className="text-gray-600">RC: {vendorInfo.businessId}</p>
              </div>
            </div>

            {/* To */}
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-600">BILL TO</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{jobDetails.propertyManager}</p>
                <p className="text-gray-600">{jobDetails.property}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-sm font-semibold text-blue-900">Job Details</p>
          <p className="text-sm text-blue-800">
            {jobDetails.jobTitle} • Job #{jobDetails.jobId}
          </p>
          <p className="text-sm text-blue-800">Completed: {jobDetails.completedDate}</p>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Description
                  </th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Qty
                  </th>
                  <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Rate (₦)
                  </th>
                  <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Amount (₦)
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {item.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="rounded p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addLineItem}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Line Item
          </button>
        </div>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-80 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VAT (7.5%)</span>
              <span className="font-semibold">₦{tax.toLocaleString()}</span>
            </div>
            <div className="border-t-2 border-gray-300 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-green-600">₦{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="mb-8 rounded-lg bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold">Payment Details</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Bank Name</p>
              <p className="font-medium">{vendorInfo.bankName}</p>
            </div>
            <div>
              <p className="text-gray-600">Account Name</p>
              <p className="font-medium">{vendorInfo.accountName}</p>
            </div>
            <div>
              <p className="text-gray-600">Account Number</p>
              <p className="font-medium">{vendorInfo.accountNumber}</p>
            </div>
            <div>
              <p className="text-gray-600">Payment Terms</p>
              <p className="font-medium">Due upon receipt</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-8">
          <label className="mb-2 block text-sm font-semibold">Additional Notes</label>
          <textarea
            placeholder="Add any additional notes or payment instructions..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            <Send className="h-5 w-5" />
            Submit Invoice
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50">
            <FileText className="h-5 w-5" />
            Save as Draft
          </button>
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Once submitted, this invoice will be reviewed and payment will be
            processed within 48 hours to your registered bank account.
          </p>
        </div>
      </div>
    </div>
  );
}
