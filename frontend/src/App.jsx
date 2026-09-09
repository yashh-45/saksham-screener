import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Info,
  UserPlus,
  Users,
  Activity,
  Download,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ClipboardCheck,
  Eye,
  RefreshCw
} from 'lucide-react';

// In production (Vercel), VITE_API_BASE is set to the Render backend URL.
// In local dev this falls back to localhost (the Vite proxy handles it).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('screener');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showNewStudentModal, setShowNewStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('Class 3-B');
  const [newStudentAge, setNewStudentAge] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Manual teacher-observed indicator checkboxes (indicators 3–5)
  const [manualSpacing, setManualSpacing] = useState(false);
  const [manualBaseline, setManualBaseline] = useState(false);
  const [manualSizing, setManualSizing] = useState(false);

  const [studentHistory, setStudentHistory] = useState([]);
  const [modelStats, setModelStats] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStudents();
    fetchModelStats();
  }, []);

  useEffect(() => {
    if (selectedStudentId) fetchStudentDetails(selectedStudentId);
  }, [selectedStudentId]);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        if (data.length > 0 && !selectedStudentId) setSelectedStudentId(data[0].id);
      }
    } catch (err) { console.warn('Could not fetch students:', err); }
  };

  const fetchStudentDetails = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/students/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStudentHistory(data.scans || []);
      }
    } catch (err) { console.warn('Could not fetch student details:', err); }
  };

  const fetchModelStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/model/validation-stats`);
      if (res.ok) setModelStats(await res.json());
    } catch (err) { console.warn('Could not fetch model stats:', err); }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      const body = {
        name: newStudentName.trim(),
        class_section: newStudentClass.trim() || 'General',
      };
      if (newStudentAge) body.age_years = parseInt(newStudentAge);
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        setStudents([created, ...students]);
        setSelectedStudentId(created.id);
        setNewStudentName(''); setNewStudentAge('');
        setShowNewStudentModal(false);
        setStatusMessage({ type: 'success', text: `Added student ${created.name}` });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to create student' });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setScanResult(null);
    }
  };

  const loadSample = async (sampleName, label) => {
    try {
      const res = await fetch(`/samples/${sampleName}`);
      const blob = await res.blob();
      setSelectedFile(new File([blob], sampleName, { type: 'image/png' }));
      setPreviewUrl(URL.createObjectURL(blob));
      setScanResult(null);
      setStatusMessage({ type: 'info', text: `Loaded test sample: ${label}` });
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) { console.error('Error loading sample:', err); }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !selectedStudentId) return;
    setAnalyzing(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (manualSpacing)  formData.append('manual_irregular_spacing', 'true');
    if (manualBaseline) formData.append('manual_baseline_drift', 'true');
    if (manualSizing)   formData.append('manual_inconsistent_sizing', 'true');

    try {
      const res = await fetch(`${API_BASE}/students/${selectedStudentId}/scans`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Analysis request failed');
      }
      const result = await res.json();
      setScanResult(result);
      fetchStudentDetails(selectedStudentId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Error running analysis' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPdf = async (scanId) => {
    if (!scanId) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${API_BASE}/scans/${scanId}/report`);
      if (!res.ok) throw new Error('Failed to generate report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `saksham_screening_report_${scanId.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      alert('Could not download PDF: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const ind = scanResult?.indicators_found || {};
  const totalCount = ind.total_indicator_count ?? ind.indicator_count ?? 0;
  const isFlagged = totalCount > 0;

  // Developmental warning if age ≤ 7 and reversal detected
  const showDevWarning = ind.Reversal && currentStudent?.age_years && currentStudent.age_years <= 7;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-badge">
            <div className="brand-logo-circle">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="brand-title">
                Saksham
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 999, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                  v1.1 — Sensitivity-Optimised
                </span>
              </div>
              <div className="brand-subtitle">AI Handwriting Screener for Early Learning-Difficulty Detection</div>
            </div>
          </div>
          <nav className="nav-links">
            {[['screener','Screening Studio'],['history','Records & Scans'],['model','Model Transparency'],['about','Scope & Funding']].map(([id, label]) => (
              <button key={id} className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mandatory disclaimer banner */}
      <div className="disclaimer-banner">
        <ShieldAlert size={16} />
        <span>
          <strong>Mandatory Notice:</strong> Saksham is a first-pass classroom screening aid, <strong>not a clinical diagnostic tool</strong>.
          Results flag visual indicators to support professional referral — they must never be interpreted as a medical or psychological diagnosis.
        </span>
      </div>

      {/* Dataset validity notice — surfaces the clinical labelling gap transparently */}
      <div style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', padding: '0.5rem 1.5rem', fontSize: '0.78rem', color: '#92400E', textAlign: 'center' }}>
        <strong>Dataset Note:</strong> Model trained on Gambo Dyslexia Dataset image labels (Kaggle).
        Labels were not independently validated by RCI-certified educational psychologists.
        The 77.1% concordance reflects agreement with image labels, not clinical expert assessment.
      </div>

      {statusMessage && (
        <div style={{
          background: statusMessage.type === 'error' ? '#FEE2E2' : statusMessage.type === 'info' ? '#E0F2FE' : '#DCFCE7',
          color: statusMessage.type === 'error' ? '#991B1B' : statusMessage.type === 'info' ? '#075985' : '#166534',
          padding: '0.6rem 1.5rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600,
        }}>
          {statusMessage.text}
        </div>
      )}

      <main className="main-wrapper">
        {/* ── TAB 1: SCREENER ─────────────────────────────────────────────────── */}
        {activeTab === 'screener' && (
          <div className="grid-two-cols">
            {/* LEFT: Student + Upload + Manual Indicators */}
            <div className="card">
              <div className="card-title"><FileText size={20} color="#2563EB" /><span>1. Student & Handwriting Sample</span></div>
              <p className="card-description">Upload a clear image of a handwriting sample, then assess the 3 teacher-observed indicators below before running analysis.</p>

              {/* Student Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Active Student</label>
                  <button onClick={() => setShowNewStudentModal(true)} style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <UserPlus size={14} /> + New Student
                  </button>
                </div>
                <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.class_section}{s.age_years ? `, age ${s.age_years}` : ''})
                    </option>
                  ))}
                </select>
                {currentStudent?.age_years && currentStudent.age_years <= 7 && (
                  <div style={{ marginTop: 5, padding: '0.45rem 0.65rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, fontSize: '0.78rem', color: '#92400E' }}>
                    ⚠️ Student is {currentStudent.age_years} years old. Letter reversals are <strong>developmentally normal</strong> up to age 7 — interpret with caution.
                  </div>
                )}
              </div>

              {/* New Student Modal */}
              {showNewStudentModal && (
                <div style={{ padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Register Student</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input type="text" className="form-input" placeholder="Full name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
                    <input type="text" className="form-input" placeholder="Class" value={newStudentClass} onChange={(e) => setNewStudentClass(e.target.value)} />
                    <input type="number" className="form-input" placeholder="Age" min="4" max="18" value={newStudentAge} onChange={(e) => setNewStudentAge(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowNewStudentModal(false)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#64748B' }}>Cancel</button>
                    <button onClick={handleCreateStudent} style={{ padding: '0.35rem 0.85rem', background: '#2563EB', color: '#FFF', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>Save</button>
                  </div>
                </div>
              )}

              {/* Upload dropzone */}
              <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} />
                <UploadCloud className="dropzone-icon" />
                <div className="dropzone-text">{selectedFile ? selectedFile.name : 'Click to select or drag & drop handwriting image'}</div>
                <div className="dropzone-hint">JPEG · PNG · WebP · up to 20 MB</div>
              </div>

              {/* Sample chips */}
              <div className="quick-samples-bar">
                <div className="quick-samples-title"><Sparkles size={13} color="#2563EB" /><span>One-Click Held-Out Test Samples</span></div>
                <div className="quick-samples-buttons">
                  <button className="sample-chip" onClick={() => loadSample('sample_normal.png', 'Typical Writing')}>✓ Typical Writing</button>
                  <button className="sample-chip" onClick={() => loadSample('sample_reversal.png', 'Letter Reversals')}>⚡ Reversal Pattern</button>
                  <button className="sample-chip" onClick={() => loadSample('sample_corrected.png', 'Over-Correction')}>✍ Over-Correction</button>
                </div>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '0.35rem' }}>Image Preview for Inference</div>
                  <div style={{ display: 'inline-block', padding: 4, background: '#FFF', border: '1px solid #CBD5E1', borderRadius: 8 }}>
                    <img src={previewUrl} alt="Preview" style={{ maxHeight: 140, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
              )}

              {/* ── MANUAL INDICATOR CHECKLIST (Indicators 3–5) ──────────────── */}
              <div style={{ marginTop: '1rem', padding: '0.9rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={15} color="#2563EB" />
                  <span>Step 2 — Teacher-Observed Indicators (Indicators 3–5 of 5)</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.75rem' }}>
                  Observe the handwriting sample directly and check any patterns you notice. These complement the automated ML analysis.
                </div>

                {[
                  { key: 'spacing', state: manualSpacing, setter: setManualSpacing, label: 'Irregular Word / Letter Spacing', desc: 'Unusually large or inconsistent gaps between letters or words' },
                  { key: 'baseline', state: manualBaseline, setter: setManualBaseline, label: 'Baseline Drift (text wanders off the line)', desc: 'Writing drifts above or below the ruled line' },
                  { key: 'sizing', state: manualSizing, setter: setManualSizing, label: 'Inconsistent Letter Sizing', desc: 'Erratic variation in letter heights within words' },
                ].map(({ key, state, setter, label, desc }) => (
                  <label key={key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                    padding: '0.65rem 0.75rem', marginBottom: '0.4rem',
                    background: state ? '#FFFBEB' : '#FFFFFF',
                    border: `1px solid ${state ? '#FDE68A' : '#E2E8F0'}`,
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={state}
                      onChange={(e) => setter(e.target.checked)}
                      style={{ marginTop: 2, accentColor: '#D97706', width: 15, height: 15 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0F172A' }}>{label}</div>
                      <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: 2 }}>{desc}</div>
                    </div>
                  </label>
                ))}

                <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 4 }}>
                  {[manualSpacing, manualBaseline, manualSizing].filter(Boolean).length} of 3 teacher-observed indicators selected
                </div>
              </div>

              {/* Run Button */}
              <button
                className="btn-primary"
                disabled={!selectedFile || !selectedStudentId || analyzing}
                onClick={handleAnalyze}
                style={{ marginTop: '1rem' }}
              >
                {analyzing ? (
                  <><RefreshCw className="spinner" size={18} /><span>Running Analysis (TTA + Sensitivity Mode)...</span></>
                ) : (
                  <><span>Run Full 5-Indicator Screening</span><ArrowRight size={18} /></>
                )}
              </button>
            </div>

            {/* RIGHT: Results */}
            <div className="card">
              <div className="card-title"><Activity size={20} color="#2563EB" /><span>2. Screening Results</span></div>
              <p className="card-description">Automated (ML) + teacher-observed indicators combined across all 5 categories from §10 of the project brief.</p>

              {!scanResult && !analyzing && (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1', color: '#64748B' }}>
                  <ClipboardCheck size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.35 }} />
                  <div style={{ fontWeight: 600, color: '#334155' }}>No active screening</div>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Select a student, upload a handwriting image, optionally check teacher-observed indicators, then click Run.
                  </div>
                </div>
              )}

              {analyzing && (
                <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                  <RefreshCw size={36} className="spinner" style={{ margin: '0 auto 1rem', color: '#2563EB' }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>Running TTA Inference...</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 4 }}>4 augmentation passes for improved Reversal sensitivity</div>
                </div>
              )}

              {scanResult && (
                <div>
                  {/* Developmental age warning */}
                  {showDevWarning && (
                    <div style={{ padding: '0.75rem 1rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: '0.85rem', fontSize: '0.82rem', color: '#92400E' }}>
                      <strong>⚠️ Developmental Note:</strong> Letter reversals are normal in children up to age 7.
                      This student ({currentStudent.age_years} yrs) is within the developmentally typical range.
                      Interpret this result with caution and in the context of broader classroom observations.
                    </div>
                  )}

                  {/* Overall result banner */}
                  <div className={`result-banner ${isFlagged ? 'flagged' : 'normal'}`}>
                    <div className="result-headline">
                      {isFlagged ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                      <span>{isFlagged ? 'Some patterns worth a closer look' : 'No indicators detected'}</span>
                    </div>
                    <div className="result-explanation">
                      {isFlagged
                        ? `${totalCount} of 5 indicators flagged. This does NOT signify a learning disability — referral for professional educational assessment is recommended.`
                        : 'No automated or teacher-observed indicators flagged. Continue routine classroom monitoring.'}
                    </div>
                  </div>

                  {/* Full 5-Indicator Table */}
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    All 5 Indicators Evaluated
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>#</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>Indicator</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>Method</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { n: 1, label: 'Letter Reversals (b/d, p/q)', method: 'ML (TTA)', val: ind.Reversal },
                        { n: 2, label: 'Over-Correction / Heavy Erasing', method: 'ML (TTA)', val: ind.Corrected },
                        { n: 3, label: 'Irregular Word / Letter Spacing', method: 'Teacher-observed', val: ind.manual_irregular_spacing },
                        { n: 4, label: 'Baseline Drift', method: 'Teacher-observed', val: ind.manual_baseline_drift },
                        { n: 5, label: 'Inconsistent Letter Sizing', method: 'Teacher-observed', val: ind.manual_inconsistent_sizing },
                      ].map(({ n, label, method, val }) => (
                        <tr key={n} style={{ borderBottom: '1px solid #F1F5F9', background: val === true ? '#FFFBEB' : 'transparent' }}>
                          <td style={{ padding: '0.55rem 0.6rem', color: '#64748B' }}>{n}</td>
                          <td style={{ padding: '0.55rem 0.6rem', fontWeight: 500 }}>{label}</td>
                          <td style={{ padding: '0.55rem 0.6rem', color: '#94A3B8', fontSize: '0.72rem' }}>{method}</td>
                          <td style={{ padding: '0.55rem 0.6rem', textAlign: 'center' }}>
                            {val === true
                              ? <span style={{ color: '#D97706', fontWeight: 700, fontSize: '0.8rem' }}>● Flagged</span>
                              : val === false
                              ? <span style={{ color: '#059669', fontSize: '0.8rem' }}>✓ Clear</span>
                              : <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>— Not assessed</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* ML Confidence row */}
                  <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#64748B' }}>Dominant pattern:</span>
                      <span style={{ fontWeight: 700 }}>{ind.dominant_class} ({Math.round((ind.confidence || 0) * 100)}% score)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#64748B' }}>Reversal raw probability:</span>
                      <span style={{ fontWeight: 700, color: ind.reversal_prob > 0.28 ? '#D97706' : '#059669' }}>
                        {((ind.reversal_prob || 0) * 100).toFixed(1)}% {ind.reversal_prob > 0.28 ? '(above sensitivity threshold)' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Held-out validation accuracy:</span>
                      <span style={{ fontWeight: 700, color: '#2563EB' }}>
                        {modelStats ? `${(modelStats.validation_accuracy * 100).toFixed(1)}%` : '77.1%'} concordance
                      </span>
                    </div>
                  </div>

                  {/* PDF Download */}
                  <button
                    className="btn-download-pdf"
                    disabled={downloadingPdf}
                    onClick={() => handleDownloadPdf(scanResult.scan_id)}
                  >
                    {downloadingPdf
                      ? <><RefreshCw className="spinner" size={18} /><span>Generating PDF...</span></>
                      : <><Download size={18} /><span>Download Full 5-Indicator Screening Report (PDF)</span></>}
                  </button>
                  <div style={{ fontSize: '0.73rem', color: '#64748B', textAlign: 'center', marginTop: '0.6rem' }}>
                    Report includes all 5 indicators, developmental context, specific referral routing, and dataset transparency notes.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: RECORDS ──────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 className="card-title"><Users size={22} color="#2563EB" /><span>Student Screening Records</span></h2>
                <p className="card-description" style={{ margin: 0 }}>Review past screenings, indicator progression, and download PDF reports.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="form-select" style={{ width: 'auto' }} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class_section})</option>)}
                </select>
                <button onClick={() => setShowNewStudentModal(true)} style={{ padding: '0.5rem 0.85rem', background: '#2563EB', color: '#FFF', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>+ Add Student</button>
              </div>
            </div>

            {studentHistory.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: 8 }}>
                No screening records yet for <strong>{currentStudent?.name || 'this student'}</strong>.
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pattern Detected</th>
                    <th>ML Indicators</th>
                    <th>Teacher-Observed</th>
                    <th>Total / 5</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {studentHistory.map((scan) => {
                    const i = scan.indicators_found || {};
                    return (
                      <tr key={scan.id}>
                        <td>{new Date(scan.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{i.dominant_class || '—'}</td>
                        <td>
                          {i.indicator_count > 0
                            ? <span style={{ color: '#D97706', fontWeight: 700 }}>{i.indicator_count} flagged</span>
                            : <span style={{ color: '#059669' }}>0</span>}
                        </td>
                        <td>
                          {i.manual_indicator_count > 0
                            ? <span style={{ color: '#D97706', fontWeight: 700 }}>{i.manual_indicator_count} observed</span>
                            : <span style={{ color: '#94A3B8' }}>{i.manual_indicator_count === 0 ? '0' : 'Not assessed'}</span>}
                        </td>
                        <td style={{ fontWeight: 700 }}>{i.total_indicator_count ?? i.indicator_count ?? 0} / 5</td>
                        <td>
                          <button onClick={() => handleDownloadPdf(scan.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563EB', fontWeight: 600, fontSize: '0.82rem' }}>
                            <Download size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB 3: MODEL TRANSPARENCY ───────────────────────────────────────── */}
        {activeTab === 'model' && (
          <div className="card">
            <div className="card-title"><Activity size={22} color="#2563EB" /><span>Honest Validation & Model Transparency (§4)</span></div>
            <p className="card-description">
              Real, measured performance on held-out test data. Training accuracy is never reported as validation accuracy. Dataset clinical limitations are stated explicitly.
            </p>

            {/* Key metrics */}
            <div className="metrics-row">
              <div className="metric-stat">
                <div className="metric-stat-label">Held-Out Test Accuracy</div>
                <div className="metric-stat-val">{modelStats ? `${(modelStats.validation_accuracy * 100).toFixed(1)}%` : '77.1%'}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Never seen during training</div>
              </div>
              <div className="metric-stat">
                <div className="metric-stat-label">Sensitivity Mode</div>
                <div className="metric-stat-val" style={{ fontSize: '0.9rem', color: '#0F172A', marginTop: 4 }}>TTA + P(Reversal) ≥ 0.28</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Reduces missed Reversal cases</div>
              </div>
              <div className="metric-stat">
                <div className="metric-stat-label">Dataset Split</div>
                <div className="metric-stat-val" style={{ fontSize: '0.9rem', color: '#0F172A', marginTop: 4 }}>
                  {modelStats ? `${modelStats.train_samples_used.toLocaleString()} train / ${modelStats.test_samples_used.toLocaleString()} test` : '6,000 / 1,800'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Stratified 3-class partition</div>
              </div>
            </div>

            {/* Per-class metrics */}
            {modelStats?.per_class_metrics && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Per-Class Performance (Held-Out Test Set)</div>
                <table className="history-table">
                  <thead>
                    <tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th><th>Clinical Note</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(modelStats.per_class_metrics).map(([cls, m]) => (
                      <tr key={cls}>
                        <td style={{ fontWeight: 700 }}>{cls}</td>
                        <td>{(m.precision * 100).toFixed(1)}%</td>
                        <td style={{ color: cls === 'Reversal' ? '#D97706' : 'inherit', fontWeight: cls === 'Reversal' ? 700 : 400 }}>
                          {(m.recall * 100).toFixed(1)}%
                          {cls === 'Reversal' && ' ↑ (sensitivity mode improves this)'}
                        </td>
                        <td>{(m.f1_score * 100).toFixed(1)}%</td>
                        <td>{m.support}</td>
                        <td style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {cls === 'Reversal' ? 'Primary screening target — sensitivity-optimised threshold applied' :
                           cls === 'Corrected' ? 'High precision — very few false positives' :
                           'High recall — good at identifying typical writing'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Training curves */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'left' }}>Training & Validation Curves (Epochs 1–13, Early Stopping)</div>
              <div style={{ background: '#FFF', padding: '0.75rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'inline-block', maxWidth: '100%' }}>
                <img src="/training_curves.png" alt="Training and Validation Curves" style={{ maxWidth: '100%', height: 'auto', maxHeight: 300, borderRadius: 6, display: 'block' }} />
              </div>
            </div>

            {/* Explicit dataset clinical validity disclaimer */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, color: '#92400E', fontSize: '0.85rem', lineHeight: 1.6 }}>
              <strong>⚠️ Dataset Clinical Validity Disclosure:</strong><br />
              The Gambo Dyslexia Handwriting Dataset image labels (Corrected / Normal / Reversal) were <strong>not independently validated by RCI-certified educational psychologists or speech-language pathologists</strong>.
              The 77.1% accuracy figure represents agreement with image-level category labels — not concordance with expert clinical assessment.
              This is a known and significant limitation that the team is actively working to address through a planned pilot with educational psychologists in Phase 2.
            </div>
          </div>
        )}

        {/* ── TAB 4: SCOPE & FUNDING ──────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title"><ShieldAlert size={20} color="#D97706" /><span>Scope & Known Limitations (§5)</span></div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#334155' }}>
                <p style={{ marginBottom: '0.75rem' }}><strong>Language:</strong> English-medium handwriting only. Regional Indian scripts (Devanagari, Tamil, etc.) are not validated and explicitly out of scope for this MVP.</p>
                <p style={{ marginBottom: '0.75rem' }}><strong>Age range:</strong> Primary school students (approx. ages 5–12). The app now shows a developmental caution note for students aged 7 and under, where b/d reversals are normal.</p>
                <p style={{ marginBottom: '0.75rem' }}><strong>Dataset labels:</strong> Not independently validated by clinical specialists. See Model Transparency tab for full disclosure.</p>
                <p><strong>Coverage:</strong> 2 of 5 indicators are ML-automated. The other 3 require teacher observation. All 5 are recorded and included in the PDF report.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-title"><BookOpen size={20} color="#2563EB" /><span>Sustainability & Funding (§6)</span></div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#334155' }}>
                <div style={{ padding: '0.75rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#166534' }}>1. NGO / CSR Funded for Government Schools</strong>
                  <p style={{ fontSize: '0.82rem', color: '#15803D', marginTop: 4 }}>100% free for government and municipal schools. Funded through CSR mandates (Companies Act §135) and foundations like Azim Premji Foundation and Pratham.</p>
                </div>
                <div style={{ padding: '0.75rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#1E40AF' }}>2. Freemium for Private Schools</strong>
                  <p style={{ fontSize: '0.82rem', color: '#1D4ED8', marginTop: 4 }}>Free up to 100 screenings/month per school. Institutional SaaS license for district dashboards, bulk scanning, and longitudinal cohort tracking.</p>
                </div>
                <div style={{ padding: '0.65rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.8rem', color: '#475569' }}>
                  <strong>On the "10-hour problem":</strong> At 15 min/student, screening a 40-student class takes 10 hours. Our roadmap includes a <strong>batch upload mode</strong> (upload a folder of photos, get a class-level summary report) to make whole-class screening feasible in a single lunch break.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div><strong>Saksham</strong> — Early Learning-Difficulty Screening Aid</div>
          <div>Held-Out Validation: <strong>{modelStats ? `${(modelStats.validation_accuracy * 100).toFixed(1)}%` : '77.1%'}</strong> concordance | 5-Indicator Coverage | Sensitivity-Optimised</div>
          <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Round 2 Hackathon Deliverable</div>
        </div>
      </footer>
    </div>
  );
}
