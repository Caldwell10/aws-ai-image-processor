import React, { useState, useEffect } from 'react';
import { Upload, RefreshCw, BarChart3, Camera, TrendingUp, Eye, CheckCircle, AlertCircle, X } from 'lucide-react';

const API_BASE_URL = 'https://mp36rpzh2m.execute-api.us-east-1.amazonaws.com/prod';

function App() {
  const [analytics, setAnalytics] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // modal
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAnalytics(), fetchImages()]);
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  // ---------- DEDUPE (one card per file, prefer completed > processing > uploaded, newest wins)
  const STATUS_RANK = { completed: 3, processing: 2, uploaded: 1 };

  function normalizeName(name = '') {
    const lower = name.toLowerCase().trim();
    const m = lower.match(/([^/_]+?\.(?:jpg|jpeg|png|webp))$/i);
    return m ? m[1] : lower;
  }

  function bestOf(a, b) {
    const sa = (a.processing_status || '').toLowerCase();
    const sb = (b.processing_status || '').toLowerCase();
    const ra = STATUS_RANK[sa] || 0;
    const rb = STATUS_RANK[sb] || 0;
    if (ra !== rb) return ra > rb ? a : b;

    const ta = new Date(a.upload_time || a.timestamp || 0).getTime();
    const tb = new Date(b.upload_time || b.timestamp || 0).getTime();
    return ta >= tb ? a : b;
  }

  function dedupeByFilename(items = []) {
    const map = new Map();
    for (const it of items) {
      const key = normalizeName(it.filename || it.id || '');
      if (!key) continue;
      if (!map.has(key)) map.set(key, it);
      else map.set(key, bestOf(map.get(key), it));
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.upload_time || b.timestamp || 0) -
        new Date(a.upload_time || a.timestamp || 0)
    );
  }

  const fetchImages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/images`);
      const data = await response.json();
      const raw = (data.images || []).sort(
        (a, b) =>
          new Date(b.upload_time || b.timestamp || 0) -
          new Date(a.upload_time || a.timestamp || 0)
      );
      const cleaned = dedupeByFilename(raw);
      setImages(cleaned);
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };
  // ---------- end dedupe

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleFileUpload = async (event) => {
    if (uploading) return;
    const inputEl = event.target;
    const file = inputEl.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadResult({ success: false, error: 'Please upload a valid image file (JPG, PNG, WebP)' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadResult({ success: false, error: 'File too large. Maximum size is 10MB.' });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];

        const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, image_data: base64Data })
        });

        const result = await uploadResponse.json();

        if (uploadResponse.ok) {
          setUploadResult({ success: true, ...result });
          setTimeout(() => { fetchData(); }, 2000);
        } else {
          setUploadResult({ success: false, error: result.error });
        }

        setUploading(false);
        try { inputEl.value = ''; } catch {}
      };

      reader.readAsDataURL(file);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({ success: false, error: error.message });
      setUploading(false);
    }
  };

  const openModal = (img) => { setSelected(img); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelected(null); };

  const StatCard = ({ icon: Icon, title, value, color, subtitle }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      transition: 'all 0.2s',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: color }}>
          <Icon size={24} color="white" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>{value}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{subtitle}</p>
        </div>
      </div>
      <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', margin: 0 }}>{title}</h3>
    </div>
  );

  if (loading && !analytics) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>AI Vision Pro</h1>
          <p style={{ color: '#6b7280' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
        @keyframes pulse { 0%,100% { opacity: 1;} 50% { opacity: .5;} }
        .lineClamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        /* responsive helpers used across the page */
        .container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 32px; }
        .recentGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }

        .objRow { display:flex; align-items:center; justify-content:space-between; padding:16px; background:#f9fafb; border-radius:8px; }
        .objLeft { display:flex; align-items:center; gap:16px; }
        .objBarWrap { display:flex; align-items:center; gap:8px; }
        .objBarTrack { width:96px; background:#e5e7eb; border-radius:4px; height:8px; }
        .objPct { font-size:14px; font-weight:600; color:#2563eb; min-width:48px; text-align:right; }

        /* modal grid stacks on smaller screens */
        .modalGrid { display:grid; grid-template-columns: 1.2fr 1fr; gap: 0; }
        @media (max-width: 900px) {
          .modalGrid { grid-template-columns: 1fr !important; }
        }

        /* small screens */
        @media (max-width: 640px) {
          .container { padding: 20px 16px; }
          .cards { grid-template-columns: 1fr; }
          .recentGrid { grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; }
          .objRow { flex-direction: column; align-items:flex-start; gap:10px; }
          .objBarTrack { width: 100%; }
          .objPct { min-width:auto; text-align:left; }
        }
        @media (max-width: 420px) {
          h1 { font-size: 20px !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div className="container" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', backgroundColor: '#2563eb', borderRadius: '8px' }}>
                <Eye size={32} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>AI Vision Pro</h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Enterprise Image Processing Platform</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s'
              }}
            >
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span>{loading ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Upload Section */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', padding: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Upload size={24} color="#2563eb" />
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>Upload Image for Processing</h2>
          </div>

          <div
            style={{
              position: 'relative',
              border: `2px dashed ${dragActive ? '#2563eb' : '#d1d5db'}`,
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              transition: 'all 0.2s',
              backgroundColor: dragActive ? '#eff6ff' : 'transparent',
              cursor: 'pointer'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Camera size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '18px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Drag and drop your image here, or
              </p>
              <label>
                <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                <span style={{
                  display: 'inline-block', backgroundColor: '#2563eb', color: 'white',
                  padding: '12px 24px', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s', fontWeight: '500'
                }}>
                  Browse Files
                </span>
              </label>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Supports JPG, PNG, WebP • Maximum 10MB</p>
          </div>

          {uploading && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTop: '2px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#1d4ed8', fontWeight: '500' }}>Processing image...</span>
              </div>
              <div style={{ marginTop: '8px', backgroundColor: '#bfdbfe', borderRadius: '4px', height: '8px' }}>
                <div style={{ backgroundColor: '#2563eb', height: '8px', borderRadius: '4px', width: '60%', animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
            </div>
          )}

          {uploadResult && (
            <div style={{
              marginTop: '24px', padding: '16px', borderRadius: '8px',
              border: `1px solid ${uploadResult.success ? '#bbf7d0' : '#fecaca'}`,
              backgroundColor: uploadResult.success ? '#f0fdf4' : '#fef2f2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {uploadResult.success ? <CheckCircle size={20} color="#059669" /> : <AlertCircle size={20} color="#dc2626" />}
                <span style={{ fontWeight: '500', color: uploadResult.success ? '#047857' : '#dc2626' }}>
                  {uploadResult.success ? 'Upload successful! Processing will complete in ~30 seconds.' : `Upload failed: ${uploadResult.error}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Analytics */}
        <div className="cards">
          <StatCard icon={BarChart3} title="Total Images Processed" value={analytics?.processing_stats?.total_processed || 0} subtitle="All time" color="#2563eb" />
          <StatCard icon={CheckCircle} title="Success Rate" value={`${analytics?.processing_stats?.success_rate || 0}%`} subtitle="Processing accuracy" color="#059669" />
          <StatCard icon={Eye} title="Objects Detected" value={analytics?.object_detection?.total_objects_detected || 0} subtitle="Across all images" color="#7c3aed" />
          <StatCard icon={TrendingUp} title="Average Confidence" value={`${analytics?.object_detection?.average_confidence || 0}%`} subtitle="Detection accuracy" color="#ea580c" />
        </div>

        {/* Top objects */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ padding: '8px', backgroundColor: '#7c3aed', borderRadius: '8px' }}>
              <BarChart3 size={20} color="white" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>Top Detected Objects</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {analytics?.object_detection?.top_objects?.slice(0, 8).map((obj, index) => (
              <div key={index}
                className="objRow"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              >
                <div className="objLeft">
                  <div style={{ width: '32px', height: '32px', backgroundColor: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb' }}>#{index + 1}</span>
                  </div>
                  <span style={{ fontWeight: '500', color: '#111827', textTransform: 'capitalize' }}>{obj.name}</span>
                </div>
                <div className="objBarWrap">
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>{obj.count} detections</span>
                  <div className="objBarTrack">
                    <div style={{ backgroundColor: '#2563eb', height: '8px', borderRadius: '4px', width: `${obj.percentage}%`, transition: 'width 0.5s ease-out' }} />
                  </div>
                  <span className="objPct">{obj.percentage}%</span>
                </div>
              </div>
            ))}
          </div>

          {(!analytics?.object_detection?.top_objects || analytics.object_detection.top_objects.length === 0) && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Camera size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '4px' }}>No object detection data available yet.</p>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Upload some images to see analytics.</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', padding: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>Recent Processing Activity</h2>

          {images.length > 0 ? (
            <div className="recentGrid">
              {images.slice(0, 12).map((image, index) => {
                const thumb = image.thumbnail_url || image.image_url;
                return (
                  <div
                    key={`${image.id || image.filename || index}`}
                    style={{ backgroundColor: '#f3f4f6', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                    onClick={() => openModal(image)}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.015)'; e.currentTarget.style.boxShadow='0 6px 12px rgba(0,0,0,.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow='none'; }}
                  >
                    <div style={{ width: '100%', aspectRatio: '4/3', background: '#e5e7eb' }}>
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={image.filename || `Image ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={32} color="#6b7280" />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <p className="lineClamp2" style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0 }}>
                        {image.filename || `Image ${index + 1}`}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {(image.upload_time || image.timestamp || '').replace('T', ' ').slice(0, 19) || 'Recently processed'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Camera size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '4px' }}>No images processed yet.</p>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Upload your first image to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ backgroundColor: '#111827', color: 'white', marginTop: '64px' }}>
        <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '6px', backgroundColor: '#2563eb', borderRadius: '6px' }}>
                <Eye size={20} color="white" />
              </div>
              <span style={{ fontSize: '16px', fontWeight: '600' }}>AI Vision Pro</span>
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>Powered by AWS</div>
          </div>
        </div>
      </footer>

      {/* Image details modal */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>{selected?.filename || selected?.id || 'Image details'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{(selected?.upload_time || selected?.timestamp || '').replace('T', ' ').slice(0, 19)}</div>
              </div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer' }}>
                <X size={20} color="#475569" />
              </button>
            </div>

            <div className="modalGrid">
              <div style={{ minHeight: 360, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selected?.image_url || selected?.thumbnail_url ? (
                  <img
                    src={selected.image_url || selected.thumbnail_url}
                    alt="preview"
                    style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <Camera size={40} />
                    <div style={{ marginTop: 8 }}>Preview not available</div>
                  </div>
                )}
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 16, fontWeight: 600, color: '#0f172a' }}>Status</div>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#eef2ff',
                  color: '#4338ca',
                  fontSize: 12,
                  marginBottom: 16
                }}>
                  {(selected?.processing_status || 'unknown').toLowerCase()}
                </div>

                <div style={{ marginBottom: 10, fontWeight: 600, color: '#0f172a' }}>Objects Detected</div>
                {Array.isArray(selected?.objects_detected) && selected.objects_detected.length ? (
                  <div style={{ display: 'grid', gap: 10, maxHeight: 380, overflow: 'auto', paddingRight: 4 }}>
                    {selected.objects_detected.map((o, i) => {
                      const name = (o?.name || 'Unknown').toString();
                      const conf = Math.round((parseFloat(o?.confidence) || 0));
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ minWidth: 140, color: '#0f172a' }}>{name}</div>
                          <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${conf}%`, height: '100%', background: '#2563eb' }} />
                          </div>
                          <div style={{ width: 44, textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>{conf}%</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#64748b' }}>No objects reported yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

