import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Database, Download, UploadCloud, RefreshCw, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'

const ROW_OPTIONS = [800, 2000, 5000]
const ANCHOR_OPTIONS = [3, 4, 6, 8]

export function Datasets() {
  const [selectedRows, setSelectedRows] = useState(800)
  const [selectedAnchors, setSelectedAnchors] = useState(4)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [uploadStats, setUploadStats] = useState<{ filename: string; missing?: Record<string, number> } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const gen = useMutation({
    mutationFn: () => api.generateDataset({ rows: selectedRows, anchor_count: selectedAnchors }),
    onSuccess: () => {
      setUploadStats(null)
      setPage(1)
    },
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDataset(file),
    onSuccess: (data, file) => {
      setUploadStats({
        filename: file.name,
        missing: data.missing_values,
      })
      setPage(1)
    },
  })

  const isPending = gen.isPending || upload.isPending
  const activeData = upload.data || gen.data
  const activeError = upload.error || gen.error

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      upload.mutate(file)
    }
  }

  const formatCellValue = (key: string, val: unknown) => {
    if (val === null || val === undefined) {
      return <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>
    }
    if (key === 'is_available') {
      return val ? (
        <span style={{ color: 'var(--lime)', fontWeight: 600 }}>ACTIVE</span>
      ) : (
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>DROPPED</span>
      )
    }
    if (typeof val === 'number') {
      if (key === 'timestamp') return `${val.toFixed(2)}s`
      if (key.includes('_m') || key === 'measured_range_m') return `${val.toFixed(3)} m`
      return val.toString()
    }
    return String(val)
  }

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1>Dataset Workspace</h1>
          <p>Generate reproducible synthetic measurement tables or upload custom CSV logs.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(13,25,35,0.8)', border: '1px solid var(--line)', borderRadius: '10px', padding: '3px' }}>
            {ANCHOR_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSelectedAnchors(count)}
                style={{
                  background: selectedAnchors === count ? 'rgba(87,219,244,0.18)' : 'transparent',
                  color: selectedAnchors === count ? 'var(--cyan)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  font: '600 11px var(--mono)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {count} Anchors
              </button>
            ))}
          </div>

          <div style={{ display: 'inline-flex', background: 'rgba(13,25,35,0.8)', border: '1px solid var(--line)', borderRadius: '10px', padding: '3px' }}>
            {ROW_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSelectedRows(count)}
                style={{
                  background: selectedRows === count ? 'rgba(87,219,244,0.18)' : 'transparent',
                  color: selectedRows === count ? 'var(--cyan)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  font: '600 11px var(--mono)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {count} rows
              </button>
            ))}
          </div>

          <button
            className="primary-action"
            onClick={() => gen.mutate()}
            disabled={isPending}
            style={{ minWidth: '150px' }}
          >
            {gen.isPending ? <RefreshCw className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Database />}
            {gen.isPending ? 'Generating…' : `Generate (${selectedAnchors}A, ${selectedRows}R)`}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            className="primary-action"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            style={{
              background: 'rgba(87,219,244,0.15)',
              borderColor: 'rgba(87,219,244,0.4)',
              color: 'var(--cyan)',
              fontWeight: 600,
            }}
          >
            <UploadCloud />
            {upload.isPending ? 'Uploading…' : 'Upload CSV'}
          </button>
        </div>
      </header>

      {activeError && (
        <div className="inline-error" style={{ marginBottom: '16px' }}>
          <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span>{activeError instanceof Error ? activeError.message : 'Operation failed.'}</span>
          <button onClick={() => gen.isError ? gen.mutate() : upload.reset()}>
            Dismiss / Retry
          </button>
        </div>
      )}

      <LiquidGlass className="schema-line">
        <span>trajectory_id</span>
        <span>timestamp</span>
        <span>anchor_id</span>
        <span>anchor_x_m</span>
        <span>anchor_y_m</span>
        <span>measured_range_m</span>
        <span>is_available</span>
        <span>target_x_m</span>
        <span>target_y_m</span>
      </LiquidGlass>

      {activeData ? (
        <>
          <LiquidGlass className="dataset-summary">
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '20px' }}>{activeData.rows.toLocaleString()}</strong>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {uploadStats ? `rows uploaded from ${uploadStats.filename}` : `synthetic measurement rows (seed 41)`}
                </span>
              </div>
              {uploadStats?.missing && Object.values(uploadStats.missing).some((v) => v > 0) && (
                <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '4px', font: '11px var(--mono)' }}>
                  Missing: {Object.entries(uploadStats.missing).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </div>
              )}
            </div>
            <a
              href={activeData.download_url}
              download
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'var(--cyan)',
                border: '1px solid var(--cyan)',
                color: '#061822',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              <Download style={{ width: 16, height: 16 }} /> Download CSV
            </a>
          </LiquidGlass>

          {(() => {
            const previewRows = activeData.preview || []
            const totalPages = Math.max(1, Math.ceil(previewRows.length / pageSize))
            const safePage = Math.min(page, totalPages)
            const startIdx = (safePage - 1) * pageSize
            const endIdx = Math.min(startIdx + pageSize, previewRows.length)
            const currentRows = previewRows.slice(startIdx, endIdx)
            const columns = previewRows[0] ? Object.keys(previewRows[0]) : []

            return (
              <LiquidGlass className="data-preview" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{
                    width: '100%',
                    minWidth: '880px',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                  }}>
                    <thead>
                      <tr style={{
                        background: 'rgba(9,24,34,0.92)',
                        borderBottom: '1px solid var(--line)',
                        font: '600 10px var(--mono)',
                        color: 'var(--cyan)',
                        letterSpacing: '0.06em',
                      }}>
                        {columns.map((col) => (
                          <th
                            key={col}
                            style={{
                              padding: '12px 14px',
                              borderRight: '1px solid var(--line)',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows.map((row, i) => (
                        <tr
                          key={startIdx + i}
                          style={{
                            borderBottom: '1px solid var(--line)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                          }}
                        >
                          {columns.map((col, j) => (
                            <td
                              key={j}
                              style={{
                                padding: '10px 14px',
                                borderRight: '1px solid var(--line)',
                                font: '11px var(--mono)',
                                whiteSpace: 'nowrap',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {formatCellValue(col, row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'rgba(6,12,18,0.7)',
                  borderTop: '1px solid var(--line)',
                  font: '11px var(--mono)',
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}>
                  <div>
                    Showing rows <strong style={{ color: 'var(--cyan)' }}>{previewRows.length === 0 ? 0 : startIdx + 1}–{endIdx}</strong> of{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{previewRows.length}</strong> preview records{' '}
                    <span style={{ color: 'var(--text-muted)' }}>({activeData.rows.toLocaleString()} total rows in generated dataset)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rows/page:</span>
                      {[10, 25, 50].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => { setPageSize(size); setPage(1) }}
                          style={{
                            background: pageSize === size ? 'rgba(87,219,244,0.18)' : 'transparent',
                            color: pageSize === size ? 'var(--cyan)' : 'var(--text-muted)',
                            border: 'none',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            font: '600 10px var(--mono)',
                            cursor: 'pointer',
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        aria-label="Previous Page"
                        style={{
                          background: 'rgba(13,25,35,0.8)',
                          border: '1px solid var(--line)',
                          color: safePage <= 1 ? 'var(--text-dim)' : 'var(--cyan)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronLeft style={{ width: 14, height: 14 }} />
                      </button>
                      <span style={{ padding: '0 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        aria-label="Next Page"
                        style={{
                          background: 'rgba(13,25,35,0.8)',
                          border: '1px solid var(--line)',
                          color: safePage >= totalPages ? 'var(--text-dim)' : 'var(--cyan)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronRight style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                </div>
              </LiquidGlass>
            )
          })()}
        </>
      ) : (
        <LiquidGlass
          className="drop-zone"
          style={{ cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Database style={{ width: 44, height: 44, color: 'var(--cyan)', marginBottom: '14px' }} />
          <h2>No Dataset Loaded in Workspace</h2>
          <p style={{ maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Click <strong>Generate {selectedRows}</strong> above to create a labelled synthetic dataset from the simulator, or click anywhere here to upload an external CSV measurement file.
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className="primary-action"
              onClick={(e) => {
                e.stopPropagation()
                gen.mutate()
              }}
              disabled={isPending}
            >
              <Database /> Quick Generate 800 Rows
            </button>
            <button
              className="primary-action"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-primary)', fontWeight: 600 }}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              <UploadCloud /> Choose CSV File
            </button>
          </div>
        </LiquidGlass>
      )}
    </div>
  )
}
