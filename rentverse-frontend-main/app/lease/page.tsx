'use client';

import { useState, useRef, useEffect } from 'react';
// 1. Import necessary React types for the assertion
import type { ComponentType, RefAttributes } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import useAuthStore from '@/stores/authStore';

// 2. Import the types from the library
import type ReactSignatureCanvas from 'react-signature-canvas';
import type { SignatureCanvasProps } from 'react-signature-canvas';

// 3. Define the combined type for the component (Props + Ref)
type CanvasComponent = ComponentType<
  SignatureCanvasProps & RefAttributes<ReactSignatureCanvas>
>;

// 4. Use Type Assertion (as ...) to force the correct type
const SignatureCanvasComponent = dynamic(
  () => import('react-signature-canvas').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
        Loading signature pad...
      </div>
    ),
  }
) as CanvasComponent;

export default function LeaseSignPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoggedIn } = useAuthStore();

  // 5. Initialize Ref with | null to satisfy strict null checks
  const sigPad = useRef<ReactSignatureCanvas | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/auth/login');
    }
  }, [isLoggedIn, router]);

  const clear = () => {
    sigPad.current?.clear();
    setIsEmpty(true);
    setMessage('');
  };

  const handleSignatureChange = () => {
    if (sigPad.current) {
      setIsEmpty(sigPad.current.isEmpty());
    }
  };

  const saveSignature = async () => {
    if (!params.id) {
      setMessage('Lease ID is missing');
      return;
    }

    if (isEmpty || !sigPad.current) {
      setMessage('Please provide a signature first');
      return;
    }

    setLoading(true);
    setMessage('');

    const signatureData = sigPad.current.getTrimmedCanvas().toDataURL('image/png');

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setMessage('Authentication required');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/leases/${params.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ signature: signatureData }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Signature submitted successfully!');
        setTimeout(() => router.push(`/leases/${params.id}`), 1500);
      } else {
        setMessage(data.message || 'Failed to save signature');
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error');
    }
    setLoading(false);
  };

  if (!isLoggedIn) {
    return <div className="p-8 text-center">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Sign Rental Agreement
        </h1>

        <div className="bg-white rounded-xl shadow-xl p-8">
          <p className="text-lg text-gray-700 mb-6">
            Hello <span className="font-semibold text-blue-600">{user?.name || user?.email}</span>,<br />
            Please sign inside the box below.
          </p>

          <div className="border-4 border-gray-200 rounded-xl overflow-hidden bg-white mb-6 relative">
            {/* The component now correctly accepts penColor and ref */}
            <SignatureCanvasComponent
              penColor="black"
              backgroundColor="white"
              canvasProps={{
                className: 'w-full h-[300px] cursor-crosshair',
              }}
              ref={sigPad}
              onEnd={handleSignatureChange}
            />

            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-gray-300 opacity-50">
                  SIGN HERE
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between mb-8">
            <button
              onClick={clear}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>

            <button
              onClick={saveSignature}
              disabled={loading || isEmpty}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Signature'}
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg text-center font-medium text-lg ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}

          <div className="mt-8 text-center">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 underline">
              Cancel & Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}