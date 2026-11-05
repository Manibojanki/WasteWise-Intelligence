
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

const EMPTY_FORM = {
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

function AdminPanel() {
  const [guidance, setGuidance] = useState([])
  const [localities, setLocalities] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const request = async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        typeof data.detail === 'string'
          ? data.detail
          : 'The request could not be completed.'
      )
    }

    return data
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [guidanceData, localityData] = await Promise.all([
        request('/api/admin/guidance'),
        request('/api/localities')
      ])

      setGuidance(guidanceData)
      setLocalities(localityData)
    } catch (err) {
      setError(err.message || 'Could not load administration data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateField = (event) => {
    const { name, value } = event.target

    setForm(previous => ({
      ...previous,
      [name]: value
    }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const editGuidance = (item) => {
    setEditingId(item.id)

    setForm({
      category_code: item.category_code,
      locality_id: String(item.locality_id),
      instruction_title: item.instruction_title,
      instruction_text: item.instruction_text,
      accepted_status: item.accepted_status,
      preparation_advice: item.preparation_advice || '',
      exceptions: item.exceptions || '',
      source_name: item.source_name || '',
      source_url: item.source_url || '',
      effective_from: item.effective_from
        ? item.effective_from.slice(0, 16)
        : '',
      effective_to: item.effective_to
        ? item.effective_to.slice(0, 16)
        : ''
    })

    setMessage('')
    setError('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveGuidance = async (event) => {
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
      preparation_advice: form.preparation_advice || null,
      exceptions: form.exceptions || null,
      source_name: form.source_name || null,
      source_url: form.source_url || null
    }

    try {
      if (editingId) {
        await request(`/api/admin/guidance/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })

        setMessage(
          'Guidance updated. It requires approval again before publication.'
        )
      } else {
        await request('/api/admin/guidance', {
          method: 'POST',
          body: JSON.stringify(payload)
        })

        setMessage('Guidance draft created successfully.')
      }

      resetForm()
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const approveGuidance = async (id) => {
    if (!window.confirm('Approve this guidance record?')) return

    setError('')
    setMessage('')

    try {
      await request(`/api/admin/guidance/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          reviewed_by: 'admin'
        })
      })

      setMessage('Guidance approved successfully.')
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const archiveGuidance = async (id) => {
    if (!window.confirm('Archive this guidance record?')) return

    setError('')
    setMessage('')

    try {
      await request(`/api/admin/guidance/${id}/archive`, {
        method: 'POST'
      })

      setMessage('Guidance archived successfully.')
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const statusLabel = (item) => {
    if (item.is_archived) return 'Archived'
    if (item.is_approved) return 'Approved'
    return 'Draft / Pending approval'
  }

  const statusColor = (item) => {
    if (item.is_archived) return '#777'
    if (item.is_approved) return '#28794d'
    return '#b7791f'
  }

  return (
    <section className="page-content">
      <p className="eyebrow">SYSTEM MANAGEMENT</p>
      <h1>Administration</h1>
      <p className="page-description">
        Manage local waste disposal guidance and its approval status.
      </p>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {message && (
        <div style={styles.success}>
          {message}
        </div>
      )}

      <div className="panel" style={{ marginTop: 24 }}>
        <div style={styles.sectionHeader}>
          <div>
            <h2>{editingId ? 'Edit Guidance' : 'Create Guidance'}</h2>
            <p style={styles.muted}>
              {editingId
                ? 'Update the selected guidance record.'
                : 'Add disposal instructions for a specific category and locality.'}
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={resetForm}
            >
              Cancel editing
            </button>
          )}
        </div>

        <form onSubmit={saveGuidance}>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              Waste category
              <select
                name="category_code"
                value={form.category_code}
                onChange={updateField}
                required
                style={styles.input}
              >
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              Locality
              <select
                name="locality_id"
                value={form.locality_id}
                onChange={updateField}
                required
                style={styles.input}
              >
                <option value="">Select locality</option>
                {localities.map(locality => (
                  <option key={locality.id} value={locality.id}>
                    {locality.city}, {locality.state}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              Instruction title
              <input
                name="instruction_title"
                value={form.instruction_title}
                onChange={updateField}
                required
                maxLength={200}
                style={styles.input}
                placeholder="e.g. Plastic bottle disposal"
              />
            </label>

            <label style={styles.field}>
              Acceptance status
              <select
                name="accepted_status"
                value={form.accepted_status}
                onChange={updateField}
                style={styles.input}
              >
                <option>Accepted</option>
                <option>Conditional</option>
                <option>Not accepted</option>
                <option>Unknown</option>
              </select>
            </label>

            <label style={styles.fieldFull}>
              Instruction text
              <textarea
                name="instruction_text"
                value={form.instruction_text}
                onChange={updateField}
                required
                rows={3}
                style={styles.input}
                placeholder="Explain how this waste should be disposed of."
              />
            </label>

            <label style={styles.fieldFull}>
              Preparation advice
              <textarea
                name="preparation_advice"
                value={form.preparation_advice}
                onChange={updateField}
                rows={2}
                style={styles.input}
                placeholder="Cleaning, drying or separating instructions."
              />
            </label>

            <label style={styles.fieldFull}>
              Exceptions
              <textarea
                name="exceptions"
                value={form.exceptions}
                onChange={updateField}
                rows={2}
                style={styles.input}
                placeholder="Conditions or exceptions."
              />
            </label>

            <label style={styles.field}>
              Source name
              <input
                name="source_name"
                value={form.source_name}
                onChange={updateField}
                maxLength={200}
                style={styles.input}
                placeholder="Official source or authority"
              />
            </label>

            <label style={styles.field}>
              Source URL
              <input
                type="url"
                name="source_url"
                value={form.source_url}
                onChange={updateField}
                style={styles.input}
                placeholder="https://example.com"
              />
            </label>

            <label style={styles.field}>
              Effective from
              <input
                type="datetime-local"
                name="effective_from"
                value={form.effective_from}
                onChange={updateField}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              Effective until
              <input
                type="datetime-local"
                name="effective_to"
                value={form.effective_to}
                onChange={updateField}
                style={styles.input}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || localities.length === 0}
            style={styles.primaryButton}
          >
            {saving
              ? 'Saving...'
              : editingId
                ? 'Save changes'
                : 'Create guidance draft'}
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div style={styles.sectionHeader}>
          <div>
            <h2>Guidance Records</h2>
            <p style={styles.muted}>
              Review, edit, approve and archive guidance.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            style={styles.secondaryButton}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading guidance records...</p>
        ) : guidance.length === 0 ? (
          <div style={styles.empty}>
            No guidance records found. Create your first guidance draft above.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {guidance.map(item => {
              const locality = localities.find(
                location => location.id === item.locality_id
              )

              return (
                <article key={item.id} style={styles.record}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <span style={styles.category}>
                        {item.category_code.toUpperCase()}
                      </span>
                      <h3 style={{ margin: '8px 0' }}>
                        {item.instruction_title}
                      </h3>
                      <p style={styles.muted}>
                        {locality
                          ? `${locality.city}, ${locality.state}`
                          : `Locality ID: ${item.locality_id}`}
                        {' · '}Version {item.version}
                      </p>
                    </div>

                    <span
                      style={{
                        ...styles.status,
                        color: statusColor(item)
                      }}
                    >
                      {statusLabel(item)}
                    </span>
                  </div>

                  <p>{item.instruction_text}</p>

                  {item.preparation_advice && (
                    <p>
                      <strong>Preparation:</strong>{' '}
                      {item.preparation_advice}
                    </p>
                  )}

                  {item.exceptions && (
                    <p>
                      <strong>Exceptions:</strong> {item.exceptions}
                    </p>
                  )}

                  <p style={styles.muted}>
                    Acceptance: {item.accepted_status}
                    {' · '}
                    Source: {item.source_name || 'Not provided'}
                  </p>

                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.sourceLink}
                    >
                      View source
                    </a>
                  )}

                  {item.reviewed_by && (
                    <p style={styles.muted}>
                      Reviewed by {item.reviewed_by}
                    </p>
                  )}

                  <div style={styles.actions}>
                    {!item.is_archived && (
                      <>
                        <button
                          type="button"
                          onClick={() => editGuidance(item)}
                          style={styles.secondaryButton}
                        >
                          Edit
                        </button>

                        {!item.is_approved && (
                          <button
                            type="button"
                            onClick={() => approveGuidance(item.id)}
                            style={styles.primaryButton}
                          >
                            Approve
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => archiveGuidance(item.id)}
                          style={styles.dangerButton}
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

const styles = {
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 18,
    marginTop: 20
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    fontWeight: 600
  },
  fieldFull: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    fontWeight: 600
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #d8e2d9',
    borderRadius: 9,
    background: '#fff',
    color: '#26382e',
    font: 'inherit'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap'
  },
  muted: {
    color: '#718078',
    fontSize: 13,
    lineHeight: 1.6
  },
  primaryButton: {
    border: 0,
    borderRadius: 9,
    padding: '11px 17px',
    background: '#397b55',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16
  },
  secondaryButton: {
    border: '1px solid #d4dfd5',
    borderRadius: 9,
    padding: '9px 14px',
    background: '#fff',
    color: '#355b42',
    fontWeight: 600,
    cursor: 'pointer'
  },
  dangerButton: {
    border: '1px solid #efcaca',
    borderRadius: 9,
    padding: '9px 14px',
    background: '#fff5f5',
    color: '#a33b3b',
    fontWeight: 600,
    cursor: 'pointer'
  },
  record: {
    border: '1px solid #e0e8e0',
    borderRadius: 12,
    padding: 18,
    background: '#fff'
  },
  category: {
    color: '#397b55',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1
  },
  status: {
    fontSize: 12,
    fontWeight: 700,
    background: '#f3f6f1',
    borderRadius: 20,
    padding: '7px 11px'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12
  },
  empty: {
    textAlign: 'center',
    padding: 30,
    color: '#718078',
    background: '#f7f9f6',
    borderRadius: 10
  },
  error: {
    background: '#fff0ef',
    color: '#a33b3b',
    borderRadius: 9,
    padding: 12,
    marginTop: 15
  },
  success: {
    background: '#edf7ef',
    color: '#28794d',
    borderRadius: 9,
    padding: 12,
    marginTop: 15
  },
  sourceLink: {
    color: '#397b55',
    fontSize: 13,
    fontWeight: 600
  }
}

export default AdminPanel
