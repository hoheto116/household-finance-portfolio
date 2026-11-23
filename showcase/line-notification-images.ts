import {Hono} from 'hono'
import type {LineBindings} from './line-routes'

// LINE's image fetch cannot use a Web session. An unguessable, time-limited
// bearer URL grants access to one confirmed image; the R2 bucket stays private.
export const notificationImages=new Hono<{Bindings:LineBindings}>()
notificationImages.get('/:token',async c=>{
 c.header('Cache-Control','private, no-store')
 c.header('Referrer-Policy','no-referrer')
 c.header('X-Content-Type-Options','nosniff')
 const token=c.req.param('token')
 if(!/^[a-f0-9]{64}$/.test(token))return c.notFound()
 const row=await c.env.DB.prepare(`SELECT i.evidence_key,i.content_type FROM line_notification_images i
 JOIN line_notification_outbox o ON o.id=i.notification_id
 JOIN app_members m ON m.line_user_id=o.recipient
 JOIN line_users l ON l.line_user_id=m.line_user_id
 WHERE i.token=? AND i.expires_at>? AND o.status IN ('pending','sent')
 AND m.active=1 AND m.household_id='default' AND l.active=1`).bind(token,Date.now()).first<{evidence_key:string;content_type:string}>()
 if(!row||!['image/jpeg','image/png','image/webp'].includes(row.content_type))return c.notFound()
 const object=await c.env.EVIDENCE.get(row.evidence_key)
 if(!object)return c.notFound()
 c.header('Content-Type',row.content_type)
 return c.body(object.body)
})

export async function notificationMessages(env:LineBindings,row:{id:string;text:string}){
 const messages:({type:'text';text:string}|{type:'image';originalContentUrl:string;previewImageUrl:string})[]=[{type:'text',text:row.text}]
 const image=await env.DB.prepare('SELECT token,evidence_key,content_type FROM line_notification_images WHERE notification_id=? AND expires_at>?').bind(row.id,Date.now()).first<{token:string;evidence_key:string;content_type:string}>()
 if(!image||!env.WEB_ORIGIN)return messages
 let origin:URL;try{origin=new URL(env.WEB_ORIGIN)}catch{return messages}
 if(origin.protocol!=='https:'||origin.origin!==env.WEB_ORIGIN)return messages
 const object=await env.EVIDENCE.head(image.evidence_key)
 if(!object)return messages
 const url=`${origin.origin}/line-notification-images/${image.token}`
 // LINE previews require JPEG/PNG <=1MB. Other supported uploads retain a
 // direct image link rather than making the entire notification fail.
 if(['image/jpeg','image/png'].includes(image.content_type)&&object.size<=1000000)messages.push({type:'image',originalContentUrl:url,previewImageUrl:url})
 else messages.push({type:'text',text:`登録画像はこちらから確認できます。\n${url}`})
 return messages
}
