"use strict";
const ID = () => crypto.randomUUID();
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hex = value => /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#879b99";
const kinds = ["Patch panel","Fibre patch panel","Switch","PoE switch","Gateway","Router","Firewall","Server","Storage","NVR","KVM switch","Media converter","Modem / ONT","UPS","Power distribution unit","Cable manager","Shelf","Blank panel","Other"];
const layouts = ["Single row","Odd above even","Even above odd","Custom grid"];
const media = ["Unknown","RJ45","SFP","SFP+","SFP28","QSFP+","QSFP28","LC","SC","MPO","Other"];
const portConditions = ["Unknown","Working","Broken","Disabled"];
const conditionOf = port => port.condition ?? "Unknown";
const unavailable = port => ["Broken","Disabled"].includes(conditionOf(port));
const cableTypes = {
  "Twisted-pair copper": ["Cat 5","Cat 5e","Cat 6","Cat 6A","Cat 7","Cat 7A","Cat 8"],
  "Direct-attach copper": ["DAC","SFP DAC","SFP+ DAC","SFP28 DAC","QSFP+ DAC","QSFP28 DAC"],
  "Active optical cables": ["AOC","SFP+ AOC","SFP28 AOC","QSFP+ AOC","QSFP28 AOC"],
  "Fibre patch leads": ["Fibre","OM1 multimode","OM2 multimode","OM3 multimode","OM4 multimode","OM5 multimode","OS1 single-mode","OS2 single-mode"]
};
const palette = {"Network":"#157d70","Panel A":"#3d85cc","Panel B":"#a378cf","Server":"#be7042","Camera":"#cb4a99"};
const defaultRouting={allowance:0.6,crossing:0.8,stock:[0.5,1,1.5,2,3,5,10]};
function estimateLength(project,board,cable) {
  const {ports}=indexBoard(board),a=ports.get(cable.a)?.d,b=ports.get(cable.b)?.d;
  if(!a||!b||a.u===null||b.u===null)return {message:"Assign a rack unit to both endpoints to estimate the route."};
  const r=project.routing||defaultRouting;
  const height=Math.abs((a.u+(a.size-1)/2)-(b.u+(b.size-1)/2))*0.04445;
  const crossFace=a.side!==b.side;
  const useDepth=board.depthMm!=null && !r.useMeasuredCrossing;
  const crossing=crossFace?(useDepth?board.depthMm/1000:r.crossing):0;
  const route=height+r.allowance+crossing;
  const length=r.stock.find(m=>m+Number.EPSILON*Math.max(1,route)>=route);
  const parts=[height.toFixed(2)+" m vertical",r.allowance+" m routing and slack"];
  if(crossFace)parts.push(crossing+" m "+(useDepth?"cabinet depth":r.useMeasuredCrossing?"measured crossing":"crossing allowance (depth unknown)"));
  return {length,route,crossing,message:parts.join(" + ")+" = "+route.toFixed(2)+" m estimated."+(length?" Stock length "+length+" m.":" Measure the route. It exceeds the longest stock cable.")};
}
function makeProject(name="Untitled rack", height=24, depthMm=null) {
  return {format:"patchbay",version:1,name,legend:{...palette},live:{height,depthMm,devices:[],cables:[]},draft:null,checked:{},source:""};
}
function makeDevice(code,name,kind,side,group,labels,layout="Single row",u=null,size=1,medium="RJ45") {
  return {id:ID(),code,name,kind,side,group,u,size,layout,ports:labels.map(label=>({id:ID(),label:String(label),medium,note:""}))};
}
function makeCable(a,b=null,note="") {
  return {id:ID(),a,b,note,type:"Unspecified",colour:"",length:null,supply:"Reuse",status:"Recorded"};
}
function indexBoard(board) {
  const ports=new Map(), links=new Map();
  for (const d of board.devices) for(const p of d.ports) ports.set(p.id,{d,p});
  for (const c of board.cables) { links.set(c.a,c); if(c.b) links.set(c.b,c); }
  return {ports,links};
}
function endpoint(idx,id) {
  const hit=idx.ports.get(id);
  return hit ? hit.d.code+" / "+hit.p.label : "Loose end";
}
function peer(c,id) { return c.a===id ? c.b : c.a; }
function portRows(d) {
  const fromSheet=d.sourceLayout===d.layout && d.ports.length && d.ports.every(p=>Number.isInteger(p.row)&&p.row>=0&&p.row<64&&Number.isInteger(p.col)&&p.col>=0&&p.col<256);
  if(d.layout==="Custom grid" || fromSheet){
    const rows=d.faceplate?.rows ?? Math.max(1,...d.ports.map(p=>p.row+1));
    const columns=d.faceplate?.columns ?? Math.max(1,...d.ports.map(p=>p.col+1));
    const grid=Array.from({length:rows},()=>Array(columns).fill(null));
    for(const p of d.ports)grid[p.row][p.col]=p;
    return grid;
  }
  if(d.layout==="Single row") return [d.ports.length?d.ports:[null]];
  const odd=d.ports.filter((p,i)=>i%2===0), even=d.ports.filter((p,i)=>i%2===1);
  const width=Math.max(1,odd.length);
  const rows=d.layout==="Even above odd"?[even,odd]:[odd,even];
  return rows.map(row=>row.concat(Array(width-row.length).fill(null)));
}
function setPortGrid(d,grid){
  const ports=new Map(d.ports.map(p=>[p.id,p]));
  grid.forEach((row,r)=>row.forEach((id,c)=>{if(id)Object.assign(ports.get(id),{row:r,col:c})}));
  d.layout="Custom grid";d.faceplate={rows:grid.length,columns:grid[0].length};delete d.sourceLayout;
}
function collision(board,d) {
  if(d.u===null) return "";
  if(d.u<1 || d.u+d.size-1>board.height) return "The device must fit inside the rack.";
  const other=board.devices.find(x=>x.id!==d.id && x.side===d.side && x.u!==null && x.u<d.u+d.size && d.u<x.u+x.size);
  return other ? "That position overlaps "+other.code+" on the "+d.side.toLowerCase()+" face." : "";
}
function validateProject(p) {
  const fail=msg=>{throw new Error(msg)};
  const str=x=>typeof x==="string";
  const ident=x=>str(x) && /^[a-zA-Z0-9_-]{1,100}$/.test(x) && !["__proto__","constructor","prototype"].includes(x);
  if(!p || p.format!=="patchbay" || p.version!==1 || !str(p.name) || !p.name.trim()) fail("Choose a Patchbay version 1 project file.");
  if(!p.legend || Array.isArray(p.legend) || typeof p.legend!=="object" || Object.entries(p.legend).some(([k,v])=>!k.trim()||!/^#[a-f0-9]{6}$/i.test(v))) fail("Invalid colour legend.");
  if(!p.checked || typeof p.checked!=="object" || Array.isArray(p.checked)) fail("Invalid checklist.");
  if(p.routing?.useMeasuredCrossing!==undefined && typeof p.routing.useMeasuredCrossing!=="boolean")fail("Invalid front-to-rear route selection.");
  if(p.routing && (![p.routing.allowance,p.routing.crossing].every(v=>Number.isFinite(v)&&v>=0)||!Array.isArray(p.routing.stock)||!p.routing.stock.length||!p.routing.stock.every((v,i,a)=>Number.isFinite(v)&&v>0&&(i===0||v>a[i-1]))))fail("Invalid cable routing settings.");
  function check(b) {
    if(!b || !Number.isInteger(b.height)||b.height<1||b.height>100||!Array.isArray(b.devices)||!Array.isArray(b.cables)) fail("Invalid rack layout.");
    const ids=new Set(),codes=new Set(),ports=new Set(),used=new Set();
    if(b.depthMm!=null && (!Number.isSafeInteger(b.depthMm)||b.depthMm<1))fail("Enter a positive cabinet depth in whole millimetres.");
    function take(id){if(!ident(id)||ids.has(id))fail("Duplicate or invalid identifier.");ids.add(id)}
    for(const d of b.devices){
      take(d.id);
      if(!str(d.code)||!d.code.trim()||codes.has(d.code.trim().toLowerCase())||!str(d.name)||!str(d.kind)||!d.kind.trim()||d.kind.length>100||!["Front","Rear"].includes(d.side)||!layouts.includes(d.layout)||!str(d.group)||!Number.isInteger(d.size)||d.size<1||d.size>b.height||(d.u!==null&&!Number.isInteger(d.u))||!Array.isArray(d.ports))fail("Invalid device definition.");
      codes.add(d.code.trim().toLowerCase());const labels=new Set();
      for(const q of d.ports){take(q.id);ports.add(q.id);if(!str(q.label)||!q.label.trim()||labels.has(q.label.trim().toLowerCase())||!media.includes(q.medium))fail("Invalid or duplicate port label on "+d.code);labels.add(q.label.trim().toLowerCase());if(!portConditions.includes(conditionOf(q)))fail("Invalid port condition on "+d.code+" / "+q.label);}
      if(d.layout==="Custom grid" || d.faceplate!=null){
        const {rows,columns}=d.faceplate||{};
        if(d.layout!=="Custom grid"||!Number.isInteger(rows)||rows<1||rows>64||!Number.isInteger(columns)||columns<1||columns>256)fail("Invalid faceplate dimensions on "+d.code);
        const slots=new Set();
        for(const q of d.ports){
          const slot=q.row+","+q.col;
          if(!Number.isInteger(q.row)||q.row<0||q.row>=rows||!Number.isInteger(q.col)||q.col<0||q.col>=columns||slots.has(slot))fail("Invalid or shared faceplate slot on "+d.code);
          slots.add(slot);
        }
      }
    }
    for(const d of b.devices){const problem=collision(b,d);if(problem)fail(problem)}
    for(const c of b.cables){
      take(c.id);if(!ports.has(c.a)||(c.b!==null&&!ports.has(c.b))||c.a===c.b||used.has(c.a)||used.has(c.b)||!str(c.note)||!str(c.type)||!str(c.colour)||!["Reuse","Buy"].includes(c.supply)||!str(c.status)||(c.length!==null&&(!Number.isFinite(c.length)||c.length<=0)))fail("Invalid cable or occupied endpoint.");
      used.add(c.a);if(c.b)used.add(c.b);
    }
  }
  check(p.live);if(p.draft!==null)check(p.draft);
  return p;
}
function workItems(project) {
  if(!project.draft)return [];
  const live=project.live, draft=project.draft, before=indexBoard(live), after=indexBoard(draft), items=[];
  function compare(oldList,newList,typ,describe) {
    const oldById=new Map(oldList.map(x=>[x.id,x])), newById=new Map(newList.map(x=>[x.id,x]));
    for(const id of new Set([...oldById.keys(),...newById.keys()])){
      const old=oldById.get(id), next=newById.get(id);
      if(JSON.stringify(old)===JSON.stringify(next))continue;
      const a=old?describe(old,before,next):"", b=next?describe(next,after,old):"";
      items.push({key:typ+"-"+id+"-"+JSON.stringify([old??null,next??null]),type:typ,title:(!old?"Add ":!next?"Remove ":"Update ")+typ.toLowerCase(),from:a,to:b});
    }
  }
  compare(live.devices,draft.devices,"Device",(d,idx,other)=>{
    const details=[d.code,d.name,d.side,d.u===null?"Unplaced":"U"+d.u,d.size+"U",d.ports.length+" ports"];
    if(other){
      for(const field of ["kind","group","layout"])if(d[field]!==other[field])details.push(d[field]);
      if(JSON.stringify(d.faceplate)!==JSON.stringify(other.faceplate))details.push(portRows(d).length+" rows × "+portRows(d)[0].length+" columns");
      const previous=new Map(other.ports.map(p=>[p.id,p]));
      for(const p of d.ports){
        const pair=previous.get(p.id);
        if(pair && conditionOf(p)!==conditionOf(pair))details.push("Port "+p.label+" · "+conditionOf(p));
        if(pair && Number.isInteger(p.row) && (p.row!==pair.row||p.col!==pair.col))details.push(p.label+" at row "+(p.row+1)+", column "+(p.col+1));
        if(!pair||p.label!==pair.label||p.medium!==pair.medium||p.note!==pair.note)details.push([p.label,p.medium,p.note].filter(Boolean).join(" / "));
      }
    }
    return details.join(" · ");
  });
  compare(live.cables,draft.cables,"Cable",(c,idx)=>[endpoint(idx,c.a)+" ↔ "+(c.b?endpoint(idx,c.b):c.note||"Loose end"),c.type,c.colour,c.length?c.length+" m":"",c.supply,c.status,c.b?c.note:""].filter(Boolean).join(" · "));
  if(live.height!==draft.height)items.unshift({key:"height-"+live.height+"-"+draft.height,title:"Resize rack",type:"Rack",from:live.height+"U",to:draft.height+"U"});
  if((live.depthMm??null)!==(draft.depthMm??null))items.unshift({key:"depth-"+(live.depthMm??"unknown")+"-"+(draft.depthMm??"unknown"),title:"Change cabinet depth",type:"Rack",from:live.depthMm?live.depthMm+" mm":"Unknown",to:draft.depthMm?draft.depthMm+" mm":"Unknown"});
  return items;
}
function demoProject(){
  const p=makeProject("Studio rack",12), b=p.live;
  const seq=(n,prefix="")=>Array.from({length:n},(_,i)=>prefix+(i+1));
  const devices=[
    makeDevice("GW1","Edge gateway","Gateway","Front","Network",seq(8),"Single row",12),
    makeDevice("PP1","Office outlets","Patch panel","Front","Panel A",seq(24,"A"),"Single row",11),
    makeDevice("SW1","Access switch","Switch","Front","Network",seq(24),"Odd above even",10),
    makeDevice("PP2","Studio outlets","Patch panel","Front","Panel B",seq(24,"B"),"Single row",9),
    makeDevice("SRV1","Application server","Server","Front","Server",["LAN 1","LAN 2","MGMT"],"Single row",5,2),
    makeDevice("NAS1","Backup storage","Storage","Rear","Server",["LAN 1","LAN 2"],"Single row",2,2),
    makeDevice("CAM1","Camera switch","Switch","Rear","Camera",seq(8),"Odd above even",8)
  ];b.devices=devices;
  const [gw,pa,sw,pb,srv,nas,cam]=devices;
  function wire(x,i,y,j){const c=makeCable(x.ports[i].id,y.ports[j].id);c.type="Cat 6";c.colour="Grey";c.length=1;b.cables.push(c)}
  wire(gw,0,sw,23);for(let i=0;i<8;i++)wire(pa,i,sw,i);for(let i=0;i<5;i++)wire(pb,i,sw,i+8);
  wire(sw,15,srv,0);wire(sw,17,nas,0);wire(sw,19,cam,7);return p;
}
