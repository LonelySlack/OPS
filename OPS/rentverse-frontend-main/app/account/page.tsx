'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore';  // ← Fixed: default import

export default function AccountPage() {
  const { user, isLoggedIn, logout } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/auth');
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, router]);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{user?.name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Role</p>
            <p className="font-medium capitalize">{user?.role || 'User'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{user?.phone || 'Not set'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Security</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Two-Factor Authentication (MFA)</p>
              <p className="text-sm text-gray-600">
                Add an extra layer of security to your account
              </p>
            </div>
            <button
              onClick={() => router.push('/account/mfa')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Manage MFA
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={logout}
          className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
} 