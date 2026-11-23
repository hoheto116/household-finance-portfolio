import type { CalculationRow } from '../../../workers/api/src/calculation-engine'

const steps = [
  ['inputting', '入力中'], ['transfer_confirmed', '振込額確定'],
  ['proof_registered', '振込証明登録'], ['completed', '月次完了'],
] as const

export function MonthlyOverview({ status, rows, transferAmount, registered, total, dirty }: {
  status?: string; rows: CalculationRow[]; transferAmount: number | null;
  registered: number; total: number; dirty: number;
}) {
  const index = steps.findIndex(([key]) => key === status)
  const amount = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString() + '円'
  const systemAmount = (no: number) => rows.find(row => row.itemKind === 'system' && row.itemNo === no)?.amount
  return <section className="monthly-overview" aria-label="月次の概要">
    <ol className="monthly-steps" aria-label="月次の進行状況">{steps.map(([key, label], position) =>
      <li key={key} className={position === index ? 'current' : position < index ? 'finished' : ''} aria-current={position === index ? 'step' : undefined}>
        <span className="step-number">{position < index ? '✓' : position + 1}</span><span>{label}</span>
      </li>)}</ol>
    <div className="overview-grid">
      <div className="overview-metric transfer"><span>{index > 0 ? '確定した振込額' : '振込額の見込み'}</span><strong>{amount(transferAmount)}</strong><small>{dirty ? '未保存の入力は反映されていません' : index > 0 ? '確定時の金額' : '保存済みの入力から計算'}</small></div>
      <div className="overview-metric"><span>手取り</span><strong>{amount(systemAmount(1))}</strong></div>
      <div className="overview-metric"><span>小遣い</span><strong>{amount(systemAmount(9))}</strong></div>
      <div className="overview-metric"><span>入力済み</span><strong>{registered}<em> / {total}項目</em></strong><small>{total - registered > 0 ? `未入力 ${total - registered}項目` : 'すべての金額を登録済み'}</small></div>
    </div>
    {index >= 1 && <p className="lock-notice">この月の金額と証跡は確定済みのため変更できません。保存された内容を参照できます。</p>}
  </section>
}
