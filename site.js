'use strict';
function valid(m){return m?.status==='ok'&&typeof m.value==='number'&&Number.isFinite(m.value)&&Number.isFinite(Date.parse(m.checked_at))&&Date.now()-Date.parse(m.checked_at)<36*3600000&&Date.parse(m.checked_at)<=Date.now();}
function validateRules(rules,labels){
 if(!Array.isArray(rules)||rules.length>10)return '最多設定 10 條條件';
 for(const r of rules){
  if(r?.badInput)return '上下限請輸入完整有效的數字';
  if(!r||!Object.hasOwn(labels,r.key))return '包含無效的指標';
  if(!['min','max'].every(k=>typeof r[k]==='string'&&(r[k]===''||(r[k].trim()!==''&&Number.isFinite(Number(r[k]))))))return '上下限請輸入有效數字';
  if(r.min!==''&&r.max!==''&&Number(r.min)>Number(r.max))return '最低值不能大於最高值';
 }
 return null;
}
function evaluateRules(metrics,rules,mode){
 const active=rules.filter(r=>r.min!==''||r.max!=='');
 if(!active.length)return 'pass';
 const states=active.map(r=>!valid(metrics[r.key])?'unknown':((r.min===''||metrics[r.key].value>=Number(r.min))&&(r.max===''||metrics[r.key].value<=Number(r.max)))?'pass':'fail');
 if(mode==='OR')return states.includes('pass')?'pass':states.includes('unknown')?'unknown':'fail';
 return states.includes('fail')?'fail':states.includes('unknown')?'unknown':'pass';
}
function csvCell(v){let s=String(v??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
if(typeof module!=='undefined')module.exports={valid,evaluateRules,validateRules,csvCell};

if(typeof document!=='undefined'){

const $=s=>document.querySelector(s);let snapshot,stocks=[],page=0,selected=null,watch=new Set(),matched=[];
try{const saved=JSON.parse(localStorage.getItem('stocklab-public-watch')||'[]');if(Array.isArray(saved))watch=new Set(saved.filter(x=>/^\d{4}$/.test(x)));}catch{}
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
const when=t=>t?new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚無資料';

function value(m){return fmt(m?.value)+(valid(m)?'':m?.value!=null?'（待查／過期）':'');}
function cell(row,text){const c=document.createElement('td');c.textContent=text;row.append(c);return c;}
function action(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);parent.append(b);}
function details(code){selected=code;const s=stocks.find(x=>x.code===code);if(!s)return;$('#detail').hidden=false;$('#detail-title').textContent=`${s.code} ${s.name}`;$('#metrics').replaceChildren();for(const [k,label] of Object.entries(snapshot.labels)){const a=document.createElement('article');const small=document.createElement('small');small.textContent=label.join(' · ');const v=document.createElement('strong');v.textContent=value(s.metrics[k]);const p=document.createElement('p');p.textContent=`資料期間 ${s.metrics[k]?.period||'待查'} · 核對 ${when(s.metrics[k]?.checked_at)}`;a.append(small,v,p);$('#metrics').append(a);}$('#detail').scrollIntoView({behavior:'smooth',block:'start'});}
function render(){if(!snapshot)return;const key=$('#field').value,q=$('#query').value.trim().toLowerCase(),lo=$('#minimum').value,hi=$('#maximum').value;const rules=readRules(),error=validateRules(rules,snapshot.labels);$('#rule-message').textContent=error||'';$('#export').disabled=!!error;
 const candidates=stocks.filter(s=>(!q||(s.code+' '+s.name).toLowerCase().includes(q))&&(!$('#only-watch').checked||watch.has(s.code)));
 const assessed=candidates.map(s=>({stock:s,state:evaluateRules(s.metrics,rules,$('#mode').value)}));
 let found=error?[]:assessed.filter(x=>x.state==='pass').map(x=>x.stock);
 const unknown=assessed.filter(x=>x.state==='unknown').length;
 const sort=$('#sort').value;found.sort((a,b)=>{if(sort==='code')return a.code.localeCompare(b.code);const x=a.metrics[key],y=b.metrics[key];if(valid(x)!==valid(y))return valid(x)?-1:1;return valid(x)?(x.value-y.value)*(sort==='desc'?-1:1):a.code.localeCompare(b.code);});page=Math.max(0,Math.min(page,Math.ceil(found.length/25)-1));matched=found;$('#result-count').textContent=error?'請修正條件後再篩選':`符合 ${found.length} 檔 · 待查 ${unknown} 檔 · 不符合 ${candidates.length-found.length-unknown} 檔`;$('#selected-label').textContent=snapshot.labels[key].join(' · ');$('#rows').replaceChildren();for(const s of found.slice(page*25,page*25+25)){const row=document.createElement('tr');action(cell(row,''),watch.has(s.code)?'★':'☆',()=>{watch.has(s.code)?watch.delete(s.code):watch.add(s.code);try{localStorage.setItem('stocklab-public-watch',JSON.stringify([...watch]));}catch{}render();});cell(row,s.code+' '+s.name);for(const k of ['price','pe','revenue_yoy',key])cell(row,value(s.metrics[k]));action(cell(row,''),'查看',()=>details(s.code));$('#rows').append(row);}$('#page').textContent=`${found.length?page+1:0} / ${Math.ceil(found.length/25)}`;$('#prev').disabled=page===0;$('#next').disabled=(page+1)*25>=found.length;}
for(const id of ['query','field','minimum','maximum','sort','only-watch','mode'])$('#'+id).addEventListener('input',()=>{page=0;render();});$('#prev').onclick=()=>{page--;render();};$('#next').onclick=()=>{page++;render();};

function readRules(){return [{key:$('#field').value,min:$('#minimum').value,max:$('#maximum').value,badInput:$('#minimum').validity.badInput||$('#maximum').validity.badInput},...Array.from($('#extra-rules').children).map(row=>({key:row.querySelector('select').value,min:row.querySelector('[data-bound=min]').value,max:row.querySelector('[data-bound=max]').value,badInput:Array.from(row.querySelectorAll('input')).some(i=>i.validity.badInput)}))];}
function options(select){for(const [k,label] of Object.entries(snapshot.labels)){const o=document.createElement('option');o.value=k;o.textContent=label.join(' · ');select.append(o);}}
function addRule(rule={}){
 if(!snapshot)return;
 if($('#extra-rules').children.length>=9){$('#rule-message').textContent='最多設定 10 條條件';return;}
 const row=document.createElement('div');row.className='rule-row';
 const select=document.createElement('select');options(select);if(Object.hasOwn(snapshot.labels,rule.key))select.value=rule.key;
 const fieldLabel=document.createElement('label');fieldLabel.textContent='附加指標';fieldLabel.append(select);row.append(fieldLabel);
 for(const [bound,label] of [['min','最低值'],['max','最高值']]){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='number';input.step='any';input.placeholder='不限';input.dataset.bound=bound;input.value=rule[bound]||'';l.append(input);row.append(l);}
 action(row,'移除此條件',()=>{row.remove();page=0;render();});row.addEventListener('input',()=>{page=0;render();});$('#extra-rules').append(row);
}
$('#add-rule').onclick=()=>{addRule();render();};
$('#save-rules').onclick=()=>{if(!snapshot)return;const rules=readRules(),error=validateRules(rules,snapshot.labels);if(error){$('#rule-message').textContent=error;return;}try{localStorage.setItem('stocklab-public-rules',JSON.stringify({rules,mode:$('#mode').value}));$('#rule-message').textContent='條件已保存於此瀏覽器';}catch{$('#rule-message').textContent='此瀏覽器不允許保存，條件仍可使用';}};
$('#load-rules').onclick=()=>{if(!snapshot)return;try{const saved=JSON.parse(localStorage.getItem('stocklab-public-rules')||'null');if(!saved||!saved.rules.length||validateRules(saved.rules,snapshot.labels)||!['AND','OR'].includes(saved.mode))throw Error();$('#field').value=saved.rules[0].key;$('#minimum').value=saved.rules[0].min;$('#maximum').value=saved.rules[0].max;$('#mode').value=saved.mode;$('#extra-rules').replaceChildren();saved.rules.slice(1).forEach(addRule);page=0;render();$('#rule-message').textContent='已還原保存的條件';}catch{$('#rule-message').textContent='尚無可還原的有效條件';}};
$('#clear-rules').onclick=()=>{$('#minimum').value='';$('#maximum').value='';$('#extra-rules').replaceChildren();$('#mode').value='AND';page=0;render();};
$('#export').onclick=()=>{
 if(!snapshot)return;render();if(validateRules(readRules(),snapshot.labels))return;
 const keys=Object.keys(snapshot.labels),header=['股票代碼','公司名稱','快照產生時間','篩選模式','篩選條件',...keys.flatMap(k=>[snapshot.labels[k].join(' '),'資料期間','核對時間','可用狀態'])];
 const lines=[header,...matched.map(s=>[s.code,s.name,snapshot.generated_at,$('#mode').value,JSON.stringify(readRules()),...keys.flatMap(k=>{const m=s.metrics[k]||{};return [m.value,m.period,m.checked_at,valid(m)?'有效':'待查／過期'];})])];
 const blob=new Blob(['\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='stocklab-results.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#rule-message').textContent=`已匯出 ${matched.length} 檔（全部符合結果，非僅目前頁）`;
};

fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP');return r.json();}).then(d=>{if(d.schema!==1||!Array.isArray(d.stocks))throw Error('schema');snapshot=d;stocks=d.stocks;$('#count').textContent=stocks.length;$('#date').textContent=d.market_date||'待更新';$('#updated').textContent=when(d.generated_at);$('#schedule').textContent=d.schedule;$('#scope').textContent=d.scope;const fresh=stocks.filter(s=>valid(s.metrics.price)).length;$('#status').textContent=`可用行情 ${fresh}／${stocks.length} 檔。每 8 小時檢查來源；來源未更新或排程失敗時保留舊值並標示待查／過期。`;for(const [k,label] of Object.entries(d.labels)){const option=document.createElement('option');option.value=k;option.textContent=label.join(' · ');$('#field').append(option);}for(const s of d.sources){const li=document.createElement('li'),a=document.createElement('a');a.textContent=s.id+' · 官方資料集';a.href=s.catalog;a.target='_blank';a.rel='noopener';li.append(a,document.createTextNode(` · ${s.ok?'最近核對成功':'最近核對失敗，保留舊資料'} · ${when(s.checked_at)}`));$('#sources').append(li);}render();setInterval(()=>{render();},60000);}).catch(()=>{$('#status').textContent='目前無法讀取公開快照，請稍後重試；不代表沒有符合條件的股票。';});

}
