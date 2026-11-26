"use strict";
let faceEdit=null;
function openFaceplate(){
  if(!device||readOnly())return;
  const d=clone(device),grid=portRows(d).map(row=>row.map(p=>p?.id??null));
  const row=port?grid.findIndex(bank=>bank.includes(port)):-1;
  faceEdit={d,grid,row:Math.max(0,row),col:row>=0?grid[row].indexOf(port):0,moving:false,structural:false,preset:""};
  drawFaceplate();
}
function faceSelection(){
  const s=faceEdit;
  return s.d.ports.find(p=>p.id===s.grid[s.row][s.col]);
}
function drawFaceplate(focusLabel=false){
  const s=faceEdit,p=faceSelection(),columns=s.grid[0].length;
  const previousLeft=modal.querySelector(".layout-scroll")?.scrollLeft||0;
  const previousTop=modal.querySelector(".layout-scroll")?.scrollTop||0;
  const byId=new Map(s.d.ports.map(p=>[p.id,p]));
  const headings=Array.from({length:columns},(_,i)=>`<button type="button" data-act="fp-select-col" data-col="${i}" class="slot-heading axis-heading" aria-pressed="${i===s.col}" aria-label="Select column ${i+1}" title="Select column ${i+1}">${i+1}</button>`).join("");
  const cells=s.grid.map((bank,row)=>{
    const slots=bank.map((id,col)=>{
      const q=byId.get(id),active=s.row===row&&s.col===col;
      const name="Row "+(row+1)+", column "+(col+1)+" · "+(q?"Port "+q.label:"Empty slot");
      return `<button type="button" data-act="fp-slot" data-row="${row}" data-col="${col}" aria-label="${esc(name)}" title="${esc(name)}" aria-pressed="${active}" class="layout-slot ${q?"filled":"gap"}" ${q?'draggable="true"':""}>${q?`<span>${esc(q.label)}</span>`:icon("plus",15)}</button>`;
    }).join("");
    return `<button type="button" data-act="fp-select-row" data-row="${row}" class="slot-row axis-heading" aria-pressed="${row===s.row}" aria-label="Select row ${row+1}" title="Select row ${row+1}">Row ${row+1}</button>${slots}`;
  }).join("");
  const controls=`<div class="layout-tools">${btn("fp-add","Add port","plus","primary tiny")}${btn("fp-row","Add row","","tiny")}${btn("fp-col","Add column","","tiny")}<select id="fp-preset" aria-label="Apply port arrangement"><option value="">Arrange ports…</option>${options(layouts.filter(name=>name!=="Custom grid"),"")}</select>${btn("fp-batch","Paste labels…","","tiny quiet")}</div>`;
  const batch=s.batch?`<div class="batch-ports">${field("Port labels for row "+(s.row+1),'<textarea id="batch-labels" placeholder="LAN 1, LAN 2, MGMT"></textarea>',true)}${btn("fp-append","Add to row","plus","tiny")}</div>`:"";
  const selection=p?`<div class="slot-edit"><div class="section-title">Port settings <small>Row ${s.row+1} · Column ${s.col+1}</small></div><div class="fields">
    ${field("Port label",inp("fpLabel",p.label,'maxlength="100" required'))}${field("Connector",sel("fpMedium",media,p.medium))}
    ${field("Condition",sel("fpCondition",portConditions,conditionOf(p)))}${field("Notes",inp("fpNote",p.note||""))}</div>
    <div class="layout-tools">${btn("fp-move",s.moving?"Cancel move":"Move or swap","flip","tiny")}${btn("fp-gap","Insert gap before","","tiny")}
    ${s.col>0&&!s.grid[s.row][s.col-1]?btn("fp-closegap","Close gap before","","tiny"):""}${btn("fp-remove","Remove port","trash","tiny danger",idx.links.has(p.id)?'disabled title="Disconnect the cable before removing this port"':"")}</div></div>`:"";
  const hint=s.moving?"Choose another slot. An occupied slot swaps the two ports.":"Click an empty slot to add a port. Select a row label or column number to remove it.";
  const removal=s.removal;
  const review=removal?`<div class="axis-review"><p role="status">${esc(removal.message)}</p><div class="layout-tools">${btn("fp-dismiss",removal.blocked?"Back to layout":"Keep "+removal.axis,"","tiny") }${removal.blocked?"":btn("fp-confirm","Remove "+removal.axis+" "+(removal.index+1),"trash","tiny danger")}</div></div>`:"";
  const removeButtons=`<div class="layout-tools">${btn("fp-remove-row","Remove row "+(s.row+1),"","quiet tiny",s.grid.length===1?'disabled title="Keep at least one row"':"")}${btn("fp-remove-col","Remove column "+(s.col+1),"","quiet tiny",columns===1?'disabled title="Keep at least one column"':"")}${btn("fp-trim","Trim empty edges","","quiet tiny")}</div>`;
  const grid=`<div class="layout-scroll"><div class="layout-grid" style="--columns:${columns}"><span></span>${headings}${cells}</div></div>`;
  dialog("Edit ports · "+s.d.code,controls+batch+`<p class="layout-hint" role="status">${hint}</p>`+grid+
    `<div class="layout-caption"><span>${s.d.ports.length} ports · ${s.grid.length} rows × ${columns} columns</span>${removeButtons}</div>`+(review||selection),"Save layout",saveFaceplate);
  modal.classList.add("wide-layout");
  const area=modal.querySelector(".layout-scroll");area.scrollLeft=previousLeft;area.scrollTop=previousTop;
  const focused=removal?modal.querySelector('[data-act="fp-dismiss"]'):focusLabel&&p?modal.querySelector('[name="fpLabel"]'):modal.querySelector('.layout-slot[aria-pressed="true"]');
  focused?.focus({preventScroll:true});
  modal.querySelector('.layout-slot[aria-pressed="true"]')?.scrollIntoView({block:"nearest",inline:"nearest"});
  if(focusLabel&&p&&!removal)focused.select();
}
function saveFaceplate(){
  const s=faceEdit,labels=new Set();
  for(const p of s.d.ports){
    p.label=p.label.trim();const label=p.label.toLowerCase();
    if(!label||labels.has(label))throw Error("Give every port a unique label. Check "+(p.label||"the blank label")+".");
    labels.add(label);
  }
  const original=board.devices.findIndex(d=>d.id===s.d.id);
  if(original<0)throw Error("The device is no longer present in this layout.");
  const previousGrid=portRows(board.devices[original]).map(bank=>bank.map(p=>p?.id??null));
  if(s.structural && (s.preset || JSON.stringify(previousGrid)!==JSON.stringify(s.grid))){
    if(s.preset){s.d.layout=s.preset;delete s.d.faceplate;delete s.d.sourceLayout}
    else setPortGrid(s.d,s.grid);
  }
  if(JSON.stringify(board.devices[original])!==JSON.stringify(s.d)){
    change(()=>{board.devices[original]=s.d;selected=s.d.id;port=s.grid[s.row][s.col]||"";wire=null},"Port layout saved");
  }
  faceEdit=null;modal.close();
}
function nextPortLabel(d,current){
  const prefix=/^(.*?)(\d+)$/.exec(current?.label||d.ports[0]?.label||"1")?.[1]||"";
  const labels=new Set(d.ports.map(p=>p.label.toLowerCase()));
  let next=1;while(labels.has((prefix+next).toLowerCase()))next++;
  return prefix+next;
}
function newFacePort(row,col){
  const s=faceEdit,previous=faceSelection();
  const p={id:ID(),label:nextPortLabel(s.d,previous),medium:previous?.medium||s.d.defaultMedium||s.d.ports[0]?.medium||"Unknown",note:""};
  s.d.ports.push(p);s.grid[row][col]=p.id;s.row=row;s.col=col;s.moving=false;s.structural=true;s.preset="";
  drawFaceplate(true);
}
function addFaceColumn(){
  if(faceEdit.grid[0].length>=256)throw Error("A faceplate supports up to 256 columns.");
  faceEdit.grid.forEach(row=>row.push(null));
}
function moveFacePort(row,col){
  const s=faceEdit;
  [s.grid[s.row][s.col],s.grid[row][col]]=[s.grid[row][col],s.grid[s.row][s.col]];
  s.row=row;s.col=col;s.moving=false;s.removal=null;s.structural=true;s.preset="";drawFaceplate();
}
function removeFaceAxis(axis,index,confirmed=false){
  const s=faceEdit,isRow=axis==="row";
  const size=isRow?s.grid.length:s.grid[0].length;
  if(size<=1 || index<0 || index>=size)return;
  const slots=isRow?s.grid[index]:s.grid.map(row=>row[index]);
  const ids=new Set(slots.filter(Boolean));
  const ports=s.d.ports.filter(p=>ids.has(p.id));
  const connected=ports.filter(p=>idx.links.has(p.id));
  const name=axis+" "+(index+1);
  s.moving=false;
  if(connected.length || (ports.length && !confirmed)){
    const affected=connected.length?connected:ports;
    const labels=affected.slice(0,8).map(p=>p.label).join(", ")+(affected.length>8?" …":"");
    const message=connected.length
      ? "Move the connected "+(connected.length===1?"port":"ports")+" ("+labels+") to another "+axis+" before removing "+name+"."
      : "Removing "+name+" also removes "+ports.length+" unpatched "+(ports.length===1?"port":"ports")+" ("+labels+").";
    s.removal={axis,index,blocked:connected.length>0,message};
  }else{
    if(isRow)s.grid.splice(index,1);
    else for(const row of s.grid)row.splice(index,1);
    s.d.ports=s.d.ports.filter(p=>!ids.has(p.id));
    s.row=Math.min(s.row,s.grid.length-1);s.col=Math.min(s.col,s.grid[0].length-1);
    s.structural=true;s.preset="";s.removal=null;
  }
  drawFaceplate();
}
function faceAction(act,el){
  const s=faceEdit;if(!s)return;
  const row=s.grid[s.row],p=faceSelection();
  const pending=s.removal;
  s.removal=null;
  switch(act){
    case "fp-select-row":s.row=Number(el.dataset.row);s.moving=false;drawFaceplate();return;
    case "fp-select-col":s.col=Number(el.dataset.col);s.moving=false;drawFaceplate();return;
    case "fp-remove-row":removeFaceAxis("row",s.row);return;
    case "fp-remove-col":removeFaceAxis("column",s.col);return;
    case "fp-dismiss":drawFaceplate();return;
    case "fp-confirm":if(pending&&!pending.blocked)removeFaceAxis(pending.axis,pending.index,true);return;
    case "fp-batch":
      s.batch=!s.batch;drawFaceplate();modal.querySelector("#batch-labels")?.focus();return;
    case "fp-append":{
      const labels=modal.querySelector("#batch-labels").value.split(/[,\n]+/).map(v=>v.trim()).filter(Boolean);
      const centre=row.findLastIndex(Boolean)+1;
      const used=new Set(s.d.ports.map(p=>p.label.trim().toLowerCase()));
      if(!labels.length)throw Error("Enter labels separated by commas or new lines.");
      if(centre+labels.length>256)throw Error("Use a new row for the remaining ports.");
      for(const label of labels){if(used.has(label.toLowerCase()))throw Error("Duplicate port label: "+label);used.add(label.toLowerCase())}
      while(row.length<centre+labels.length)addFaceColumn();
      const medium=p?.medium||s.d.defaultMedium||s.d.ports[0]?.medium||"Unknown";
      labels.forEach((label,i)=>{const q={id:ID(),label,medium,note:""};s.d.ports.push(q);row[centre+i]=q.id});
      s.col=centre;s.batch=false;break;
    }
    case "fp-slot":{
      const r=Number(el.dataset.row),c=Number(el.dataset.col);
      if(s.moving){moveFacePort(r,c);return}
      if(!s.grid[r][c]){newFacePort(r,c);return}
      s.row=r;s.col=c;drawFaceplate();return;
    }
    case "fp-add":{
      const c=row.findLastIndex(Boolean)+1;
      if(c>=row.length)addFaceColumn();
      newFacePort(s.row,c);return;
    }
    case "fp-row":
      if(s.grid.length>=64)throw Error("A faceplate supports up to 64 rows.");
      s.grid.push(Array(row.length).fill(null));s.row=s.grid.length-1;s.col=0;break;
    case "fp-col":addFaceColumn();s.col=row.length-1;break;
    case "fp-move":s.moving=!s.moving;drawFaceplate();return;
    case "fp-gap":{
      if(row.at(-1))addFaceColumn();
      row.splice(s.col,0,null);row.pop();s.col++;break;
    }
    case "fp-closegap":
      if(s.col>0&&!row[s.col-1]){row.splice(s.col-1,1);row.push(null);s.col--}
      break;
    case "fp-remove":
      if(!p||idx.links.has(p.id))throw Error("Disconnect the port before removing it.");
      s.d.ports=s.d.ports.filter(q=>q.id!==p.id);row[s.col]=null;break;
    case "fp-trim":
      while(s.grid.length>1 && s.grid.at(-1).every(id=>!id))s.grid.pop();
      while(s.grid[0].length>1 && s.grid.every(bank=>!bank.at(-1)))s.grid.forEach(bank=>bank.pop());
      s.row=Math.min(s.row,s.grid.length-1);s.col=Math.min(s.col,s.grid[0].length-1);break;
    default:return;
  }
  s.structural=true;s.moving=false;s.preset="";drawFaceplate();
}
document.addEventListener("input",e=>{
  if(!faceEdit||!modal.open||!e.target.name?.startsWith("fp"))return;
  const p=faceSelection();if(!p)return;
  switch(e.target.name){
    case "fpLabel":p.label=e.target.value;modal.querySelector('.layout-slot[aria-pressed="true"] span').textContent=p.label;break;
    case "fpMedium":p.medium=e.target.value;break;
    case "fpCondition":if(e.target.value==="Unknown")delete p.condition;else p.condition=e.target.value;break;
    case "fpNote":p.note=e.target.value;break;
  }
});
document.addEventListener("change",e=>{
  if(e.target.id!=="fp-preset"||!e.target.value||!faceEdit)return;
  const s=faceEdit,preset=e.target.value;
  const d={...s.d,layout:preset,faceplate:undefined,sourceLayout:undefined};
  s.grid=portRows(d).map(row=>row.map(p=>p?.id??null));s.preset=preset;s.structural=true;s.row=0;s.col=0;s.moving=false;s.removal=null;drawFaceplate();
});
modal.addEventListener("dragstart",e=>{
  const slot=e.target.closest(".layout-slot.filled");if(!slot||!faceEdit)return;
  e.dataTransfer.setData("application/x-patchbay-slot",slot.dataset.row+","+slot.dataset.col);e.dataTransfer.effectAllowed="move";
});
modal.addEventListener("dragover",e=>{if(e.target.closest(".layout-slot")&&e.dataTransfer.types.includes("application/x-patchbay-slot"))e.preventDefault()});
modal.addEventListener("drop",e=>{
  const slot=e.target.closest(".layout-slot"),raw=e.dataTransfer.getData("application/x-patchbay-slot");
  if(!slot||!faceEdit||!/^\d+,\d+$/.test(raw))return;
  const [r,c]=raw.split(",").map(Number);if(!faceEdit.grid[r]?.[c])return;
  e.preventDefault();faceEdit.row=r;faceEdit.col=c;moveFacePort(Number(slot.dataset.row),Number(slot.dataset.col));
});
modal.addEventListener("close",()=>{if(!modal.open)faceEdit=null});
