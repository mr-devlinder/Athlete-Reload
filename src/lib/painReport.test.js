import { describe, expect, it } from 'vitest'
import { buildPainIssueReport } from './painReport'

describe('pain report document', () => {
  it('builds a branded print-safe report', () => {
    const html = buildPainIssueReport({ status: 'Monitoring' }, { currentSeverity: 4, firstReportedDate: '2026-08-01', label: 'Left knee', peakSeverity: 7 }, 'Athletic trainer')
    expect(html).toContain('Athlete Reload')
    expect(html).toContain('@media print')
    expect(html).toContain('Monitor closely')
    expect(html).toContain('Prepared for Athletic trainer')
  })

  it('escapes sensitive user-entered content', () => {
    const html = buildPainIssueReport({ athleteNotes: '<script>alert(1)</script>' }, { currentSeverity: 8, label: '<b>Knee</b>', peakSeverity: 9 }, '<img src=x>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Higher concern')
  })
})
