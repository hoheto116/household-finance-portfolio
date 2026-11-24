import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, validateExpression, CalculationError } from './calculation-engine.ts';

const constant = value => ({op:'constant',value});
const ref = itemNo => ({op:'ref',itemKind:'system',itemNo});
const op = (op,...args) => ({op,args});
const sources = expression => ({
  version:1, configurationRevision:1,
  items:[
    {itemKind:'system',itemNo:1,name:'Sample input',category:'input',nature:'monthly'},
    {itemKind:'system',itemNo:12,name:'Sample transfer',category:'calculated',nature:'monthly'}
  ],
  fixedValues:[],monthlyValues:[{itemKind:'system',itemNo:1,amount:10001}],
  definitions:[{itemKind:'system',itemNo:12,expression}]
});
test('exact division and explicit rounding',()=>{
  const r=calculate(sources(op('round',op('divide',ref(1),constant(2)))));
  assert.equal(r.transferAmount,5001);assert.equal(r.canConfirm,true);
});
test('fractional yen requires explicit rounding',()=>{
  const r=calculate(sources(op('divide',ref(1),constant(2))));
  assert.equal(r.canConfirm,false);assert.equal(r.transferAmount,null);assert.equal(r.errors.length,1);
});
test('division by zero prevents confirmation',()=>{
  const r=calculate(sources(op('divide',ref(1),constant(0))));
  assert.equal(r.canConfirm,false);assert.equal(r.errors.length,1);
});
test('negative transfer prevents confirmation',()=>{
  const r=calculate(sources(constant(-1)));
  assert.equal(r.transferAmount,-1);assert.equal(r.canConfirm,false);
});
test('unsupported operator is rejected',()=>{
  assert.throws(()=>validateExpression(op('eval',constant(1))),CalculationError);
});
test('circular reference is rejected',()=>{
  assert.throws(()=>calculate(sources(ref(12))),CalculationError);
});
test('missing referenced item is rejected',()=>{
  assert.throws(()=>calculate(sources(ref(999))),CalculationError);
});
test('unsafe integer constant is rejected',()=>{
  assert.throws(()=>validateExpression(constant(Number.MAX_SAFE_INTEGER+1)),CalculationError);
});
