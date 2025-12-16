'use client';

import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useRouter } from 'next/navigation';

export default function SignLeasePage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sigPad = useRef<SignatureCanvas>(null);
  const router = useRouter();
  const leaseId = params.id;

  // Clear the signature pad
  const clearSignature = () => {
    sigPad.current?.clear();
    setError('');
  };

  // Submit the signature
  const saveSignature = async () => {
    // 1. Validation: Check if empty
    if (sigPad.current?.isEmpty()) {
      setError('Please provide a signature before submitting.');
      return;
    }

    setLoading(true);
    setError('');

    // 2. Get the signature as a Base64 image string
    const signatureData = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');

    try {
      // 3. Send to your Next.js API Route (The "Messenger")
      const res = await fetch(`/api/leases/${params.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature: signatureData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to sign lease');
      }

      // 4. Success! Redirect user back to the lease details
      alert('Lease signed successfully!');
      router.push(`/leases/${leaseId}`); // Or wherever you want them to go
      router.refresh();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Sign Lease Agreement</h1>
      <p className="text-gray-600 mb-6">
        Please sign in the box below to finalize your lease agreement.
      </p>

      {/* Error Message Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Signature Canvas Container */}
      <div className="border-2 border-gray-300 rounded-lg mb-4 bg-white">
        <SignatureCanvas
          ref={sigPad}
          penColor="black"
          canvasProps={{
            className: 'signature-canvas w-full h-64 rounded-lg cursor-crosshair',
            style: { width: '100%', height: '250px' } 
          }}
          backgroundColor="rgb(249, 250, 251)" // Light gray background
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <button
          onClick={clearSignature}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          Clear
        </button>
        
        <button
          onClick={saveSignature}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Confirm & Sign Lease'}
        </button>
      </div>
    </div>
  );
}