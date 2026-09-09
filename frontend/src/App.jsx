import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, UploadCloud, CheckCircle2, AlertTriangle, Info,
  UserPlus, Users, Activity, Download, BookOpen, ArrowRight,
  ShieldAlert, Sparkles, ClipboardCheck, Eye, RefreshCw, X,
  TrendingUp, Zap
} from 'lucide-react';
import logoImg from './assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

/* ── Tiny helpers ─────────────────────────────────────────────────────────── */
const ConfidenceBar = ({ value, label }) => (
  <div className="confidence-bar-wrap">
    <div className="confidence-bar-label">
      <span>{label}</span>
      <span style={{ color: '#0F172A', fontWeight: 700 }}>{Math.round(value * 100)}%</span>
    </div>
    <div className="confidence-bar-track">
      <div className="confidence-bar-fill" style={{ width: `${value * 100}%` }} />
    </div>
  </div>
);

const Tag = ({ children, type = 'grey' }) => (
  <span className={`tag tag-${type}`}>{children}</span>
);

export default function App() {
  const [activeTab, setActiveTab]     = useState('screener');
  const [students, setStudents]       = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showNewStudentModal, setShowNewStudentModal] = useState(false);
  const [newStudentName, setNewStudentName]   = useState('');
  const [newStudentClass, setNewStudentClass] = useState('Class 3-B');
  const [newStudentAge, setNewStudentAge]     = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl]     = useState(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [scanResult, setScanResult]     = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [manualSpacing,  setManualSpacing]  = useState(false);
  const [manualBaseline, setManualBaseline] = useState(false);
  const [manualSizing,   setManualSizing]   = useState(false);

  const [studentHistory, setStudentHistory] = useState([]);
  const [modelStats, setModelStats]         = useState(null);
  const [statusMessage, setStatusMessage]   = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => { fetchStudents(); fetchModelStats(); }, []);
  useEffect(() => { if (selectedStudentId) fetchStudentDetails(selectedStudentId); }, [selectedStudentId]);

  const showToast = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        if (data.length > 0 && !selectedStudentId) setSelectedStudentId(data[0].id);
      }
    } catch { /* silent */ }
  };

  const fetchStudentDetails = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/students/${id}`);
      if (res.ok) { const d = await res.json(); setStudentHistory(d.scans || []); }
    } catch { /* silent */ }
  };

  const fetchModelStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/model/validation-stats`);
      if (res.ok) setModelStats(await res.json());
    } catch { /* silent */ }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      const body = { name: newStudentName.trim(), class_section: newStudentClass.trim() || 'General' };
      if (newStudentAge) body.age_years = parseInt(newStudentAge);
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        setStudents([created, ...students]);
        setSelectedStudentId(created.id);
        setNewStudentName(''); setNewStudentAge('');
        setShowNewStudentModal(false);
        showToast('success', `✓ Added student ${created.name}`);
      }
    } catch { showToast('error', 'Failed to create student — check backend is running'); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); setScanResult(null); }
  };

  const loadSample = async (name, label) => {
    try {
      const blob = await (await fetch(`/samples/${name}`)).blob();
      setSelectedFile(new File([blob], name, { type: 'image/png' }));
      setPreviewUrl(URL.createObjectURL(blob));
      setScanResult(null);
      showToast('info', `Loaded: ${label}`);
    } catch { showToast('error', 'Could not load sample image'); }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !selectedStudentId) return;
    setAnalyzing(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    if (manualSpacing)  fd.append('manual_irregular_spacing', 'true');
    if (manualBaseline) fd.append('manual_baseline_drift', 'true');
    if (manualSizing)   fd.append('manual_inconsistent_sizing', 'true');
    try {
      const res = await fetch(`${API_BASE}/students/${selectedStudentId}/scans`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Analysis failed');
      }
      const result = await res.json();
      setScanResult(result);
      fetchStudentDetails(selectedStudentId);
      showToast('success', 'Screening complete');
    } catch (err) {
      showToast('error', err.message || 'Error running screening');
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `saksham_report_${scanId.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', 'PDF download failed: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId);
  const ind            = scanResult?.indicators_found || {};
  const totalCount     = ind.total_indicator_count ?? ind.indicator_count ?? 0;
  const isFlagged      = totalCount > 0;
  const showDevWarning = ind.Reversal && currentStudent?.age_years && currentStudent.age_years <= 7;
  const manualChecked  = [manualSpacing, manualBaseline, manualSizing].filter(Boolean).length;

  const TABS = [
    ['screener', 'Screening Studio'],
    ['history',  'Records'],
    ['model',    'Model Transparency'],
    ['about',    'Scope & Funding'],
  ];

  return (
    <div className="app-container">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-badge">
            <div className="brand-logo-circle">
              <img src={logoImg} alt="Saksham logo" />
            </div>
            <div>
              <div className="brand-title">
                Saksham
                <span className="brand-title-badge">v1.1</span>
              </div>
              <div className="brand-subtitle">AI Handwriting Screener · Early Learning-Difficulty Detection</div>
            </div>
          </div>

          <nav className="nav-links" role="navigation" aria-label="Main navigation">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Sticky banners ──────────────────────────────────────────────── */}
      <div className="disclaimer-banner" role="alert" aria-live="polite">
        <ShieldAlert size={15} aria-hidden />
        <span>
          <strong>Screening Aid Only</strong> — Not a clinical diagnostic instrument.
          Results must be interpreted by a qualified educational psychologist or special educator.
        </span>
      </div>
      <div className="dataset-notice">
        <strong>Dataset Note:</strong> Trained on Gambo Dyslexia Dataset (Kaggle) — image labels not independently validated by RCI-certified professionals.
        77.1% concordance reflects label agreement, not clinical accuracy.
      </div>

      {statusMessage && (
        <div className={`status-toast ${statusMessage.type}`} role="status">
          {statusMessage.text}
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="main-wrapper">

        {/* ══ TAB 1: SCREENER ════════════════════════════════════════════ */}
        {activeTab === 'screener' && (
          <div className="grid-two-cols">

            {/* LEFT — Upload + Student + Manual indicators */}
            <div className="card">
              <div className="card-title">
                <FileText size={20} color="var(--primary)" aria-hidden />
                <span>Step 1 — Student & Sample</span>
              </div>
              <p className="card-description">
                Select a student, upload a handwriting image, and assess any teacher-observed patterns before running the automated screening.
              </p>

              {/* Student selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Active Student</label>
                  <button
                    id="add-student-btn"
                    onClick={() => setShowNewStudentModal(true)}
                    style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <UserPlus size={13} /> Add Student
                  </button>
                </div>

                <select
                  id="student-select"
                  className="form-select"
                  value={selectedStudentId}
                  onChange={(e) => { setSelectedStudentId(e.target.value); setScanResult(null); }}
                >
                  {students.length === 0 && <option value="">— No students yet —</option>}
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.class_section}{s.age_years ? ` · Age ${s.age_years}` : ''}
                    </option>
                  ))}
                </select>

                {currentStudent?.age_years && currentStudent.age_years <= 7 && (
                  <div className="age-caution-pill">
                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Age {currentStudent.age_years}: Letter reversals are <strong>developmentally normal</strong> up to age 7.
                      Interpret reversal findings with extra caution.
                    </span>
                  </div>
                )}
              </div>

              {/* New student modal inline */}
              {showNewStudentModal && (
                <div style={{ padding: '1rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', animation: 'fadeSlideIn 0.2s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Register New Student</span>
                    <button onClick={() => setShowNewStudentModal(false)}><X size={16} color="var(--text-muted)" /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 75px', gap: '0.5rem', marginBottom: '0.65rem' }}>
                    <input id="student-name" type="text" className="form-input" placeholder="Full name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} autoFocus />
                    <input id="student-class" type="text" className="form-input" placeholder="Class" value={newStudentClass} onChange={(e) => setNewStudentClass(e.target.value)} />
                    <input id="student-age" type="number" className="form-input" placeholder="Age" min="4" max="18" value={newStudentAge} onChange={(e) => setNewStudentAge(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowNewStudentModal(false)} style={{ padding: '0.38rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cancel</button>
                    <button id="save-student-btn" onClick={handleCreateStudent} style={{ padding: '0.38rem 0.9rem', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 700 }}>Save Student</button>
                  </div>
                </div>
              )}

              <div className="section-divider" />

              {/* Upload area */}
              <label htmlFor="file-upload" style={{ display: 'block' }}>
                <div className="dropzone" role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
                  <input id="file-upload" type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} />
                  <UploadCloud className="dropzone-icon" aria-hidden />
                  <div className="dropzone-text">{selectedFile ? selectedFile.name : 'Click or drag & drop handwriting image'}</div>
                  <div className="dropzone-hint">JPEG · PNG · WebP · max 20 MB</div>
                </div>
              </label>

              {/* Sample chips */}
              <div className="quick-samples-bar">
                <div className="quick-samples-title"><Sparkles size={12} aria-hidden /><span>One-Click Test Samples</span></div>
                <div className="quick-samples-buttons">
                  {[
                    ['sample_normal.png',    '✓ Typical Writing'],
                    ['sample_reversal.png',  '⚡ Letter Reversals'],
                    ['sample_corrected.png', '✍ Over-Correction'],
                  ].map(([file, label]) => (
                    <button key={file} className="sample-chip" id={`sample-${file}`} onClick={() => loadSample(file, label)}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Image preview */}
              {previewUrl && (
                <div style={{ marginTop: '0.85rem', position: 'relative', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Preview</div>
                  <div style={{ display: 'inline-block', padding: 4, background: '#FFF', border: '1px solid var(--border-subtle)', borderRadius: 10, boxShadow: 'var(--shadow-sm)' }}>
                    <img src={previewUrl} alt="Handwriting preview" style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain', display: 'block', borderRadius: 7 }} />
                  </div>
                  <button
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); setScanResult(null); }}
                    style={{ position: 'absolute', top: 22, right: 4, background: 'rgba(255,255,255,0.9)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-xs)', border: '1px solid var(--border-subtle)' }}
                    title="Remove image"
                  >
                    <X size={12} color="var(--text-muted)" />
                  </button>
                </div>
              )}

              <div className="section-divider" style={{ marginTop: '1rem' }} />

              {/* Manual indicator checklist */}
              <div className="indicator-checklist">
                <div className="indicator-checklist-header">
                  <Eye size={14} color="var(--amber)" aria-hidden />
                  Step 2 — Teacher-Observed Indicators (3 of 5)
                </div>
                <div className="indicator-checklist-desc">
                  Look at the handwriting sample directly and check any patterns you notice. These complement the ML analysis to give full 5-indicator coverage.
                </div>
                {[
                  { key: 'sp', state: manualSpacing,  setter: setManualSpacing,  label: 'Irregular Word / Letter Spacing',    desc: 'Unusually large or inconsistent gaps between letters or words' },
                  { key: 'bl', state: manualBaseline, setter: setManualBaseline, label: 'Baseline Drift (text wanders off line)', desc: 'Writing drifts above or below the ruled line' },
                  { key: 'sz', state: manualSizing,   setter: setManualSizing,   label: 'Inconsistent Letter Sizing',           desc: 'Erratic variation in letter heights within words or sentences' },
                ].map(({ key, state, setter, label, desc }) => (
                  <label
                    key={key}
                    className={`indicator-check-item ${state ? 'checked' : ''}`}
                    style={{ display: 'flex', alignItems: 'flex-start' }}
                  >
                    <input type="checkbox" checked={state} onChange={(e) => setter(e.target.checked)} />
                    <div>
                      <div className="indicator-check-label">{label}</div>
                      <div className="indicator-check-hint">{desc}</div>
                    </div>
                  </label>
                ))}
                <div className="indicator-check-count">{manualChecked} / 3 teacher-observed indicators selected</div>
              </div>

              {/* Run button */}
              <button
                id="run-screening-btn"
                className="btn-primary"
                disabled={!selectedFile || !selectedStudentId || analyzing}
                onClick={handleAnalyze}
              >
                {analyzing
                  ? <><RefreshCw className="spinner" size={17} aria-hidden /><span>Running TTA Analysis...</span></>
                  : <><Zap size={17} aria-hidden /><span>Run Full 5-Indicator Screening</span><ArrowRight size={17} aria-hidden /></>
                }
              </button>

              {!selectedFile && !analyzing && (
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
                  Upload an image or select a test sample above to enable screening
                </p>
              )}
            </div>

            {/* RIGHT — Results */}
            <div className="card">
              <div className="card-title">
                <Activity size={20} color="var(--primary)" aria-hidden />
                <span>Step 3 — Screening Results</span>
              </div>
              <p className="card-description">
                All 5 indicators evaluated: 2 automated (ML + TTA) + up to 3 teacher-observed. Results are stored and downloadable as a PDF.
              </p>

              {/* Empty state */}
              {!scanResult && !analyzing && (
                <div className="empty-state">
                  <ClipboardCheck size={48} className="empty-state-icon" aria-hidden />
                  <div className="empty-state-title">No active screening</div>
                  <div className="empty-state-body">
                    Complete steps 1 and 2 on the left, then click <em>Run Full 5-Indicator Screening</em>.
                  </div>
                </div>
              )}

              {/* Analyzing state */}
              {analyzing && (
                <div className="empty-state" style={{ borderStyle: 'solid', borderColor: 'var(--primary-border)', background: 'var(--primary-light)' }}>
                  <RefreshCw size={42} className="spinner empty-state-icon" style={{ color: 'var(--primary)' }} aria-hidden />
                  <div className="empty-state-title" style={{ color: 'var(--primary)' }}>Running TTA Inference</div>
                  <div className="empty-state-body">4 augmentation passes for improved Reversal sensitivity…</div>
                </div>
              )}

              {/* Results */}
              {scanResult && (
                <div style={{ animation: 'fadeSlideIn 0.35s ease' }}>

                  {/* Developmental warning */}
                  {showDevWarning && (
                    <div className="dev-note">
                      <strong>⚠️ Developmental Note:</strong> This student is {currentStudent.age_years} years old.
                      Letter reversals are typically normal up to age 7 — interpret the Reversal indicator with caution
                      and consider the broader classroom context.
                    </div>
                  )}

                  {/* Overall result */}
                  <div className={`result-banner ${isFlagged ? 'flagged' : 'normal'}`}>
                    <div className="result-headline">
                      {isFlagged ? <AlertTriangle size={19} aria-hidden /> : <CheckCircle2 size={19} aria-hidden />}
                      <span>{isFlagged ? 'Patterns worth a closer look' : 'No indicators detected'}</span>
                      <Tag type={isFlagged ? 'amber' : 'green'}>{totalCount} / 5</Tag>
                    </div>
                    <div className="result-explanation">
                      {isFlagged
                        ? `${totalCount} of 5 indicators flagged. This does NOT confirm a learning difficulty — professional educational assessment is the recommended next step.`
                        : 'No automated or teacher-observed indicators flagged. Continue routine classroom monitoring.'}
                    </div>
                  </div>

                  {/* ML confidence bar */}
                  <ConfidenceBar value={ind.confidence || 0} label={`ML confidence: "${ind.dominant_class}"`} />

                  {/* 5-Indicator table */}
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    All 5 Indicators
                  </div>
                  <table className="history-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th>#</th><th>Indicator</th><th>Method</th><th style={{ textAlign: 'center' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { n: 1, label: 'Letter Reversals (b/d, p/q)',        method: 'ML · TTA',         val: ind.Reversal },
                        { n: 2, label: 'Over-Correction / Heavy Erasing',    method: 'ML · TTA',         val: ind.Corrected },
                        { n: 3, label: 'Irregular Word / Letter Spacing',     method: 'Teacher-observed', val: ind.manual_irregular_spacing },
                        { n: 4, label: 'Baseline Drift',                      method: 'Teacher-observed', val: ind.manual_baseline_drift },
                        { n: 5, label: 'Inconsistent Letter Sizing',          method: 'Teacher-observed', val: ind.manual_inconsistent_sizing },
                      ].map(({ n, label, method, val }) => (
                        <tr key={n} style={{ background: val === true ? 'var(--amber-light)' : 'transparent' }}>
                          <td style={{ color: 'var(--text-subtle)', width: 28 }}>{n}</td>
                          <td style={{ fontWeight: 500 }}>{label}</td>
                          <td>
                            <Tag type={method.startsWith('ML') ? 'blue' : 'grey'}>{method}</Tag>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {val === true   && <Tag type="amber">● Flagged</Tag>}
                            {val === false  && <Tag type="green">✓ Clear</Tag>}
                            {val == null    && <span style={{ color: 'var(--text-subtle)', fontSize: '0.78rem' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Reversal probability detail */}
                  {ind.reversal_prob !== undefined && (
                    <div style={{ marginTop: '0.85rem' }}>
                      <ConfidenceBar value={ind.reversal_prob || 0} label="Reversal raw probability (threshold 0.28)" />
                      {ind.reversal_prob >= 0.28 && ind.reversal_prob < 0.5 && (
                        <p style={{ fontSize: '0.73rem', color: 'var(--amber-text)', marginTop: '0.2rem' }}>
                          Flagged via sensitivity threshold (above 0.28). Standard argmax would have classified as {ind.dominant_class === 'Reversal' ? 'Normal' : ind.dominant_class}.
                        </p>
                      )}
                    </div>
                  )}

                  {/* PDF Download */}
                  <button
                    id="download-pdf-btn"
                    className="btn-download-pdf"
                    style={{ marginTop: '1.1rem' }}
                    disabled={downloadingPdf}
                    onClick={() => handleDownloadPdf(scanResult.scan_id)}
                  >
                    {downloadingPdf
                      ? <><RefreshCw className="spinner" size={17} /><span>Generating PDF…</span></>
                      : <><Download size={17} /><span>Download Full Screening Report (PDF)</span></>}
                  </button>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '0.5rem', lineHeight: 1.4 }}>
                    Includes all 5 indicators · Developmental context · Specific referral routing · Dataset limitations
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB 2: RECORDS ═════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 className="card-title"><Users size={20} color="var(--primary)" /><span>Student Screening Records</span></h2>
                <p className="card-description" style={{ margin: 0 }}>Review past screenings and download PDF reports for any session.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="form-select" style={{ width: 'auto', minWidth: 180 }} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.class_section}</option>)}
                </select>
                <button onClick={() => { setShowNewStudentModal(true); setActiveTab('screener'); }} style={{ padding: '0.55rem 0.9rem', background: 'var(--primary)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserPlus size={14} /> Add
                </button>
              </div>
            </div>

            {studentHistory.length === 0 ? (
              <div className="empty-state">
                <FileText size={44} className="empty-state-icon" />
                <div className="empty-state-title">No screenings yet</div>
                <div className="empty-state-body">Run a screening in the Screening Studio tab to see records here.</div>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr><th>Date</th><th>Pattern</th><th>ML Flags</th><th>Teacher-Obs</th><th>Total / 5</th><th>Report</th></tr>
                </thead>
                <tbody>
                  {studentHistory.map((scan) => {
                    const i = scan.indicators_found || {};
                    const total = i.total_indicator_count ?? i.indicator_count ?? 0;
                    return (
                      <tr key={scan.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(scan.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                        <td style={{ fontWeight: 600 }}>{i.dominant_class || '—'}</td>
                        <td>{i.indicator_count > 0 ? <Tag type="amber">{i.indicator_count}</Tag> : <Tag type="green">0</Tag>}</td>
                        <td>{i.manual_indicator_count > 0 ? <Tag type="amber">{i.manual_indicator_count}</Tag> : <Tag type="grey">{i.manual_indicator_count === 0 ? '0' : '—'}</Tag>}</td>
                        <td style={{ fontWeight: 800, color: total > 0 ? 'var(--amber)' : 'var(--green)' }}>{total} / 5</td>
                        <td>
                          <button onClick={() => handleDownloadPdf(scan.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-border)', background: 'var(--primary-light)' }}>
                            <Download size={13} /> PDF
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

        {/* ══ TAB 3: MODEL TRANSPARENCY ══════════════════════════════════ */}
        {activeTab === 'model' && (
          <div className="card">
            <div className="card-title"><TrendingUp size={20} color="var(--primary)" /><span>Honest Validation & Model Transparency (§4)</span></div>
            <p className="card-description">Real measured performance on strictly held-out test data. Training accuracy is never reported as validation accuracy. Dataset limitations are stated explicitly.</p>

            <div className="metrics-row">
              <div className="metric-stat">
                <div className="metric-stat-label">Held-Out Test Accuracy</div>
                <div className="metric-stat-val">{modelStats ? `${(modelStats.validation_accuracy * 100).toFixed(1)}%` : '77.1%'}</div>
                <div style={{ fontSize: '0.71rem', color: 'var(--text-subtle)', marginTop: 3 }}>Never seen during training</div>
              </div>
              <div className="metric-stat">
                <div className="metric-stat-label">Reversal Sensitivity</div>
                <div className="metric-stat-val" style={{ fontSize: '1rem', marginTop: 5 }}>P ≥ 0.28 + TTA×4</div>
                <div style={{ fontSize: '0.71rem', color: 'var(--text-subtle)', marginTop: 3 }}>Reduces missed Reversal cases</div>
              </div>
              <div className="metric-stat">
                <div className="metric-stat-label">Dataset Split</div>
                <div className="metric-stat-val" style={{ fontSize: '1rem', marginTop: 5 }}>
                  {modelStats ? `${(modelStats.train_samples_used / 1000).toFixed(1)}k / ${modelStats.test_samples_used}` : '~6k / ~1.8k'}
                </div>
                <div style={{ fontSize: '0.71rem', color: 'var(--text-subtle)', marginTop: 3 }}>Stratified 3-class partition</div>
              </div>
            </div>

            {modelStats?.per_class_metrics && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.5rem' }}>Per-Class Performance (Held-Out Test Set)</div>
                <table className="history-table">
                  <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th><th>Note</th></tr></thead>
                  <tbody>
                    {Object.entries(modelStats.per_class_metrics).map(([cls, m]) => (
                      <tr key={cls}>
                        <td style={{ fontWeight: 700 }}>{cls}</td>
                        <td>{(m.precision * 100).toFixed(1)}%</td>
                        <td style={{ fontWeight: cls === 'Reversal' ? 700 : 400, color: cls === 'Reversal' ? 'var(--amber)' : 'inherit' }}>
                          {(m.recall * 100).toFixed(1)}%
                          {cls === 'Reversal' && <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 400 }}> ↑ sensitivity mode</span>}
                        </td>
                        <td>{(m.f1_score * 100).toFixed(1)}%</td>
                        <td>{m.support}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {cls === 'Reversal'   ? 'Primary target — optimised threshold applied'
                          : cls === 'Corrected' ? 'High precision — few false positives'
                          :                       'High recall — good at identifying typical writing'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.5rem' }}>Training Curves (Early Stopping at Epoch 13)</div>
              <div style={{ background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <img src="/training_curves.png" alt="Training and validation accuracy/loss curves" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 'var(--radius-sm)', display: 'inline-block' }} />
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--amber-light)', border: '1.5px solid var(--amber-border)', borderRadius: 'var(--radius-md)', color: 'var(--amber-text)', fontSize: '0.83rem', lineHeight: 1.65 }}>
              <strong>⚠️ Dataset Clinical Validity Disclosure</strong><br />
              The Gambo Dyslexia Dataset labels (Corrected / Normal / Reversal) were <strong>not independently validated by RCI-certified educational psychologists</strong>.
              The 77.1% accuracy reflects agreement with image-level labels, not concordance with expert clinical assessment.
              This is a known limitation. Phase 2 roadmap includes a clinical pilot with certified assessors.
            </div>
          </div>
        )}

        {/* ══ TAB 4: SCOPE & FUNDING ═════════════════════════════════════ */}
        {activeTab === 'about' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title"><ShieldAlert size={20} color="var(--amber)" /><span>Scope & Limitations (§5)</span></div>
              {[
                ['Language', 'English-medium handwriting only. Regional Indian scripts (Devanagari, Tamil, etc.) are explicitly out of scope for this MVP.'],
                ['Age range', 'Primary school students (approx. ages 5–12). Students aged 7 and under receive a developmental caution note since b/d reversals are normal at that age.'],
                ['Dataset labels', 'Not independently validated by clinical specialists — see Model Transparency for full disclosure.'],
                ['Indicator coverage', '2 of 5 indicators are ML-automated. The remaining 3 require teacher observation — all 5 are recorded in the PDF report.'],
              ].map(([k, v]) => (
                <div key={k} style={{ marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{k}</div>
                  <div style={{ fontSize: '0.87rem', lineHeight: 1.55 }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-title"><BookOpen size={20} color="var(--primary)" /><span>Sustainability & Funding (§6)</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ padding: '0.85rem', background: 'var(--green-light)', border: '1.5px solid var(--green-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--green-text)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>1. Free for Government & NGO Schools</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--green-text)', lineHeight: 1.5 }}>Funded via CSR mandates (Companies Act §135) and foundations like Azim Premji Foundation & Pratham. 100% free.</div>
                </div>
                <div style={{ padding: '0.85rem', background: 'var(--primary-light)', border: '1.5px solid var(--primary-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>2. Freemium for Private Schools</div>
                  <div style={{ fontSize: '0.82rem', color: '#1E40AF', lineHeight: 1.5 }}>Free up to 100 screenings/month. Paid institutional SaaS for district dashboards, bulk scanning, and longitudinal cohort tracking.</div>
                </div>
                <div style={{ padding: '0.85rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-main)' }}>📋 Phase 2 Roadmap:</strong><br />
                  Batch upload mode (screen a full class from a folder of photos), clinical pilot with RCI-certified assessors, regional language support (Devanagari script), and mobile teacher app.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={logoImg} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
            <strong>Saksham</strong> — Early Learning-Difficulty Screening Aid
          </div>
          <div>Held-Out Accuracy: <strong>{modelStats ? `${(modelStats.validation_accuracy*100).toFixed(1)}%` : '77.1%'}</strong> · 5-Indicator Coverage · Sensitivity-Optimised</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.73rem' }}>Hackathon Round 2 · <a href="https://github.com/yashh-45/saksham-screener" target="_blank" rel="noopener noreferrer">GitHub</a></div>
        </div>
      </footer>
    </div>
  );
}
