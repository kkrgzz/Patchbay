"use strict";
const $=s=>document.querySelector(s);
const app=$("#app"), modal=$("#modal"), cacheKey="patchbay-session-v1";
let project,cacheProblem="",dirty=false;
try {const data=localStorage.getItem(cacheKey);project=data?validateProject(JSON.parse(data)):demoProject();dirty=Boolean(data)&&localStorage.getItem(cacheKey+"-saved")!=="yes"}
catch(e){project=demoProject();cacheProblem="The previous local session could not be read. Open your saved project to recover it."}
let view="Rack",side="Front",mode=project.draft?"draft":"live",selected="",port="",wire=null,query="",filter="All",showEmpty=false,navOpen=false;
let undoStack=[],redoStack=[],nativeDirect=false,browserHandle=null,saving=false;
let board,idx,device,point,cable;
function sync(){
  board=project[mode]||project.live;idx=indexBoard(board);
  device=board.devices.find(d=>d.id===selected);
  if(!device || device.side!==side){device=board.devices.find(d=>d.side===side);selected=device?.id||"";port=""}
  point=device?.ports.find(p=>p.id===port);if(!point)port="";cable=point?idx.links.get(port):null;
}
const readOnly=()=>mode==="live"&&!!project.draft;
function remember(message){
  try{localStorage.setItem(cacheKey,JSON.stringify(project));localStorage.setItem(cacheKey+"-saved","no");cacheProblem=""}catch(e){cacheProblem="Local recovery is unavailable. Save a project file."}
  dirty=true;render();if(message||cacheProblem)toast(cacheProblem||message);
}
function change(fn,message){
  const prev=JSON.stringify(project);
  try{fn();validateProject(project)}catch(e){project=JSON.parse(prev);sync();throw e}
  undoStack.push(prev);if(undoStack.length>40)undoStack.shift();redoStack=[];remember(message);
}
function undo(redo=false){const a=redo?redoStack:undoStack,b=redo?undoStack:redoStack;if(!a.length)return;b.push(JSON.stringify(project));project=JSON.parse(a.pop());if(!project.draft)mode="live";wire=null;remember(redo?"Change restored":"Change undone")}
let toastTimer;
function toast(msg){const n=$("#toast");n.textContent=msg;n.classList.add("on");clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove("on"),3300)}
const btn=(act,text,ic="",cls="",extra="")=>`<button type="button" class="btn ${cls}" data-act="${act}" ${extra}>${ic?icon(ic):""}${esc(text)}</button>`;
const ib=(act,label,ic,extra="")=>btn(act,"",ic,"icon-btn",`aria-label="${esc(label)}" title="${esc(label)}" ${extra}`);
const options=(values,picked)=>values.map(v=>`<option ${v===picked?"selected":""}>${esc(v)}</option>`).join("");
const dot=(colour)=>`<i class="dot" style="--dot:${hex(colour)}"></i>`;
const place=d=>d.u===null?"Unplaced":d.size===1?"U"+d.u:"U"+(d.u+d.size-1)+"–"+d.u;
const titleMap={Rack:"Rack workspace",Connections:"Connections",Plan:"Work plan",Materials:"Cable list"};
const navs=[["Rack","Rack workspace","rack"],["Connections","Connections","cable"],["Plan","Work plan","plan"],["Materials","Cable list","box"]];
function render(){
  sync();const selectedFocus=document.activeElement?.dataset?.pid;
  app.innerHTML=`<div class="shell ${navOpen?"nav-open":""}"><aside class="sidebar">
    <div class="brand"><span class="brand-mark"><b></b><b></b><b></b><b></b></span>Patchbay</div>
    <div class="nav-caption">WORKSPACE</div><nav>${navs.map(([id,name,ic])=>`<button data-act="nav" data-val="${id}" class="nav ${view===id?"active":""}" ${view===id?'aria-current="page"':""}>${icon(ic)}${name}</button>`).join("")}</nav>
    <div class="nav-caption">PROJECT</div>${btn("files","Project files","folder","nav")}${btn("settings","Rack settings","settings","nav")}
    <div class="side-bottom">${btn("help","Shortcuts","key","nav")}<span class="offline"><i></i> Offline workspace</span></div>
  </aside><main><header class="top"><div class="crumb">${ib("navtoggle","Navigation","menu",'id="nav-toggle"')}${icon("folder",17)} <span>${esc(project.name)}</span> ${icon("chev",13)} <strong>${esc(titleMap[view])}</strong></div><div class="actions">${ib("undo","Undo (Ctrl+Z)","undo",undoStack.length?"":"disabled")}${ib("redo","Redo (Ctrl+Shift+Z)","redo",redoStack.length?"":"disabled")}<i class="divider"></i>${btn("open","Open","folder","top-open")}${btn("save","Save project","save","save-btn",dirty?'title="Save changes to your portable file"':"")}</div></header>
  <div class="page"><div class="page-head"><div><div class="eyebrow"><i></i> ${mode==="draft"?"DRAFT PLAN":"CURRENT LAYOUT"}</div><h1>${titleMap[view]}</h1><div class="sub">${esc(project.name)}<span> / </span>${board.height}U cabinet${board.depthMm?" · "+board.depthMm+" mm deep":""}</div></div><div class="actions">${view==="Rack"?btn("add","Add device","plus","primary",readOnly()?"disabled":""):view==="Materials"||view==="Plan"&&project.draft?btn("print","Print","print"):view==="Connections"?btn("printlabels","Print labels","label"):""}</div></div>
  ${project.draft?`<div class="modebar"><span>${icon("layers",16)} Layout</span><div class="seg">${btn("live","Current","","",mode==="live"?'aria-pressed="true"':'aria-pressed="false"')}${btn("draft","Draft","","",mode==="draft"?'aria-pressed="true"':'aria-pressed="false"')}</div>${readOnly()?"<small>Current layout is locked while a draft is open.</small>":""}</div>`:""}
  ${wire?`<div class="wirebar">${icon("link")}<b>From ${esc(endpoint(idx,wire.a))}</b><span>Select the destination port on either rack face.</span>${btn("pickdest","Choose from list","search")}${ib("cancelwire","Cancel connection","x")}</div>`:""}
  ${view==="Rack"?rackView():view==="Connections"?connectionsView():view==="Materials"?materialsView():planView()}</div></main></div>`;
  if(selectedFocus)Array.from(app.querySelectorAll("[data-pid]")).find(b=>b.dataset.pid===selectedFocus)?.focus({preventScroll:true});
}
function portColour(p) {
  const c=idx.links.get(p.id);if(!c)return "";
  const other=idx.ports.get(peer(c,p.id));
  if(other)return project.legend[other.d.group]||"#53a18e";
  return hex(p.source?.fill||project.legend[c.status]||"#dba663");
}
function portDescription(d,p){
  const c=idx.links.get(p.id);
  return esc([d.code+" / "+p.label,conditionOf(p),c?(peer(c,p.id)?endpoint(idx,peer(c,p.id)):c.note||"Loose end"):"Unpatched"].join(" · "));
}
function faceplateView(d,compact){
  const rows=portRows(d),columns=rows[0].length;
  const renderCell=p=>{
    if(!p)return '<span class="port-gap" aria-hidden="true"></span>';
    const props=`data-condition="${conditionOf(p)}" data-act="port" data-pid="${p.id}" aria-label="${portDescription(d,p)}" title="${portDescription(d,p)}"`;
    if(compact)return `<button class="mini ${p.id===port?'chosen':''} ${idx.links.has(p.id)?"wired":""}" ${props} style="--jack:${hex(portColour(p))}">${columns<=12 && p.label.length<4?`<span>${esc(p.label)}</span>`:""}<i></i></button>`;
    return `<button class="port ${p.id===port?"sel":""}" ${props}><i style="--jack:${portColour(p)||"#d4dedb"}"></i>${esc(p.label)}</button>`;
  };
  return `<div class="face-scroll ${compact?"is-mini":"is-detail"}"><div class="physical-grid" style="--columns:${columns}">${rows.map(row=>row.map(renderCell).join("")).join("")}</div></div>`;
}
function chassis(d){
  return `<div class="rack-row ${d.id===selected?"selected":""}" data-device="${d.id}" draggable="${!readOnly()}"><div class="unit" title="${esc(place(d))}">${d.u===null?"•":String(d.u).padStart(2,"0")}</div><div class="chassis" style="min-height:${61+Math.min(d.size-1,5)*32}px"><div class="rail"><i></i><i></i></div><button class="device-title" data-act="select" data-id="${d.id}" title="${esc(d.name)}"><b>${esc(d.code)}</b><span>${esc(d.name)}</span></button><div class="jacks">${faceplateView(d,true)}</div><div class="rail"><i></i><i></i></div></div></div>`;
}
function rackView(){
  const group=(text,contents)=>`<div class="rack-group"><span>${esc(text)}</span><i></i></div>${contents}`;
  const devices=board.devices.filter(d=>d.side===side);
  const placed=devices.filter(d=>d.u!==null).sort((a,b)=>b.u-a.u), spare=devices.filter(d=>d.u===null);
  let rack="";
  if(showEmpty){
    for(let u=board.height;u>=1;u--){
      const d=placed.find(d=>u===d.u+d.size-1);
      if(d)rack+=chassis(d);else if(!placed.some(d=>d.u<=u&&d.u+d.size>u))rack+=`<div class="empty-unit" data-unit="${u}"><span>${String(u).padStart(2,"0")}</span><button data-act="place" data-u="${u}" ${readOnly()?"disabled":""}>${icon("plus",13)} Place at U${u}</button></div>`;
    }
  }else{
    let last=board.height+1;
    for(const d of placed){const gap=last-(d.u+d.size);if(gap)rack+=gapRow(gap);rack+=chassis(d);last=d.u}
    if(placed.length&&last>1)rack+=gapRow(last-1);
  }
  if(spare.length)rack+=group("Unplaced · "+spare.length,spare.map(chassis).join(""));
  if(!devices.length&&!showEmpty)rack=`<div class="empty-state">${icon("rack",38)}<h3>This face is empty</h3>${btn("add","Add device","plus","",readOnly()?"disabled":"")}</div>`;
  const count=d=>board.devices.filter(x=>x.side===d).length;
  const importHint=project.source&&spare.length?`<div class="import-hint">${icon("info",16)}<span>${spare.length} unplaced on this face. Set the cabinet height and each device’s U position from the rack.</span></div>`:"";
  return `<div class="work-grid"><section class="panel rack-panel"><div class="panel-heading"><div class="heading-icon">${icon("rack")}</div><div><h2>Rack elevation</h2><small>${board.devices.length} devices <b>·</b> ${board.cables.length} cables</small></div>${ib("settings","Rack settings","settings")}</div>${importHint}
    <div class="rack-tools"><div class="seg">${["Front","Rear"].map(s=>`<button data-act="side" data-val="${s}" aria-pressed="${s===side}">${s}<em>${count(s)}</em></button>`).join("")}</div><div class="rack-tool-actions">${btn("conditions","Port conditions","search","tiny")}${btn("units",showEmpty?"Hide empty U":"Show all U","layers","tiny",`aria-pressed="${showEmpty}"`)}</div></div>
    <div class="elevation"><div class="rack-cap"><span>U</span><strong>${side.toUpperCase()} ELEVATION</strong><small>${board.height} U</small></div>${rack}<div class="rack-base"></div></div>
    <div class="legend"><span>Groups</span>${[...new Set(board.devices.map(d=>d.group))].filter(Boolean).map(g=>`<span>${dot(project.legend[g])}${esc(g)}</span>`).join("")}</div></section>${inspector()}</div>`;
}
function gapRow(n){return `<button class="gap-row" data-act="units" title="Show empty rack units"><i></i><span>${n}U available</span><i></i></button>`}
function inspector(){
  if(!device)return `<aside class="panel inspector"><div class="panel-heading"><h2>Inspector</h2></div><div class="empty-state">${icon("switch",32)}<p>Select a device to inspect its ports.</p></div></aside>`;
  const d=device,used=d.ports.filter(p=>idx.links.has(p.id)).length, colour=project.legend[d.group], lock=readOnly()?"disabled":"";
  return `<aside class="panel inspector"><div class="panel-heading"><h2>Device inspector</h2>${ib("edit","Edit device","edit",lock)}</div>
  <div class="inspect-body"><div class="device-caption"><div class="device-symbol">${icon(kindIcon(d.kind),23)}</div><div><strong>${esc(d.code)}</strong><small>${esc(d.kind)}</small></div></div><h3>${esc(d.name)}</h3><div class="chips"><span>${d.side}</span><span>${place(d)}</span><span>${dot(colour)}${esc(d.group)}</span></div>
  <div class="section-title">Ports ${btn("faceplate","Edit ports","grid","tiny",lock)}</div>
  ${faceplateView(d,false)}<small class="port-count">${used} / ${d.ports.length} in use</small>
  ${point?portDetail(lock):`<div class="port-hint">${icon("info",15)} Select a port to trace or patch a cable.</div>`}
  <div class="inspect-actions">${btn("edit","Edit device","edit","",lock)}${ib("duplicate","Duplicate device","copy",lock)}</div></div></aside>`;
}
function portDetail(lock){
  const peerId=cable&&peer(cable,port),other=idx.ports.get(peerId), label=cable?(other?endpoint(idx,peerId):cable.note||"Loose end"):"Unpatched";
  const wireLock=unavailable(point)?'disabled title="This port is unavailable for new patches"':lock;
  return `<div class="port-detail"><div class="section-title">${esc(device.code+" / "+point.label)}${ib("editport","Edit port","edit",lock)}</div>
  <div class="port-facts"><span class="condition-pill" data-condition="${conditionOf(point)}">${conditionOf(point)}</span><span>${esc(point.medium==="Unknown"?"Unspecified connector":point.medium)}</span></div>
  <div class="peer">${icon(cable?"link":"plus",16)} ${esc(label)} ${other?ib("trace","Go to other end","arrow"):""}</div><small>${esc([cable?.status,point.note].filter(Boolean).join(" · "))}</small>
  ${point.source?.text?`<small class="source-note">Excel entry · ${esc(point.source.text)}</small>`:""}
  <div class="row-buttons">${cable?btn("editcable","Cable details","edit","tiny",lock):btn("wire","Connect port","link","primary tiny",wireLock)}${cable?btn("wire","Repatch","flip","tiny",wireLock):""}</div></div>`;
}
function connectionsView(){
  return `<section class="panel table-panel"><div class="filterbar"><label class="search">${icon("search",17)}<input id="search" placeholder="Search ports, devices or notes" value="${esc(query)}"></label><select id="link-filter" aria-label="Filter connections">${options(["All","Needs review","Loose ends","Buy"],filter)}</select></div><div id="connection-rows">${connectionRows()}</div></section>`;
}
function connectionRows(){
  const rows=board.cables.filter(c=>{
    const line=[endpoint(idx,c.a),c.b?endpoint(idx,c.b):"",c.note,c.status,c.type,c.colour].join(" ").toLowerCase();
    return line.includes(query.toLowerCase())&&(filter==="All"||filter==="Needs review"&&["Check on site","Single entry","Pending"].includes(c.status)||filter==="Loose ends"&&!c.b||filter==="Buy"&&c.supply==="Buy");
  });
  return `<table><thead><tr><th>From</th><th>To</th><th>Cable</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><button class="table-link" data-act="jump" data-id="${c.a}">${esc(endpoint(idx,c.a))}</button></td><td>${c.b?`<button class="table-link" data-act="jump" data-id="${c.b}">${esc(endpoint(idx,c.b))}</button>`:esc(c.note||"Loose end")}</td><td>${esc([c.type,c.colour,c.length?c.length+" m":""].filter(Boolean).join(" · "))}</td><td><span class="status ${["Check on site","Pending","Single entry"].includes(c.status)?"warn":""}">${esc(c.status)}</span></td><td>${ib("linkedit","Cable details","edit",`data-id="${c.id}" ${readOnly()?"disabled":""}`)}</td></tr>`).join("")}</tbody></table>${!rows.length?'<div class="empty-state">No connections match this view.</div>':""}<div class="table-foot">${rows.length} connections</div>`;
}
function planView(){
  if(!project.draft)return `<section class="panel plan-intro"><div class="intro-icon">${icon("plan",32)}</div><h2>Plan your recabling</h2><p>Start with a copy of the current rack. Move equipment and repatch cables in the draft to build a checklist for the cabinet.</p>${btn("startdraft","Create draft","plus","primary")}</section>`;
  const items=workItems(project),done=items.filter(x=>project.checked[x.key]).length;
  return `<section class="panel"><div class="panel-heading"><h2>Change checklist</h2><small>${done} of ${items.length} checked</small></div>${items.map((x,i)=>`<label class="task"><input type="checkbox" data-task="${i}" ${project.checked[x.key]?"checked":""}><div><strong>${esc(x.title)}</strong>${x.from?`<small>From · ${esc(x.from)}</small>`:""}${x.to?`<small>To · ${esc(x.to)}</small>`:""}</div></label>`).join("")||'<div class="empty-state">Your draft matches the current rack. Edit the draft to add work items.</div>'}<div class="panel-actions">${btn("draftedit","Edit draft","rack")}${btn("applydraft","Apply draft","check","primary")}${btn("discarddraft","Discard","","quiet")}</div></section>`;
}
function materialsView(){
  const groups=new Map();
  for(const c of board.cables){const key=JSON.stringify([c.supply,c.type,c.colour,c.length]);groups.set(key,(groups.get(key)||0)+1)}
  const list=[...groups].sort((a,b)=>a[0].localeCompare(b[0]));
  return `<section class="panel"><div class="panel-heading"><h2>Cable requirements</h2><small>${board.cables.filter(c=>c.supply==="Buy").length} to buy · ${board.cables.filter(c=>c.supply==="Reuse").length} to reuse</small></div><table><thead><tr><th>Source</th><th>Type</th><th>Colour</th><th>Length</th><th>Quantity</th></tr></thead><tbody>${list.map(([key,count])=>{const [s,t,c,l]=JSON.parse(key);return `<tr><td><span class="status">${s}</span></td><td>${esc(t)}</td><td>${esc(c||"Unspecified")}</td><td>${l?l+" m":"Measure"}</td><td><b>${count}</b></td></tr>`}).join("")}</tbody></table>${!list.length?'<div class="empty-state">Connect ports to build your cable list.</div>':""}<div class="table-foot">Set the length and purchase choice in Cable details.</div></section>`;
}
