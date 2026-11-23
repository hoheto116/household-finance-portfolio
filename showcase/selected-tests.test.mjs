// Extracted verbatim from workers/api/tests/monthly-states.test.mjs.
// These tests rely on setup(), lineSetup(), withLineMock(), and app in the original suite.
// This excerpt is for code review; it is not standalone executable.

test('Web APIs fail closed, including evidence; forged internal headers cannot bypass',async()=>{
 const t=setup({domesticProfile:true})
 for(const path of ['/items','/months','/monthly-values?month=2026-10','/months/2026-10/proof','/monthly-values/system/1/evidence?month=2026-10','/calculation-definitions']){
  const r=await app.request('/api'+path,{headers:{Authorization:'Bearer forged','X-Internal-Request':'true'}},t.authEnv)
  assert.equal(r.status,401,path);assert.equal(r.headers.get('Cache-Control'),'no-store')
 }
 assert.equal((await app.request('/api/health',{},t.authEnv)).status,200)
 assert.equal((await app.request('/api/auth/login',{},t.authEnv)).status,503)
})

test('Web sessions check CSRF, origin, expiry, active membership and administrator role',async()=>{
 const t=setup({domesticProfile:true});await t.request('/items',undefined,'GET')
 const cookie='__Host-household-session='+t.sessionToken
 const send=(path,headers={},method='POST')=>app.request('/api'+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...headers},body:method==='GET'?undefined:'{}'},t.authEnv)
 assert.equal((await send('/monthly-values')).status,403)
 assert.equal((await send('/monthly-values',{Origin:'https://evil.example','X-CSRF-Token':t.csrf})).status,403)
 t.sql.exec("UPDATE app_members SET role='member'")
 for(const path of ['/items','/fixed-values','/calculation-definitions'])assert.equal((await send(path,{Origin:t.authEnv.WEB_ORIGIN,'X-CSRF-Token':t.csrf})).status,403)
 assert.equal((await send('/items',{},'GET')).status,200)
 t.sql.exec('UPDATE app_members SET active=0');assert.equal((await send('/items',{},'GET')).status,401)
 t.sql.exec('UPDATE app_members SET active=1; UPDATE web_sessions SET expires_at=0');assert.equal((await send('/items',{},'GET')).status,401)
})

test('unsafe expressions, nonexistent references, self references and indirect cycles',()=>{
  for(const expression of ['1+1',{op:'eval',args:[]},{op:'constant',value:1,code:'alert(1)'},{op:'ref',itemKind:'custom',itemNo:1},operation('divide',constant(1))])
    assert.throws(()=>validateExpression(expression),CalculationError)
  const sources=baseSources()
  assert.throws(()=>validateDefinitions(sources.items,[{itemKind:'system',itemNo:9,expression:ref(9)}]),/循環参照/)
  assert.throws(()=>validateDefinitions(sources.items,[{itemKind:'system',itemNo:9,expression:ref(10)},{itemKind:'system',itemNo:10,expression:ref(9)}]),/循環参照/)
  assert.throws(()=>validateDefinitions(sources.items,[{itemKind:'system',itemNo:9,expression:ref(999)}]),/参照項目/)
  let deep=constant(1);for(let n=0;n<34;n++)deep=operation('floor',deep)
  assert.throws(()=>validateExpression(deep),/深さ32/)
  const wide=operation('add',...Array.from({length:64},()=>operation('add',...Array.from({length:5},()=>constant(1)))))
  assert.throws(()=>validateExpression(wide),/256ノード/)
})

test('LINE signature checked on raw bytes; empty verification and registration admin guard',async()=>{
  const t=lineSetup();await withLineMock(t,async()=>{
    assert.equal((await t.send(null)).status,200)
    assert.equal((await t.send(t.makeEvent('給料'),{signature:'invalid'})).status,401)
    assert.equal((await t.send(t.makeEvent('給料'),{raw:'{ "events": [] }'})).status,401)
    assert.equal(t.replies.length,0)
    assert.equal((await app.request('/api/line/users',{},t.env)).status,401)
    const bad=await app.request('/api/line/users',{method:'POST',headers:{Authorization:'Bearer test-admin-token','Content-Type':'application/json'},body:JSON.stringify({lineUserId:'bad',displayName:'test'})},t.env)
    assert.equal(bad.status,400)
    const good=await app.request('/api/line/users',{method:'POST',headers:{Authorization:'Bearer test-admin-token','Content-Type':'application/json'},body:JSON.stringify({lineUserId:lineUser,displayName:'test',active:false})},t.env)
    assert.equal(good.status,200)
    assert.equal(t.sql.prepare('SELECT active FROM line_users').get().active,0)
  })
})

