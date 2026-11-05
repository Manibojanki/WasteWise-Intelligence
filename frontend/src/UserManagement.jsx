
import { useCallback, useEffect, useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [selectedRoles, setSelectedRoles] = useState({})

  let currentUser = null

  try {
    currentUser = JSON.parse(
      sessionStorage.getItem('wastewise_user') || 'null'
    )
  } catch {
    currentUser = null
  }

  const getHeaders = () => {
    const token = sessionStorage.getItem('wastewise_token')

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json()
      return data.detail || data.message || 'Something went wrong.'
    } catch {
      return `Request failed with status ${response.status}.`
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: getHeaders()
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data = await response.json()
      setUsers(Array.isArray(data) ? data : data.users || [])

      const roles = {}
      const userList = Array.isArray(data) ? data : data.users || []

      userList.forEach((user) => {
        roles[user.id] = user.role
      })

      setSelectedRoles(roles)
    } catch (err) {
      setError(err.message || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const updateRole = async (user) => {
    const newRole = selectedRoles[user.id]

    if (!newRole || newRole === user.role) {
      setMessage('')
      return
    }

    if (user.id === currentUser?.id) {
      setError('You cannot change your own role.')
      return
    }

    setUpdatingId(user.id)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${user.id}/role`,
        {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ role: newRole })
        }
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      setMessage(`Role updated successfully for ${user.username}.`)
      await fetchUsers()
    } catch (err) {
      setError(err.message || 'Unable to update role.')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      setError('You cannot deactivate your own account.')
      return
    }

    const newStatus = !user.is_active

    setUpdatingId(user.id)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${user.id}/status`,
        {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ is_active: newStatus })
        }
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      setMessage(
        `${user.username} has been ${newStatus ? 'activated' : 'deactivated'}.`
      )

      await fetchUsers()
    } catch (err) {
      setError(err.message || 'Unable to update account status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="panel" style={{ marginTop: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '18px'
        }}
      >
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2 style={{ margin: '4px 0' }}>User Management</h2>
          <p style={{ margin: 0, color: '#718078', fontSize: '14px' }}>
            Manage registered accounts, roles and access.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={fetchUsers}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Users'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {message && (
        <div
          className="success-tag"
          style={{ display: 'block', marginBottom: '14px' }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading registered users...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No registered users found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '720px'
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #dce5dc' }}>
                {['User', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(
                  (heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: '12px 10px',
                        color: '#718078',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUser?.id
                const isUpdating = updatingId === user.id

                return (
                  <tr
                    key={user.id}
                    style={{ borderBottom: '1px solid #edf1eb' }}
                  >
                    <td style={{ padding: '14px 10px' }}>
                      <strong>{user.username}</strong>
                      {isCurrentUser && (
                        <div style={{ fontSize: '11px', color: '#718078' }}>
                          You
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#89958e' }}>
                        ID: {user.id}
                      </div>
                    </td>

                    <td style={{ padding: '14px 10px', fontSize: '13px' }}>
                      {user.email}
                    </td>

                    <td style={{ padding: '14px 10px' }}>
                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        <select
                          value={selectedRoles[user.id] || user.role}
                          disabled={isCurrentUser || isUpdating}
                          onChange={(event) =>
                            setSelectedRoles((previous) => ({
                              ...previous,
                              [user.id]: event.target.value
                            }))
                          }
                          style={{
                            padding: '7px',
                            borderRadius: '7px',
                            border: '1px solid #d5dfd5',
                            background: '#fff',
                            color: '#26382e'
                          }}
                        >
                          <option value="user">User</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>

                        {!isCurrentUser &&
                          selectedRoles[user.id] !== user.role && (
                            <button
                              className="secondary-button"
                              disabled={isUpdating}
                              onClick={() => updateRole(user)}
                            >
                              Save
                            </button>
                          )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 10px' }}>
                      <span
                        className={user.is_active ? 'success-tag' : 'review-tag'}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 10px', fontSize: '12px' }}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : '—'}
                    </td>

                    <td style={{ padding: '14px 10px' }}>
                      <button
                        className="secondary-button"
                        disabled={isCurrentUser || isUpdating}
                        onClick={() => toggleStatus(user)}
                      >
                        {isUpdating
                          ? 'Updating...'
                          : user.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: '#718078', fontSize: '12px', marginTop: '16px' }}>
        Role and account status changes take effect immediately. The backend
        protects the current administrator and the last active administrator.
      </p>
    </section>
  )
}

export default UserManagement
