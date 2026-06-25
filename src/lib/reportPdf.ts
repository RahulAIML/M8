import type { SimReport } from '../api/types'

// Brand palette mirrors the closing-report HTML the simulator generates
const NAVY:  [number, number, number] = [27, 42, 73]    // #1b2a49
const SLATE: [number, number, number] = [71, 85, 105]   // #475569
const MUTED: [number, number, number] = [148, 163, 184] // #94a3b8
const GREEN: [number, number, number] = [16, 185, 129]  // #10b981
const RED:   [number, number, number] = [239, 68, 68]   // #ef4444

function isVerdict(a: string): 'si' | 'no' | null {
  const v = a.trim().toLowerCase()
  if (v === 'si' || v === 'sí') return 'si'
  if (v === 'no') return 'no'
  return null
}

/**
 * Builds and downloads a styled PDF of the closing report.
 * jsPDF is imported on demand — first call lazy-loads its chunk.
 */
export async function downloadReportPDF(r: SimReport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ unit: 'pt', format: 'a4' })
  const W    = doc.internal.pageSize.getWidth()
  const H    = doc.internal.pageSize.getHeight()
  const M    = 48
  const maxW = W - M * 2

  // ── Header band ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 104, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  const title      = r.Titulo || 'Reporte de la simulación'
  const titleLines = (doc.splitTextToSize(title, maxW) as string[]).slice(0, 2)
  doc.text(titleLines, M, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(190, 202, 226)
  const meta = [r.Usuario_Nombre, (r.Fecha_y_Hora ?? '').substring(0, 16), `${r.Calificacion}%`]
    .filter(Boolean).join('   ·   ')
  doc.text(meta, M, 42 + titleLines.length * 18 + 6)

  let y = 104 + 34

  const ensureRoom = (needed: number) => {
    if (y + needed > H - 56) { doc.addPage(); y = 56 }
  }

  // ── Sections ──
  for (const sec of r.Secciones) {
    // question
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...NAVY)
    const qLines = doc.splitTextToSize(sec.q, maxW) as string[]
    ensureRoom(qLines.length * 14 + 30)
    doc.text(qLines, M, y)
    y += qLines.length * 14 + 4

    // answer
    const verdict = isVerdict(sec.a)
    if (verdict) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(...(verdict === 'si' ? GREEN : RED))
      doc.text(sec.a.trim().toUpperCase(), M, y + 4)
      y += 26
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...SLATE)
      const rawLines = sec.a.split('\n').map((l) => l.trim()).filter(Boolean)
      const bullets  = rawLines.length > 1
      for (const line of rawLines) {
        const wrapped = doc.splitTextToSize(bullets ? `•  ${line}` : line, maxW - (bullets ? 10 : 0)) as string[]
        ensureRoom(wrapped.length * 13 + 4)
        doc.text(wrapped, M + (bullets ? 4 : 0), y)
        y += wrapped.length * 13 + 3
      }
      y += 8
    }
    y += 8
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('M8 Pharma — Simulador de Ventas · Reporte generado por el dashboard', M, H - 28)
    doc.text(`${p} / ${pages}`, W - M, H - 28, { align: 'right' })
  }

  doc.save(`reporte_sim_${r.ID_Sim}.pdf`)
}
