import {useEffect,useState} from 'react'
import {apiFetch} from './auth-client'
import {Formula} from './Formula'
import {ImagePreview} from './ImagePreview'
import type {CalculationRow,Trace} from '../../../workers/api/src/calculation-engine'

const API=import.meta.env.VITE_API_BASE_URL||''
export function requestedMonth(){const m=new URLSearchParams(window.location.search).get('month');return m&&/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(m)?m:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date())}
type Value={itemKind:string;itemNo:number;amount:number|null;hasEvidence:boolean}
function references(t:Trace):string[]{return [...(t.op==='ref'?[`${t.itemKind}:${t.itemNo}`]:[]),...(t.children??[]).flatMap(references)]}
export function evidenceReferences(trace:Trace,rows:CalculationRow[]){const keys=new Set<string>();function visit(t:Trace){for(const key of references(t)){if(keys.has(key))continue;keys.add(key);const row=rows.find(r=>`${r.itemKind}:${r.itemNo}`===key);if(row?.trace)visit(row.trace)}}visit(trace);return keys}
export function MonthlyDetails(){
 const [month,setMonth]=useState(requestedMonth),[data,setData]=useState<{rows:CalculationRow[];values:Value[];frozen:boolean;transferAmount:number|null;status:string}|null>(null),[error,setError]=useState('')
 useEffect(()=>{const controller=new AbortController();setData(null);setError('')
  async function load(){const responses=await Promise.all(['/months/'+month+'/calculation','/monthly-values?month='+month,'/months/'+month].map(p=>apiFetch(API+'/api'+p,{signal:controller.signal})));const [calculation,values,state]=await Promise.all(responses.map(r=>r.json()));if(responses.some(r=>!r.ok))throw new Error(calculation.error??values.error??state.error??'読み込めませんでした。');if(!controller.signal.aborted)setData({rows:calculation.calculation?.rows??[],values:values.values??[],frozen:calculation.frozen,transferAmount:calculation.transferAmount,status:state.status})}
  load().catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()
 },[month])
 const url=(v:Value)=>`${API}/api/monthly-values/${v.itemKind}/${v.itemNo}/evidence?month=${month}`
 function images(values:Value[]){return <div className="detail-images">{values.map(v=>{const row=data?.rows.find(r=>r.itemKind===v.itemKind&&r.itemNo===v.itemNo);return <ImagePreview key={`${v.itemKind}:${v.itemNo}`} src={url(v)} label={row?.name??'登録画像'} thumbnail/>})}</div>}
 const find=(no:number)=>data?.rows.find(r=>r.itemKind==='system'&&r.itemNo===no)
 const transfer=find(12),allowance=find(9),utilities=find(10),salary=find(1)

 const remainder=find(11)?.trace
 const otherTerms=remainder?.op==='add'?(remainder.children??[]).filter(t=>t.op==='ref'&&!(t.itemKind==='system'&&[9,10].includes(t.itemNo??0))):[]
 function transferFormula():Trace|undefined{
  const t=transfer?.trace
  if(t?.op==='subtract'&&t.children?.[1]?.op==='ref'&&t.children[1].itemKind==='system'&&t.children[1].itemNo===11&&remainder?.op==='add'){
   const parts=remainder.children??[]
   const deductions=parts.filter(c=>!(c.op==='ref'&&c.itemKind==='system'&&[9,10].includes(c.itemNo??0)))
   const others:Trace|undefined=deductions.length&&deductions.every(c=>/^-?\d+$/.test(c.value))?{op:'ref',name:'その他',value:deductions.reduce((sum,c)=>sum+BigInt(c.value),0n).toString(),missing:deductions.some(c=>c.missing)}:undefined
   if(others||!deductions.length)return {...t,children:[t.children[0],...parts.filter(c=>c.itemKind==='system'&&c.itemNo===9),...(others?[others]:[]),...parts.filter(c=>c.itemKind==='system'&&c.itemNo===10).map(c=>utilities?.trace??c)]}
  }
  return t
 }
 const otherTotal=otherTerms.reduce((sum,t)=>sum+Number(t.value),0)
 const amount=(row:CalculationRow|undefined)=>row?.amount==null?'未計算':row.amount.toLocaleString()+'円'
 return <main className="monthly-details"><header><div className="eyebrow">HOUSEHOLD FINANCE</div><h1>入力内容・計算</h1><label>対象月<input type="month" value={month} onChange={e=>{if(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){setMonth(e.target.value);window.history.replaceState(null,'',`/monthly-detail?month=${e.target.value}`)}}}/></label></header>
  {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>読み込み中…</p>}
  {data&&<><section className="card detail-total"><span>{data.frozen?'確定時の計算':'現在の入力からの計算'}</span><h2>振込額</h2><strong>{data.transferAmount===null?'未計算':data.transferAmount.toLocaleString()+'円'}</strong>{transfer?.trace&&<><h3>計算式</h3><Formula trace={transferFormula()??transfer.trace}/></>}{transfer?.error&&<p role="alert">{transfer.error}</p>}</section>
   <section className="detail-summary-grid" aria-label="振込額の内訳"><article className="card"><h3>手取り額</h3><strong>{amount(salary)}</strong></article><article className="card"><h3>お小遣い</h3><strong>{amount(allowance)}</strong>{allowance?.trace&&<details><summary>計算式</summary><Formula trace={allowance.trace}/></details>}</article><article className="card"><h3>その他（交通費等）</h3><strong>{otherTerms.length?otherTotal.toLocaleString()+'円':'内訳を確認'}</strong>{otherTerms.length>0&&<details><summary>内訳</summary><Formula trace={{op:'add',value:String(otherTotal),children:otherTerms}}/></details>}</article><article className="card"><h3>公共料金等合計</h3><strong>{amount(utilities)}</strong></article></section>
   <section className="card detail-utilities"><h2>公共料金等合計</h2><strong>{amount(utilities)}</strong>{utilities?.trace&&<Formula trace={utilities.trace}/>} {utilities?.error&&<p role="alert">{utilities.error}</p>}</section>
   <section className="card"><h2>計算根拠の画像</h2>{images(data.values.filter(v=>v.hasEvidence))}{!data.values.some(v=>v.hasEvidence)&&<p>登録画像はありません。</p>}</section>
   <section><h2>入力項目・固定値</h2>{data.rows.filter(r=>r.source!=='calculated'&&!r.trace&&!r.error).map(row=>{const v=data.values.find(v=>v.itemKind===row.itemKind&&v.itemNo===row.itemNo);return <article className="card detail-input" key={`${row.itemKind}:${row.itemNo}`}><h3>{row.name}</h3><p>{row.amount?.toLocaleString()}円{row.missing?'（未入力・計算上0円）':row.source==='fixed'?'（固定値）':''}</p>{v?.hasEvidence&&images([v])}</article>})}</section>
   {data.rows.length===0&&<p>この月の計算結果は保存されていません。</p>}
  </>}<a className="navigation-link" href="/">月次の家計を開く <span aria-hidden="true">→</span></a>
 </main>
}
