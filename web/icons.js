"use strict";
const glyphs={
 rack:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16m-12 3h.01M8 12h.01M8 6h.01"/>',
 cable:'<path d="M7 3v4m4-4v4M5 7h8v3a4 4 0 0 1-8 0zm4 7v3a3 3 0 0 0 6 0v-3m-2 0h6v-3h-6z"/>',
 plan:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 4V2m8 2V2M7 10l1.3 1.3L11 8m2 2h4m-10 6 1.3 1.3L11 14m2 2h4"/>',
 box:'<path d="m3 7 9-5 9 5v10l-9 5-9-5zm0 0 9 5 9-5m-9 5v10M7 5l10 5"/>',
 folder:'<path d="M3 7V5h7l2 2h8v3M3 9h19l-3 11H3z"/>',
 save:'<path d="M4 3h13l4 4v14H3V3zm3 0v6h9V3M7 21v-8h10v8"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 edit:'<path d="m4 16-1 5 5-1L20 8l-4-4zm10-10 4 4"/>', flip:'<path d="M3 7h15l-4-4m7 14H6l4 4"/>',
 layers:'<path d="m3 8 9-5 9 5-9 5zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
 switch:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 11h2v3H6zm5 0h2v3h-2zm6 0h1"/>',
 panel:'<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M5 10v4m4-4v4m5-4v4m4-4v4"/>',
 gateway:'<rect x="3" y="11" width="18" height="8" rx="2"/><path d="M7 11V5m10 6V5m-5 10h5"/>',
 server:'<rect x="4" y="3" width="16" height="8" rx="1"/><rect x="4" y="13" width="16" height="8" rx="1"/><path d="M7 7h1m-1 10h1m4-10h5m-5 10h5"/>',
 storage:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 check:'<path d="m4 12 5 5L20 6"/>',chev:'<path d="m9 5 7 7-7 7"/>',down:'<path d="m6 9 6 6 6-6"/>',
 arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>', undo:'<path d="M9 4 3 10l6 6m-6-6h10c5 0 8 4 8 9"/>',
 redo:'<path d="m15 4 6 6-6 6m6-6H11c-5 0-8 4-8 9"/>',key:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h1m3 0h1m3 0h1m3 0h1M7 14h10"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', settings:'<path d="M3 7h5m4 0h9M3 17h11m4 0h3"/><circle cx="10" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',link:'<path d="m9 15 6-6m-4-2 2-2a5 5 0 0 1 7 7l-2 2m-5 3-2 2a5 5 0 0 1-7-7l2-2"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',x:'<path d="m5 5 14 14M19 5 5 19"/>',
 trash:'<path d="M3 6h18m-15 0 1 15h10l1-15M9 6V3h6v3"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 label:'<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',print:'<path d="M6 8V3h12v5M5 17H3V8h18v9h-2M6 14h12v7H6z"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 file:'<path d="M5 3h10l4 4v14H5zM14 3v6h5"/>', swatch:'<circle cx="8" cy="9" r="5"/><circle cx="16" cy="9" r="5"/><circle cx="12" cy="16" r="5"/>'
};
function icon(n,s=18){return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(glyphs[n]||glyphs.box)+'</svg>'}
function kindIcon(k){
  const icons={"Patch panel":"panel","Fibre patch panel":"panel","Switch":"switch","PoE switch":"switch","KVM switch":"switch","Gateway":"gateway","Router":"gateway","Firewall":"gateway","Server":"server","Storage":"storage","NVR":"storage","UPS":"box"};
  return Object.hasOwn(icons,k)?icons[k]:"box";
}
