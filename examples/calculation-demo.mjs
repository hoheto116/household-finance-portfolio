// ポートフォリオ用の独立した計算例。実アプリの計算エンジンそのものではありません。
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(new URL('./demo-data.json', import.meta.url), 'utf8'));
const allowance = Math.floor((d.salary - d.commuting) * 10 / 100);
const utilities = Object.values(d.bills).reduce((a,b)=>a+b,0) + d.otherExpense;
const remaining = allowance + d.commuting + d.otherIncome + utilities;
const transfer = d.salary - remaining;
console.log(JSON.stringify({month:d.month,salary:d.salary,allowance,utilities,remaining,transfer},null,2));
if (allowance !== 29000 || utilities !== 103000 || transfer !== 156000) throw new Error('Unexpected calculation');
