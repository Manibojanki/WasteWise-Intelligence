
import { useCallback, useEffect, useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

const CATEGORIES = [
  'cardboard',
  'glass',
  'metal',
  'paper',
  'plastic',
  'trash'
]

const initialForm = {
  category_code: 'plastic',
  locality_id: '',
  instruction_title: '',
  instruction_text: '',
  accepted_status: 'Unknown',
  preparation_advice: '',
  exceptions: '',
  source_name: '',
  source_url: '',
  effective_from: '',
  effective_to: ''
}

const inputStyle = {
  width: '100%',
  padding: 11,
  border: '1px solid #dce5d8',
  borderRadius: 9,
  background: '#fff',
  color: '#304b35',
  font: 'inherit',
  boxSizing: 'border-box'
}

const labelStyle = {
  display: 'grid',
  gap: 7,
  color: '#52644f',
  fontSize: 13,
  fontWeight: 600
}

function formatCategory(value) {
  return value
    ? value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Unknown'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not specified'
}

export default function Administration() {
  const [records, setRecords] = useState([])
  const [localities, setLocalities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [guidanceResponse, localityResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/guidance`),
        fetch(`${API_URL}/api/localities`)
      ])

      if (!guidanceResponse.ok) {
        throw new Error(
          guidanceResponse.status === 403
            ? 'Administrator access is required.'
            : 'Could not load guidance records.'
        )
      }

      if (!localityResponse.ok) {
        throw new Error('Could not load configured localities.')
      }

      const guidanceData = await guidanceResponse.json()
      const localityData = await localityResponse.json()

      setRecords(Array.isArray(guidanceData) ? guidanceData : [])
      setLocalities(Array.isArray(localityData) ? localityData : [])

      setForm(current => ({
        ...current,
        locality_id: current.locality_id ||
          String(localityData[0]?.id || '')
      }))
    } catch (err) {
      setError(err.message || 'Could not connect to the backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      ...initialForm,
      locality_id: String(localities[0]?.id || '')
    })
  }

  function editRecord(record) {
    setEditingId(record.id)

    setForm({
      category_code: record.category_code,
      locality_id: String(record.locality_id),
      instruction_title: record.instruction_title,
      instruction_text: record.instruction_text,
      accepted_status: record.accepted_status || 'Unknown',
      preparation_advice: record.preparation_advice || '',
      exceptions: record.exceptions || '',
      source_name: record.source_name || '',
      source_url: record.source_url || '',
      effective_from: record.effective_from
        ? record.effective_from.slice(0, 16)
        : '',
      effective_to: record.effective_to
        ? record.effective_to.slice(0, 16)
        : ''
    })

    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveGuidance(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const payload = {
      ...form,
      locality_id: Number(form.locality_id),
      effective_from: form.effective_from
        ? new Date(form.effective_from).toISOString()
        : null,
      effective_to: form.effective_to
        ? new Date(form.effective_to).toISOString()
        : null,
      preparation_advice: form.preparation_advice.trim() || null,
      exceptions: form.exceptions.trim() || null,
      source_name: form.source_name.trim() || null,
      source_url: form.source_url.trim() || null
    }

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/api/admin/guidance/${editingId}`
          : `${API_URL}/api/admin/guidance`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not save guidance.'
        )
      }

      setMessage(data.message || 'Guidance saved successfully.')
      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not save guidance.')
    } finally {
      setSaving(false)
    }
  }

  async function approveGuidance(record) {
    if (!window.confirm(
      `Approve guidance #${record.id} for ${formatCategory(record.category_code)}?`
    )) return

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/admin/guidance/${record.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewed_by: 'Administrator' })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not approve guidance.'
        )
      }

      setMessage(data.message)
      await loadData()
    } catch (err) {
      setError(err.message || 'Approval failed.')
    }
  }

  async function archiveGuidance(record) {
    if (!window.confirm(
      `Archive guidance #${record.id}? It will no longer appear in public guidance.`
    )) return

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/admin/guidance/${record.id}/archive`,
        { method: 'POST' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not archive guidance.'
        )
      }

      setMessage(data.message)
      await loadData()
    } catch (err) {
      setError(err.message || 'Archiving failed.')
    }
  }

  const approvedCount = records.filter(
    item => item.is_approved && !item.is_archived
  ).length

  const draftCount = records.filter(
    item => !item.is_approved && !item.is_archived
  ).length

  const archivedCount = records.filter(
    item => item.is_archived
  ).length

  return (
    <section className="page-content">
      <div className="welcome-section">
        <div>
          <p className="eyebrow">SYSTEM MANAGEMENT</p>
          <h1>Administration</h1>
          <p className="subtitle">
            Manage verified waste-sorting instructions and configured localities.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {message && (
        <p className="success-tag" role="status">
          {message}
        </p>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total guidance records</span>
          <h2>{records.length}</h2>
          <p>Stored in the database</p>
        </div>

        <div className="stat-card">
          <span>Approved records</span>
          <h2>{approvedCount}</h2>
          <p>Approved and not archived</p>
        </div>

        <div className="stat-card">
          <span>Pending drafts</span>
          <h2>{draftCount}</h2>
          <p>Awaiting administrator approval</p>
        </div>

        <div className="stat-card">
          <span>Archived records</span>
          <h2>{archivedCount}</h2>
          <p>Not shown in public guidance</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <p className="eyebrow">
          {editingId ? 'EDIT EXISTING RECORD' : 'CREATE NEW RECORD'}
        </p>

        <h2>{editingId ? `Edit guidance #${editingId}` : 'Create guidance draft'}</h2>

        <p className="subtitle">
          New records and updated versions require approval before becoming public.
        </p>

        <form
          onSubmit={saveGuidance}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: 16,
            marginTop: 20
          }}
        >
          <label style={labelStyle}>
            Waste category
            <select
              name="category_code"
              value={form.category_code}
              onChange={updateField}
              style={inputStyle}
              required
            >
              {CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {formatCategory(category)}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Locality
            <select
              name="locality_id"
              value={form.locality_id}
              onChange={updateField}
              style={inputStyle}
              required
            >
              <option value="">Select locality</option>
              {localities.map(item => (
                <option key={item.id} value={item.id}>
                  {item.city}, {item.state}, {item.country}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Instruction title
            <input
              name="instruction_title"
              value={form.instruction_title}
              onChange={updateField}
              style={inputStyle}
              maxLength={200}
              required
              placeholder="Example: Separate clean plastic bottles"
            />
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Instruction text
            <textarea
              name="instruction_text"
              value={form.instruction_text}
              onChange={updateField}
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={4}
              required
              placeholder="Describe the local disposal instruction..."
            />
          </label>

          <label style={labelStyle}>
            Accepted status
            <select
              name="accepted_status"
              value={form.accepted_status}
              onChange={updateField}
              style={inputStyle}
            >
              {['Accepted', 'Conditional', 'Not accepted', 'Unknown'].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Source name
            <input
              name="source_name"
              value={form.source_name}
              onChange={updateField}
              style={inputStyle}
              maxLength={200}
              placeholder="Municipal authority or official source"
            />
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Source URL
            <input
              name="source_url"
              type="url"
              value={form.source_url}
              onChange={updateField}
              style={inputStyle}
              maxLength={1000}
              placeholder="https://..."
            />
          </label>

          <label style={labelStyle}>
            Preparation advice
            <textarea
              name="preparation_advice"
              value={form.preparation_advice}
              onChange={updateField}
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={3}
              placeholder="Cleaning, drying or preparation steps"
            />
          </label>

          <label style={labelStyle}>
            Exceptions and special notes
            <textarea
              name="exceptions"
              value={form.exceptions}
              onChange={updateField}
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={3}
              placeholder="Special conditions or exceptions"
            />
          </label>

          <label style={labelStyle}>
            Effective from
            <input
              name="effective_from"
              type="datetime-local"
              value={form.effective_from}
              onChange={updateField}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Effective until
            <input
              name="effective_to"
              type="datetime-local"
              value={form.effective_to}
              onChange={updateField}
              style={inputStyle}
            />
          </label>

          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap'
            }}
          >
            <button
              className="primary-button"
              type="submit"
              disabled={saving || !localities.length}
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save updated draft'
                  : 'Create guidance draft'}
            </button>

            {editingId && (
              <button
                className="secondary-button"
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>

        {!localities.length && !loading && (
          <p className="error-message">
            No active localities are configured. A locality is required to create guidance.
          </p>
        )}
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="welcome-section">
          <div>
            <p className="eyebrow">GUIDANCE DATABASE</p>
            <h2>All guidance records</h2>
          </div>
          <span className="model-badge">{records.length} records</span>
        </div>

        {loading ? (
          <p className="empty-state">Loading guidance records...</p>
        ) : records.length === 0 ? (
          <p className="empty-state">
            No guidance records have been created yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 15, marginTop: 15 }}>
            {records.map(record => (
              <div
                key={record.id}
                style={{
                  padding: 17,
                  border: '1px solid #e4ebe0',
                  borderRadius: 11,
                  background: '#fbfcfa'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <p className="eyebrow">
                      {formatCategory(record.category_code)} · Record #{record.id}
                    </p>
                    <h3 style={{ color: '#304b35', margin: '5px 0' }}>
                      {record.instruction_title}
                    </h3>
                    <p style={{ color: '#657461', fontSize: 13, lineHeight: 1.7 }}>
                      {record.instruction_text}
                    </p>
                  </div>

                  <span className={
                    record.is_archived
                      ? 'review-tag'
                      : record.is_approved
                        ? 'success-tag'
                        : 'model-badge'
                  }>
                    {record.is_archived
                      ? 'Archived'
                      : record.is_approved
                        ? 'Approved'
                        : 'Draft · Approval required'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                    marginTop: 12,
                    color: '#71806d',
                    fontSize: 12
                  }}
                >
                  <span>Accepted status: <strong>{record.accepted_status}</strong></span>
                  <span>Version: <strong>{record.version}</strong></span>
                  <span>Reviewed by: <strong>{record.reviewed_by || 'Not reviewed'}</strong></span>
                  <span>Reviewed: <strong>{formatDate(record.reviewed_at)}</strong></span>
                </div>

                {record.source_name && (
                  <p style={{ fontSize: 12, color: '#71806d' }}>
                    Source: {record.source_name}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 9,
                    flexWrap: 'wrap',
                    marginTop: 15
                  }}
                >
                  {!record.is_archived && (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() => editRecord(record)}
                      >
                        Edit
                      </button>

                      {!record.is_approved && (
                        <button
                          className="primary-button"
                          onClick={() => approveGuidance(record)}
                        >
                          ✓ Approve
                        </button>
                      )}

                      <button
                        className="secondary-button"
                        onClick={() => archiveGuidance(record)}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <p className="eyebrow">CONFIGURED LOCALITIES</p>
        <h2>Locality management overview</h2>

        {localities.length === 0 ? (
          <p className="empty-state">No active localities found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {localities.map(item => (
              <div
                key={item.id}
                className="history-row"
              >
                <div>
                  <strong>{item.city}</strong>
                  <span>{item.name}, {item.state}, {item.country}</span>
                </div>
                <span className="success-tag">Active</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: '#899487', fontSize: 12, marginBottom: 0 }}>
          This section currently displays active localities. Locality creation,
          editing and deactivation are not exposed by the current backend.
        </p>
      </div>
    </section>
  )
}
