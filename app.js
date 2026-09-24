(function(){
'use strict';
var LEADS_ENDPOINT = /(^|\.)bigredbox\.co\.uk$/.test(location.hostname) ? 'api/lead.php' : '';
var MAX = 10;
var TAGS = {client:['Client data',4],hr:['HR',4],fin:['Financial',3],health:['Health',5],code:['Source code',4]};
var DEF = {on:['On by default',1],admin:['Admin-controlled',0.65],optin:['Opt-in',0.4],unknown:['Not disclosed',0.85],none:['No AI',0.05]};
var REG = {UK:['UK',0.7],EU:['EU',0.85],US:['US',1],'?':['Unknown',1]};
var TRAIN = {no:['No training',1],optout:['Trains unless opted out',1.15],yes:['Trains on data',1.35],unknown:['Training unknown',1.25]};
var R = [
 {id:'harbour',name:'Harbour CRM',cat:'CRM and sales email',tags:['client'],ev:'Trust centre and DPA, 14 Aug 2026',conf:1,
  features:[{name:'Email drafting and deal summaries',def:'on',flows:[{p:'OpenAI',r:'US',t:'optout'},{p:'Anthropic',r:'US',t:'optout'}]}],
  fix:'Check the model-training opt-out in Harbour admin and confirm it applies to your account. Update your DPA for both AI subprocessors.'},
 {id:'northgate',name:'Northgate Payroll',cat:'Payroll bureau',tags:['hr','fin'],ev:'No AI disclosure found',conf:1.2,
  features:[{name:'AI use not disclosed',def:'unknown',flows:[{p:'Unknown',r:'?',t:'unknown'}]}],
  fix:'Send an AI disclosure request. Until they answer, add a clause: no AI processing of employee data without your written approval.'},
 {id:'tessera',name:'Tessera Workspace',cat:'Email and documents',tags:['client','hr','fin'],ev:'Subprocessor change notice, 10 Sep 2026',conf:1,
  features:[{name:'Meeting and document copilot',def:'admin',flows:[{p:'In-house',r:'UK',t:'no'},{p:'Anthropic',r:'US',t:'no'}]}],
  fix:'A new AI subprocessor processes outside the UK. Review the admin toggle, decide whether to keep it on, and record who decided.'},
 {id:'talentpath',name:'Talentpath',cat:'Recruitment agency',tags:['hr'],ev:'Privacy notice, Jun 2026',conf:1,
  features:[{name:'CV screening and ranking',def:'on',flows:[{p:'Google Gemini',r:'US',t:'yes'}]}],
  fix:'Candidate CVs may be used to train models. Ask for the opt-out in writing, and check candidates are told about automated screening.'},
 {id:'clearview',name:'Clearview IT',cat:'Managed IT provider (MSP)',tags:['client','hr'],ev:'Website mentions AI; no subprocessor list',conf:1.2,
  features:[{name:'Ticket triage and session summaries',def:'on',flows:[{p:'Unknown',r:'?',t:'unknown'}]}],
  fix:'Your MSP has wide access and has not named its AI provider. Ask which model sees your tickets and remote sessions, and where.'},
 {id:'aria',name:'Aria Chat',cat:'Website chat widget',tags:['client'],ev:'Terms of service, Jul 2026',conf:1,
  features:[{name:'AI chatbot',def:'on',flows:[{p:'OpenAI',r:'US',t:'yes'}]}],
  fix:'Free-plan transcripts can train the provider\u2019s models. Move to a plan with training off, or stop collecting personal data in chat.'},
 {id:'ledgerline',name:'Ledgerline',cat:'Accounting software',tags:['fin'],ev:'Subprocessor list, 2 Sep 2026',conf:1,
  features:[{name:'Invoice and receipt assistant',def:'on',flows:[{p:'Azure OpenAI',r:'UK',t:'no'}]}],
  fix:'Confirm the assistant is covered by your DPA and that UK processing is written into the contract.'},
 {id:'brightdesk',name:'Brightdesk',cat:'Customer helpdesk',tags:['client'],ev:'Supplier attestation, 3 Sep 2026',conf:1,
  features:[{name:'Auto-reply agent',def:'optin',flows:[{p:'Anthropic',r:'EU',t:'no'}]}],
  fix:'Opt-in only. Record who approved it and limit which ticket fields reach the agent.'},
 {id:'codeharbour',name:'Codeharbour',cat:'Code hosting',tags:['code'],ev:'Trust centre, Aug 2026',conf:1,
  features:[{name:'Code assistant',def:'admin',flows:[{p:'OpenAI',r:'US',t:'no'}]}],
  fix:'Keep the assistant off for repositories holding secrets or client code, and confirm suggestions are not retained.'},
 {id:'quillsign',name:'Quillsign',cat:'E-signature',tags:['client'],ev:'DPA, Jul 2026',conf:1,
  features:[{name:'Contract summaries',def:'optin',flows:[{p:'OpenAI',r:'US',t:'no'}]}],
  fix:'Low risk while opt-in with zero retention. Keep it off for board and HR contracts unless approved.'},
 {id:'parcelpoint',name:'Parcelpoint',cat:'Delivery and logistics',tags:['client'],ev:'Supplier attestation, 28 Aug 2026',conf:1,
  features:[{name:'Route and ETA prediction',def:'on',flows:[{p:'In-house',r:'UK',t:'no'}]}],
  fix:'In-house model, processed in the UK. Nothing to do beyond monitoring.'},
 {id:'medicus',name:'Medicus Cover',cat:'Employee health benefits',tags:['health'],ev:'Supplier attestation, 1 Sep 2026',conf:1,
  features:[],
  fix:'No AI features, confirmed by the supplier. Recheck at renewal.'}
];
var SAMPLE = ['harbour','northgate','tessera','talentpath','clearview','aria','ledgerline'];
var state = {sel:[], tags:{}};
function $(id){return document.getElementById(id);}
function el(tag,attrs,kids){var n=document.createElement(tag);if(attrs)for(var k in attrs){if(k==='text')n.textContent=attrs[k];else if(k==='cls')n.className=attrs[k];else n.setAttribute(k,attrs[k]);}(kids||[]).forEach(function(c){n.appendChild(c);});return n;}
function sv(tag,attrs){var n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(var k in attrs){if(k==='text')n.textContent=attrs[k];else n.setAttribute(k,attrs[k]);}return n;}
function byId(id){for(var i=0;i<R.length;i++)if(R[i].id===id)return R[i];}

function scoreSupplier(s){
  var tags=state.tags[s.id]||[];
  var sens=1;tags.forEach(function(t){sens=Math.max(sens,TAGS[t][1]);});
  var worst={v:DEF.none[1],f:null,fl:null};
  s.features.forEach(function(f){f.flows.forEach(function(fl){var v=DEF[f.def][1]*REG[fl.r][1]*TRAIN[fl.t][1];if(v>worst.v||!worst.f)worst={v:v,f:f,fl:fl};});});
  var raw=(sens/5)*worst.v*s.conf;
  var score=Math.min(100,Math.round(raw/1.35*100));
  var unknown=s.features.some(function(f){return f.def==='unknown'||f.flows.some(function(x){return x.p==='Unknown';});});
  var lvl=unknown?'uk':score>=55?'hi':score>=30?'md':'lo';
  return {score:score,lvl:lvl,sens:sens,worst:worst,unknown:unknown,tags:tags};
}
function sevWord(l){return {hi:'High',md:'Medium',lo:'Low',uk:'Unknown'}[l];}

function renderList(){
  var ul=$('supplier-list');ul.textContent='';
  R.forEach(function(s){
    var on=state.sel.indexOf(s.id)>-1;
    var li=el('li',{cls:'sup'+(on?' on':'')});
    var btn=el('button',{cls:'sup-toggle',type:'button','aria-pressed':on?'true':'false'},[el('span',{cls:'sup-box','aria-hidden':'true'}),el('span',{cls:'sup-name',text:s.name},[el('span',{cls:'sup-cat',text:s.cat})])]);
    btn.addEventListener('click',function(){toggle(s.id);});
    li.appendChild(btn);
    var tg=el('div',{cls:'sup-tags','aria-label':'Data you share with '+s.name});
    Object.keys(TAGS).forEach(function(t){var pressed=(state.tags[s.id]||[]).indexOf(t)>-1;var b=el('button',{cls:'tagbtn',type:'button','aria-pressed':pressed?'true':'false',text:TAGS[t][0]});b.addEventListener('click',function(){toggleTag(s.id,t);});tg.appendChild(b);});
    li.appendChild(tg);ul.appendChild(li);
  });
  $('sel-count').textContent=state.sel.length+' / '+MAX;
}
function toggle(id){var i=state.sel.indexOf(id);if(i>-1){state.sel.splice(i,1);}else{if(state.sel.length>=MAX)return;state.sel.push(id);if(!state.tags[id])state.tags[id]=byId(id).tags.slice();}render();}
function toggleTag(id,t){var a=state.tags[id]||(state.tags[id]=[]);var i=a.indexOf(t);if(i>-1)a.splice(i,1);else a.push(t);render();}

function renderMap(scores){
  var svg=$('chain-map');while(svg.firstChild)svg.removeChild(svg.firstChild);
  var sel=state.sel.map(byId);
  $('map-empty').style.display=sel.length?'none':'grid';
  if(!sel.length){svg.setAttribute('height','0');$('chain-list').textContent='';return;}
  var W=svg.parentNode.clientWidth||700;
  var ml=$('chain-list');ml.textContent='';
  if(W<640){svg.setAttribute('height','0');svg.style.display='none';ml.style.display='grid';
    sel.forEach(function(s){var sc=scores[s.id];var li=el('li',{cls:'cl-item risk-'+sc.lvl});
      li.appendChild(el('div',{cls:'cl-top'},[el('span',{cls:'cl-name',text:s.name}),el('span',{cls:'sev '+sc.lvl,text:sevWord(sc.lvl)})]));
      if(!s.features.length){li.appendChild(el('p',{cls:'cl-flow',text:'No AI features (supplier attested)'}));}
      s.features.forEach(function(f){f.flows.forEach(function(fl){li.appendChild(el('p',{cls:'cl-flow',text:f.name+' \u2192 '+(fl.p==='Unknown'?'provider unknown':fl.p)+' \u2192 '+(REG[fl.r][0]==='Unknown'?'region unknown':REG[fl.r][0])}));});li.appendChild(el('p',{cls:'cl-meta',text:DEF[f.def][0]}));});
      ml.appendChild(li);});
    return;}
  svg.style.display='block';ml.style.display='none';var cols=5;var gap=W<560?10:22;var nw=(W-gap*(cols-1))/cols;var nh=W<560?38:46;var vg=12;
  var feats=[],provs={},regs={};
  sel.forEach(function(s){var f=s.features.length?s.features:[{name:'No AI features',def:'none',flows:[]}];f.forEach(function(ft){feats.push({s:s,f:ft});ft.flows.forEach(function(fl){provs[fl.p]=provs[fl.p]||{n:fl.p,lv:'lo'};var rk=REG[fl.r][0];regs[rk]=regs[rk]||{n:rk};});});});
  var pl=Object.keys(provs),rl=Object.keys(regs);
  var rows=Math.max(sel.length,feats.length,pl.length,rl.length);
  var H=rows*(nh+vg);svg.setAttribute('height',H);svg.setAttribute('viewBox','0 0 '+W+' '+H);
  function colY(n,i){var tot=n*(nh+vg)-vg;var off=(H-tot)/2;return off+i*(nh+vg);}
  function x(c){return c*(nw+gap);}
  var pos={};
  pos.org={x:x(0),y:(H-nh)/2};
  sel.forEach(function(s,i){pos['s:'+s.id]={x:x(1),y:colY(sel.length,i)};});
  feats.forEach(function(ft,i){pos['f:'+i]={x:x(2),y:colY(feats.length,i)};ft.pos='f:'+i;});
  pl.forEach(function(p,i){pos['p:'+p]={x:x(3),y:colY(pl.length,i)};});
  rl.forEach(function(r,i){pos['r:'+r]={x:x(4),y:colY(rl.length,i)};});
  var rank={lo:0,md:1,uk:1.5,hi:2};
  var links=sv('g',{});svg.appendChild(links);
  function link(a,b,l){var A=pos[a],B=pos[b];var x1=A.x+nw,y1=A.y+nh/2,x2=B.x,y2=B.y+nh/2,mx=(x1+x2)/2;links.appendChild(sv('path',{d:'M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2,'class':'map-link '+l}));}
  var seen={};
  sel.forEach(function(s){link('org','s:'+s.id,scores[s.id].lvl);});
  feats.forEach(function(ft){var lv=scores[ft.s.id].lvl;link('s:'+ft.s.id,ft.pos,lv);ft.f.flows.forEach(function(fl){var k=ft.pos+'>'+fl.p;if(!seen[k]){seen[k]=1;link(ft.pos,'p:'+fl.p,lv);}var rk=REG[fl.r][0];var k2=fl.p+'>'+rk;if(!seen[k2]){seen[k2]=1;link('p:'+fl.p,'r:'+rk,lv);}if(rank[lv]>rank[provs[fl.p].lv])provs[fl.p].lv=lv;});});
  function fit(t,max){var cw=W<560?6.2:7.0;var n=Math.floor((max-16)/cw);return t.length>n?t.slice(0,Math.max(1,n-1))+'\u2026':t;}
  function node(key,label,sub,cls){var P=pos[key];var g=sv('g',{'class':'map-node '+(cls||''),transform:'translate('+P.x+','+P.y+')'});g.appendChild(sv('rect',{width:nw,height:nh,rx:3}));var t=sv('text',{x:10,y:sub?(W<560?16:19):nh/2+4,text:fit(label,nw)});g.appendChild(t);if(sub)g.appendChild(sv('text',{x:10,y:(W<560?30:34),'class':'sub',text:fit(sub,nw)}));var ti=sv('title',{text:label+(sub?' \u00b7 '+sub:'')});g.appendChild(ti);svg.appendChild(g);}
  node('org','Your organisation',sel.length+' suppliers','org');
  sel.forEach(function(s){node('s:'+s.id,s.name,s.cat,'risk-'+scores[s.id].lvl);});
  feats.forEach(function(ft){node(ft.pos,ft.f.name,DEF[ft.f.def][0],'risk-'+scores[ft.s.id].lvl);});
  pl.forEach(function(p){node('p:'+p,p==='Unknown'?'Provider unknown':p,null,'risk-'+provs[p].lv);});
  rl.forEach(function(r){node('r:'+r,r==='Unknown'?'Region unknown':r,r==='UK'?'Inside UK':'Outside UK','risk-'+(r==='UK'?'lo':r==='Unknown'?'uk':'md'));});
}

function render(){
  renderList();
  var scores={};state.sel.forEach(function(id){scores[id]=scoreSupplier(byId(id));});
  renderMap(scores);
  var ids=state.sel.slice();var vals=ids.map(function(id){return scores[id].score;});
  var overall=0;if(vals.length){var mx=Math.max.apply(null,vals);var mean=vals.reduce(function(a,b){return a+b;},0)/vals.length;overall=Math.round(mx*0.6+mean*0.4);}
  animateNum($('score'),overall);
  var C=326.7;$('ring-fill').style.strokeDashoffset=String(C-C*overall/100);
  $('ring-fill').style.stroke=overall>=55?'var(--red)':overall>=30?'var(--amber)':'var(--green)';
  $('score-label').textContent=!vals.length?'No suppliers yet':overall>=55?'High exposure':overall>=30?'Medium exposure':'Low exposure';
  var nf=0,nd=0,off=0,unk=0;
  ids.forEach(function(id){var s=byId(id);s.features.forEach(function(f){if(f.def!=='unknown')nf++;if(f.def==='on')nd++;if(f.flows.some(function(x){return x.r!=='UK';}))off++;});if(scores[id].unknown)unk++;});
  $('f-features').textContent=nf;$('f-default').textContent=nd;$('f-offshore').textContent=off;$('f-unknown').textContent=unk;
  var ol=$('findings');ol.textContent='';
  var order=ids.sort(function(a,b){return scores[b].score-scores[a].score;});
  $('findings-sub').textContent=order.length?order.length+' findings, highest risk first':'Findings appear once you pick suppliers.';
  order.forEach(function(id){
    var s=byId(id),sc=scores[id];var w=sc.worst;
    var li=el('li',{cls:'finding'});
    li.appendChild(el('span',{cls:'sev '+sc.lvl,text:sevWord(sc.lvl)}));
    var tagNames=sc.tags.map(function(t){return TAGS[t][0];});
    var why=w.f?(w.f.name+' \u00b7 '+DEF[w.f.def][0]+(w.fl&&w.fl.p!=='Unknown'?' \u00b7 '+w.fl.p+', '+REG[w.fl.r][0]:'')):'No AI features disclosed';
    var mid=el('div',{},[el('h4',{text:s.name}),el('p',{cls:'why',text:why})]);
    var f=el('div',{cls:'factors'});
    f.appendChild(el('span',{text:'Data: '+(tagNames.length?tagNames.join(', '):'none tagged')}));
    if(w.fl){f.appendChild(el('span',{text:TRAIN[w.fl.t][0]}));}
    f.appendChild(el('span',{text:'Score '+sc.score}));
    mid.appendChild(f);li.appendChild(mid);
    var fx=el('p',{cls:'fix'});fx.appendChild(el('b',{text:'Fix: '}));fx.appendChild(document.createTextNode(s.fix));
    li.appendChild(el('div',{},[fx,el('p',{cls:'ev',text:'Evidence (illustrative): '+s.ev})]));
    ol.appendChild(li);
  });
}
var numTimer;
function animateNum(node,to){var from=parseInt(node.textContent,10)||0;if(from===to)return;cancelAnimationFrame(numTimer);var t0=null;function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/600);var e=1-Math.pow(1-p,3);node.textContent=Math.round(from+(to-from)*e);if(p<1)numTimer=requestAnimationFrame(step);}numTimer=requestAnimationFrame(step);}

function initTheme(){var b=$('theme-toggle');b.addEventListener('click',function(){var cur=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',cur);try{localStorage.setItem('brb-theme',cur);}catch(e){}});}
function initHeader(){var h=document.querySelector('.header');function f(){h.classList.toggle('scrolled',window.scrollY>10);}window.addEventListener('scroll',f,{passive:true});f();}

function initForm(){
  var form=$('register-form'),st=$('form-status'),btn=$('register-btn');
  form.addEventListener('submit',function(e){
    e.preventDefault();st.className='form-status';st.textContent='';
    var d={name:form.name.value.trim(),email:form.email.value.trim(),company:form.company.value.trim(),size:form.size.value,consent:form.consent.checked,website:form.website.value};
    var bad=false;
    [['name',d.name.length>1],['email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)]].forEach(function(c){form[c[0]].setAttribute('aria-invalid',c[1]?'false':'true');if(!c[1])bad=true;});
    if(bad){st.className='form-status err';st.textContent='Please add your name and a valid work email.';return;}
    if(!d.consent){st.className='form-status err';st.textContent='Please tick the box so we can contact you.';return;}
    if(d.website){st.className='form-status ok';st.textContent='Thanks. You\u2019re on the list.';form.reset();return;}
    if(!LEADS_ENDPOINT){st.className='form-status ok';st.textContent='Review build: sign-ups aren\u2019t being collected yet.';return;}
    btn.disabled=true;
    fetch(LEADS_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d),credentials:'omit',mode:'cors',referrerPolicy:'no-referrer'})
      .then(function(r){if(!r.ok)throw new Error(r.status);st.className='form-status ok';st.textContent='Thanks. You\u2019re on the list. We\u2019ll be in touch personally.';form.reset();})
      .catch(function(){st.className='form-status err';st.textContent='That didn\u2019t go through. Please try again in a moment.';})
      .then(function(){btn.disabled=false;});
  });
}
document.addEventListener('DOMContentLoaded',function(){
  initTheme();initHeader();initForm();
  $('btn-sample').addEventListener('click',function(){state.sel=SAMPLE.slice();state.sel.forEach(function(id){state.tags[id]=byId(id).tags.slice();});render();});
  $('btn-clear').addEventListener('click',function(){state.sel=[];render();});
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(render,120);});
  state.sel=SAMPLE.slice(0,5);state.sel.forEach(function(id){state.tags[id]=byId(id).tags.slice();});
  render();
});
})();
