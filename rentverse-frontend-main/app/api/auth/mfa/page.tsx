'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore'; // default import

export default function MFASetup() {
  const { user, isLoggedIn, logout } = useAuthStore();
  const router = useRouter();

  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'setup' | 'enabled'>('idle');

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/auth/login');
    } else if (user?.mfaEnabled) {
      setStatus('enabled');
    }
  }, [isLoggedIn, user, router]);

  const setupMFA = async () => {
    setLoading(true);
    setMessage('');
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        setMessage('Authentication token missing. Please log in again.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/mfa/setup', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (res.ok) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setStatus('setup');
        setMessage('Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)');
      } else {
        setMessage(data.message || data.error || 'Failed to generate QR code');
      }
    } catch (err) {
      console.error('Setup MFA error:', err);
      setMessage('Network error. Check console.');
    }
    setLoading(false);
  };

 const verifyMFA = async () => {
  if (token.length !== 6) {
    setMessage('Enter a valid 6-digit code');
    return;
  }

  setLoading(true);
  setMessage('');

  try {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      setMessage('Not logged in');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage('MFA enabled successfully!');
      // Refresh user or redirect
      window.location.reload();
    } else {
      setMessage(data.message || 'Invalid code');
    }
  } catch (err) {
    setMessage('Network error');
  }

  setLoading(false);
};

  const disableMFA = async () => {
    setLoading(true);
    setMessage('');
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        setMessage('MFA disabled successfully');
        setStatus('idle');
        window.location.reload();
      } else {
        setMessage('Failed to disable MFA');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  if (!isLoggedIn) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Two-Factor Authentication (MFA)</h1>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <p className="text-lg">
            Status: <strong className={status === 'enabled' ? 'text-green-600' : 'text-orange-600'}>
              {status === 'enabled' ? 'Enabled' : 'Disabled'}
            </strong>
          </p>
        </div>

        {status === 'idle' && (
          <div>
            <p className="mb-6 text-gray-700">
              Add an extra layer of security to your account with MFA.
            </p>
            <button
              onClick={setupMFA}
              disabled={loading}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Enable MFA'}
            </button>
          </div>
        )}

        {status === 'setup' && (
          <div>
            <p className="mb-6 font-medium">1. Scan this QR code with your authenticator app:</p>
            {qrCode && (
              <div className="mb-8 text-center">
                <img src={qrCode} alt="MFA QR Code" className="mx-auto border-4 border-gray-300 rounded-lg" />
                <p className="mt-4 text-sm text-gray-600">
                  Can't scan? Use this backup key: <code className="bg-gray-100 px-2 py-1 rounded">{secret}</code>
                </p>
              </div>
            )}

            <p className="mb-4 font-medium">2. Enter the 6-digit code from your app:</p>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="px-4 py-3 text-xl text-center border rounded-lg w-48"
              />
              <button
                onClick={verifyMFA}
                disabled={loading || token.length !== 6}
                className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        )}

        {status === 'enabled' && (
          <div>
            <p className="text-green-600 font-medium mb-6">
              MFA is active – your account is protected with two-factor authentication!
            </p>
            <button
              onClick={disableMFA}
              disabled={loading}
              className="px-8 py-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
            >
              Disable MFA
            </button>
          </div>
        )}

        {message && (
          <p className={`mt-8 text-center text-lg font-medium ${message.includes('success') || message.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <div className="mt-10 text-center">
          <button
            onClick={() => router.push('/account')}
            className="text-blue-600 hover:underline"
          >
            ← Back to Account
          </button>
        </div>
      </div>
    </div>
  );
}