"use strict";
// Import the illustrated ServerSchrank sheet. Other project layouts use the native editor.
async function importWorkbook(bytes, fileName) {
  const zip=await JSZip.loadAsync(bytes);
  const xml=async path=>{
    const f=zip.file(path); if(!f)return null;
    const doc=new DOMParser().parseFromString(await f.async("string"),"application/xml");
    if(doc.getElementsByTagName("parsererror").length)throw new Error("The Excel XML could not be read.");
    return doc;
  };
  const all=(node,tag)=>node ? Array.from(node.getElementsByTagNameNS("*",tag)) : [];
  const book=await xml("xl/workbook.xml"), rel=await xml("xl/_rels/workbook.xml.rels");
  const sheet=all(book,"sheet").find(s=>s.getAttribute("name").toLowerCase()==="server-schrank")||all(book,"sheet")[0];
  if(!sheet)throw new Error("The workbook has no worksheets.");
  const rid=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
  const target=all(rel,"Relationship").find(r=>r.getAttribute("Id")===rid)?.getAttribute("Target");
  const sheetPath=target?.startsWith("/")?target.slice(1):"xl/"+target;
  const [doc,strings,styles,theme]=await Promise.all([xml(sheetPath),xml("xl/sharedStrings.xml"),xml("xl/styles.xml"),xml("xl/theme/theme1.xml")]);
  if(!doc)throw new Error("The worksheet data could not be found.");
  const shared=all(strings,"si").map(n=>all(n,"t").map(t=>t.textContent).join(""));
  const fills=all(all(styles,"fills")[0],"fill"), xfs=all(all(styles,"cellXfs")[0],"xf");
  const scheme=all(theme,"clrScheme")[0], themeKeys=["lt1","dk1","lt2","dk2","accent1","accent2","accent3","accent4","accent5","accent6","hlink","folHlink"];
  const colors=fills.map(f=>{
    const n=all(f,"fgColor")[0]; if(!n) return "";
    let raw=n.getAttribute("rgb");
    if(!raw && n.hasAttribute("theme")){
      const elem=all(scheme,themeKeys[Number(n.getAttribute("theme"))])[0]?.firstElementChild;
      raw=elem?.getAttribute("lastClr")||elem?.getAttribute("val");
    }
    if(!raw||!/[0-9a-f]{6}$/i.test(raw))return "";
    const tint=Number(n.getAttribute("tint")||0);
    const channels=raw.slice(-6).match(/../g).map(x=>parseInt(x,16));
    return "#"+channels.map(x=>Math.round(tint<0?x*(1+tint):x+(255-x)*tint).toString(16).padStart(2,"0")).join("");
  });
  const cells=new Map();let maxRow=0, maxCol=0;
  for(const n of all(doc,"c")){
    const m=/^([A-Z]+)(\d+)$/.exec(n.getAttribute("r")||"");if(!m)continue;
    const col=[...m[1]].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0),row=Number(m[2]);
    const v=all(n,"v")[0]?.textContent??"", t=n.getAttribute("t");
    const value=t==="s"?shared[Number(v)]:t==="inlineStr"?all(n,"t").map(t=>t.textContent).join(""):v;
    const fill=colors[Number(xfs[Number(n.getAttribute("s")||0)]?.getAttribute("fillId")||0)]||"";
    cells.set(row+","+col,{value:String(value??""),fill,ref:n.getAttribute("r"),type:t});
    if(value){maxRow=Math.max(maxRow,row);maxCol=Math.max(maxCol,col)}
  }
  const cell=(r,c)=>cells.get(r+","+c)||{value:"",fill:"",ref:""};
  const project=makeProject(fileName.replace(/\.xlsx$/i,"")),board=project.live;
  project.source=fileName;project.legend={Network:"#157d70",Ungrouped:"#879b99"};
  let legendCol=maxCol+1;
  for(const [key,val] of cells)if(val.value.trim().toLowerCase()==="legends"){
    const [row,col]=key.split(",").map(Number);legendCol=col;
    for(let r=row+1;r<=maxRow;r++){
      const title=cell(r,col+1).value.trim();if(!title)break;
      project.legend[title]=cell(r,col).fill||"#aab6b4";
    }break;
  }
  const headers=[];
  for(let r=1;r<=maxRow;r++){const code=cell(r,2).value.trim().toUpperCase();if(/^[SPC]\d+$/.test(code))headers.push({row:r,code})}
  if(!headers.length)throw new Error("This importer expects the ServerSchrank layout with S, P and C device sections in column B. Use New project for a different rack.");
  const byRef=new Map(), info=new Map();
  const norm=s=>s.trim().replace(/[ıİ]/g,"I").toUpperCase().replace(/^SFP[+]?\s*[\/\s]+/,"").replace(/\s/g,"");
  for(const [i,h] of headers.entries()){
    const panel=h.code.startsWith("P"), cam=h.code.startsWith("C"), gateway=h.code==="S0";
    const name=gateway?cell(h.row-1,2).value:cell(h.row,3).value;
    const group=panel?name:cam?"Camera Switchleri":"Network";
    if(!Object.hasOwn(project.legend,group))project.legend[group]="#879b99";
    const d=makeDevice(h.code,name||h.code,panel?"Patch panel":gateway?"Gateway":"Switch",cam||/^P[789]$/.test(h.code)?"Rear":"Front",group,[],panel?"Single row":cam?"Even above odd":"Odd above even");
    const first=gateway?h.row:h.row+1;
    for(const [bank,r] of (panel?[first]:[first,first+3]).entries()){
      for(let col=3;col<Math.min(legendCol,maxCol+1);col++){
        const label=cell(r,col).value.trim();if(!(panel?/^[A-Zıİ]\d+$/i:/^\d+$/).test(label))continue;
        const origin=cell(r+2,col), box=cell(r+1,col),pt={id:ID(),label,medium:/^SFP[\/\s]/i.test(origin.value)?"SFP":"Unknown",note:"",row:bank,col:col-3};
        if(origin.value||origin.fill||box.type==="b")pt.source={text:origin.value,fill:origin.fill,cell:origin.ref,checkbox:box.type==="b"?box.value==="1":null};
        d.ports.push(pt);byRef.set(norm(h.code+"-"+label),pt);info.set(pt.id,{pt,d,origin});
      }
    }
    if(!d.ports.length)throw new Error("No port labels found for "+h.code+".");
    d.sourceLayout=d.layout; d.ports.sort((a,b)=>a.label.localeCompare(b.label,"en",{numeric:true}));board.devices.push(d);
  }
  const claims=new Map(), occupied=new Set();
  for(const [id,{origin}] of info){const dst=byRef.get(norm(origin.value));if(dst)claims.set(id,dst.id)}
  function add(a,b,note,status){
    const c=makeCable(a,b,note);c.status=status;board.cables.push(c);occupied.add(a);if(b)occupied.add(b);
  }
  for(const [a,b] of claims)if(a!==b&&claims.get(b)===a&&!occupied.has(a)&&!occupied.has(b))add(a,b,"","Matched entries");
  const incoming=new Map();for(const b of claims.values())incoming.set(b,(incoming.get(b)||0)+1);
  for(const [a,b] of claims){
    if(occupied.has(a))continue;
    const dest=info.get(b);
    if(a!==b&&!occupied.has(b)&&!dest.origin.value.trim()&&!dest.origin.fill&&incoming.get(b)===1)add(a,b,"","Single entry");
  }
  for(const [a,{origin,pt}] of info){
    if(occupied.has(a))continue;
    if(origin.value.trim()||origin.fill){
      const status=origin.fill===project.legend.Pending?"Pending":"Check on site";
      add(a,null,origin.value.trim()||Object.entries(project.legend).find(([,v])=>v===origin.fill)?.[0]||"Coloured cell",status);
    }
  }
  return validateProject(project);
}
