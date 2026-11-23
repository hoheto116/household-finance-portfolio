import type {Trace} from '../../../workers/api/src/calculation-engine'

const symbols:Record<string,string>={add:'＋',subtract:'−',multiply:'×',divide:'÷'}
const functions:Record<string,string>={floor:'切り捨て',ceil:'切り上げ',round:'四捨五入',min:'最小',max:'最大'}
function numeric(value:string){return /^-?\d+$/.test(value)?BigInt(value).toLocaleString():value}
export function Formula({trace}:{trace:Trace}){
 function expression(t:Trace,root=false):React.ReactNode[]{
  if(t.op==='ref'||t.op==='constant')return [<ruby key="value" className={'formula-term'+(t.missing?' missing':'')}>{numeric(t.value)}<rt>{t.op==='ref'?(t.name??'項目'):t.value.endsWith('％')?'割合':'定数'}</rt></ruby>]
  if(t.op==='divide'&&t.children?.[1]?.op==='constant'&&t.children[1].value==='100'){
   const numerator=t.children[0],args=numerator.children??[]
   if(numerator.op==='multiply'&&args.length===2&&args[1].op==='constant')return expression({...t,op:'multiply',children:[args[0],{...args[1],value:args[1].value+'％'}]},root)
  }
  const children=t.children??[],symbol=symbols[t.op],rounding=['floor','ceil','round'].includes(t.op),brackets=!root||!symbol
  return [...(brackets?[<span key="open">{symbol||rounding?'（':functions[t.op]+'（'}</span>]:[]),...children.flatMap((child,index)=>[...(index>0?[<span key={'op'+index} className="formula-symbol">{symbol??'，'}</span>]:[]),...expression(child).map((node,n)=><span className="formula-token" key={index+':'+n}>{node}</span>)]),...(brackets?[<span key="close">）{rounding?functions[t.op]:''}</span>]:[])]
 }

 return <div className="formula-scroll" tabIndex={0} aria-label="日本語の項目名を上に、数値の式を下に表示"><div className="formula-equation">{expression(trace,true)}<span className="formula-symbol">＝</span><ruby className="formula-term">{numeric(trace.value)}<rt>計算結果</rt></ruby><span>円</span></div></div>
}
