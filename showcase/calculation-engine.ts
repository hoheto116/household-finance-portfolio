export type ItemKind = 'system' | 'custom'
export type ItemRef = { itemKind: ItemKind; itemNo: number }
export type Expression =
  | { op: 'constant'; value: number }
  | ({ op: 'ref' } & ItemRef)
  | { op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max'; args: Expression[] }
  | { op: 'floor' | 'ceil' | 'round'; args: [Expression] }
export type SourceItem = ItemRef & { name: string; category: string; nature: string; inputMode?: string; displayOrder?: number }
export type Definition = ItemRef & { expression: Expression; revision?: number }
export type Sources = {
  version: number; items: SourceItem[];
  fixedValues: (ItemRef & { amount: number })[];
  monthlyValues: (ItemRef & { amount: number | null; hasEvidence?: number })[];
  definitions: Definition[]; configurationRevision: number
}
export class CalculationError extends Error {}
export const itemKey = (item: ItemRef) => `${item.itemKind}:${item.itemNo}`
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function validRef(value: unknown): value is ItemRef {
  if (!isRecord(value) || !Number.isSafeInteger(value.itemNo)) return false
  return value.itemKind === 'system' ? Number(value.itemNo) >= 1 && Number(value.itemNo) <= 999
    : value.itemKind === 'custom' && Number(value.itemNo) >= 1000
}
export function validateExpression(value: unknown): asserts value is Expression {
  let count = 0
  function visit(node: unknown, depth: number) {
    if (++count > 256 || depth > 32) throw new CalculationError('式は256ノード・深さ32までです')
    if (!isRecord(node)) throw new CalculationError('構造化された計算式が必要です')
    const keys = Object.keys(node).sort().join(',')
    if (node.op === 'constant' && keys === 'op,value' && Number.isSafeInteger(node.value)) return
    if (node.op === 'ref' && keys === 'itemKind,itemNo,op' && validRef(node)) return
    if (keys !== 'args,op' || !Array.isArray(node.args)) throw new CalculationError('不正な演算または属性です')
    const op = node.op
    const size = node.args.length
    if (['subtract','divide'].includes(String(op)) ? size !== 2
      : ['floor','ceil','round'].includes(String(op)) ? size !== 1
      : ['add','multiply','min','max'].includes(String(op)) ? size < 2 || size > 64 : true)
      throw new CalculationError('未対応の演算または引数数です')
    node.args.forEach(child => visit(child, depth + 1))
  }
  visit(value, 0)
}
function refs(expression: Expression): ItemRef[] {
  return expression.op === 'ref' ? [expression] : expression.op === 'constant' ? [] : expression.args.flatMap(refs)
}
export function validateDefinitions(items: SourceItem[], definitions: Definition[]) {
  if (definitions.length>512) throw new CalculationError('計算定義は512項目までです')
  const itemMap = new Map(items.map(item => [itemKey(item), item]))
  const definitionMap = new Map<string, Definition>()
  for (const definition of definitions) {
    if (!validRef(definition)) throw new CalculationError('項目番号が不正です')
    const key = itemKey(definition)
    if (definitionMap.has(key)) throw new CalculationError(`計算定義が重複しています: ${key}`)
    if (itemMap.get(key)?.category !== 'calculated') throw new CalculationError(`有効な計算結果項目が必要です: ${key}`)
    validateExpression(definition.expression)
    for (const ref of refs(definition.expression)) {
      if (!itemMap.has(itemKey(ref))) throw new CalculationError(`参照項目が存在しないか無効です: ${itemKey(ref)}`)
    }
    definitionMap.set(key, definition)
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  function visit(key: string, path: string[]) {
    if (visiting.has(key)) throw new CalculationError(`循環参照: ${[...path,key].join(' → ')}`)
    if (visited.has(key)) return
    if (path.length > 64) throw new CalculationError('計算項目の依存は64段までです')
    visiting.add(key)
    for (const ref of refs(definitionMap.get(key)!.expression)) if (definitionMap.has(itemKey(ref))) visit(itemKey(ref), [...path,key])
    visiting.delete(key); visited.add(key)
  }
  for (const key of definitionMap.keys()) visit(key, [])
}
// Exact rational arithmetic avoids binary floating-point errors for money.
type Rational = { n: bigint; d: bigint }
const maxMoney = BigInt(Number.MAX_SAFE_INTEGER)
function fraction(n: bigint, d = 1n): Rational {
  if (d === 0n) throw new CalculationError('0で除算できません')
  if (d < 0n) { n = -n; d = -d }
  if (n.toString(2).length > 256 || d.toString(2).length > 256) throw new CalculationError('計算値が大きすぎます')
  let a = n < 0n ? -n : n, b = d
  while (b) { const remainder = a % b; a = b; b = remainder }
  return { n: n / a, d: d / a }
}
function amount(value: Rational): number {
  if (value.d !== 1n) throw new CalculationError('円未満の結果です。floor / ceil / roundを指定してください')
  if (value.n > maxMoney || value.n < -maxMoney) throw new CalculationError('金額が安全な整数範囲を超えています')
  return Number(value.n)
}
function printable(value: Rational) { return value.d === 1n ? value.n.toString() : `${value.n}/${value.d}` }
export type Trace = { op: Expression['op']; value: string; itemKind?: ItemKind; itemNo?: number; name?: string; source?: string; missing?: boolean; children?: Trace[] }
export type CalculationRow = ItemRef & { name: string; amount: number | null; source: string; missing: boolean; trace?: Trace; error?: string }
export function calculate(sources: Sources) {
  validateDefinitions(sources.items, sources.definitions)
  const items = new Map(sources.items.map(item => [itemKey(item), item]))
  const definitions = new Map(sources.definitions.map(item => [itemKey(item), item]))
  const fixed = new Map(sources.fixedValues.map(item => [itemKey(item), item.amount]))
  if(fixed.size!==sources.fixedValues.length) throw new CalculationError('固定値の適用期間が重複しています')
  const monthly = new Map(sources.monthlyValues.filter(item=>item.amount!==null).map(item => [itemKey(item), item.amount!]))
  const cache = new Map<string, CalculationRow>()
  function row(key: string): CalculationRow {
    if (cache.has(key)) return cache.get(key)!
    const item = items.get(key)!
    let result: CalculationRow
    if (item.category === 'calculated') {
      const definition = definitions.get(key)
      if (!definition) throw new CalculationError(`計算式が未設定です: ${item.name}`)
      const evaluated = evaluate(definition.expression)
      result = { ...item, amount: amount(evaluated.value), source: 'calculated', missing: false, trace: evaluated.trace }
    } else {
      const source = item.nature === 'fixed' ? 'fixed' : 'monthly'
      const values = source === 'fixed' ? fixed : monthly
      const missing = !values.has(key), value = values.get(key) ?? 0
      if (!Number.isSafeInteger(value) || value < 0) throw new CalculationError(`入力金額が不正です: ${item.name}`)
      result = { ...item, amount: value, source, missing }
    }
    cache.set(key, result)
    return result
  }
  function evaluate(expression: Expression): { value: Rational; trace: Trace } {
    if (expression.op === 'constant') {
      return { value: fraction(BigInt(expression.value)), trace: { op: 'constant', value: String(expression.value) } }
    }
    if (expression.op === 'ref') {
      const ref = row(itemKey(expression))
      return { value: fraction(BigInt(ref.amount!)), trace: { op: 'ref', value: String(ref.amount), itemKind: ref.itemKind, itemNo: ref.itemNo, name: ref.name, source: ref.source, missing: ref.missing } }
    }
    const children = expression.args.map(evaluate), values = children.map(child => child.value)
    const first = values[0]
    let value: Rational
    switch (expression.op) {
      case 'add': value = values.reduce((a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d)); break
      case 'subtract': value = fraction(first.n*values[1].d-values[1].n*first.d,first.d*values[1].d); break
      case 'multiply': value = values.reduce((a,b)=>fraction(a.n*b.n,a.d*b.d)); break
      case 'divide': value = fraction(first.n*values[1].d,first.d*values[1].n); break
      case 'min': value = values.reduce((a,b)=>a.n*b.d <= b.n*a.d ? a : b); break
      case 'max': value = values.reduce((a,b)=>a.n*b.d >= b.n*a.d ? a : b); break
      case 'floor': value = fraction(first.n/first.d-(first.n<0n && first.n%first.d!==0n ? 1n : 0n)); break
      case 'ceil': value = fraction(first.n/first.d+(first.n>0n && first.n%first.d!==0n ? 1n : 0n)); break
      case 'round': { const sign = first.n<0n ? -1n : 1n; const n = first.n*sign; value = fraction(sign*((2n*n+first.d)/(2n*first.d))); break }
    }
    return { value, trace: { op: expression.op, value: printable(value), children: children.map(child=>child.trace) } }
  }
  const rows = sources.items.map(item => {
    try { return row(itemKey(item)) }
    catch (error) { if (!(error instanceof CalculationError)) throw error; return { ...item, amount: null, source: 'calculated', missing: false, error: error.message } as CalculationRow }
  })
  const transfer = rows.find(item => item.itemKind === 'system' && item.itemNo === 12)
  const errors = rows.filter(row=>row.error).map(row=>({ itemKind: row.itemKind, itemNo: row.itemNo, error: row.error }))
  if (transfer?.amount != null && transfer.amount < 0) errors.push({ itemKind: 'system', itemNo: 12, error: '振込額が負数です' })
  return { rows, errors, transferAmount: transfer?.amount ?? null,
    canConfirm: !!transfer && transfer.amount !== null && transfer.amount >= 0 && errors.length === 0 }
}
