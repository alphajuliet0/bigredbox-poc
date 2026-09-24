/* Live supplier check: real public data from data/intel.json (rebuilt daily from CISA KEV, HIBP and DNS). */
(function(){
'use strict';
var MAXL=10, D=null, sel=[], share={};
var SHARE=[['personal','Client or staff personal data'],['financial','Financial or payment data'],['admin','Admin access to your systems']];
function $(id){return document.getElementById(id);}
function el(t,a,k){var n=document.createElement(t);if(a)for(var x in a){if(x==='text')n.textContent=a[x];else if(x==='cls')n.className=a[x];else n.setAttribute(x,a[x]);}(k||[]).forEach(function(c){if(c)n.appendChild(typeof c==='string'?document.createTextNode(c):c);});return n;}
function link(href,text){return el('a',{href:href,target:'_blank',rel:'noopener noreferrer',text:text});}
function fmtDate(s){var d=new Date(s+'T00:00:00Z');return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}
function fmtN(n){return n>=1e6?(Math.round(n/1e5)/10)+'m':n>=1e3?Math.round(n/1e3)+'k':String(n);}
function byId(id){for(var i=0;i<D.suppliers.length;i++)if(D.suppliers[i].id===id)return D.suppliers[i];}
function nvd(c){return 'https://nvd.nist.gov/vuln/detail/'+c;}

function score(s){
  var items=[],k=s.kev,n=k.last12m;
  var kp=n>=10?35:n>=3?25:n>=1?15:0;
  if(kp)items.push({pts:kp,key:'kev',label:n+' exploited '+(n===1?'flaw':'flaws')+' in '+k.vendor+' products added to CISA KEV in 12 months'});
  if(k.ransomware12m)items.push({pts:5,key:'rw',label:k.ransomware12m+' of them used in ransomware campaigns'});
  var rb=s.breaches.filter(function(b){return b.recent;}),ob=s.breaches.filter(function(b){return !b.recent;});
  if(rb.length)items.push({pts:20,key:'br',label:'Breach of '+s.domain+' in the last 5 years ('+rb[0].title+', '+fmtDate(rb[0].date)+')'});
  else if(ob.length)items.push({pts:10,key:'br',label:'Older breach of '+s.domain+' ('+ob[0].title+', '+fmtDate(ob[0].date)+')'});
  var p=s.email.policy,ep=!s.email.dmarc?20:p==='none'?15:p==='quarantine'?5:0;
  if(ep)items.push({pts:ep,key:'dm',label:!s.email.dmarc?'No DMARC record on '+s.domain:'DMARC on '+s.domain+' is "'+p+'", not "reject"'});
  if(!s.email.spf)items.push({pts:5,key:'spf',label:'No SPF record on '+s.domain});
  var posture=items.reduce(function(a,b){return a+b.pts;},0);
  var tags=share[s.id]||[];var w=Math.min(1,0.6+0.2*tags.length);
  var sc=Math.round(Math.min(100,posture/65*100)*w);
  return {items:items,posture:posture,weight:w,score:sc,lvl:sc>=50?'hi':sc>=25?'md':'lo'};
}

function recs(s,r){
  var out=[],nm=s.name.split(' (')[0],k=s.kev,vn=k.vendor||nm;
  r.items.forEach(function(it){
    if(it.key==='kev'){var v=k.recent[0];out.push({pts:it.pts+(k.ransomware12m?5:0),s:s,title:'Patch '+vn+' products against the CISA exploited list',
      body:[k.last12m+' '+vn+' vulnerabilities were confirmed exploited in the wild in the last 12 months'+(k.ransomware12m?', '+k.ransomware12m+' of them by ransomware groups':'')+'. Latest: ',link(nvd(v.cve),v.cve),' ('+v.product+', added '+fmtDate(v.added)+'). If you run '+vn+' products yourself, check each against the list and patch inside CISA\u2019s deadlines. If '+vn+' or your IT provider runs them, ask for their patch timelines in writing.']});}
    if(it.key==='br'){var b=s.breaches[0];out.push({pts:it.pts,s:s,title:'Close off the '+b.title+' breach',
      body:[link('https://haveibeenpwned.com/Breach/'+b.name,b.title+' breach'),' ('+fmtDate(b.date)+', '+fmtN(b.accounts)+' accounts; exposed: '+b.classes.slice(0,4).join(', ').toLowerCase()+'). Require SSO or MFA on your '+nm+' accounts and make sure no one reuses a password from that era.']});}
    if(it.key==='dm'){out.push({pts:it.pts,s:s,title:'Treat payment-change emails from '+nm+' as unverified',
      body:['The ',link('https://dns.google/query?name=_dmarc.'+s.domain+'&rr_type=TXT','DMARC policy on '+s.domain),' is '+(s.email.policy?'"'+s.email.policy+'"':'missing')+', so spoofed mail from this domain '+(s.email.policy==='quarantine'?'can still reach junk folders':'can reach inboxes')+'. Confirm any bank-detail change by phone on a number you already hold.']});}
  });
  return out;
}

function renderPick(){
  var ul=$('live-list');ul.textContent='';
  D.suppliers.forEach(function(s){var on=sel.indexOf(s.id)>-1;
    var b=el('button',{type:'button',cls:'live-chip'+(on?' on':''),'aria-pressed':on?'true':'false'},[el('span',{cls:'lc-name',text:s.name}),el('span',{cls:'lc-cat',text:s.category})]);
    b.addEventListener('click',function(){var i=sel.indexOf(s.id);if(i>-1)sel.splice(i,1);else if(sel.length<MAXL)sel.push(s.id);render();});
    ul.appendChild(el('li',{},[b]));});
  $('live-count').textContent=sel.length+' / '+MAXL;
}

function render(){
  renderPick();
  var res=$('live-results');res.textContent='';
  if(!sel.length){$('live-score').textContent='\u2013';$('live-score-label').textContent='Pick your suppliers';$('live-why').textContent='';$('live-recs').textContent='';res.appendChild(el('p',{cls:'panel-hint',text:'Pick suppliers on the left. Each one is scored from public records only.'}));return;}
  var rs={};sel.forEach(function(id){rs[id]=score(byId(id));});
  var vals=sel.map(function(id){return rs[id].score;});var mx=Math.max.apply(null,vals),mean=vals.reduce(function(a,b){return a+b;},0)/vals.length;
  var overall=Math.round(0.6*mx+0.4*mean);
  $('live-score').textContent=overall;$('live-score-label').textContent=overall>=50?'High exposure':overall>=25?'Medium exposure':'Low exposure';
  var top=sel.slice().sort(function(a,b){return rs[b].score-rs[a].score;});
  var why=$('live-why');why.textContent='';
  why.appendChild(el('p',{},['Your score is 60% your riskiest supplier (',el('strong',{text:byId(top[0]).name.split(' (')[0]+', '+mx}),') and 40% the average across '+sel.length+' ('+Math.round(mean)+'). Each supplier scores the points below, out of 65, scaled to 100, then weighted by what you share with them.']));
  top.forEach(function(id){var s=byId(id),r=rs[id];
    var card=el('details',{cls:'live-card risk-'+r.lvl});
    card.appendChild(el('summary',{},[el('span',{cls:'lcard-name',text:s.name}),el('span',{cls:'lcard-score',text:String(r.score)})]));
    var tb=el('ul',{cls:'pts'});
    if(!r.items.length)tb.appendChild(el('li',{},[el('span',{cls:'pt',text:'0'}),'No concerns in these sources. That\u2019s not a clean bill of health: KEV covers products you run, not incidents inside a SaaS platform.']));
    r.items.forEach(function(it){tb.appendChild(el('li',{},[el('span',{cls:'pt',text:'+'+it.pts}),it.label]));});
    tb.appendChild(el('li',{cls:'pt-sum'},[el('span',{cls:'pt',text:r.posture+'/65'}),'Public posture. \u00d7'+r.weight.toFixed(1)+' for what you share = '+r.score]));
    card.appendChild(tb);
    var sh=el('div',{cls:'share'},[el('span',{cls:'share-q',text:'What do you share with them?'})]);
    SHARE.forEach(function(t){var on=(share[id]||[]).indexOf(t[0])>-1;var b=el('button',{type:'button',cls:'tag-btn'+(on?' on':''),'aria-pressed':on?'true':'false',text:t[1]});
      b.addEventListener('click',function(){var a=share[id]||(share[id]=[]);var i=a.indexOf(t[0]);if(i>-1)a.splice(i,1);else a.push(t[0]);var open=[].slice.call(document.querySelectorAll('.live-card[open]')).map(function(c){return c.dataset.id;});render();open.forEach(function(o){var c=document.querySelector('.live-card[data-id="'+o+'"]');if(c)c.open=true;});});sh.appendChild(b);});
    card.appendChild(sh);card.dataset.id=id;
    res.appendChild(card);});
  var all=[];top.forEach(function(id){all=all.concat(recs(byId(id),rs[id]).map(function(x){x.w=x.pts*rs[id].weight;x.wt=rs[id].weight;return x;}));});
  all.sort(function(a,b){return b.w-a.w;});
  var ol=$('live-recs');ol.textContent='';
  if(!all.length)ol.appendChild(el('li',{},[el('p',{text:'Nothing in these public sources needs action for your picks.'})]));
  all.slice(0,6).forEach(function(x){ol.appendChild(el('li',{},[el('div',{cls:'rec-head'},[el('strong',{text:x.title}),el('span',{cls:'rec-pts',text:'+'+Math.round(Math.min(100,x.pts/65*100)*x.wt)+' on '+x.s.name.split(' (')[0]})]),el('p',{},x.body)]));});
}

function init(){
  if(!$('live'))return;
  fetch('data/intel.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){D=d;
    $('live-asof').textContent='Data as of '+new Date(d.generated).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})+' UK \u00b7 CISA KEV catalogue '+d.kevCatalog+' ('+d.kevCount.toLocaleString('en-GB')+' entries) \u00b7 '+d.hibpCount.toLocaleString('en-GB')+' HIBP breaches \u00b7 refreshed daily';
    sel=['microsoft','xero','sage','fortinet','dropbox'];render();
  }).catch(function(){$('live-results').textContent='Live data could not load. Try again shortly.';});
}
document.addEventListener('DOMContentLoaded',init);
})();
