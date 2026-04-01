'use client'

import { useEffect, useState } from 'react'

const ROLES = ['superadmin', 'admin', 'staff']

const ROLE_COLORS = {
  superadmin: 'bg-purple-900/60 text-purple-300 border-purple-700',
  admin: 'bg-violet-900/60 text-violet-300 border-violet-700',
  staff: 'bg-gray-800 text-gray-300 border-gray-700',
}

function RoleBadge({ role }) {
  const cls = ROLE_COLORS[role] || 'bg-gray-800 text-gray-300 border-gray-700'
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {role}
    </span>
  )
}

export default function AdminUsersClient({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'staff' })

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setUsers(json.users)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setForm({ email: '', name: '', password: '', role: 'staff' })
      setShowCreate(false)
      await fetchUsers()
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: json.user.role } : u))
    } catch (e) {
      alert('Failed to update role: ' + e.message)
    }
  }

  async function handleToggleDisabled(userId, currentDisabled) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentDisabled }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, disabled: json.user.disabled } : u))
    } catch (e) {
      alert('Failed to update user: ' + e.message)
    }
  }

  const isSuperadmin = currentUser?.role === 'superadmin'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-white"
            style={{ borderLeft: '3px solid #AE2BCF', paddingLeft: '12px' }}
          >
            👥 User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1 pl-4">
            Manage team access and roles · Admin-only
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreateError(null) }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
          style={{ backgroundColor: '#731494', border: '1px solid #AE2BCF' }}
        >
          {showCreate ? '✕ Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Create User Form */}
      {showCreate && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <h2 className="text-white font-semibold">Create New User</h2>
          {createError && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2 text-red-300 text-sm">
              ⚠️ {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-black/40 border border-[#2a1a3e] focus:outline-none focus:border-violet-500"
                placeholder="user@growyourcenter.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-black/40 border border-[#2a1a3e] focus:outline-none focus:border-violet-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Temporary Password *</label>
              <input
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-black/40 border border-[#2a1a3e] focus:outline-none focus:border-violet-500"
                placeholder="GYC2026!"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-black/40 border border-[#2a1a3e] focus:outline-none focus:border-violet-500"
              >
                {isSuperadmin && <option value="superadmin">superadmin</option>}
                <option value="admin">admin</option>
                <option value="staff">staff</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
                style={{ backgroundColor: '#731494' }}
              >
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 gap-3">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Loading users…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                <th className="text-left px-5 py-3 text-gray-500 text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-gray-500 text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 text-xs uppercase tracking-wider">Created</th>
                <th className="text-right px-5 py-3 text-gray-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1a0a2e' }} className="hover:bg-white/5 transition">
                    <td className="px-5 py-3">
                      <div className="text-white font-medium">{u.name || '—'}</div>
                      <div className="text-gray-500 text-xs">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      {isSelf ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="rounded px-2 py-1 text-xs text-white bg-black/60 border border-[#2a1a3e] focus:outline-none focus:border-violet-500"
                        >
                          {isSuperadmin && <option value="superadmin">superadmin</option>}
                          <option value="admin">admin</option>
                          <option value="staff">staff</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {u.disabled ? (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded border bg-red-950 text-red-400 border-red-800">
                          Disabled
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded border bg-green-950 text-green-400 border-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleDisabled(u.id, u.disabled)}
                          className={`text-xs px-3 py-1 rounded border transition ${
                            u.disabled
                              ? 'border-green-700 text-green-400 hover:bg-green-900/30'
                              : 'border-red-800 text-red-400 hover:bg-red-900/30'
                          }`}
                        >
                          {u.disabled ? 'Enable' : 'Disable'}
                        </button>
                      )}
                      {isSelf && (
                        <span className="text-xs text-gray-600">you</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-gray-600 text-xs pb-4">
        Role definitions: <strong className="text-gray-500">superadmin</strong> → full access (Todd only) ·{' '}
        <strong className="text-gray-500">admin</strong> → full access (leadership team) ·{' '}
        <strong className="text-gray-500">staff</strong> → all pages except Finance/Churn/Dunning/Leadership
      </p>
    </div>
  )
}
