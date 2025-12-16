'use client'

import { useState, useEffect } from 'react'
import ContentWrapper from '@/components/ContentWrapper' // Matching your component
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShieldAlert, CheckCircle, XCircle, Activity, ArrowLeft } from 'lucide-react'
import { createApiUrl } from '@/utils/apiConfig' // Matching your util
import Link from 'next/link'

interface LogUser {
  email: string
  name: string
  role: string
}

interface ActivityLog {
  id: string
  action: string
  status: string // Changed from literal type to string to be safe
  ipAddress: string
  createdAt: string
  user: LogUser | null
}

export default function SecurityDashboard() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState({ success: 0, failed: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('authToken')
      
      // Call the API
      const response = await fetch(createApiUrl('users/logs'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("🔥 DASHBOARD DATA RECEIVED:", data) // Check browser console for this!
        setLogs(data)

        // Calculate stats
        // Note: Backend sends "SUCCESS" or "FAILURE" (uppercase)
        const successCount = data.filter((l: ActivityLog) => l.status === 'SUCCESS').length
        const failedCount = data.filter((l: ActivityLog) => l.status === 'FAILURE').length
        
        setStats({ success: successCount, failed: failedCount })
      } else {
        console.error("Failed to fetch logs:", response.status)
      }
    } catch (error) {
      console.error("Error fetching security logs:", error)
    } finally {
      setLoading(false)
    }
  }
  const chartData = [
    { name: 'Successful Logins', count: stats.success, fill: '#22c55e' }, // Green
    { name: 'Failed Attempts', count: stats.failed, fill: '#ef4444' },    // Red
  ]

  return (
    <ContentWrapper>
      <div className="mb-8 flex items-center justify-between">
        <div>
           <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center mb-2">
             <ArrowLeft className="w-4 h-4 mr-1" /> Back to Property Admin
           </Link>
           <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="mr-3 text-teal-600 w-8 h-8" /> 
            Security & Activity Center
          </h1>
        </div>
        <button 
          onClick={fetchLogs} 
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm flex items-center"
        >
          <Activity className="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      ) : (
        <>
          {/* --- CHARTS & STATS SECTION --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-6 text-slate-700">Login Traffic Analysis</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex items-center">
                <div className="p-3 bg-white rounded-full mr-5 shadow-sm">
                  <XCircle className="text-red-600 w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-red-600 font-bold uppercase tracking-wide">Security Threats</p>
                  <p className="text-3xl font-extrabold text-slate-800">{stats.failed}</p>
                  <p className="text-xs text-red-500 mt-1">Failed login attempts detected</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex items-center">
                <div className="p-3 bg-white rounded-full mr-5 shadow-sm">
                  <CheckCircle className="text-green-600 w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-bold uppercase tracking-wide">Valid Sessions</p>
                  <p className="text-3xl font-extrabold text-slate-800">{stats.success}</p>
                  <p className="text-xs text-green-500 mt-1">Successful user authentications</p>
                </div>
              </div>
            </div>
          </div>

          {/* --- LOGS TABLE SECTION --- */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-700">Live System Activity Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 uppercase text-xs font-bold text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">User / Identity</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{log.action}</td>
                      <td className="px-6 py-4">
                        {log.user ? (
                          <div>
                            <p className="text-slate-900 font-medium">{log.user.name}</p>
                            <p className="text-xs text-slate-400">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unknown / Guest</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{log.ipAddress}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border
                          ${log.status === 'FAILURE' 
                            ? 'bg-red-50 text-red-700 border-red-100' 
                            : 'bg-green-50 text-green-700 border-green-100'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No activity logs found. Try logging in to generate data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ContentWrapper>
  )
}