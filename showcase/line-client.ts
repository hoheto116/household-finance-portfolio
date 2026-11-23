import { imageType, MAX_LINE_IMAGE_BYTES } from './line-domain'

export class LineTransportError extends Error {}
async function fetchLine(url:string,init:RequestInit) {
  try{return await fetch(url,init)}catch{throw new LineTransportError('LINE network failure')}
}
export function buildLineMessage(text:string){
  const detail=text.match(/\n詳細：(https:\/\/[^\s]+\/monthly-detail\?month=\d{4}-\d{2})$/)
  if(detail){const summary=text.slice(0,detail.index);return {type:'template',altText:summary.slice(0,400),template:{type:'buttons',text:summary.slice(0,160),actions:[{type:'uri',label:'入力内容・計算を見る',uri:detail[1]}]}}}
  if(/を登録しました。\n[\d,]+円$/.test(text)||text.startsWith('この項目は登録済みです。'))return {type:'template',altText:text.slice(0,400),template:{type:'buttons',text:text.slice(0,160),actions:[{type:'postback',label:'次の項目を入力',data:'メニュー',inputOption:'openRichMenu'}]}}
  const form=text.match(/^入力フォームを開いてください。\n(https:\/\/[^\s]+)$/)
  if(form)return {type:'template',altText:'入力フォームを開いてください。',template:{type:'buttons',text:'金額と画像を入力してください。',actions:[{type:'uri',label:'入力フォームを開く',uri:form[1]}]}}
  const confirmation=text.match(/「((?:登録確認|確定|完了) [0-9a-f-]{36})」/)
  const actions=confirmation?[{label:confirmation[1].startsWith('登録確認')?'はい、登録します':confirmation[1].startsWith('完了')?'この月を完了':'この金額で確定',text:confirmation[1]},{label:'キャンセル',text:'キャンセル'}]:[
    {label:'給料',text:'給料'},{label:'電気代',text:'電気代'},{label:'水道代',text:'水道代'},
    {label:'ガス代',text:'ガス代'},{label:'その他',text:'その他'},{label:'今月の状況',text:'今月の状況'},
    {label:'振込額確定',text:'振込額確定'},{label:'振込証明',text:'振込証明'},{label:'月次完了',text:'月次完了'},
    {label:'キャンセル',text:'キャンセル'},
    {label:'受付月に戻る',text:'受付月'},
  ]
  const quickReply=text==='画像を送信してください。'?{items:[
    {type:'action',action:{type:'cameraRoll',label:'画像を選ぶ'}},
    {type:'action',action:{type:'camera',label:'撮影する'}},
    {type:'action',action:{type:'message',label:'キャンセル',text:'キャンセル'}},
  ]}:{items:(text.endsWith('金額を入力してください。')?[{label:'キャンセル',text:'キャンセル'}]:actions).map(action=>({type:'action',action:['給料','電気代','水道代','ガス代'].includes(action.text)?{type:'postback',label:action.label,data:'項目 '+action.text,displayText:action.text,inputOption:'openKeyboard'}:{type:'message',...action}}))}
  const cleanText=text.replace(/[^\n]*「(?:登録確認|確定|完了) [0-9a-f-]{36}」[^\n]*/g,'').trim()
  const message=confirmation?{
    type:'flex',altText:cleanText.slice(0,400),contents:{type:'bubble',
      body:{type:'box',layout:'vertical',spacing:'md',contents:[
        {type:'text',text:confirmation[1].startsWith('登録確認')?'入力内容の確認':confirmation[1].startsWith('完了')?'月次完了の確認':'振込額の確認',weight:'bold',size:'lg',color:'#164E43',wrap:true},
        {type:'text',text:cleanText,wrap:true,size:'md',color:'#334155'},
      ]},
      footer:{type:'box',layout:'vertical',spacing:'sm',contents:actions.map((action,index)=>({type:'button',style:index===0?'primary':'secondary',...(index===0?{color:'#167B65'}:{}),action:index===0?{type:'postback',label:action.label,data:action.text,displayText:action.label}:{type:'message',label:action.label,text:action.text}}))},
    },
  }:{type:'text',text:text.slice(0,5000),quickReply}
  return message
}
export async function replyLine(token: string, replyToken: string, text: string) {
  const response = await fetchLine('https://api.line.me/v2/bot/message/reply', {
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({replyToken,messages:[buildLineMessage(text)]}),
    signal:AbortSignal.timeout(10000),
  })
  // Expired/used reply tokens cannot be retried. No push-message fallback.
  if (response.status===400) {const error=await response.json().catch(()=>null) as {message?:string}|null;if(error?.message==='Invalid reply token')return false}
  if (!response.ok) throw new LineTransportError(`LINE reply HTTP ${response.status}`)
  return true
}
export async function downloadLineImage(token: string, messageId: string) {
  if (!/^\d{1,64}$/.test(messageId)) throw new Error('画像IDが不正です')
  const response = await fetchLine(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    // Return redirects without following them or forwarding the bearer token.
    // Workers runtimes can reject redirect:'error' before sending the request.
    headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),redirect:'manual',
  })
  if (!response.ok) throw new LineTransportError(`LINE content HTTP ${response.status}`)
  const length = Number(response.headers.get('Content-Length'))
  if (length > MAX_LINE_IMAGE_BYTES) { await response.body?.cancel();throw new Error('画像は10MB以下にしてください') }
  if (!response.body) throw new Error('画像を取得できませんでした')
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0
  while (true) {
    let chunk:ReadableStreamReadResult<Uint8Array>;try{chunk=await reader.read()}catch{throw new LineTransportError('LINE image stream failure')}const {done,value}=chunk;if(done)break
    size+=value.byteLength
    if(size>MAX_LINE_IMAGE_BYTES){await reader.cancel();throw new Error('画像は10MB以下にしてください')}
    chunks.push(value)
  }
  const bytes=new Uint8Array(size);let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const type=imageType(bytes)
  if(!type)throw new Error('PNG・JPEG・WebP画像を送信してください')
  return new File([bytes],`line-${messageId}.${type==='image/png'?'png':type==='image/jpeg'?'jpg':'webp'}`,{type})
}
