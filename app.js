(function(){
  const $ = s => document.querySelector(s);
  const toastEl = $('#toast'); let tT;
  function toast(m){ toastEl.textContent=m; toastEl.classList.add('show'); clearTimeout(tT); tT=setTimeout(()=>toastEl.classList.remove('show'),2600); }
  const hasWeb3 = typeof window.solanaWeb3 !== 'undefined';

  /* ---------- wallet (Solana wallet providers + @solana/web3.js) ---------- */
  const WALLETS = [
    { name:'Phantom',  get:()=> window.phantom && window.phantom.solana && window.phantom.solana.isPhantom ? window.phantom.solana : (window.solana && window.solana.isPhantom ? window.solana : null), url:'https://phantom.app/' },
    { name:'Solflare', get:()=> window.solflare && window.solflare.isSolflare ? window.solflare : null, url:'https://solflare.com/' },
    { name:'Backpack', get:()=> window.backpack && window.backpack.solana ? window.backpack.solana : (window.backpack || null), url:'https://backpack.app/' },
  ];
  const state = { provider:null, wallet:null, pubkey:null };
  const short = k => k.slice(0,4)+'…'+k.slice(-4);

  function toPubkey(pk){
    const s = pk && pk.toString ? pk.toString() : String(pk);
    if (hasWeb3){ try { return new solanaWeb3.PublicKey(s); } catch(e){ return null; } }
    return { toBase58:()=>s, toString:()=>s };
  }

  function renderWallet(){
    const connected = !!state.pubkey;
    const label = connected ? short(state.pubkey.toBase58()) : 'connect wallet';
    $('#walletBtn').textContent = label;
    $('#wmProvider').textContent = connected ? state.wallet+' connected' : '';
    $('#wmAddr').textContent = connected ? state.pubkey.toBase58() : '';
    $('#launchBtn').textContent = connected ? 'deploy program' : 'connect wallet to deploy';
    $('#dMsg').textContent = connected ? 'No programs on this wallet yet.' : 'Connect a wallet to see your programs.';
    $('#dConnect').textContent = connected ? 'deploy a program' : 'connect wallet';
    document.querySelectorAll('[data-connect]').forEach(b=>{ b.textContent = connected ? (b.id==='pubGo' ? 'wallet connected' : label) : 'connect wallet'; });
    const pn=document.getElementById('pubNote'); if(pn) pn.textContent = connected ? 'Connected as '+short(state.pubkey.toBase58())+'. Template fees will go to this wallet.' : "Connect the wallet you'll receive template fees with.";
    if(!connected) $('#walletMenu').classList.remove('open');
  }

  function openConnect(){
    const list = $('#wList'); list.innerHTML='';
    WALLETS.forEach(w=>{
      const p = w.get(); const b = document.createElement('button');
      b.innerHTML = '<span>'+w.name+'</span><span class="tag '+(p?'ok':'')+'">'+(p?'detected':'install')+'</span>';
      b.onclick = () => p ? connect(w.name,p) : window.open(w.url,'_blank','noopener');
      list.appendChild(b);
    });
    $('#connectModal').classList.add('open');
    list.querySelector('button').focus();
  }

  async function connect(name, provider){
    try{
      const res = await provider.connect();
      const raw = (res && res.publicKey) || provider.publicKey;
      const pk = toPubkey(raw);
      if(!pk) throw new Error('The wallet returned an invalid address.');
      state.provider = provider; state.wallet = name; state.pubkey = pk;
      if (provider.on){
        provider.on('accountChanged', npk => { if(npk){ state.pubkey = toPubkey(npk); renderWallet(); toast('Switched to '+short(state.pubkey.toBase58())); } else disconnect(); });
        provider.on('disconnect', () => { state.pubkey=null; renderWallet(); });
      }
      $('#connectModal').classList.remove('open');
      renderWallet(); toast(name+' connected: '+short(pk.toBase58()));
    }catch(e){
      toast(e && e.code===4001 ? 'Connection request was rejected in '+name+'.' : (e.message || 'Could not connect to '+name+'.'));
    }
  }

  async function disconnect(){
    try{ if(state.provider && state.provider.disconnect) await state.provider.disconnect(); }catch(e){}
    state.provider=null; state.pubkey=null; state.wallet=null; renderWallet(); toast('Wallet disconnected.');
  }

  // silent reconnect if the wallet already trusts this site
  window.addEventListener('load', async ()=>{
    for (const w of WALLETS){
      const p = w.get();
      if (p && p.connect){ try{ const r = await p.connect({ onlyIfTrusted:true }); const pk = toPubkey((r&&r.publicKey)||p.publicKey); if(pk){ state.provider=p; state.wallet=w.name; state.pubkey=pk; renderWallet(); break; } }catch(e){} }
    }
  });

  $('#walletBtn').onclick = e => { e.stopPropagation(); state.pubkey ? $('#walletMenu').classList.toggle('open') : openConnect(); };
  $('#disconnect').onclick = disconnect;
  $('#copyAddr').onclick = async () => { try{ await navigator.clipboard.writeText(state.pubkey.toBase58()); toast('Address copied.'); }catch(e){ toast('Copy failed. Select the address and copy it manually.'); } };
  document.addEventListener('click', e => { if(!e.target.closest('.wallet')) $('#walletMenu').classList.remove('open'); });
  $('#cmClose').onclick = () => $('#connectModal').classList.remove('open');
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.remove('open'); }));
  document.addEventListener('keydown', e => { if(e.key==='Escape' && document.querySelector('.modal.open')){ document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open')); e.stopImmediatePropagation(); } });

  /* ---------- live epoch from Solana mainnet ---------- */
  // Swap in your own RPC endpoint (Helius, Triton, QuickNode...) for production traffic.
  const RPC_URL = 'https://api.mainnet-beta.solana.com';
  const conn = hasWeb3 ? new solanaWeb3.Connection(RPC_URL, 'confirmed') : null;
  async function tick(){
    if(!conn) return;
    try{
      const e = await conn.getEpochInfo();
      $('#epoch').textContent = e.epoch + ' · ' + Math.floor(e.slotIndex / e.slotsInEpoch * 100) + '%';
    }catch(err){ /* keep last value; the public RPC can rate-limit */ }
  }
  tick(); setInterval(tick, 60000);

  /* ---------- program templates ---------- */
  // Each template: label, blurb, default name, colour, what you configure, and the form fields it needs.
  const TEMPLATES = {
    staking: { s:'STAKING', label:'staking vault', c:'#14f195', name:'Community staking vault',
      blurb:'Holders lock a token and earn rewards over time.', good:'memecoin communities, DAOs, game tokens',
      conf:['stake token','reward token','reward rate','lock period','early-exit penalty'],
      fields:[
        {id:'stakeMint', label:'stake token mint', type:'mint'},
        {id:'rewardMint', label:'reward token mint', type:'mint'},
        {id:'rate', label:'rewards per day (tokens)', type:'num', value:'1000', min:0},
        {id:'lock', label:'lock period', type:'select', options:['none','7 days','30 days','90 days'], value:'30 days'},
        {id:'penalty', label:'early-exit penalty', type:'select', options:['0%','5%','10%','25%'], value:'10%'} ] },
    vesting: { s:'VESTING', label:'token vesting', c:'#9945ff', name:'Team token vesting',
      blurb:'Release tokens on a schedule with an optional cliff.', good:'team allocations, investors, grants',
      conf:['token','total amount','cliff','duration','revocable'],
      fields:[
        {id:'mint', label:'token mint', type:'mint'},
        {id:'amount', label:'total amount', type:'num', value:'1000000', min:0},
        {id:'cliff', label:'cliff', type:'select', options:['none','1 month','3 months','6 months','12 months'], value:'3 months'},
        {id:'duration', label:'vesting duration', type:'select', options:['6 months','12 months','24 months','36 months','48 months'], value:'24 months'},
        {id:'revocable', label:'revocable by admin', type:'select', options:['no','yes'], value:'no'} ] },
    escrow: { s:'ESCROW', label:'escrow', c:'#00c2ff', name:'OTC deal escrow',
      blurb:'Hold funds until both sides deliver, then release them.', good:'OTC trades, freelance work, NFT swaps',
      conf:['token','release rule','timeout','arbiter'],
      fields:[
        {id:'mint', label:'token mint', type:'mint'},
        {id:'rule', label:'release rule', type:'select', options:['both parties approve','arbiter decides','release at deadline'], value:'both parties approve'},
        {id:'timeout', label:'refund after', type:'select', options:['3 days','7 days','30 days'], value:'7 days'} ] },
    payments: { s:'PAYMENTS', label:'payments', c:'#19fb9b', name:'Creator subscriptions',
      blurb:'Accept one-time or recurring payments in any SPL token.', good:'subscriptions, merch, tipping',
      conf:['payment token','recipient','price','billing'],
      fields:[
        {id:'mint', label:'payment token mint', type:'mint'},
        {id:'recipient', label:'recipient wallet', type:'mint'},
        {id:'price', label:'price (tokens)', type:'num', value:'10', min:0},
        {id:'billing', label:'billing', type:'select', options:['one-time','weekly','monthly'], value:'monthly'} ] },
    multisig: { s:'MULTISIG', label:'multisig wallet', c:'#dc1fff', name:'Treasury multisig',
      blurb:'Funds move only when enough signers approve.', good:'DAO treasuries, team wallets, upgrade keys',
      conf:['signers','approval threshold','timelock'],
      fields:[
        {id:'signers', label:'signer addresses (one per line)', type:'list'},
        {id:'threshold', label:'approvals needed', type:'num', value:'2', min:1},
        {id:'timelock', label:'timelock', type:'select', options:['none','12 hours','24 hours','72 hours'], value:'24 hours'} ] },
    treasury: { s:'TREASURY', label:'automated treasury', c:'#5a6bff', name:'Auto buyback treasury',
      blurb:'Run buybacks, burns and payouts on a schedule.', good:'buyback programs, holder rewards, grants',
      conf:['token','buyback share','burn share','interval','max per run'],
      fields:[
        {id:'mint', label:'token mint', type:'mint'},
        {id:'buyback', label:'buyback share', type:'select', options:['0%','25%','50%','75%','100%'], value:'50%'},
        {id:'burn', label:'burn share of buybacks', type:'select', options:['0%','50%','100%'], value:'100%'},
        {id:'interval', label:'run every', type:'select', options:['day','week','month'], value:'week'},
        {id:'cap', label:'max per run (SOL)', type:'num', value:'5', min:0} ] },
  };
  const KEYS = Object.keys(TEMPLATES);
  let tpl = 'staking';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const isAddr = v => { if(!v) return false; if(hasWeb3){ try{ new solanaWeb3.PublicKey(v); return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); }catch(e){ return false; } } return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); };

  const tplBox = $('#tplBox');
  tplBox.innerHTML = KEYS.map(k => '<button type="button" data-k="'+k+'" aria-pressed="false">'+esc(TEMPLATES[k].label)+'</button>').join('');
  tplBox.addEventListener('click', e => { const b=e.target.closest('button'); if(b) applyTpl(b.dataset.k); });

  function renderParams(){
    const t=TEMPLATES[tpl];
    $('#params').innerHTML = '<div class="pgrid">'+t.fields.map(f=>{
      const id='p_'+f.id;
      let input;
      if(f.type==='select') input='<select id="'+id+'">'+f.options.map(o=>'<option'+(o===f.value?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
      else if(f.type==='list') input='<textarea id="'+id+'" rows="3" spellcheck="false" placeholder="one Solana address per line"></textarea>';
      else if(f.type==='num') input='<input id="'+id+'" type="number" inputmode="decimal" min="'+(f.min||0)+'" step="any" value="'+esc(f.value||'')+'">';
      else input='<input id="'+id+'" autocomplete="off" spellcheck="false" placeholder="Solana address">';
      return '<div class="field'+(f.type==='mint'||f.type==='list'?' wide':'')+'"><label for="'+id+'">'+esc(f.label)+'</label>'+input+'</div>';
    }).join('')+'</div>';
  }
  function applyTpl(k){
    if(!TEMPLATES[k]) return;
    tpl=k; const t=TEMPLATES[k];
    tplBox.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.k===k));
    $('#fName').value=t.name; $('#pvAv').style.background=t.c;
    renderParams(); preview();
  }
  function preview(){
    const n=$('#fName').value.trim();
    $('#pvName').textContent = n || 'your program';
    $('#pvAv').textContent = n ? n[0].toUpperCase() : '?';
    $('#pvMeta').textContent = TEMPLATES[tpl].label+' · '+$('#fFee').value+' fee · '+($('#fUpg').value==='immutable'?'immutable':'upgradeable');
  }
  $('#fAdmin').addEventListener('change', ()=>{ $('#msWrap').hidden = $('#fAdmin').value!=='multisig'; });
  $('#launchForm').addEventListener('input', preview);
  $('#launchForm').addEventListener('change', preview);
  applyTpl('staking');

  let running=false;
  $('#launchForm').addEventListener('submit', async e => {
    e.preventDefault();
    if(running) return;
    if(!state.pubkey){ openConnect(); return; }
    const t=TEMPLATES[tpl], name=$('#fName').value.trim();
    if(!name){ $('#fName').focus(); toast('Give your program a name first.'); return; }
    const vals={};
    for(const f of t.fields){
      const el=document.getElementById('p_'+f.id), v=el.value.trim();
      if(f.type==='mint' && !isAddr(v)){ el.focus(); toast('Enter a valid Solana address for '+f.label+'.'); return; }
      if(f.type==='num' && !(parseFloat(v)>=(f.min||0))){ el.focus(); toast('Enter a number for '+f.label+'.'); return; }
      if(f.type==='list'){
        const list=v.split(/\s+/).filter(Boolean);
        if(list.length<2){ el.focus(); toast('Add at least 2 signer addresses.'); return; }
        const badA=list.find(a=>!isAddr(a)); if(badA){ el.focus(); toast('Not a valid Solana address: '+short(badA)); return; }
        if(new Set(list).size!==list.length){ el.focus(); toast('Each signer can only be listed once.'); return; }
        vals[f.id]=list; continue;
      }
      vals[f.id]=v;
    }
    if(tpl==='multisig'){ const th=parseInt(vals.threshold,10); if(!(th>=1 && th<=vals.signers.length)){ document.getElementById('p_threshold').focus(); toast('Approvals needed must be between 1 and '+vals.signers.length+'.'); return; } }
    if(tpl==='treasury' && vals.buyback==='0%'){ toast('Set a buyback share above 0%.'); document.getElementById('p_buyback').focus(); return; }
    if($('#fAdmin').value==='multisig' && !isAddr($('#fMs').value.trim())){ $('#fMs').focus(); toast('Enter the multisig address.'); return; }
    running=true; $('#launchBtn').disabled=true;
    const list=$('#logList'); list.innerHTML=''; $('#logState').textContent='configuring'; $('#logState').style.color='#00c2ff'; $('#logBar').style.width='0';
    const progKey = hasWeb3 ? short(solanaWeb3.Keypair.generate().publicKey.toBase58()) : 'ok';
    const steps=[
      ['owner wallet', short(state.pubkey.toBase58())],
      ['template', t.label],
      ['generating program account key', progKey],
      ['program name', '"'+name+'"'],
    ];
    t.fields.forEach(f=>{ const v=vals[f.id]; steps.push([f.label, f.type==='mint'?short(v):(Array.isArray(v)?v.length+' signers':v)]); });
    steps.push(['admin authority', $('#fAdmin').value==='multisig' ? 'multisig '+short($('#fMs').value.trim()) : 'your wallet']);
    steps.push(['protocol fee', $('#fFee').value]);
    steps.push(['upgrade authority', $('#fUpg').value==='immutable' ? 'none (immutable)' : 'kept, shown on program page']);
    for(let i=0;i<steps.length;i++){
      const li=document.createElement('li'); li.innerHTML='&gt; '+esc(steps[i][0])+' … <span class="w">working</span>'; list.appendChild(li);
      await new Promise(r=>setTimeout(r, 220+Math.random()*220));
      const sp=li.querySelector('span'); sp.className='ok'; sp.textContent=steps[i][1];
      $('#logBar').style.width=((i+1)/steps.length*100)+'%';
    }
    const done=document.createElement('li'); done.innerHTML='<span class="ok">✓ configuration ready for '+esc(name)+'.</span><span class="cursor"></span>'; list.appendChild(done);
    $('#logState').textContent='ready'; $('#logState').style.color='#14f195';
    toast('Configuration ready for '+name+'.');
    running=false; $('#launchBtn').disabled=false;
  });

  $('#dConnect').onclick = () => state.pubkey ? (location.hash='launch') : openConnect();

  /* ---------- marketplace ---------- */
  // Each program: { n:name, t:template label, tx:transactions in 30 days, users, rev:SOL revenue, upg:'immutable'|'upgradeable', age:days }
  const PROGRAMS = [];
  let sortKey='tx', q='';
  function renderMk(){
    $('#mkBody').closest('table').classList.toggle('is-empty', !PROGRAMS.length);
    const rows=PROGRAMS.filter(p=>!q||(p.n+' '+p.t).toLowerCase().includes(q)).sort((a,b)=>sortKey==='new'?a.age-b.age:b[sortKey]-a[sortKey]);
    $('#mkBody').innerHTML = rows.length ? rows.map((p,i)=>`
      <tr><td class="rank">${i+1}</td><td><b>${esc(p.n)}</b></td><td>${esc(p.t)}</td>
      <td class="num">${p.tx.toLocaleString('en-US')}</td><td class="num">${p.users.toLocaleString('en-US')}</td><td class="num">${p.rev} SOL</td>
      <td>${esc(p.upg)}</td><td><button class="td-btn" type="button">view</button></td></tr>`).join('')
      : (PROGRAMS.length ? '<tr><td colspan="8" style="color:var(--mute);font-family:var(--mono);font-size:14px">No programs match that search. Try a template name.</td></tr>'
      : '<tr><td colspan="8"><div class="empty"><b>no programs yet</b><span>The marketplace fills up as people deploy. Yours can be the first.</span><div style="margin-top:18px"><a class="btn" href="#launch">deploy the first program</a></div></div></td></tr>');
  }
  $('#mkSearch').addEventListener('input', e=>{ q=e.target.value.trim().toLowerCase(); renderMk(); });
  document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ sortKey=b.dataset.sort; document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderMk(); });
  renderMk();

  /* ---------- HQ visual: program module ---------- */
  let selected='staking';
  const stage=$('#stage'), pcube=$('#pcube');

  // template chips in the right column
  const g8=$('#grid8');
  g8.innerHTML = KEYS.map(k=>`<button type="button" class="g8" data-k="${k}" aria-pressed="false" style="--c:${TEMPLATES[k].c}"><i></i><b>${TEMPLATES[k].s}</b><span>0 live</span></button>`).join('')
    + '<a class="g8 add" href="#launch"><b>+ LAUNCH</b><span>a program</span></a><button type="button" class="g8 add" id="pubChip"><b>PUBLISH</b><span>a template</span></button>';
  g8.addEventListener('click', e=>{ const b=e.target.closest('button.g8[data-k]'); if(b) select(b.dataset.k); });

  function select(k){
    selected=k; const t=TEMPLATES[k];
    document.querySelectorAll('.g8[data-k]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.k===k));
    stage.style.setProperty('--tc', t.c);
    $('#pcName').textContent=t.label.toUpperCase();
    $('#feature').style.setProperty('--c', t.c);
    $('#ftTitle').textContent=t.label.toUpperCase(); $('#ftTitle').style.color=t.c;
    $('#ftSub').textContent=t.blurb;
    $('#ftList').innerHTML=t.conf.map(x=>`<li><span>${esc(x)}</span><em>YOU SET</em></li>`).join('');
    $('#ftFoot').textContent='Good for '+t.good+'.';
    $('#capLbl').textContent=t.label.toUpperCase(); $('#capLbl').style.background=t.c; $('#capLbl').style.color='#06070d';
    $('#capText').textContent = t.blurb+' Launch it on Solana in a few clicks, no Rust.';
    const ql=$('#qlTitle'); ql.querySelector('span').textContent=t.label.toUpperCase(); ql.querySelector('i').style.background=t.c;
    $('#qlName').value=t.name;
  }
  const step = d => select(KEYS[(KEYS.indexOf(selected)+d+KEYS.length)%KEYS.length]);
  $('#prevT').onclick=()=>step(-1);
  $('#nextT').onclick=()=>step(1);
  $('#qlGo').onclick=()=>{ const name=$('#qlName').value.trim(); applyTpl(selected); if(name) { $('#fName').value=name; preview(); } location.hash='launch'; };

  // spin: drag to turn the module, slow auto-spin when idle
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  let ry=-30, auto=!reduce.matches, drag=null, moved=false, idleAt=0;
  const setRy=v=>{ ry=v; pcube.style.setProperty('--ry', ry+'deg'); };
  setRy(ry);
  $('#autoCam').setAttribute('aria-pressed', auto);
  $('#autoCam').onclick=()=>{ auto=!auto; $('#autoCam').setAttribute('aria-pressed',auto); };
  $('#resetCam').onclick=()=>setRy(-30);
  const scene=document.querySelector('.pc-scene');
  scene.addEventListener('pointerdown', e=>{ if(e.button!==0) return; drag={x:e.clientX, ry}; moved=false; });
  window.addEventListener('pointermove', e=>{ if(!drag) return; const dx=e.clientX-drag.x; if(Math.abs(dx)>4){ moved=true; stage.classList.add('dragging'); } setRy(drag.ry+dx*.6); });
  window.addEventListener('pointerup', ()=>{ if(drag){ const wasMove=moved; drag=null; idleAt=performance.now(); stage.classList.remove('dragging'); if(!wasMove){ applyTpl(selected); location.hash='launch'; } } });

  /* ---------- live Solana slots under the module ---------- */
  // Real slot from mainnet, re-synced every 20s; between syncs it advances at Solana's ~400ms slot time.
  const SLOT_MS=400, N=15, MID=7, GAP=96;
  const cplane=$('#cplane'), blocks=[];
  for(let i=0;i<N;i++){
    const b=document.createElement('div'); b.className='blk';
    b.style.cssText='--w:62px;--h:34px;--bc:'+(i%2?'#9945ff':'#14f195');
    b.innerHTML='<i class="f s"></i><i class="f w"></i><i class="f e"></i><i class="f n"></i><i class="f t"></i>';
    cplane.appendChild(b); blocks.push(b);
  }
  let sync=null;
  async function syncSlot(){
    if(!conn) return;
    try{ const s=await conn.getSlot('confirmed'); sync={slot:s, t:performance.now()}; }catch(e){ /* keep last sync */ }
  }
  syncSlot(); setInterval(syncSlot, 20000);
  let lastShown=-1;
  function frame(now){
    const cur = sync ? sync.slot + (now-sync.t)/SLOT_MS : now/SLOT_MS;
    const whole=Math.floor(cur), frac=reduce.matches?0:cur-whole;
    blocks.forEach((b,i)=>{
      const off=i-MID;
      b.style.transform='translate3d('+((off-frac)*GAP).toFixed(1)+'px,0,0)';
      b.classList.toggle('next', off>0);
      b.classList.toggle('cur', off===0);
      b.style.setProperty('--o', Math.max(0, 1-Math.abs(off-frac)/(MID+.5)).toFixed(2));
      b.lastChild.textContent = sync && off<=0 ? String(whole+off).slice(-4) : '';
    });
    if(sync && whole!==lastShown){ lastShown=whole; $('#slotNum').textContent=whole.toLocaleString('en-US'); }
    if(auto && !drag && now-idleAt>1500) setRy(ry+.25);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  select('staking');

  /* ---------- right-column tabs ---------- */
  const tabs=[...document.querySelectorAll('.ttabs [role=tab]')];
  function showTab(btn){
    tabs.forEach(t=>{ const on=t===btn; t.setAttribute('aria-selected',on); t.tabIndex=on?0:-1; document.getElementById(t.getAttribute('aria-controls')).hidden=!on; });
  }
  tabs.forEach((t,i)=>{
    t.addEventListener('click',()=>showTab(t));
    t.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ const n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]; showTab(n); n.focus(); } });
  });

  // extra connect buttons (mobile header, validate tab)
  document.querySelectorAll('[data-connect]').forEach(b=>b.addEventListener('click',()=>{
    if(!state.pubkey) return openConnect();
    if(b.id==='pubGo') return toast('Connected as '+short(state.pubkey.toBase58())+'.');
    if(confirm('Disconnect '+short(state.pubkey.toBase58())+'?')) disconnect();
  }));
  renderWallet();

  $('#pubChip').onclick=()=>{ const t=document.getElementById('tb-publish'); showTab(t); t.focus(); };

  /* ---------- panels in the center column (hash routing) ---------- */
  const PANELS=['how','launch','dashboard','market','ledger','flywheel'];
  const mtop=document.querySelector('.mtop');
  const setHdr=()=>document.documentElement.style.setProperty('--hdr', mtop.getBoundingClientRect().height+'px');
  setHdr(); window.addEventListener('resize', setHdr);
  let lastFocus=null;
  function route(){
    const h=location.hash.slice(1);
    const isPanel=PANELS.includes(h);
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('open', p.id==='p-'+h));
    if(isPanel){
      lastFocus=lastFocus||document.activeElement;
      const p=document.getElementById('p-'+h); p.scrollTop=0; p.querySelector('.close').focus({preventScroll:true});
      if(window.innerWidth<=1180) document.body.style.overflow='hidden';
    } else {
      document.body.style.overflow='';
      if(lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true}); lastFocus=null;
    }
    const cur=isPanel?h:'hq';
    document.querySelectorAll('[data-tab]').forEach(a=>{ if(a.dataset.tab===cur) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  }
  function closePanel(){ history.pushState('', document.title, location.pathname+location.search); route(); }
  document.querySelectorAll('.panel .close').forEach(b=>b.onclick=closePanel);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.querySelector('.panel.open') && !document.querySelector('.modal.open')) closePanel(); });
  window.addEventListener('hashchange', route);
  route();
})();
