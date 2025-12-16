'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore';

export default function MFAPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

 const setupMFA = async () => {
  setLoading(true);
  setMessage('');
  try {
    const token = localStorage.getItem('authToken'); // Get from your authStore storage

    if (!token) {
      setMessage('You must be logged in');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/mfa/setup', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,  // ← Critical line
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await res.json();

    if (res.ok) {
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setMessage('Scan the QR code with your authenticator app');
    } else {
      setMessage(data.message || data.error || 'Failed to setup MFA');
    }
  } catch (err) {
    console.error(err);
    setMessage('Network error – check console');
  }
  setLoading(false);
};

  const verifyMFA = async () => {
    setLoading(true);
    setMessage('');
    try {
     const authToken = localStorage.getItem('authToken');

    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`, // Use the renamed variable here
      },
    body: JSON.stringify({ token }),
  });
      const data = await res.json();
      if (res.ok) {
        setMessage('MFA enabled successfully!');
        setQrCode('');
        setToken('');
        window.location.reload();
      } else {
        setMessage(data.error || 'Invalid code');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  const disableMFA = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
  const res = await fetch('/api/auth/mfa/disable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
      if (res.ok) {
        setMessage('MFA disabled');
        setQrCode('');
      }
    } catch (err) {
      setMessage('Failed to disable');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Two-Factor Authentication</h1>

     <div className="bg-white shadow rounded-lg p-6">
        <p className="mb-6">
          Status: <strong className={user?.mfaEnabled ? 'text-green-600' : 'text-red-600'}>
            {user?.mfaEnabled ? 'Enabled' : 'Disabled'}
          </strong>
        </p>

        {!user?.mfaEnabled ? (
          <div>
            <button
              onClick={setupMFA}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Enable MFA'}
            </button>

            {qrCode && (
              <div className="mt-6">
                <p className="mb-4 font-medium">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                <img src={qrCode} alt="MFA QR Code" className="mx-auto border" />
                <p className="mt-4 text-sm text-gray-600">
                  Backup key: <code className="bg-gray-100 px-2 py-1 rounded">{secret}</code>
                </p>
                <div className="mt-6">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="px-4 py-2 border rounded mr-4"
                    maxLength={6}
                  />
                  <button
                    onClick={verifyMFA}
                    disabled={loading || token.length !== 6}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-green-600 font-medium mb-4">MFA is active – your account is protected!</p>
            <button
              onClick={disableMFA}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Disable MFA
            </button>
          </div>
        )}

        {message && (
          <p className={`mt-6 text-center font-medium ${message.includes('success') || message.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <button
          onClick={() => router.push('/account')}
          className="mt-8 text-blue-600 hover:underline"
        >
          ← Back to Account
        </button>
      </div>
    </div>
  );
} 