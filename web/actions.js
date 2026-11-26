"use strict";
let formHandler=null;
const field=(label,html,full=false)=>`<label class="field ${full?"full":""}"><span>${esc(label)}</span>${html}</label>`;
const inp=(n,v="",attrs="")=>`<input name="${n}" value="${esc(v)}" ${attrs}>`;
const sel=(n,items,v)=>`<select name="${n}">${options(items,v)}</select>`;
function dialog(title,body,submit="",handler=null,extra=""){
  modal.classList.remove("wide-layout");
  formHandler=handler;
  $("#dialog-body").innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${ib("close","Close","x")}</div><form id="editor"><div class="dialog-body">${body}<div class="form-error" role="alert"></div></div>${submit?`<div class="dialog-foot">${extra}${btn("close","Cancel")}<button class="btn primary" type="submit">${esc(submit)}</button></div>`:""}</form>`;
  modal.setAttribute("aria-labelledby","dialog-title");
  if(!modal.open)modal.showModal();
  const input=modal.querySelector(".dialog-body input:not([type=color]),.dialog-body select,.dialog-body button");
  input?.focus({preventScroll:true});
}
function ask(title,message,action,fn){dialog(title,`<p>${esc(message)}</p>`,action,()=>{modal.close();fn()})}
function protective(action){if(!dirty){action();return}ask("Switch project?","Save a project file to keep your current changes before switching. Opening another project replaces this local session.","Switch project",action)}
function loadProject(p){
  validateProject(p);project=p;mode=p.draft?"draft":"live";side="Front";selected="";port="";wire=null;view="Rack";query="";filter="All";showEmpty=false;
  nativeDirect=false;browserHandle=null;undoStack=[];redoStack=[];navOpen=false;modal.close();remember("Project opened");dirty=false;
}
function freshCode(d){let n=2,code=d.code+"-2";while(board.devices.some(x=>x.code.toLowerCase()===code.toLowerCase()))code=d.code+"-"+(++n);return code}
function deviceForm(action="add",at=null){
  if(readOnly())return;
  const editing=action==="edit",source=action==="add"?null:device;
  const knownKinds=[...new Set([...kinds,...board.devices.map(d=>d.kind)])];
  const selectedLayout=source?.layout||"Odd above even";
  const fields=[
    field("Device ID",inp("code",source?(editing?source.code:freshCode(source)):"",'required maxlength="48" placeholder="e.g. SW2"')),
    field("Device type",`<select name="kind">${options(knownKinds,source?.kind||"Switch")}<option value="__new_kind__">Custom device type…</option></select>`),
    `<label class="field full" id="custom-kind-field" hidden><span>Custom device type</span>${inp("customKind","",'disabled maxlength="100" placeholder="e.g. Audio interface"')}</label>`,
    field("Display name",inp("name",source?.name||"",'required maxlength="120" placeholder="e.g. Access switch"'),true),
    field("Rack face",sel("side",["Front","Rear"],source?.side||side)),
    field("Bottom rack unit",inp("u",at??(editing?source.u:""),`type="number" min="1" max="${board.height}" placeholder="Unplaced"`)),
    field("Height in rack units",inp("size",source?.size||1,`type="number" required min="1" max="${board.height}"`)),
    field("Colour group",sel("group",Object.keys(project.legend),source?.group||Object.keys(project.legend)[0]))
  ];
  if(!source){
    fields.push(field("Starting port layout",sel("layout",layouts,selectedLayout),true),
      `<div data-auto-fields class="form-pair">${field("Number of ports",inp("count",24,'type="number" min="0" max="256" required'))}${field("Label prefix (optional)",inp("prefix","",'placeholder="e.g. A for A1, A2…"'))}</div>`,
      `<div data-grid-fields class="form-pair" hidden>${field("Rows",inp("rows",2,'type="number" min="1" max="64" required disabled'))}${field("Columns",inp("columns",8,'type="number" min="1" max="256" required disabled'))}</div>`,
      field("Default connector",sel("medium",media,"RJ45"),true));
  }else{
    const rows=portRows(source);
    fields.push(`<div class="device-ports-summary"><span>${source.ports.length} ports · ${rows.length} rows × ${rows[0].length} columns</span><input type="hidden" name="after" value="">${btn("saveeditports",editing?"Save & edit ports":"Duplicate & edit ports","grid","tiny")}</div>`);
  }
  dialog(editing?"Edit device":source?"Duplicate device":"Add device",`<div class="fields">${fields.join("")}</div>`,editing?"Save device":"Add device",f=>{
    const get=n=>String(f.get(n)||"").trim();
    const code=get("code"),kind=get("kind")==="__new_kind__"?get("customKind"):get("kind");
    if(!code||!kind||!get("name"))throw Error("Enter a device ID, type and name.");
    if(board.devices.some(x=>x.id!==(editing?source.id:null)&&x.code.toLowerCase()===code.toLowerCase()))throw Error("That device ID is already in use.");
    const common={code,name:get("name"),kind,side:get("side"),group:get("group"),size:Number(get("size")),u:get("u")?Number(get("u")):null};
    let next;
    if(source){
      next=Object.assign(clone(source),common);
      if(!editing){
        next.id=ID();
        for(const p of next.ports){p.id=ID();delete p.source;delete p.condition;p.note=""}
      }
    }else{
      const custom=get("layout")==="Custom grid";
      const labels=custom?[]:Array.from({length:Number(get("count"))},(_,i)=>get("prefix")+(i+1));
      next=makeDevice(code,common.name,kind,common.side,common.group,labels,get("layout"),common.u,common.size,get("medium"));
      next.defaultMedium=get("medium");
      if(custom)next.faceplate={rows:Number(get("rows")),columns:Number(get("columns"))};
    }
    const overlap=collision(board,next);if(overlap)throw Error(overlap);
    change(()=>{if(editing)board.devices[board.devices.findIndex(x=>x.id===next.id)]=next;else board.devices.push(next);side=next.side;selected=next.id;port=""},editing?"Device updated":"Device added");
    modal.close();
    if(get("after")==="ports"||!source&&next.layout==="Custom grid")openFaceplate();
  },editing?btn("deletedevice","Remove","trash","danger quiet"):"");
}
function removeDevice(){
  const d=device;
  ask("Remove "+d.code+"?","This removes the device and its attached cables from this layout. Undo is available.","Remove device",()=>change(()=>{
    const ids=new Set(d.ports.map(p=>p.id));board.cables=board.cables.filter(c=>!ids.has(c.a)&&!ids.has(c.b));board.devices=board.devices.filter(x=>x.id!==d.id);selected="";port="";wire=null;
  },"Device removed"));
}
function portForm(){
  if(!point||readOnly())return;
  const id=point.id;
  dialog("Edit port · "+endpoint(idx,id),`<div class="fields">${field("Port label",inp("label",point.label,"required"))}${field("Port type",sel("medium",media,point.medium))}${field("Port condition",sel("condition",portConditions,conditionOf(point)),true)}${field("Notes",`<textarea name="note" placeholder="Fault symptoms, test result or reason for disabling">${esc(point.note)}</textarea>`,true)}</div>`,"Save port",f=>{
    const label=String(f.get("label")).trim();if(!label||device.ports.some(p=>p.id!==id&&p.label.toLowerCase()===label.toLowerCase()))throw Error("Use a unique port label.");
    change(()=>{
      const p=idx.ports.get(id).p;
      Object.assign(p,{label,medium:f.get("medium"),note:f.get("note")});
      if(f.get("condition")==="Unknown")delete p.condition;else p.condition=f.get("condition");
      if(wire?.a===id && unavailable(p))wire=null;
    },"Port updated");modal.close();
  },btn("removeport","Remove","trash","danger quiet"));
}
function conditionList(selectedCondition){
  const ports=Array.from(idx.ports.values());
  const counts=Object.fromEntries(portConditions.map(name=>[name,0]));
  for(const {p} of ports)counts[conditionOf(p)]++;
  const names=["Broken","Disabled","Unknown","Working"];
  const active=selectedCondition||names.find(name=>counts[name])||"Unknown";
  const buttons=names.map(name=>btn("conditionfilter",name+" ("+counts[name]+")","","tiny",`data-val="${name}" aria-pressed="${active===name}"`)).join("");
  const rows=ports.filter(({p})=>conditionOf(p)===active).map(({d,p})=>{
    const c=idx.links.get(p.id), other=c&&peer(c,p.id);
    const dest=c?(other?endpoint(idx,other):c.note||"Loose end"):"Unpatched";
    return `<button type="button" class="condition-entry" data-act="inspectcondition" data-id="${p.id}"><span><strong>${esc(d.code+" / "+p.label)}</strong><small>${esc(d.side+" · "+dest)}</small></span>${icon("chev",15)}</button>`;
  }).join("");
  dialog("Port conditions",`<div class="condition-filters">${buttons}</div><div class="condition-list">${rows||`<div class="empty-state">No ports marked ${active.toLowerCase()}.</div>`}</div>`);
  modal.querySelector('[aria-pressed="true"]')?.focus();
}
function wiring(){
  if(!point||readOnly())return;
  requireUsablePort(port);
  wire={a:port,id:cable?.id||null};render();destPicker();
}
function destPicker(){
  if(!wire)return;
  requireUsablePort(wire.a);
  const dests=Array.from(idx.ports.values()).filter(({p})=>p.id!==wire.a&&!unavailable(p)&&(!idx.links.has(p.id)||idx.links.get(p.id).id===wire.id));
  const list=dests.map(({d,p})=>`<option value="${p.id}">${esc(d.side+" · "+d.code+" / "+p.label+" · "+p.medium+" · "+conditionOf(p))}</option>`).join("");
  dialog("Connect "+endpoint(idx,wire.a),`<div class="fields">${field("Destination",`<select name="dst"><option value="">Loose or unknown end</option>${list}</select>`,true)}<div class="helptext">You can also pick the destination directly on the front or rear elevation.</div></div>`,"Continue",f=>cableForm(wire.id,f.get("dst")||null,true),btn("pickrack","Pick on rack","rack","quiet"));
}
function requireUsablePort(id){
  if(!id)return;
  const hit=idx.ports.get(id);
  if(!hit)throw Error("This port has been removed. Select another port.");
  if(unavailable(hit.p))throw Error(endpoint(idx,id)+" is marked "+conditionOf(hit.p).toLowerCase()+". Choose another port.");
}
function cableTypeField(value){
  const custom=value!=="Unspecified" && !Object.values(cableTypes).flat().includes(value);
  const groups=Object.entries(cableTypes).map(([name,values])=>`<optgroup label="${esc(name)}">${options(values,value)}</optgroup>`).join("");
  return field("Cable type",`<select name="type"><option>Unspecified</option>${groups}<option value="__custom__" ${custom?"selected":""}>Custom type…</option></select>`)
    +`<label class="field full" id="custom-type-field" ${custom?"":"hidden"}><span>Custom cable type</span>${inp("customType",custom?value:"",custom?"required":"disabled")}</label>`;
}
function cableForm(id,dest,rewire=false){
  if(readOnly())return;
  const existing=board.cables.find(c=>c.id===id);
  const c=existing?clone(existing):makeCable(wire.a);
  if(rewire){requireUsablePort(wire.a);requireUsablePort(dest);c.a=wire.a;c.b=dest;if(!existing){c.supply=mode==="draft"?"Buy":"Reuse"}if(c.b)c.note="";c.status="Recorded"}
  const p1=idx.ports.get(c.a),p2=idx.ports.get(c.b);
  const endpointName=c.b?endpoint(idx,c.b):"Loose or unknown end";
  const mixed=p2&&p1.p.medium!=="Unknown"&&p2.p.medium!=="Unknown"&&p1.p.medium!==p2.p.medium;
  const estimate=estimateLength(project,board,c);
  dialog(existing&&!rewire?"Cable details":"Patch cable",`<p><strong>${esc(endpoint(idx,c.a))} ↔ ${esc(endpointName)}</strong></p>${mixed?'<p>Port types differ. Check the cable and transceivers before installation.</p>':""}<div class="fields">
  ${cableTypeField(c.type)}
  ${field("Physical cable colour",inp("colour",c.colour,'placeholder="e.g. Grey"'))}
  ${field("Length (metres)",inp("length",c.length??"",'type="number" min="0.01" step="any" placeholder="Measure"'))}
  ${field("Cable source",sel("supply",["Reuse","Buy"],c.supply))}
  <div class="helptext estimate">${esc(estimate.message)} ${estimate.length?btn("estimate","Use "+estimate.length+" m","layers","tiny",`data-length="${estimate.length}"`):""}</div>
  ${field("Verification",sel("status",["Recorded","Verified","Check on site","Pending","Single entry","Matched entries"],c.status),true)}
  ${field(c.b?"Notes":"Far-end label or notes",`<textarea name="note">${esc(c.note)}</textarea>`,true)}</div>`,"Save connection",f=>{
    if([c.a,c.b].some(pid=>pid&&idx.links.has(pid)&&idx.links.get(pid).id!==c.id))throw Error("An endpoint is already occupied.");
    if(rewire){requireUsablePort(c.a);requireUsablePort(c.b)}
    const type=f.get("type")==="__custom__"?String(f.get("customType")||"").trim():f.get("type");
    if(!type)throw Error("Enter a custom cable type.");
    Object.assign(c,{type,colour:String(f.get("colour")).trim(),length:f.get("length")?Number(f.get("length")):null,supply:f.get("supply"),status:f.get("status"),note:f.get("note")});
    change(()=>{if(existing)board.cables[board.cables.findIndex(x=>x.id===c.id)]=c;else board.cables.push(c);wire=null},"Connection saved");modal.close();
  },existing?btn("disconnect","Disconnect","trash","quiet danger",`data-id="${c.id}"`):"");
}
function jump(pid){
  const hit=idx.ports.get(pid);if(!hit)return;side=hit.d.side;selected=hit.d.id;port=pid;view="Rack";render();
  requestAnimationFrame(()=>{const el=app.querySelector('[data-device="'+selected+'"]');el?.scrollIntoView({block:"nearest"});if(window.innerWidth<720)app.querySelector(".inspector")?.scrollIntoView({block:"start"})});
}
function settingForm(){
  const groups=Object.entries(project.legend);
  const routing=project.routing||defaultRouting;
  dialog("Rack settings",`<div class="fields">${field("Project name",inp("name",project.name,"required"),true)}${field("Rack height (U)",inp("height",board.height,`type="number" min="1" max="100" required ${readOnly()?"readonly":""}`))}${depthField(board.depthMm,readOnly())}</div>
  <details class="setting-section"><summary>Colour legend</summary>${groups.map(([g,v],i)=>`<label class="palette-row"><span>${esc(g)}</span><input type="color" name="g${i}" value="${hex(v)}"></label>`).join("")}<div class="fields">${field("New group",inp("group","",'placeholder="Optional group name"'))}${field("Group colour",inp("newcolour","#789f80",'type="color"'))}</div></details>
  <details class="setting-section"><summary>Cable length estimates</summary><p class="helptext">Choose how to estimate the distance between faces. When cabinet depth is unknown, the crossing allowance is used.</p><div class="fields">${field("Front-to-rear route",sel("crossingMode",["Cabinet depth","Measured cable path"],routing.useMeasuredCrossing?"Measured cable path":"Cabinet depth"),true)}${field("Routing and slack (m)",inp("allowance",routing.allowance,'type="number" required min="0" step="any"'))}${field("Measured path or fallback (m)",inp("crossing",routing.crossing,'type="number" required min="0" step="any"'))}${field("Stock lengths (m)",inp("stock",routing.stock.join(", "),"required"),true)}</div></details>`,"Save settings",f=>{
    const h=Number(f.get("height")),n=String(f.get("name")).trim(),g=String(f.get("group")).trim();
    if(!n)throw Error("Give the project a name.");if(board.devices.some(d=>d.size>h||d.u!==null&&d.u+d.size-1>h))throw Error("Move devices inside the new height first.");
    if(g&&(Object.hasOwn(project.legend,g)||["__proto__","constructor","prototype"].includes(g)))throw Error("Choose a unique group name.");
    const stock=[...new Set(String(f.get("stock")).split(",").map(x=>Number(x.trim())))].sort((a,b)=>a-b);
    if(!stock.every(x=>Number.isFinite(x)&&x>0))throw Error("Enter positive stock lengths, separated by commas.");
    change(()=>{project.name=n;project.routing={allowance:Number(f.get("allowance")),crossing:Number(f.get("crossing")),useMeasuredCrossing:f.get("crossingMode")==="Measured cable path",stock};if(!readOnly()){board.height=h;if(f.get("depthMm"))board.depthMm=Number(f.get("depthMm"));else delete board.depthMm}groups.forEach(([key],i)=>project.legend[key]=f.get("g"+i));if(g)project.legend[g]=f.get("newcolour")},"Settings saved");modal.close();
  });
}
function depthField(value,locked=false){
  return field("Cabinet depth (mm)",inp("depthMm",value??"",`type="number" min="1" step="1" placeholder="Unknown" ${locked?"readonly":""}`));
}
function fileMenu(){dialog("Project files",`<div class="file-options">${btn("open","Open project or import workbook","folder")}${btn("save","Save project","save")}${btn("saveas","Save project as…","copy")}${btn("template","Export layout as template","layers")}${btn("new","New empty project","plus")}${btn("demo","Open example rack","rack")}</div>`)}
function templateProject(){
  const p=clone(project);p.name+=" template";p.live=clone(board);p.draft=null;p.checked={};p.source="";p.live.cables=[];p.live.devices.forEach(d=>d.ports.forEach(q=>{delete q.source;delete q.condition;q.note=""}));return p;
}
function safeFileName(str){return str.replace(/[<>:"/\\|?*\u0000-\u001f]/g,"-").slice(0,120).trim()||"Rack"}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function save(as=false,template=false){
  if(saving)return;saving=true;
  const p=template?templateProject():project, data=JSON.stringify(p,null,2),name=safeFileName(p.name)+".rackplan";
  try{
    if(window.__TAURI__?.core){
      // A template is an independent export. Force a new path on the next project save.
      const done=await window.__TAURI__.core.invoke("save_project",{content:data,name,choose:template||as||!nativeDirect});if(!done)return;
      nativeDirect=!template;
    }else if(window.showSaveFilePicker){
      const handle=(!as&&!template&&browserHandle)||await window.showSaveFilePicker({suggestedName:name,types:[{description:"Patchbay project",accept:{"application/json":[".rackplan"]}}]});
      const stream=await handle.createWritable();await stream.write(data);await stream.close();if(!template)browserHandle=handle;
    }else download(new Blob([data],{type:"application/json"}),name);
    if(!template&&JSON.stringify(project,null,2)===data){dirty=false;try{localStorage.setItem(cacheKey+"-saved","yes")}catch{}}
    modal.close();toast(template?"Template exported":"Project saved");
  }catch(e){if(e.name!=="AbortError")toast("Save failed · "+String(e.message||e))}finally{saving=false}
}
function help(){
  const lines=[["Open project or Excel","Ctrl O"],["Save project","Ctrl S"],["Save as","Ctrl Shift S"],["Undo / redo","Ctrl Z / Ctrl Shift Z"],["Add device","N"],["Switch rack face","F"],["Find connection","/"],["Show shortcuts","?"],["Close or cancel","Esc"]];
  dialog("Keyboard shortcuts",lines.map(([a,b])=>`<div class="keyrow"><span>${a}</span><kbd>${b}</kbd></div>`).join(""));
}
function placeAt(u){
  if(readOnly())return;
  const available=board.devices.filter(d=>!collision(board,{...d,side,u}));
  dialog("Place at U"+u,`<div class="fields">${field("Device",`<select name="device">${available.map(d=>`<option value="${d.id}" ${d.id===selected?"selected":""}>${esc(d.code+" · "+d.name+" · "+d.side+" · "+place(d))}</option>`).join("")}</select>`,true)}</div>`,"Place device",f=>{
    const d=board.devices.find(x=>x.id===f.get("device"));if(!d)throw Error("Add a device or choose a unit with enough space.");change(()=>{d.u=u;d.side=side;selected=d.id;port=""},"Device placed");modal.close()
  },btn("addhere","New device","plus","quiet",`data-u="${u}"`));
}
function printLabels(){
  document.querySelector(".print-labels")?.remove();const root=document.createElement("section");root.className="print-labels";
  root.innerHTML=`<h2>${esc(project.name)} · Cable labels</h2>${board.cables.map(c=>{const a=endpoint(idx,c.a),b=c.b?endpoint(idx,c.b):c.note||"Loose end";return [a+" ↔ "+b,b+" ↔ "+a].map(l=>`<span class="label-card">${esc(l)}</span>`).join("")}).join("")}`;
  document.body.append(root);document.body.classList.add("label-print");window.addEventListener("afterprint",()=>{root.remove();document.body.classList.remove("label-print")},{once:true});window.print();
}
function handle(act,el={}){
 if(act.startsWith("fp-")){faceAction(act,el);return}
 const v=el.dataset?.val,id=el.dataset?.id;
 switch(act){
 case "close":modal.close();break;
 case "navtoggle":navOpen=!navOpen;render();break;
 case "nav":view=v;navOpen=false;wire=null;render();window.scrollTo(0,0);break;
 case "files":fileMenu();break;
 case "new":protective(()=>dialog("New project",`<div class="fields">${field("Project name",inp("name","","required autofocus"),true)}${field("Rack height (U)",inp("height",24,'type="number" required min="1" max="100"'))}${depthField(null)}</div>`,"Create project",f=>{loadProject(makeProject(f.get("name").trim(),Number(f.get("height")),f.get("depthMm")?Number(f.get("depthMm")):null));dirty=true}));break;
 case "demo":protective(()=>loadProject(demoProject()));break;
 case "open":modal.close();if(window.__TAURI__?.core)openNative(false);else $("#file").click();break;
 case "save":case "saveas":case "template":save(act==="saveas",act==="template");break;
 case "side":side=v;port="";render();break;
 case "select":selected=id;port="";render();break;
 case "port":{const pid=el.dataset.pid;if(wire&&pid!==wire.a){if(idx.links.has(pid)&&idx.links.get(pid).id!==wire.id){toast("This port already has a cable.");return}cableForm(wire.id,pid,true)}else jump(pid);break}
 case "add":case "edit":case "duplicate":deviceForm(act);break;
 case "addhere":deviceForm("add",Number(el.dataset.u));break;
 case "units":showEmpty=!showEmpty;render();break;
 case "place":placeAt(Number(el.dataset.u));break;
 case "settings":settingForm();break;
 case "conditions":conditionList();break;
 case "faceplate":openFaceplate();break;
 case "saveeditports":{
   const form=modal.querySelector("form"),after=form.elements.after;
   after.value="ports";form.requestSubmit();after.value="";break;
 }
 case "conditionfilter":conditionList(v);break;
 case "inspectcondition":modal.close();wire=null;jump(id);break;
 case "estimate":modal.querySelector('[name="length"]').value=el.dataset.length;break;
 case "undo":undo();break;case "redo":undo(true);break;
 case "editport":portForm();break;
 case "removeport":{const q=point;if(idx.links.has(q.id)){toast("Disconnect this port before removing it.");break}
 ask("Remove port "+q.label+"?","This removes the port from the selected device.","Remove port",()=>change(()=>{device.ports=device.ports.filter(p=>p.id!==q.id);port=""},"Port removed"));break}
 case "deletedevice":removeDevice();break;
 case "wire":wiring();break;case "pickdest":destPicker();break;case "pickrack":modal.close();break;case "cancelwire":wire=null;render();break;
 case "editcable":cableForm(cable.id);break;case "linkedit":cableForm(id);break;
 case "disconnect":ask("Disconnect cable?","Both endpoints will become available. Undo restores the connection.","Disconnect",()=>change(()=>{board.cables=board.cables.filter(c=>c.id!==id);wire=null},"Cable disconnected"));break;
 case "trace":jump(peer(cable,port));break;case "jump":jump(id);break;
 case "help":help();break;
 case "live":case "draft":mode=act;wire=null;render();break;
 case "startdraft":change(()=>{project.draft=clone(project.live);project.checked={};mode="draft";view="Rack";wire=null},"Draft created");break;
 case "draftedit":mode="draft";view="Rack";render();break;
 case "discarddraft":ask("Discard draft?","The current layout is kept. The draft and its checklist will be removed.","Discard draft",()=>change(()=>{project.draft=null;project.checked={};mode="live";wire=null},"Draft discarded"));break;
 case "applydraft":{const items=workItems(project),remaining=items.filter(x=>!project.checked[x.key]).length;ask("Apply draft to current rack?",remaining+" unchecked tasks remain. Applying makes the planned layout your current record.","Apply draft",()=>change(()=>{project.live=project.draft;project.draft=null;project.checked={};mode="live";view="Rack";wire=null},"Draft applied"));break}
 case "print":window.print();break;case "printlabels":printLabels();break;
 }
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b||b.disabled)return;try{handle(b.dataset.act,b)}catch(err){toast(err.message||String(err))}});
document.addEventListener("submit",e=>{if(e.target.id!=="editor")return;e.preventDefault();try{formHandler?.(new FormData(e.target,e.submitter||undefined))}catch(err){modal.querySelector(".form-error").textContent=err.message||String(err)}});
async function readAndOpen(f,native=false){
 try{
   if(f.size>32*1024*1024)throw Error("Choose a project or workbook smaller than 32 MB.");
   const isExcel=/\.xlsx$/i.test(f.name);const p=isExcel?await importWorkbook(await f.arrayBuffer(),f.name):validateProject(JSON.parse(await f.text()));
   protective(async ()=>{
     loadProject(p);dirty=isExcel;try{localStorage.setItem(cacheKey+"-saved",isExcel?"no":"yes")}catch{}
     if(native){try{nativeDirect=await window.__TAURI__.core.invoke("accept_file")}catch{nativeDirect=false}}
     if(isExcel)toast("Workbook imported · review unplaced devices and unresolved ends.");
   });
 }catch(err){dialog("Could not open file",`<p>${esc(err.message||err)}</p>`)}
}
async function openNative(startup){
 try{
   const file=await window.__TAURI__.core.invoke(startup?"startup_project":"choose_project");
   if(file)await readAndOpen(new File([new Uint8Array(file.bytes)],file.name),true);
 }catch(e){dialog("Could not open file",`<p>${esc(e.message||e)}</p>`)}
}
$("#file").addEventListener("change",async e=>{
 const f=e.target.files[0];e.target.value="";if(f)await readAndOpen(f);
});
document.addEventListener("input",e=>{if(e.target.id==="search"){query=e.target.value;$("#connection-rows").innerHTML=connectionRows()}});
document.addEventListener("change",e=>{if(e.target.id==="link-filter"){filter=e.target.value;$("#connection-rows").innerHTML=connectionRows()}
 if(e.target.name==="kind" && e.target.closest("#editor")){
   const custom=e.target.value==="__new_kind__",field=$("#custom-kind-field"),input=field.querySelector("input");
   field.hidden=!custom;input.disabled=!custom;input.required=custom;if(custom)input.focus();
 }
 if(e.target.name==="layout" && e.target.closest("#editor")){
   const custom=e.target.value==="Custom grid";
   for(const [area,hide] of [[modal.querySelector("[data-auto-fields]"),custom],[modal.querySelector("[data-grid-fields]"),!custom]]){
     area.hidden=hide;area.querySelectorAll("input").forEach(n=>n.disabled=hide);
   }
 }
 if(e.target.name==="type" && e.target.closest("#editor")){
   const custom=e.target.value==="__custom__",field=$("#custom-type-field"),input=field.querySelector("input");
   field.hidden=!custom;input.disabled=!custom;input.required=custom;if(custom)input.focus();
 }
 if(e.target.dataset.task!==undefined){const item=workItems(project)[Number(e.target.dataset.task)],value=e.target.checked;change(()=>{if(value)project.checked[item.key]=true;else delete project.checked[item.key]})}
});
document.addEventListener("keydown",e=>{
 if(e.isComposing||e.altKey)return;const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey,typing=e.target.closest("input,textarea,select,[contenteditable]");
 if(mod&&["s","o"].includes(key)){e.preventDefault();if(modal.open&&modal.querySelector("#editor button[type=submit]"))return;handle(key==="s"?(e.shiftKey?"saveas":"save"):"open");return}
 if(modal.open||typing)return;
 if(mod&&["z","y"].includes(key)){e.preventDefault();undo(key==="y"||e.shiftKey);return}if(mod)return;
 if(key==="n")deviceForm();else if(key==="f"){side=side==="Front"?"Rear":"Front";view="Rack";port="";render()}else if(key==="/"){e.preventDefault();view="Connections";render();$("#search").focus()}else if(key==="?")help();else if(key==="escape"){wire=null;navOpen=false;render()}
});
document.addEventListener("dragstart",e=>{const d=e.target.closest("[data-device]");if(!d||readOnly())return;e.dataTransfer.setData("text/patchbay-device",d.dataset.device);e.dataTransfer.effectAllowed="move"});
document.addEventListener("dragover",e=>{const u=e.target.closest("[data-unit]");if(u&&!readOnly()){e.preventDefault();u.classList.add("over")}});
document.addEventListener("dragleave",e=>e.target.closest("[data-unit]")?.classList.remove("over"));
document.addEventListener("drop",e=>{const unit=e.target.closest("[data-unit]");if(!unit||readOnly())return;e.preventDefault();unit.classList.remove("over");const d=board.devices.find(x=>x.id===e.dataTransfer.getData("text/patchbay-device"));if(!d)return;const u=Number(unit.dataset.unit),problem=collision(board,{...d,u,side});if(problem){toast(problem);return}change(()=>{d.u=u;d.side=side;selected=d.id;port=""},"Device moved")});
render();if(cacheProblem)toast(cacheProblem);
if(window.__TAURI__?.core && !sessionStorage.getItem("patchbay-launched")){
 sessionStorage.setItem("patchbay-launched","1");openNative(true);
}
