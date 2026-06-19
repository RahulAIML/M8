import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { useDashboardData } from '../hooks/useDashboardData'
import { FileDown, BarChart3, GitBranch, Users, Activity } from 'lucide-react'

function ReportCard({
  icon: Icon,
  title,
  description,
  tag,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  tag: string
}) {
  return (
    <div className="card p-5 flex items-start gap-4 hover:border-accent/30 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 whitespace-nowrap shrink-0">{tag}</span>
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { kpis, sims } = useDashboardData()

  const simCount = kpis?.totalSimulations ?? 0

  function downloadCSV(rows: string[][], filename: string) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportSimSummary() {
    downloadCSV(
      [
        [language === 'es' ? 'Métrica' : 'Metric', language === 'es' ? 'Valor' : 'Value'],
        [language === 'es' ? 'Total Simulaciones' : 'Total Simulations', String(simCount)],
        [language === 'es' ? 'Puntaje Promedio' : 'Average Score', String(kpis?.averageScore ?? 0) + '%'],
        [language === 'es' ? 'Tasa de Aprobación' : 'Pass Rate', String(kpis?.passRate ?? 0) + '%'],
        [language === 'es' ? 'Asesores Activos' : 'Active Advisors', String(kpis?.activeAdvisors ?? 0)],
        [language === 'es' ? 'Aprobados' : 'Passed', String(kpis?.passCount ?? 0)],
        [language === 'es' ? 'Reprobados' : 'Failed', String(kpis?.failCount ?? 0)],
      ],
      `m8_simulator_summary_${new Date().toISOString().split('T')[0]}.csv`,
    )
  }

  function exportSimDetails() {
    if (!sims.length) return
    const rows: string[][] = [[
      'ID_Sim', 'Usuario', 'Usuario_Nombre', 'ID_Caso_de_Uso',
      'Fecha_y_Hora', 'Calificacion', 'Puntos_Totales', 'Diagnostico_Final',
    ]]
    sims.forEach((s) => rows.push([
      String(s.ID_Sim), s.Usuario ?? '', s.Usuario_Nombre ?? '',
      String(s.ID_Caso_de_Uso), s.Fecha_y_Hora,
      String(s.Calificacion), String(s.Puntos_Totales),
      s.Diagnostico_Final ?? '',
    ]))
    downloadCSV(rows, `m8_simulations_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const es = language === 'es'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_reports_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_reports_subtitle')}</p>
      </div>

      {/* Data summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BarChart3, label: es ? 'Simulaciones' : 'Simulations', value: simCount.toLocaleString() },
          { icon: Users, label: es ? 'Usuarios Activos' : 'Active Users', value: String(kpis?.activeAdvisors ?? 0) },
          { icon: Activity, label: es ? 'Actividades' : 'Activities', value: String(kpis?.totalActivities ?? 0) },
          { icon: GitBranch, label: es ? 'Miembros' : 'Members', value: String(kpis?.totalMembers ?? 0) },
        ].map((item) => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-lg font-bold text-slate-100">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Export cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
          {es ? 'Exportar Datos' : 'Export Data'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={exportSimSummary}
            disabled={!simCount}
            className="card p-5 flex items-start gap-4 hover:border-accent/40 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <FileDown className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                {es ? 'Resumen Simulador' : 'Simulator Summary'}
              </p>
              <p className="text-xs text-slate-500">
                {es ? `KPIs agregados — ${simCount} simulaciones` : `Aggregated KPIs — ${simCount} simulations`}
              </p>
              <span className="inline-block mt-2 text-[10px] font-medium text-accent">CSV ↓</span>
            </div>
          </button>

          <button
            onClick={exportSimDetails}
            disabled={!simCount}
            className="card p-5 flex items-start gap-4 hover:border-violet/40 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center shrink-0">
              <FileDown className="w-5 h-5 text-violet" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                {es ? 'Detalle de Simulaciones' : 'Simulation Details'}
              </p>
              <p className="text-xs text-slate-500">
                {es ? `Registro completo — ${simCount} simulaciones` : `Full record — ${simCount} simulations`}
              </p>
              <span className="inline-block mt-2 text-[10px] font-medium text-violet">CSV ↓</span>
            </div>
          </button>
        </div>
      </div>

      {/* Report templates */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">
          {es ? 'Plantillas de Reporte' : 'Report Templates'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportCard
            icon={BarChart3}
            title={es ? 'Reporte Ejecutivo Semanal' : 'Weekly Executive Report'}
            description={es ? 'KPIs, tendencias y top performers del período.' : 'KPIs, trends, and top performers for the period.'}
            tag={es ? 'Próximamente' : 'Coming soon'}
          />
          <ReportCard
            icon={GitBranch}
            title={es ? 'Análisis por Línea de Negocio' : 'Business Line Analysis'}
            description={es ? 'Comparativa de rendimiento por línea organizacional.' : 'Performance comparison by organizational line.'}
            tag={es ? 'Próximamente' : 'Coming soon'}
          />
          <ReportCard
            icon={Users}
            title={es ? 'Rendimiento por Administrador' : 'Administrator Performance'}
            description={es ? 'Comparativa de supervisores y equipos comerciales.' : 'Supervisor and sales team comparison.'}
            tag={es ? 'Próximamente' : 'Coming soon'}
          />
          <ReportCard
            icon={Activity}
            title={es ? 'Progresión de Asesores' : 'Advisor Progression'}
            description={es ? 'Evolución individual de puntajes en el tiempo.' : 'Individual score evolution over time.'}
            tag={es ? 'Próximamente' : 'Coming soon'}
          />
        </div>
      </div>
    </div>
  )
}
