
import { useCallback, useEffect, useState } from 'react'
import UserManagement from './UserManagement'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

const WASTE_CATEGORIES = [
  'cardboard',
  'glass',
  'metal',
  'paper',
  'plastic',
  'trash'
]

const ACCEPTED_STATUSES = [
  'Accepted',
  'Conditional',
  'Not accepted',
  'Unknown'
]

function formatWasteCategory(category) {
  if (!category) return 'Unknown'

  return category
    .replaceAll('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function formatDate(value) {
  if (!value) return 'Not specified'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Not specified'
    : date.toLocaleDateString()
}

function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function dateToStart(value) {
  return value ? `${value}T00:00:00` : null
}

function dateToEnd(value) {
  return value ? `${value}T23:59:59` : null
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data.detail === 'string'
      ? data.detail
      : data.detail?.message || data.message || `Request failed (${response.status}).`

    throw new Error(message)
  }

  return data
}

async function requestGuidance(category, locality) {
  const params = new URLSearchParams({ category, locality })
  const response = await fetch(`${API_URL}/api/guidance?${params.toString()}`)
  return readResponse(response)
}

function GuidanceContent({ response, loading, error }) {
  if (loading) {
    return <p className="empty-state">Checking approved local guidance...</p>
  }

  if (error) {
    return <p className="error-message" role="alert">{error}</p>
  }

  if (!response) {
    return <p className="empty-state">Select a category and locality to view guidance.</p>
  }

  if (!response.guidance) {
    return (
      <div style={{
        padding: 18,
        borderRadius: 11,
        background: '#fff4df',
        color: '#89662e',
        lineHeight: 1.7
      }}>
        <strong>Check local rules</strong>
        <p style={{ margin: '7px 0 0', fontSize: 13 }}>
          {response.message || 'No approved local guidance is currently available. Check with your local municipal authority before disposal.'}
        </p>
        <p style={{ margin: '9px 0 0', fontSize: 11 }}>
          WasteWise only displays instructions reviewed and approved for the selected locality.
        </p>
      </div>
    )
  }

  const item = response.guidance

  return (
    <div style={{
      display: 'grid',
      gap: 15,
      padding: 19,
      border: '1px solid #dce8d8',
      borderRadius: 12,
      background: '#f7faf5'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }}>
        <span className="success-tag">Approved local guidance</span>
        <span style={{ color: '#819080', fontSize: 11 }}>
          Version {item.version}
        </span>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 7 }}>INSTRUCTION</p>
        <h3 style={{ margin: 0, color: '#304b35', fontSize: 19 }}>
          {item.instruction_title}
        </h3>
        <p style={{ color: '#607260', fontSize: 13, lineHeight: 1.8 }}>
          {item.instruction_text}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12
      }}>
        <div style={{ background: '#fff', padding: 13, borderRadius: 9, border: '1px solid #e7eee3' }}>
          <span style={{ display: 'block', color: '#91a092', fontSize: 10, marginBottom: 6 }}>ACCEPTED STATUS</span>
          <strong style={{ color: '#315c43', fontSize: 13 }}>
            {item.accepted_status || 'Not specified'}
          </strong>
        </div>
        <div style={{ background: '#fff', padding: 13, borderRadius: 9, border: '1px solid #e7eee3' }}>
          <span style={{ display: 'block', color: '#91a092', fontSize: 10, marginBottom: 6 }}>LOCALITY</span>
          <strong style={{ color: '#315c43', fontSize: 13 }}>
            {item.locality || 'Not specified'}
          </strong>
        </div>
      </div>

      {item.preparation_advice && (
        <div>
          <strong style={{ color: '#405b43', fontSize: 13 }}>Preparation advice</strong>
          <p style={{ color: '#687969', fontSize: 13, lineHeight: 1.7 }}>
            {item.preparation_advice}
          </p>
        </div>
      )}

      {item.exceptions && (
        <div>
          <strong style={{ color: '#405b43', fontSize: 13 }}>Exceptions and special notes</strong>
          <p style={{ color: '#687969', fontSize: 13, lineHeight: 1.7 }}>
            {item.exceptions}
          </p>
        </div>
      )}

      <div style={{
        borderTop: '1px solid #e3eadf',
        paddingTop: 13,
        color: '#849184',
        fontSize: 11,
        lineHeight: 1.8
      }}>
        <div><strong>Source:</strong> {item.source_name || 'Not specified'}</div>
        {item.source_url && (
          <div>
            <strong>Source link:</strong>{' '}
            <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: '#477653' }}>
              View source
            </a>
          </div>
        )}
        <div><strong>Reviewed by:</strong> {item.reviewed_by || 'Not specified'}</div>
        <div><strong>Last reviewed:</strong> {formatDate(item.reviewed_at)}</div>
        <div><strong>Effective from:</strong> {formatDate(item.effective_from)}</div>
        <div><strong>Effective until:</strong> {item.effective_to ? formatDate(item.effective_to) : 'No end date specified'}</div>
      </div>
    </div>
  )
}

function App() {
  const [page, setPage] = useState('Dashboard')

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')

  const [feedback, setFeedback] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackClassificationId, setFeedbackClassificationId] = useState('')
  const [feedbackType, setFeedbackType] = useState('correct')
  const [correctedCategory, setCorrectedCategory] = useState('')
  const [feedbackComments, setFeedbackComments] = useState('')

  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null)
  const [reviewCategories, setReviewCategories] = useState({})
  const [reviewNotes, setReviewNotes] = useState({})

  const [localities, setLocalities] = useState([])
  const [selectedLocality, setSelectedLocality] = useState('Tirupati')
  const [localityLoading, setLocalityLoading] = useState(false)
  const [localityError, setLocalityError] = useState('')

  const [guidanceCategory, setGuidanceCategory] = useState('plastic')
  const [guidanceResponse, setGuidanceResponse] = useState(null)
  const [guidanceLoading, setGuidanceLoading] = useState(false)
  const [guidanceError, setGuidanceError] = useState('')

  const [classifierGuidance, setClassifierGuidance] = useState(null)
  const [classifierGuidanceLoading, setClassifierGuidanceLoading] = useState(false)
  const [classifierGuidanceError, setClassifierGuidanceError] = useState('')

  // Administration state
  const [adminGuidance, setAdminGuidance] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [adminSubmitting, setAdminSubmitting] = useState(false)
  const [editingGuidanceId, setEditingGuidanceId] = useState(null)

  const emptyGuidanceForm = {
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

  const [guidanceForm, setGuidanceForm] = useState(emptyGuidanceForm)

  const fieldStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #dce5d8',
    borderRadius: '9px',
    background: '#fff',
    color: '#304b35',
    font: 'inherit'
  }

  const fieldLabelStyle = {
    display: 'grid',
    gap: '7px',
    color: '#52644f',
    fontSize: '13px',
    fontWeight: 600
  }

  const formatCategory = formatWasteCategory

  function formatPercentage(value) {
    const percentage = Number(value)
    return Number.isFinite(percentage) ? percentage.toFixed(2) : '0.00'
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${API_URL}/api/history`)
      const data = await readResponse(response)
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      setError('Cannot connect to the backend. Make sure the API server is running.')
    }
  }

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError('')

    try {
      const response = await fetch(`${API_URL}/api/analytics`)
      setAnalytics(await readResponse(response))
    } catch (err) {
      setAnalyticsError(err.message || 'Could not load analytics.')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true)
    setFeedbackError('')

    try {
      const response = await fetch(`${API_URL}/api/feedback`)
      const data = await readResponse(response)
      setFeedback(Array.isArray(data) ? data : [])
    } catch (err) {
      setFeedbackError(err.message || 'Could not load feedback.')
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  const loadReviewerQueue = useCallback(async () => {
    setReviewLoading(true)
    setReviewError('')

    try {
      const response = await fetch(`${API_URL}/api/reviewer-queue`)
      const data = await readResponse(response)
      setReviewQueue(Array.isArray(data) ? data : [])
    } catch (err) {
      setReviewError(err.message || 'Could not load the reviewer queue.')
    } finally {
      setReviewLoading(false)
    }
  }, [])

  const loadLocalities = useCallback(async () => {
    setLocalityLoading(true)
    setLocalityError('')

    try {
      const response = await fetch(`${API_URL}/api/localities`)
      const data = await readResponse(response)
      const records = Array.isArray(data) ? data : []

      setLocalities(records)

      if (records.length > 0) {
        setSelectedLocality(current => {
          const existing = records.find(
            item => item.city?.toLowerCase() === current.toLowerCase()
          )
          return existing ? existing.city : records[0].city
        })
      }
    } catch (err) {
      setLocalityError(err.message || 'Could not load localities.')
    } finally {
      setLocalityLoading(false)
    }
  }, [])

  // Administration: load every guidance record, including drafts and archived records.
  const loadAdminGuidance = useCallback(async () => {
    setAdminLoading(true)
    setAdminError('')

    try {
      const response = await fetch(`${API_URL}/api/admin/guidance`)
      const data = await readResponse(response)
      setAdminGuidance(Array.isArray(data) ? data : [])
    } catch (err) {
      setAdminError(err.message || 'Could not load administration records.')
    } finally {
      setAdminLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
    loadLocalities()
  }, [loadLocalities])

  useEffect(() => {
    if (page === 'Feedback') loadFeedback()
  }, [page, loadFeedback])

  useEffect(() => {
    if (page === 'Analytics') loadAnalytics()
  }, [page, loadAnalytics])

  useEffect(() => {
    if (page === 'Reviewer Queue') {
      setReviewMessage('')
      loadReviewerQueue()
    }
  }, [page, loadReviewerQueue])

  useEffect(() => {
    if (page === 'Administration') {
      setAdminMessage('')
      loadAdminGuidance()
      loadLocalities()
    }
  }, [page, loadAdminGuidance, loadLocalities])

  // Exact category and locality guidance lookup.
  useEffect(() => {
    if (page !== 'Guidance' || !selectedLocality) return

    let active = true

    async function loadPageGuidance() {
      setGuidanceLoading(true)
      setGuidanceError('')
      setGuidanceResponse(null)

      try {
        const data = await requestGuidance(guidanceCategory, selectedLocality)
        if (active) setGuidanceResponse(data)
      } catch (err) {
        if (active) setGuidanceError(err.message || 'Could not load local guidance.')
      } finally {
        if (active) setGuidanceLoading(false)
      }
    }

    loadPageGuidance()

    return () => {
      active = false
    }
  }, [page, guidanceCategory, selectedLocality])

  // Classifier guidance is shown only after a prediction passes review threshold.
  useEffect(() => {
    if (
      !result ||
      result.review_required ||
      result.status === 'manual_review' ||
      !selectedLocality
    ) {
      setClassifierGuidance(null)
      setClassifierGuidanceError('')
      setClassifierGuidanceLoading(false)
      return
    }

    let active = true

    async function loadClassifierGuidance() {
      setClassifierGuidanceLoading(true)
      setClassifierGuidanceError('')
      setClassifierGuidance(null)

      try {
        const data = await requestGuidance(result.predicted_class, selectedLocality)
        if (active) setClassifierGuidance(data)
      } catch (err) {
        if (active) setClassifierGuidanceError(err.message || 'Could not load local guidance.')
      } finally {
        if (active) setClassifierGuidanceLoading(false)
      }
    }

    loadClassifierGuidance()

    return () => {
      active = false
    }
  }, [result, selectedLocality])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  // ------------------------------------------------
  // FEEDBACK
  // ------------------------------------------------

  async function submitFeedback(event) {
    event.preventDefault()
    setFeedbackError('')
    setFeedbackMessage('')

    if (!feedbackClassificationId) {
      setFeedbackError('Please select a classification record.')
      return
    }

    if (feedbackType === 'incorrect' && !correctedCategory.trim()) {
      setFeedbackError('Please select the correct waste category.')
      return
    }

    setFeedbackSubmitting(true)

    const payload = {
      classification_id: Number(feedbackClassificationId),
      feedback_type: feedbackType,
      corrected_category: feedbackType === 'incorrect'
        ? correctedCategory.trim()
        : null,
      comments: feedbackComments.trim() || null
    }

    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      await readResponse(response)

      setFeedbackMessage('Your feedback has been submitted successfully.')
      setFeedbackClassificationId('')
      setFeedbackType('correct')
      setCorrectedCategory('')
      setFeedbackComments('')

      await loadFeedback()
    } catch (err) {
      setFeedbackError(err.message || 'Unable to submit feedback.')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // ------------------------------------------------
  // REVIEWER QUEUE
  // ------------------------------------------------

  async function submitReview(item, action) {
    const category = (reviewCategories[item.classification_id] || '').trim()
    const notes = (reviewNotes[item.classification_id] || '').trim()

    if (action === 'correct' && !category) {
      setReviewError(
        `Please select the corrected category for classification #${item.classification_id}.`
      )
      return
    }

    setReviewError('')
    setReviewMessage('')
    setReviewSubmittingId(item.classification_id)

    const payload = {
      classification_id: item.classification_id,
      action,
      corrected_category: action === 'correct' ? category : null,
      notes: notes || null
    }

    try {
      const response = await fetch(`${API_URL}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await readResponse(response)
      const finalCategory = data.review?.final_category

      setReviewMessage(
        action === 'approve'
          ? `Classification #${item.classification_id} was approved successfully.`
          : `Classification #${item.classification_id} was corrected to ${formatCategory(finalCategory || category)}.`
      )

      setReviewCategories(current => ({
        ...current,
        [item.classification_id]: ''
      }))

      setReviewNotes(current => ({
        ...current,
        [item.classification_id]: ''
      }))

      await Promise.all([loadReviewerQueue(), loadHistory()])
    } catch (err) {
      setReviewError(err.message || 'Unable to submit the review decision.')
    } finally {
      setReviewSubmittingId(null)
    }
  }

  // ------------------------------------------------
  // IMAGE CLASSIFICATION
  // ------------------------------------------------

  function chooseFile(event) {
    const selected = event.target.files?.[0]
    if (!selected) return

    setError('')
    setResult(null)
    setClassifierGuidance(null)
    setClassifierGuidanceError('')

    if (!['image/jpeg', 'image/png'].includes(selected.type)) {
      setError('Please select a JPG, JPEG or PNG image.')
      setFile(null)
      setPreview('')
      return
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.')
      setFile(null)
      setPreview('')
      return
    }

    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  async function classifyImage() {
    if (!file || loading) return

    setLoading(true)
    setError('')
    setResult(null)
    setClassifierGuidance(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_URL}/api/classify`, {
        method: 'POST',
        body: formData
      })

      const data = await readResponse(response)
      setResult(data)
      await loadHistory()
    } catch (err) {
      setError(err.message || 'Unable to classify this image.')
    } finally {
      setLoading(false)
    }
  }

  function clearImage() {
    setFile(null)
    setPreview('')
    setResult(null)
    setError('')
    setClassifierGuidance(null)
    setClassifierGuidanceError('')
  }

  // ------------------------------------------------
  // ADMINISTRATION
  // ------------------------------------------------

  function updateGuidanceForm(event) {
    const { name, value } = event.target

    setGuidanceForm(current => ({
      ...current,
      [name]: value
    }))
  }

  function resetGuidanceForm() {
    setGuidanceForm({
      ...emptyGuidanceForm,
      locality_id: localities.length ? String(localities[0].id) : ''
    })
    setEditingGuidanceId(null)
  }

  function editGuidance(record) {
    setEditingGuidanceId(record.id)

    setGuidanceForm({
      category_code: record.category_code || 'plastic',
      locality_id: String(record.locality_id || ''),
      instruction_title: record.instruction_title || '',
      instruction_text: record.instruction_text || '',
      accepted_status: record.accepted_status || 'Unknown',
      preparation_advice: record.preparation_advice || '',
      exceptions: record.exceptions || '',
      source_name: record.source_name || '',
      source_url: record.source_url || '',
      effective_from: toDateInput(record.effective_from),
      effective_to: toDateInput(record.effective_to)
    })

    setAdminMessage('')
    setAdminError('')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveGuidance(event) {
    event.preventDefault()
    setAdminError('')
    setAdminMessage('')

    if (!guidanceForm.locality_id) {
      setAdminError('Please select a locality.')
      return
    }

    if (
      guidanceForm.effective_from &&
      guidanceForm.effective_to &&
      guidanceForm.effective_to <= guidanceForm.effective_from
    ) {
      setAdminError('Effective end date must be later than the start date.')
      return
    }

    const payload = {
      category_code: guidanceForm.category_code,
      locality_id: Number(guidanceForm.locality_id),
      instruction_title: guidanceForm.instruction_title.trim(),
      instruction_text: guidanceForm.instruction_text.trim(),
      accepted_status: guidanceForm.accepted_status,
      preparation_advice: guidanceForm.preparation_advice.trim() || null,
      exceptions: guidanceForm.exceptions.trim() || null,
      source_name: guidanceForm.source_name.trim() || null,
      source_url: guidanceForm.source_url.trim() || null,
      effective_from: dateToStart(guidanceForm.effective_from),
      effective_to: dateToEnd(guidanceForm.effective_to)
    }

    if (
      !payload.instruction_title ||
      !payload.instruction_text
    ) {
      setAdminError('Instruction title and instruction text are required.')
      return
    }

    setAdminSubmitting(true)

    try {
      const isEditing = editingGuidanceId !== null
      const url = isEditing
        ? `${API_URL}/api/admin/guidance/${editingGuidanceId}`
        : `${API_URL}/api/admin/guidance`

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await readResponse(response)

      setAdminMessage(
        data.message ||
        (isEditing ? 'Guidance updated successfully.' : 'Guidance draft created successfully.')
      )

      resetGuidanceForm()
      await loadAdminGuidance()
    } catch (err) {
      setAdminError(err.message || 'Could not save guidance.')
    } finally {
      setAdminSubmitting(false)
    }
  }

  async function approveGuidance(record) {
    const confirmed = window.confirm(
      `Approve guidance #${record.id} for ${formatCategory(record.category_code)}?`
    )

    if (!confirmed) return

    setAdminError('')
    setAdminMessage('')
    setAdminSubmitting(true)

    try {
      const response = await fetch(
        `${API_URL}/api/admin/guidance/${record.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The backend records the authenticated administrator's username.
          // This required field is retained for the request schema.
          body: JSON.stringify({ reviewed_by: 'Administrator' })
        }
      )

      const data = await readResponse(response)

      setAdminMessage(data.message || `Guidance #${record.id} approved successfully.`)
      await loadAdminGuidance()
    } catch (err) {
      setAdminError(err.message || 'Could not approve guidance.')
    } finally {
      setAdminSubmitting(false)
    }
  }

  async function archiveGuidance(record) {
    const confirmed = window.confirm(
      `Archive guidance #${record.id}? It will no longer appear in public guidance results.`
    )

    if (!confirmed) return

    setAdminError('')
    setAdminMessage('')
    setAdminSubmitting(true)

    try {
      const response = await fetch(
        `${API_URL}/api/admin/guidance/${record.id}/archive`,
        { method: 'POST' }
      )

      const data = await readResponse(response)

      setAdminMessage(data.message || `Guidance #${record.id} archived successfully.`)
      await loadAdminGuidance()
    } catch (err) {
      setAdminError(err.message || 'Could not archive guidance.')
    } finally {
      setAdminSubmitting(false)
    }
  }

  function guidanceStatus(record) {
    if (record.is_archived) return 'Archived'
    if (record.is_approved) return 'Approved'
    return 'Draft / Pending approval'
  }

  // ------------------------------------------------
  // SHARED DATA
  // ------------------------------------------------

  const menuItems = [
    { name: 'Dashboard', icon: '⌂' },
    { name: 'AI Classifier', icon: '✳' },
    { name: 'History', icon: '◷' },
    { name: 'Analytics', icon: '▥' },
    { name: 'Feedback', icon: '♡' },
    { name: 'Reviewer Queue', icon: '☷' },
    { name: 'Guidance', icon: '♧' },
    { name: 'Administration', icon: '⚙' }
  ]

  const counts = {
    total: history.length,
    review: history.filter(item => item.review_required).length,
    classified: history.filter(item => !item.review_required).length
  }

  const topPredictions = Array.isArray(result?.top_predictions)
    ? result.top_predictions
    : []

  const confidenceThreshold = Number(result?.confidence_threshold ?? 0.6)

  const approvedGuidanceCount = adminGuidance.filter(
    item => item.is_approved && !item.is_archived
  ).length

  const draftGuidanceCount = adminGuidance.filter(
    item => !item.is_approved && !item.is_archived
  ).length

  const archivedGuidanceCount = adminGuidance.filter(
    item => item.is_archived
  ).length

  // ------------------------------------------------
  // USER INTERFACE
  // ------------------------------------------------

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">♧</div>
          <div>
            <h2>WasteWise</h2>
            <span>INTELLIGENCE</span>
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <nav>
          {menuItems.map(item => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? 'active' : ''}`}
              onClick={() => setPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="eco-card">
            <span>♧</span>
            <p>Smarter sorting starts with better information.</p>
          </div>
          <span className="version">WasteWise Intelligence · v1.0</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace /</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            AI Classification Workspace
          </div>
        </header>

        {/* DASHBOARD */}

        {page === 'Dashboard' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">WASTE MANAGEMENT, MADE SMARTER</p>
                <h1>Welcome to WasteWise.</h1>
                <p className="subtitle">
                  Understand your waste. Make more informed sorting decisions.
                </p>
              </div>
              <button className="primary-button" onClick={() => setPage('AI Classifier')}>
                + Classify Waste
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Total classifications</span>
                <h2>{counts.total}</h2>
                <p>Recorded in the database</p>
              </div>
              <div className="stat-card">
                <span>Classified results</span>
                <h2>{counts.classified}</h2>
                <p>Above the configured threshold</p>
              </div>
              <div className="stat-card">
                <span>Manual reviews</span>
                <h2>{counts.review}</h2>
                <p>Require additional attention</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="panel classifier-panel">
                <p className="eyebrow">AI POWERED CLASSIFICATION</p>
                <h2>What goes in your waste?</h2>
                <p>
                  Upload a picture of one waste item to receive an AI-assisted category prediction.
                </p>
                <button className="primary-button" onClick={() => setPage('AI Classifier')}>
                  Start classifying →
                </button>
              </div>

              <div className="panel">
                <p className="eyebrow">RECENT ACTIVITY</p>
                <h2>Recent classifications</h2>

                {history.length === 0 ? (
                  <p className="empty-state">No classifications recorded yet.</p>
                ) : (
                  history.slice(0, 5).map(item => (
                    <div className="history-row" key={item.id}>
                      <div>
                        <strong>{formatCategory(item.predicted_class)}</strong>
                        <span>Classification #{item.id}</span>
                      </div>
                      <span className={item.review_required ? 'review-tag' : 'success-tag'}>
                        {item.review_required ? 'Review required' : 'Classified'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* AI CLASSIFIER */}

        {page === 'AI Classifier' && (
          <section className="page-content classifier-page">
            <div className="classifier-heading">
              <div>
                <p className="eyebrow">AI WASTE RECOGNITION</p>
                <h1>Waste classifier</h1>
                <p className="subtitle">
                  Upload an image and let AI help identify your waste.
                </p>
              </div>
              <span className="model-badge">
                ✳ AI Model · {result?.model_version || '1.0.0'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 20,
              padding: 15,
              background: '#fbfcf9',
              border: '1px solid #e9eee6',
              borderRadius: 12
            }}>
              <label style={{ ...fieldLabelStyle, flex: '1 1 220px' }}>
                Disposal guidance locality
                <select
                  value={selectedLocality}
                  onChange={event => setSelectedLocality(event.target.value)}
                  style={fieldStyle}
                  disabled={localityLoading || localities.length === 0}
                >
                  {localities.length === 0 && (
                    <option value="">No localities configured</option>
                  )}
                  {localities.map(item => (
                    <option key={item.id} value={item.city}>
                      {item.city}, {item.state}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ color: '#829084', fontSize: 11 }}>
                Guidance is matched to the selected locality.
              </span>
            </div>

            {localityError && <p className="error-message">{localityError}</p>}

            <div className="classifier-layout">
              <div className="panel upload-card">
                <div className="card-heading">
                  <div>
                    <h2>Upload your image</h2>
                    <p>Select one primary waste item to analyse.</p>
                  </div>
                  <span className="step-number">01</span>
                </div>

                <label className={`custom-dropzone ${preview ? 'has-preview' : ''}`}>
                  {preview ? (
                    <img className="image-preview" src={preview} alt="Selected waste item" />
                  ) : (
                    <div className="upload-placeholder">
                      <span className="upload-icon">↑</span>
                      <h3>Choose your waste image</h3>
                      <p>Click below to browse your files</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={chooseFile}
                  />
                </label>

                <div className="upload-file-info">
                  <span className="file-icon">▧</span>
                  <div>
                    <strong>{file ? file.name : 'No image selected'}</strong>
                    <span>
                      {file
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : 'JPG, JPEG or PNG · Maximum 5 MB'}
                    </span>
                  </div>
                </div>

                {error && <p className="error-message">{error}</p>}

                <div className="upload-actions">
                  <button className="secondary-button" onClick={clearImage}>
                    Clear
                  </button>
                  <button
                    className="primary-button"
                    onClick={classifyImage}
                    disabled={!file || loading}
                  >
                    {loading ? 'Analysing...' : '✳ Analyse image'}
                  </button>
                </div>

                <p className="privacy-note">AI-assisted educational decision support.</p>
              </div>

              <div className="panel prediction-card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">AI ANALYSIS</p>
                    <h2>Classification result</h2>
                  </div>
                  <span className="result-symbol">✳</span>
                </div>

                {!result ? (
                  <div className="result-empty">
                    <div className="empty-illustration">♧</div>
                    <h3>Your result will appear here</h3>
                    <p>
                      Upload a waste image and select Analyse image to see the predicted category and confidence.
                    </p>
                  </div>
                ) : (
                  <div className="prediction-details">
                    <span className="result-label">
                      {result.status === 'manual_review'
                        ? 'REVIEW REQUIRED'
                        : 'PREDICTED CATEGORY'}
                    </span>

                    <h2 className="prediction-name">
                      {result.status === 'manual_review'
                        ? 'Needs review'
                        : formatCategory(result.predicted_class)}
                    </h2>

                    {result.status === 'manual_review' && (
                      <p className="prediction-category">
                        Model's suggested category: {formatCategory(result.predicted_class)}
                      </p>
                    )}

                    <div className="confidence-section">
                      <div className="confidence-heading">
                        <span>Model confidence</span>
                        <strong>{formatPercentage(result.confidence_percentage)}%</strong>
                      </div>
                      <div className="confidence-track">
                        <div
                          className="confidence-fill"
                          style={{
                            width: `${Math.min(100, Math.max(0, Number(result.confidence_percentage) || 0))}%`
                          }}
                        />
                      </div>
                    </div>

                    <div style={{
                      marginTop: 28,
                      padding: 20,
                      background: '#f5f8f3',
                      borderRadius: 14,
                      border: '1px solid #e1e9dd'
                    }}>
                      <p className="eyebrow">MODEL ANALYSIS</p>
                      <h3 style={{ marginTop: 5, color: '#304b35' }}>Top 3 predictions</h3>

                      {topPredictions.length ? (
                        topPredictions.map((prediction, index) => {
                          const percentage = Math.min(
                            100,
                            Math.max(0, Number(prediction.confidence_percentage) || 0)
                          )

                          return (
                            <div key={`${prediction.category}-${index}`} style={{ marginTop: 16 }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: 7,
                                color: '#344b37',
                                fontSize: 13
                              }}>
                                <strong>
                                  {index + 1}. {formatCategory(prediction.category)}
                                </strong>
                                <strong>
                                  {formatPercentage(prediction.confidence_percentage)}%
                                </strong>
                              </div>
                              <div style={{
                                height: 8,
                                background: '#e3e9df',
                                borderRadius: 20,
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${percentage}%`,
                                  height: '100%',
                                  background: index === 0 ? '#648b5d' : '#9bb58f'
                                }} />
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p>No additional prediction details were returned.</p>
                      )}
                    </div>

                    <div className="result-meta">
                      <div>
                        <span>Classification ID</span>
                        <strong>#{result.classification_id}</strong>
                      </div>
                      <div>
                        <span>Model version</span>
                        <strong>{result.model_version || 'Unknown'}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 12, color: '#71806d' }}>
                      Confidence threshold: {(confidenceThreshold * 100).toFixed(0)}%
                    </div>

                    {result.request_id && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: '#899487',
                        overflowWrap: 'anywhere'
                      }}>
                        Request ID: {result.request_id}
                      </div>
                    )}

                    {result.review_required ? (
                      <div className="review-notice">
                        <strong>Manual review recommended</strong>
                        <p>
                          Confidence is below the configured threshold of {(confidenceThreshold * 100).toFixed(0)}%.
                          This prediction is not confirmed. Disposal guidance is hidden until the category has been
                          verified. Please verify the item in Reviewer Queue.
                        </p>
                        <button
                          className="secondary-button"
                          onClick={() => setPage('Reviewer Queue')}
                        >
                          Open Reviewer Queue
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="classified-notice">
                          <strong>✓ Classification completed</strong>
                          <p>
                            The prediction meets the configured confidence threshold. It is still an AI prediction, not a guarantee.
                          </p>
                        </div>

                        <div style={{ marginTop: 20 }}>
                          <p className="eyebrow">LOCAL SORTING GUIDANCE</p>
                          <h3 style={{ color: '#304b35', margin: '5px 0 12px' }}>
                            {formatCategory(result.predicted_class)} · {selectedLocality || 'Locality not selected'}
                          </h3>

                          <GuidanceContent
                            response={classifierGuidance}
                            loading={classifierGuidanceLoading}
                            error={classifierGuidanceError}
                          />

                          <button
                            className="secondary-button"
                            style={{ marginTop: 12 }}
                            onClick={() => setPage('Guidance')}
                          >
                            Open Guidance page
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="result-footer">
                  <span>WasteWise Intelligence</span>
                  <span>AI-assisted decision support</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* GUIDANCE */}

        {page === 'Guidance' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">LOCAL WASTE SORTING INFORMATION</p>
                <h1>Sorting guidance</h1>
                <p className="subtitle">
                  Find approved disposal and preparation instructions for a waste category in your locality.
                </p>
              </div>
              <span className="model-badge">♧ Local guidance</span>
            </div>

            <div className="panel" style={{ marginBottom: 20 }}>
              <p className="eyebrow">FIND LOCAL INSTRUCTIONS</p>
              <h2 style={{ marginTop: 0 }}>
                Choose your waste category and locality
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 16,
                marginTop: 18
              }}>
                <label style={fieldLabelStyle}>
                  Waste category
                  <select
                    value={guidanceCategory}
                    onChange={event => setGuidanceCategory(event.target.value)}
                    style={fieldStyle}
                  >
                    {WASTE_CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {formatCategory(category)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldLabelStyle}>
                  Locality
                  <select
                    value={selectedLocality}
                    onChange={event => setSelectedLocality(event.target.value)}
                    style={fieldStyle}
                    disabled={localityLoading || localities.length === 0}
                  >
                    {localities.length === 0 && (
                      <option value="">No localities configured</option>
                    )}
                    {localities.map(item => (
                      <option key={item.id} value={item.city}>
                        {item.city}, {item.state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {localityLoading && <p className="empty-state">Loading localities...</p>}
              {localityError && <p className="error-message" role="alert">{localityError}</p>}

              <p style={{ color: '#899487', fontSize: 11, lineHeight: 1.6, marginBottom: 0 }}>
                Only guidance approved for the exact selected locality is displayed. WasteWise does not automatically substitute rules from another city.
              </p>
            </div>

            <div className="panel">
              <p className="eyebrow">GUIDANCE RESULT</p>
              <h2 style={{ marginTop: 0 }}>
                {formatCategory(guidanceCategory)} in {selectedLocality || 'selected locality'}
              </h2>
              <GuidanceContent
                response={guidanceResponse}
                loading={guidanceLoading}
                error={guidanceError}
              />
            </div>

            <div className="panel" style={{ marginTop: 20 }}>
              <p className="eyebrow">IMPORTANT INFORMATION</p>
              <h2>Use local rules responsibly</h2>
              <p>
                Waste collection and recycling acceptance can differ between municipalities and service providers.
                Check with your local municipal authority if no approved instruction is available or if an item is unusual,
                hazardous, contaminated, or part of a special waste stream.
              </p>
              <p style={{ color: '#899487', fontSize: 11, marginBottom: 0 }}>
                Guidance is informational and does not replace official municipal instructions.
              </p>
            </div>
          </section>
        )}

        {/* HISTORY */}

        {page === 'History' && (
          <section className="page-content">
            <p className="eyebrow">YOUR CLASSIFICATION RECORDS</p>
            <h1>Classification history</h1>
            <p className="subtitle">Results currently available from the backend.</p>

            <div className="panel">
              {history.length === 0 ? (
                <p className="empty-state">No classification records found.</p>
              ) : (
                history.map(item => (
                  <div className="history-row" key={item.id}>
                    <div>
                      <strong>{formatCategory(item.predicted_class)}</strong>
                      <span>
                        Record #{item.id} · {(item.confidence * 100).toFixed(2)}% confidence
                      </span>
                    </div>
                    <span className={item.review_required ? 'review-tag' : 'success-tag'}>
                      {item.review_required ? 'Review required' : 'Classified'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ANALYTICS */}

        {page === 'Analytics' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">DATABASE-DRIVEN INSIGHTS</p>
                <h1>Waste analytics</h1>
                <p className="subtitle">
                  Explore classification activity and model confidence using your recorded data.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={loadAnalytics}
                disabled={analyticsLoading}
              >
                {analyticsLoading ? 'Refreshing...' : '↻ Refresh analytics'}
              </button>
            </div>

            {analyticsError && (
              <div className="error-message" role="alert">{analyticsError}</div>
            )}

            {analyticsLoading && !analytics && (
              <div className="panel">
                <p className="empty-state">Loading analytics from the database...</p>
              </div>
            )}

            {!analyticsLoading && !analytics && !analyticsError && (
              <div className="panel">
                <p className="empty-state">No analytics data is available yet.</p>
              </div>
            )}

            {analytics && (
              <>
                <div
                  className="stats-grid analytics-stats-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
                    gap: 16
                  }}
                >
                  <div className="stat-card">
                    <span>Total classifications</span>
                    <h2>{analytics.summary?.total_classifications ?? 0}</h2>
                    <p>All records in the database</p>
                  </div>
                  <div className="stat-card">
                    <span>Successfully classified</span>
                    <h2>{analytics.summary?.classified_count ?? 0}</h2>
                    <p>{Number(analytics.summary?.classified_percentage ?? 0).toFixed(2)}% of all records</p>
                  </div>
                  <div className="stat-card">
                    <span>Manual reviews</span>
                    <h2>{analytics.summary?.manual_review_count ?? 0}</h2>
                    <p>{Number(analytics.summary?.manual_review_percentage ?? 0).toFixed(2)}% need attention</p>
                  </div>
                  <div className="stat-card">
                    <span>Average confidence</span>
                    <h2>{Number(analytics.summary?.average_confidence_percentage ?? 0).toFixed(2)}%</h2>
                    <p>Mean model confidence</p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                  gap: 20,
                  marginTop: 22
                }}>
                  <div className="panel">
                    <p className="eyebrow">WASTE BREAKDOWN</p>
                    <h2>Category distribution</h2>
                    <p className="subtitle">Share of recorded predictions by category.</p>

                    {analytics.category_distribution?.length ? (
                      <>
                        <div style={{ width: '100%', height: 290, marginTop: 12 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.category_distribution}
                                dataKey="count"
                                nameKey="category"
                                cx="50%"
                                cy="48%"
                                outerRadius={95}
                                innerRadius={48}
                                paddingAngle={3}
                              >
                                {analytics.category_distribution.map((entry, index) => (
                                  <Cell
                                    key={`${entry.category}-${index}`}
                                    fill={['#648b5d', '#9bb58f', '#c5d6b8', '#d8c49a', '#9aa99a', '#7b9b87'][index % 6]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend formatter={formatCategory} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {analytics.category_distribution.map(item => (
                          <div
                            key={item.category}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginTop: 10,
                              fontSize: 13
                            }}
                          >
                            <span>{formatCategory(item.category)}</span>
                            <strong>
                              {item.count} · {Number(item.percentage ?? 0).toFixed(2)}%
                            </strong>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="empty-state">No category records are available yet.</p>
                    )}
                  </div>

                  <div className="panel">
                    <p className="eyebrow">CLASSIFICATION ACTIVITY</p>
                    <h2>Daily classification trend</h2>
                    <p className="subtitle">
                      Number of images classified on each recorded date.
                    </p>

                    {analytics.daily_trend?.length ? (
                      <div style={{ width: '100%', height: 340, marginTop: 20 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analytics.daily_trend}
                            margin={{ top: 10, right: 12, left: -18, bottom: 8 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#e7ede4"
                            />
                            <XAxis dataKey="date" tick={{ fill: '#74846f', fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                              dataKey="count"
                              name="Classifications"
                              fill="#648b5d"
                              radius={[7, 7, 0, 0]}
                              maxBarSize={54}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="empty-state">No daily activity has been recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="panel" style={{ marginTop: 22 }}>
                  <p className="eyebrow">REVIEW PERFORMANCE</p>
                  <h2>Classification status</h2>

                  {[
                    ['Classified results', analytics.summary?.classified_percentage, '#648b5d'],
                    ['Manual review', analytics.summary?.manual_review_percentage, '#c69b58']
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ marginTop: 17 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 7,
                        fontSize: 13
                      }}>
                        <span>{label}</span>
                        <strong>{Number(value ?? 0).toFixed(2)}%</strong>
                      </div>
                      <div style={{
                        height: 10,
                        background: '#e8eee5',
                        borderRadius: 20,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(0, Number(value ?? 0)))}%`,
                          background: color
                        }} />
                      </div>
                    </div>
                  ))}

                  <p style={{ color: '#74846f', fontSize: 12, marginTop: 16 }}>
                    Manual review is triggered when model confidence falls below the configured threshold.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {/* FEEDBACK */}

        {page === 'Feedback' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">HUMAN-IN-THE-LOOP IMPROVEMENT</p>
                <h1>Classification feedback</h1>
                <p className="subtitle">
                  Confirm an AI prediction or report the correct waste category.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={loadFeedback}
                disabled={feedbackLoading}
              >
                {feedbackLoading ? 'Refreshing...' : '↻ Refresh feedback'}
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: 20,
              alignItems: 'start'
            }}>
              <div className="panel">
                <p className="eyebrow">SHARE YOUR REVIEW</p>
                <h2 style={{ marginTop: 0 }}>Submit feedback</h2>
                <p className="subtitle">
                  Select a previous classification and tell us whether its prediction was correct.
                </p>

                <form onSubmit={submitFeedback} style={{ display: 'grid', gap: 15 }}>
                  <label style={fieldLabelStyle}>
                    Classification record
                    <select
                      value={feedbackClassificationId}
                      onChange={event => setFeedbackClassificationId(event.target.value)}
                      required
                      style={fieldStyle}
                    >
                      <option value="">Choose a classification</option>
                      {history.map(item => (
                        <option key={item.id} value={item.id}>
                          #{item.id} · {formatCategory(item.predicted_class)} · {(Number(item.confidence) * 100).toFixed(2)}% confidence
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'grid', gap: 9 }}>
                    <span style={{ color: '#52644f', fontSize: 13, fontWeight: 600 }}>
                      Was the AI prediction correct?
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <label>
                        <input
                          type="radio"
                          name="feedbackType"
                          value="correct"
                          checked={feedbackType === 'correct'}
                          onChange={() => {
                            setFeedbackType('correct')
                            setCorrectedCategory('')
                          }}
                        />
                        {' '}Correct
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="feedbackType"
                          value="incorrect"
                          checked={feedbackType === 'incorrect'}
                          onChange={() => setFeedbackType('incorrect')}
                        />
                        {' '}Incorrect
                      </label>
                    </div>
                  </div>

                  {feedbackType === 'incorrect' && (
                    <label style={fieldLabelStyle}>
                      Correct waste category
                      <select
                        value={correctedCategory}
                        onChange={event => setCorrectedCategory(event.target.value)}
                        required
                        style={fieldStyle}
                      >
                        <option value="">Select the correct category</option>
                        {WASTE_CATEGORIES.map(category => (
                          <option key={category} value={category}>
                            {formatCategory(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label style={fieldLabelStyle}>
                    Comments (optional)
                    <textarea
                      value={feedbackComments}
                      onChange={event => setFeedbackComments(event.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Add a short note about this classification..."
                      style={{ ...fieldStyle, resize: 'vertical' }}
                    />
                  </label>

                  {feedbackError && <p className="error-message" role="alert">{feedbackError}</p>}
                  {feedbackMessage && <p className="success-tag" role="status">{feedbackMessage}</p>}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={feedbackSubmitting || history.length === 0}
                  >
                    {feedbackSubmitting ? 'Submitting...' : 'Submit feedback'}
                  </button>
                </form>
              </div>

              <div className="panel">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <p className="eyebrow">REVIEW HISTORY</p>
                    <h2 style={{ marginTop: 0 }}>Submitted feedback</h2>
                  </div>
                  <span className="model-badge">{feedback.length} records</span>
                </div>

                {feedbackLoading ? (
                  <p className="empty-state">Loading feedback from the database...</p>
                ) : feedbackError && feedback.length === 0 ? (
                  <p className="error-message" role="alert">{feedbackError}</p>
                ) : feedback.length === 0 ? (
                  <p className="empty-state">No feedback has been submitted yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {feedback.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: 14,
                          border: '1px solid #e4ebe0',
                          borderRadius: 11,
                          background: '#fbfcfa'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap'
                        }}>
                          <strong style={{ color: '#304b35', fontSize: 14 }}>
                            Classification #{item.classification_id}
                          </strong>
                          <span className={item.feedback_type === 'correct' ? 'success-tag' : 'review-tag'}>
                            {item.feedback_type === 'correct' ? 'Marked correct' : 'Marked incorrect'}
                          </span>
                        </div>

                        {item.corrected_category && (
                          <p style={{ color: '#52644f', fontSize: 13 }}>
                            Correct category: <strong>{formatCategory(item.corrected_category)}</strong>
                          </p>
                        )}

                        {item.comments && (
                          <p style={{ color: '#657461', fontSize: 13, lineHeight: 1.5 }}>
                            “{item.comments}”
                          </p>
                        )}

                        <p style={{ color: '#899487', fontSize: 11 }}>
                          Feedback #{item.id} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Date unavailable'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p style={{ marginTop: 16, color: '#899487', fontSize: 12 }}>
              Feedback is stored for review. Submitting feedback does not automatically retrain or change the AI model.
            </p>
          </section>
        )}

        {/* REVIEWER QUEUE */}

        {page === 'Reviewer Queue' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">HUMAN REVIEW WORKSPACE</p>
                <h1>Reviewer Queue</h1>
                <p className="subtitle">
                  Verify low-confidence predictions and record the final waste category.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={loadReviewerQueue}
                disabled={reviewLoading}
              >
                {reviewLoading ? 'Refreshing...' : '↻ Refresh queue'}
              </button>
            </div>

            <div className="stats-grid" style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))'
            }}>
              <div className="stat-card">
                <span>Pending reviews</span>
                <h2>{reviewQueue.length}</h2>
                <p>Awaiting a reviewer decision</p>
              </div>
              <div className="stat-card">
                <span>Review actions</span>
                <h2>2</h2>
                <p>Approve or correct a prediction</p>
              </div>
            </div>

            {reviewMessage && (
              <p className="success-tag" role="status" style={{ display: 'inline-block', marginTop: 18 }}>
                {reviewMessage}
              </p>
            )}

            {reviewError && (
              <p className="error-message" role="alert" style={{ marginTop: 18 }}>
                {reviewError}
              </p>
            )}

            {reviewLoading ? (
              <div className="panel" style={{ marginTop: 20 }}>
                <p className="empty-state">Loading pending classifications...</p>
              </div>
            ) : reviewQueue.length === 0 ? (
              <div className="panel" style={{
                marginTop: 20,
                textAlign: 'center',
                padding: 35
              }}>
                <div className="empty-illustration">✓</div>
                <h2>Queue is clear</h2>
                <p className="empty-state">
                  There are no classifications waiting for manual review.
                </p>
                <button className="primary-button" onClick={() => setPage('AI Classifier')}>
                  Classify another image
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 18, marginTop: 20 }}>
                {reviewQueue.map(item => {
                  const isSubmitting = reviewSubmittingId === item.classification_id

                  return (
                    <div className="panel" key={item.classification_id}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 14,
                        flexWrap: 'wrap'
                      }}>
                        <div>
                          <p className="eyebrow">PENDING CLASSIFICATION</p>
                          <h2 style={{ margin: '5px 0' }}>
                            Record #{item.classification_id}
                          </h2>
                          <p style={{ margin: 0, color: '#657461', fontSize: 13 }}>
                            Submitted {item.created_at ? new Date(item.created_at).toLocaleString() : 'Date unavailable'}
                          </p>
                        </div>
                        <span className="review-tag">Review required</span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                        marginTop: 18
                      }}>
                        <div style={{ padding: 14, background: '#f5f8f3', borderRadius: 10 }}>
                          <span style={{ color: '#74846f', fontSize: 12 }}>AI predicted category</span>
                          <h3 style={{ color: '#304b35', margin: '6px 0 0' }}>
                            {formatCategory(item.predicted_class)}
                          </h3>
                        </div>
                        <div style={{ padding: 14, background: '#f5f8f3', borderRadius: 10 }}>
                          <span style={{ color: '#74846f', fontSize: 12 }}>Model confidence</span>
                          <h3 style={{ color: '#304b35', margin: '6px 0 0' }}>
                            {formatPercentage(item.confidence_percentage)}%
                          </h3>
                        </div>
                      </div>

                      <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
                        <label style={fieldLabelStyle}>
                          Corrected waste category
                          <select
                            value={reviewCategories[item.classification_id] || ''}
                            onChange={event => setReviewCategories(current => ({
                              ...current,
                              [item.classification_id]: event.target.value
                            }))}
                            style={fieldStyle}
                          >
                            <option value="">Select only if correcting the prediction</option>
                            {WASTE_CATEGORIES.map(category => (
                              <option key={category} value={category}>
                                {formatCategory(category)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={fieldLabelStyle}>
                          Reviewer notes (optional)
                          <textarea
                            value={reviewNotes[item.classification_id] || ''}
                            onChange={event => setReviewNotes(current => ({
                              ...current,
                              [item.classification_id]: event.target.value
                            }))}
                            rows={2}
                            maxLength={1000}
                            placeholder="Explain why you approved or corrected this prediction..."
                            style={{ ...fieldStyle, resize: 'vertical' }}
                          />
                        </label>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginTop: 18
                      }}>
                        <button
                          className="primary-button"
                          disabled={isSubmitting}
                          onClick={() => submitReview(item, 'approve')}
                        >
                          {isSubmitting ? 'Saving...' : '✓ Approve prediction'}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={
                            isSubmitting ||
                            !(reviewCategories[item.classification_id] || '').trim()
                          }
                          onClick={() => submitReview(item, 'correct')}
                        >
                          {isSubmitting ? 'Saving...' : 'Correct category'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p style={{ marginTop: 16, color: '#899487', fontSize: 12 }}>
              Review decisions are saved to the database audit history. Correcting a category updates the stored classification; approving keeps the AI-predicted category.
            </p>
          </section>
        )}

        {/* ADMINISTRATION */}

        {page === 'Administration' && (
          <section className="page-content">
            <div className="welcome-section">
              <div>
                <p className="eyebrow">SYSTEM MANAGEMENT</p>
                <h1>Administration</h1>
                <p className="subtitle">
                  Create, manage, review, approve, and archive local waste guidance.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={loadAdminGuidance}
                disabled={adminLoading}
              >
                {adminLoading ? 'Refreshing...' : '↻ Refresh records'}
              </button>
            </div>

            <div className="stats-grid" style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))'
            }}>
              <div className="stat-card">
                <span>Total guidance records</span>
                <h2>{adminGuidance.length}</h2>
                <p>All stored guidance versions</p>
              </div>
              <div className="stat-card">
                <span>Approved and active</span>
                <h2>{approvedGuidanceCount}</h2>
                <p>Approved records not archived</p>
              </div>
              <div className="stat-card">
                <span>Drafts awaiting approval</span>
                <h2>{draftGuidanceCount}</h2>
                <p>Not currently shown to users</p>
              </div>
              <div className="stat-card">
                <span>Archived records</span>
                <h2>{archivedGuidanceCount}</h2>
                <p>Hidden from public guidance</p>
              </div>
            </div>

            {adminMessage && (
              <div
                className="success-tag"
                role="status"
                style={{ display: 'inline-block', marginTop: 18 }}
              >
                {adminMessage}
              </div>
            )}

            {adminError && (
              <p className="error-message" role="alert" style={{ marginTop: 18 }}>
                {adminError}
              </p>
            )}
            <UserManagement />
            {/* CREATE OR EDIT GUIDANCE FORM */}

            <div className="panel" style={{ marginTop: 22 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <div>
                  <p className="eyebrow">
                    {editingGuidanceId ? 'UPDATE EXISTING RECORD' : 'NEW GUIDANCE RECORD'}
                  </p>
                  <h2 style={{ marginTop: 0 }}>
                    {editingGuidanceId
                      ? `Edit guidance #${editingGuidanceId}`
                      : 'Create guidance draft'}
                  </h2>
                </div>

                {editingGuidanceId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetGuidanceForm}
                  >
                    Cancel editing
                  </button>
                )}
              </div>

              <p className="subtitle">
                New records are saved as drafts. They must have a source name and source URL before approval.
                Editing an approved record resets its approval and creates a new version.
              </p>

              {localityLoading ? (
                <p className="empty-state">Loading configured localities...</p>
              ) : localities.length === 0 ? (
                <p className="error-message">
                  No active localities are available. Add an active locality before creating guidance.
                </p>
              ) : (
                <form onSubmit={saveGuidance} style={{ display: 'grid', gap: 17 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                    gap: 15
                  }}>
                    <label style={fieldLabelStyle}>
                      Waste category *
                      <select
                        name="category_code"
                        value={guidanceForm.category_code}
                        onChange={updateGuidanceForm}
                        style={fieldStyle}
                        required
                      >
                        {WASTE_CATEGORIES.map(category => (
                          <option key={category} value={category}>
                            {formatCategory(category)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={fieldLabelStyle}>
                      Locality *
                      <select
                        name="locality_id"
                        value={guidanceForm.locality_id}
                        onChange={updateGuidanceForm}
                        style={fieldStyle}
                        required
                      >
                        <option value="">Select a locality</option>
                        {localities.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.city}, {item.state}, {item.country}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={fieldLabelStyle}>
                      Accepted status *
                      <select
                        name="accepted_status"
                        value={guidanceForm.accepted_status}
                        onChange={updateGuidanceForm}
                        style={fieldStyle}
                        required
                      >
                        {ACCEPTED_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label style={fieldLabelStyle}>
                    Instruction title *
                    <input
                      name="instruction_title"
                      value={guidanceForm.instruction_title}
                      onChange={updateGuidanceForm}
                      maxLength={200}
                      required
                      placeholder="Example: Prepare plastic bottles for collection"
                      style={fieldStyle}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    Instruction text *
                    <textarea
                      name="instruction_text"
                      value={guidanceForm.instruction_text}
                      onChange={updateGuidanceForm}
                      rows={4}
                      required
                      placeholder="Explain the local disposal or collection instructions..."
                      style={{ ...fieldStyle, resize: 'vertical' }}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    Preparation advice
                    <textarea
                      name="preparation_advice"
                      value={guidanceForm.preparation_advice}
                      onChange={updateGuidanceForm}
                      rows={3}
                      placeholder="Explain how the item should be cleaned, separated, or prepared..."
                      style={{ ...fieldStyle, resize: 'vertical' }}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    Exceptions and special notes
                    <textarea
                      name="exceptions"
                      value={guidanceForm.exceptions}
                      onChange={updateGuidanceForm}
                      rows={3}
                      placeholder="Mention exceptions, contamination rules, or special collection conditions..."
                      style={{ ...fieldStyle, resize: 'vertical' }}
                    />
                  </label>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                    gap: 15
                  }}>
                    <label style={fieldLabelStyle}>
                      Source name *
                      <input
                        name="source_name"
                        value={guidanceForm.source_name}
                        onChange={updateGuidanceForm}
                        maxLength={200}
                        required
                        placeholder="Example: Municipal Corporation"
                        style={fieldStyle}
                      />
                    </label>

                    <label style={fieldLabelStyle}>
                      Source URL *
                      <input
                        name="source_url"
                        type="url"
                        value={guidanceForm.source_url}
                        onChange={updateGuidanceForm}
                        maxLength={1000}
                        required
                        placeholder="https://example.gov.in/waste-guidelines"
                        style={fieldStyle}
                      />
                    </label>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                    gap: 15
                  }}>
                    <label style={fieldLabelStyle}>
                      Effective from
                      <input
                        name="effective_from"
                        type="date"
                        value={guidanceForm.effective_from}
                        onChange={updateGuidanceForm}
                        style={fieldStyle}
                      />
                    </label>

                    <label style={fieldLabelStyle}>
                      Effective until
                      <input
                        name="effective_to"
                        type="date"
                        value={guidanceForm.effective_to}
                        onChange={updateGuidanceForm}
                        min={guidanceForm.effective_from || undefined}
                        style={fieldStyle}
                      />
                    </label>
                  </div>

                  <div style={{
                    padding: 13,
                    background: '#fff7e8',
                    border: '1px solid #f0e2c5',
                    borderRadius: 9,
                    color: '#806437',
                    fontSize: 12,
                    lineHeight: 1.7
                  }}>
                    <strong>Approval requirement:</strong> A draft is not visible to ordinary users.
                    Provide a valid source name and URL, then use the Approve action after saving.
                    Editing a record automatically resets its approval.
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={adminSubmitting}
                    >
                      {adminSubmitting
                        ? 'Saving...'
                        : editingGuidanceId
                          ? 'Save guidance changes'
                          : 'Create guidance draft'}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={resetGuidanceForm}
                      disabled={adminSubmitting}
                    >
                      Clear form
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* GUIDANCE RECORDS TABLE */}

            <div className="panel" style={{ marginTop: 22 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <div>
                  <p className="eyebrow">GUIDANCE DATABASE</p>
                  <h2 style={{ marginTop: 0 }}>Manage guidance records</h2>
                </div>
                <span className="model-badge">
                  {adminGuidance.length} records
                </span>
              </div>

              {adminLoading ? (
                <p className="empty-state">Loading guidance records...</p>
              ) : adminGuidance.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 25 }}>
                  <div className="empty-illustration">♧</div>
                  <h3>No guidance records yet</h3>
                  <p className="empty-state">
                    Create your first guidance draft using the form above.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {adminGuidance.map(record => {
                    const locality = localities.find(
                      item => item.id === record.locality_id
                    )

                    const archived = Boolean(record.is_archived)
                    const approved = Boolean(record.is_approved) && !archived

                    return (
                      <div
                        key={record.id}
                        style={{
                          padding: 17,
                          border: '1px solid #e3eade',
                          borderRadius: 12,
                          background: '#fbfcfa'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                          flexWrap: 'wrap'
                        }}>
                          <div>
                            <p className="eyebrow" style={{ marginBottom: 5 }}>
                              GUIDANCE #{record.id} · VERSION {record.version}
                            </p>
                            <h3 style={{ margin: '4px 0', color: '#304b35' }}>
                              {record.instruction_title}
                            </h3>
                            <p style={{
                              color: '#71806d',
                              fontSize: 12,
                              margin: '5px 0'
                            }}>
                              {formatCategory(record.category_code)} · {locality
                                ? `${locality.city}, ${locality.state}`
                                : `Locality ID ${record.locality_id}`}
                            </p>
                          </div>

                          <span className={
                            archived
                              ? 'review-tag'
                              : approved
                                ? 'success-tag'
                                : 'model-badge'
                          }>
                            {guidanceStatus(record)}
                          </span>
                        </div>

                        <p style={{
                          color: '#61715e',
                          fontSize: 13,
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap'
                        }}>
                          {record.instruction_text}
                        </p>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 10,
                          marginTop: 12
                        }}>
                          <div>
                            <span style={{ color: '#91a092', fontSize: 10, display: 'block' }}>
                              ACCEPTED STATUS
                            </span>
                            <strong style={{ color: '#52644f', fontSize: 12 }}>
                              {record.accepted_status || 'Unknown'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#91a092', fontSize: 10, display: 'block' }}>
                              SOURCE
                            </span>
                            <strong style={{ color: '#52644f', fontSize: 12 }}>
                              {record.source_name || 'Not provided'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#91a092', fontSize: 10, display: 'block' }}>
                              REVIEWED BY
                            </span>
                            <strong style={{ color: '#52644f', fontSize: 12 }}>
                              {record.reviewed_by || 'Not reviewed'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#91a092', fontSize: 10, display: 'block' }}>
                              EFFECTIVE UNTIL
                            </span>
                            <strong style={{ color: '#52644f', fontSize: 12 }}>
                              {record.effective_to ? formatDate(record.effective_to) : 'No end date'}
                            </strong>
                          </div>
                        </div>

                        {record.source_url && (
                          <p style={{ fontSize: 12, marginTop: 10 }}>
                            <a
                              href={record.source_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#477653' }}
                            >
                              View source document
                            </a>
                          </p>
                        )}

                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 9,
                          marginTop: 15,
                          borderTop: '1px solid #e7ede4',
                          paddingTop: 14
                        }}>
                          {!archived && (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => editGuidance(record)}
                                disabled={adminSubmitting}
                              >
                                Edit
                              </button>

                              {!approved && (
                                <button
                                  type="button"
                                  className="primary-button"
                                  onClick={() => approveGuidance(record)}
                                  disabled={adminSubmitting}
                                >
                                  Approve guidance
                                </button>
                              )}

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => archiveGuidance(record)}
                                disabled={adminSubmitting}
                              >
                                Archive
                              </button>
                            </>
                          )}

                          {archived && (
                            <span style={{ color: '#899487', fontSize: 12 }}>
                              This record is archived and cannot be approved.
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="panel" style={{ marginTop: 20 }}>
              <p className="eyebrow">ADMINISTRATOR NOTES</p>
              <h2>Guidance approval workflow</h2>
              <ol style={{
                color: '#657461',
                fontSize: 13,
                lineHeight: 1.9,
                paddingLeft: 20
              }}>
                <li>Create a draft with the correct waste category and locality.</li>
                <li>Enter the instruction and supporting source name and URL.</li>
                <li>Review the information before approving it.</li>
                <li>Approved, current guidance becomes available on the public Guidance page.</li>
                <li>Editing an approved record creates a new version and resets approval.</li>
                <li>Archived records are hidden from public guidance results.</li>
              </ol>
              <p style={{ color: '#899487', fontSize: 11, marginBottom: 0 }}>
                Only an authenticated administrator can access these management endpoints.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
