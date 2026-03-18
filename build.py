import io, sys, subprocess, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SRC = 'c:/Users/Roman Averin/Downloads/buff-marketplace.jsx'
OUT_HTML = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/buff-marketplace.html'
OUT_JSX  = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/app.jsx'
OUT_JS   = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/app.js'

with open(SRC, 'r', encoding='utf-8') as f:
    jsx = f.read()

jsx = jsx.replace('import { useState, useMemo } from "react";\n', '')
jsx = jsx.replace('discountPct:15,demandLevel:"Medium" };', 'discountPct:0,demandLevel:"Medium" };')
jsx = jsx.replace('export default function App', 'function App')

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 1 — Scale up shared UI components
# ══════════════════════════════════════════════════════════════════════════════

# Btn — bigger padding and font
jsx = jsx.replace(
    'primary: { background:G,         color:"#0a0a0a", padding:small?"6px 14px":"9px 18px", fontSize:small?11:12 },\n'
    '    ghost:   { background:"#1a1a1a", color:"#888",    padding:small?"6px 14px":"9px 18px", fontSize:small?11:12, border:"1px solid #2a2a2a" },\n'
    '    danger:  { background:"#dc2626", color:"#fff",    padding:small?"6px 14px":"9px 18px", fontSize:small?11:12 },\n'
    '    success: { background:"#16a34a", color:"#fff",    padding:small?"6px 14px":"9px 18px", fontSize:small?11:12 },',
    'primary: { background:G,         color:"#0a0a0a", padding:small?"7px 16px":"10px 22px", fontSize:small?12:13 },\n'
    '    ghost:   { background:"#1a1a1a", color:"#888",    padding:small?"7px 16px":"10px 22px", fontSize:small?12:13, border:"1px solid #2a2a2a" },\n'
    '    danger:  { background:"#dc2626", color:"#fff",    padding:small?"7px 16px":"10px 22px", fontSize:small?12:13 },\n'
    '    success: { background:"#16a34a", color:"#fff",    padding:small?"7px 16px":"10px 22px", fontSize:small?12:13 },'
)

# Field label — bigger
jsx = jsx.replace(
    '<label style={{display:"block",fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>{label}</label>',
    '<label style={{display:"block",fontSize:11,fontWeight:700,color:"#555",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</label>'
)

# StatCard — bigger value, more padding
jsx = jsx.replace(
    '<div style={{background:accent?"rgba(200,255,0,0.04)":"#0d0d0d",border:`1px solid ${accent?"rgba(200,255,0,0.15)":"#1a1a1a"}`,borderRadius:12,padding:"18px 20px"}}>',
    '<div style={{background:accent?"rgba(200,255,0,0.04)":"#0d0d0d",border:`1px solid ${accent?"rgba(200,255,0,0.15)":"#1a1a1a"}`,borderRadius:14,padding:"22px 26px"}}>'
)
jsx = jsx.replace(
    '<div style={{fontSize:10,color:"#555",fontWeight:700,marginBottom:8,letterSpacing:"0.07em",textTransform:"uppercase"}}>{label}</div>\n'
    '      <div style={{fontSize:22,fontWeight:900,color,letterSpacing:"-0.04em",lineHeight:1}}>{value}</div>\n'
    '      {sub && <div style={{fontSize:11,color:"#444",marginTop:6}}>{sub}</div>}',
    '<div style={{fontSize:10,color:"#555",fontWeight:700,marginBottom:10,letterSpacing:"0.07em",textTransform:"uppercase"}}>{label}</div>\n'
    '      <div style={{fontSize:28,fontWeight:900,color,letterSpacing:"-0.04em",lineHeight:1}}>{value}</div>\n'
    '      {sub && <div style={{fontSize:12,color:"#444",marginTop:8}}>{sub}</div>}'
)

# inputStyle — slightly larger font
jsx = jsx.replace(
    'color:"#f1f5f9", fontSize:13, padding:"8px 12px"',
    'color:"#f1f5f9", fontSize:14, padding:"9px 13px"'
)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 2 — OverviewTab: bigger TH, more row padding, planned/real headers
# ══════════════════════════════════════════════════════════════════════════════

# TH in OverviewTab — update to support color param + bigger
jsx = jsx.replace(
    '  const TH = s => <th style={{textAlign:"left",padding:"10px 16px",color:"#444",fontWeight:700,fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;\n\n  return (\n    <div>\n      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"',
    '  const TH  = (s,c="#444") => <th style={{textAlign:"left",padding:"13px 20px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;\n  const THp = s => TH(s,"#555");\n  const THr = s => TH(s,G);\n\n  return (\n    <div>\n      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"'
)

# Overview page padding
jsx = jsx.replace(
    '      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24}}>',
    '      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:28}}>'
)

# Overview country table — add grouped PLANNED / REAL superheader + color TH calls
old_ov_country_thead = (
    '        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>\n'
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{["Country","Products","Planned daily","Real daily","Planned monthly","Real monthly","Utilization","Share (real)"].map(TH)}'
    '</tr></thead>'
)
new_ov_country_thead = (
    '        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>\n'
    '          <thead>\n'
    '            <tr>\n'
    '              <th colSpan={2} style={{borderBottom:"1px solid #111",padding:"4px 0"}}/>\n'
    '              <th colSpan={2} style={{padding:"4px 20px",fontSize:9,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"center",borderBottom:"1px solid #111",borderLeft:"1px solid #111",borderRight:"1px solid #111"}}>PLANNED</th>\n'
    '              <th colSpan={2} style={{padding:"4px 20px",fontSize:9,fontWeight:700,color:G,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"center",borderBottom:"1px solid #111",borderLeft:"1px solid #111",borderRight:"1px solid #111"}}>REAL</th>\n'
    '              <th colSpan={2} style={{borderBottom:"1px solid #111",padding:"4px 0"}}/>\n'
    '            </tr>\n'
    '            <tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{[TH("Country"),TH("Products"),THp("Daily"),THr("Daily"),THp("Monthly"),THr("Monthly"),TH("Utilization"),THr("Share")]}'
    '</tr>\n'
    '          </thead>'
)
jsx = jsx.replace(old_ov_country_thead, new_ov_country_thead)

# Overview country table rows — more padding
jsx = jsx.replace(
    '<td style={{padding:"11px 16px",fontWeight:800,color:r.count>0?"#f1f5f9":"#2a2a2a",fontSize:13}}>{r.country}</td>',
    '<td style={{padding:"14px 20px",fontWeight:800,color:r.count>0?"#f1f5f9":"#2a2a2a",fontSize:14}}>{r.country}</td>'
)
jsx = jsx.replace(
    '<td style={{padding:"11px 16px",color:r.count>0?"#555":"#1a1a1a"}}>{r.count||"—"}</td>',
    '<td style={{padding:"14px 20px",color:r.count>0?"#555":"#1a1a1a"}}>{r.count||"—"}</td>'
)

# Overview country table footer
jsx = jsx.replace(
    '<td colSpan={2} style={{padding:"12px 16px",fontWeight:800,color:"#f1f5f9",fontSize:13}}>Total</td>',
    '<td colSpan={2} style={{padding:"14px 20px",fontWeight:800,color:"#f1f5f9",fontSize:14}}>Total</td>'
)

# Overview brand table — add PLANNED/REAL colored headers
old_ov_brand_thead = (
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{["Brand","Countries","Planned monthly","Real monthly","Utilization"].map(TH)}'
    '</tr></thead>'
)
new_ov_brand_thead = (
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{[TH("Brand"),TH("Countries"),THp("Planned Monthly"),THr("Real Monthly"),TH("Utilization")]}'
    '</tr></thead>'
)
jsx = jsx.replace(old_ov_brand_thead, new_ov_brand_thead)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 3 — ProductsTab: labeled filters, bigger table
# ══════════════════════════════════════════════════════════════════════════════

# Products TH — bigger
jsx = jsx.replace(
    '  const TH = s => <th style={{textAlign:"left",padding:"10px 12px",color:"#444",fontWeight:700,fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;\n\n  return (\n    <div>',
    '  const TH  = (s,c="#444") => <th style={{textAlign:"left",padding:"13px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;\n\n  return (\n    <div>'
)

# Products filter bar — labeled selects
old_prod_filters = (
    '      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>\n'
    '        <Select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...inputStyle,width:140}}>\n'
    '          {["All",...CATEGORIES].map(c=><option key={c}>{c}</option>)}\n'
    '        </Select>\n'
    '        <Select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} style={{...inputStyle,width:140}}>\n'
    '          {brands.map(b=><option key={b}>{b}</option>)}\n'
    '        </Select>\n'
    '        <Select value={filterDemand} onChange={e=>setFilterDemand(e.target.value)} style={{...inputStyle,width:140}}>\n'
    '          {["All",...DEMAND_LEVELS].map(d=><option key={d}>{d}</option>)}\n'
    '        </Select>\n'
    '        <div style={{flex:1}}/>\n'
    '        <Btn variant="primary" onClick={()=>setModal("add")}><Icon.plus/> Add product</Btn>\n'
    '      </div>'
)
new_prod_filters = (
    '      <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap",alignItems:"flex-end",'
    'padding:"16px 20px",background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12}}>\n'
    '        <div style={{fontSize:10,fontWeight:800,color:"#333",letterSpacing:"0.08em",'
    'textTransform:"uppercase",alignSelf:"center",marginRight:8}}>Filters</div>\n'
    '        <div>\n'
    '          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Category</div>\n'
    '          <Select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...inputStyle,width:150}}>\n'
    '            {["All",...CATEGORIES].map(c=><option key={c}>{c}</option>)}\n'
    '          </Select>\n'
    '        </div>\n'
    '        <div>\n'
    '          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Brand</div>\n'
    '          <Select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} style={{...inputStyle,width:150}}>\n'
    '            {brands.map(b=><option key={b}>{b}</option>)}\n'
    '          </Select>\n'
    '        </div>\n'
    '        <div>\n'
    '          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Demand Level</div>\n'
    '          <Select value={filterDemand} onChange={e=>setFilterDemand(e.target.value)} style={{...inputStyle,width:150}}>\n'
    '            {["All",...DEMAND_LEVELS].map(d=><option key={d}>{d}</option>)}\n'
    '          </Select>\n'
    '        </div>\n'
    '        <div style={{flex:1}}/>\n'
    '        <Btn variant="primary" onClick={()=>setModal("add")}><Icon.plus/> Add Product</Btn>\n'
    '      </div>'
)
jsx = jsx.replace(old_prod_filters, new_prod_filters)

# Products table: section header + cleaner column names
old_prod_table_start = (
    '      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>\n'
    '        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>\n'
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{["Brand","Category","Price","USD","Provider","Type","Demand","BP Reg.","BP Prem.","Disc.","After disc.",""].map(TH)}'
    '</tr></thead>'
)
new_prod_table_start = (
    '      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>\n'
    '        <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>\n'
    '          <span style={{fontSize:14,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em"}}>Product Catalogue</span>\n'
    '          <span style={{fontSize:12,color:"#444"}}>{filtered.length} product{filtered.length!==1?"s":""} shown</span>\n'
    '        </div>\n'
    '        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>\n'
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{[TH("Brand"),TH("Category"),TH("Local Price"),TH("USD Price"),TH("Provider"),TH("Type"),TH("Demand"),TH("BP Regular"),TH("BP Premium"),TH("Disc."),TH("After Disc."),TH("")]}'
    '</tr></thead>'
)
jsx = jsx.replace(old_prod_table_start, new_prod_table_start)

# Products table cell padding
jsx = jsx.replace(
    '<td style={{padding:"10px 12px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}</td>',
    '<td style={{padding:"14px 16px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}</td>'
)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 4 — CountriesTab: bigger TH, planned/real headers, more padding
# ══════════════════════════════════════════════════════════════════════════════

# Countries TH — update to support color param + bigger
jsx = jsx.replace(
    '  const TH  = s => <th style={{textAlign:"left",padding:"10px 16px",color:"#444",fontWeight:700,fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;',
    '  const TH  = (s,c="#444") => <th style={{textAlign:"left",padding:"13px 20px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;\n'
    '  const THp = s => TH(s,"#555");\n'
    '  const THr = s => TH(s,G);'
)

# Countries detail table — planned/real grouped headers
old_countries_detail_thead = (
    '                  <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{["Brand","Demand","Pulses/day","Qty/pulse","Daily qty","Interval","Utilization","Planned daily","Real daily","Planned monthly","Real monthly"].map(TH)}'
    '</tr></thead>'
)
new_countries_detail_thead = (
    '                  <thead>\n'
    '                    <tr>\n'
    '                      <th colSpan={7} style={{borderBottom:"1px solid #111",padding:"4px 0"}}/>\n'
    '                      <th colSpan={2} style={{padding:"4px 20px",fontSize:9,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"center",borderBottom:"1px solid #111",borderLeft:"1px solid #111",borderRight:"1px solid #111"}}>PLANNED</th>\n'
    '                      <th colSpan={2} style={{padding:"4px 20px",fontSize:9,fontWeight:700,color:G,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"center",borderBottom:"1px solid #111",borderLeft:"1px solid #111"}}>REAL</th>\n'
    '                    </tr>\n'
    '                    <tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{[TH("Brand"),TH("Demand"),TH("Pulses/day"),TH("Qty/pulse"),TH("Daily Qty"),TH("Interval"),TH("Utilization"),THp("Daily"),THr("Daily"),THp("Monthly"),THr("Monthly")]}'
    '</tr>\n'
    '                  </thead>'
)
jsx = jsx.replace(old_countries_detail_thead, new_countries_detail_thead)

# Countries sidebar — more context text
jsx = jsx.replace(
    '        <div style={{padding:"12px 14px",borderBottom:"1px solid #1a1a1a",fontSize:10,fontWeight:700,color:"#444",letterSpacing:"0.07em",textTransform:"uppercase"}}>Countries</div>',
    '        <div style={{padding:"14px 16px",borderBottom:"1px solid #1a1a1a"}}>\n'
    '          <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:2}}>Countries</div>\n'
    '          <div style={{fontSize:11,color:"#333"}}>Select to view / edit</div>\n'
    '        </div>'
)

# Countries detail header
jsx = jsx.replace(
    '              <div>\n'
    '                <span style={{fontSize:16,fontWeight:900,color:"#f1f5f9"}}>{sel.country}</span>\n'
    '                <span style={{fontSize:12,color:"#444",marginLeft:10}}>{sel.rows.length} product{sel.rows.length!==1?"s":""}</span>\n'
    '              </div>\n'
    '              <Btn variant="primary" small onClick={()=>setModal(true)}><Icon.edit/> Edit</Btn>',
    '              <div>\n'
    '                <div style={{fontSize:10,fontWeight:700,color:"#555",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>Country Allocation</div>\n'
    '                <span style={{fontSize:18,fontWeight:900,color:"#f1f5f9"}}>{sel.country}</span>\n'
    '                <span style={{fontSize:13,color:"#444",marginLeft:12}}>{sel.rows.length} product{sel.rows.length!==1?"s":""} allocated</span>\n'
    '              </div>\n'
    '              <Btn variant="primary" small onClick={()=>setModal(true)}><Icon.edit/> Edit Allocations</Btn>'
)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 5 — AllocationForm: bigger TH + planned/real headers
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '  const TH = s => <th style={{textAlign:"left",padding:"8px 10px",color:"#444",fontWeight:700,fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;',
    '  const TH  = (s,c="#444") => <th style={{textAlign:"left",padding:"11px 14px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;\n'
    '  const THp = s => TH(s,"#555");\n'
    '  const THr = s => TH(s,G);'
)
jsx = jsx.replace(
    '            <thead><tr>{["Product","Demand","Pulses/day","Qty/pulse","Daily qty","Utilization","Planned daily","Real daily"].map(TH)}<th style={{borderBottom:"1px solid #1a1a1a",width:36}}/></tr></thead>',
    '            <thead><tr>{[TH("Product"),TH("Demand"),TH("Pulses/day"),TH("Qty/pulse"),TH("Daily Qty"),TH("Utilization"),THp("Planned Daily"),THr("Real Daily")]}<th style={{borderBottom:"1px solid #1a1a1a",width:36}}/></tr></thead>'
)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 6 — App logo + nav tabs + page padding
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '<div style={{marginRight:36,padding:"16px 0"}}>\n'
    '          <div style={{fontSize:15,fontWeight:900,letterSpacing:"-0.03em"}}>\n'
    '            <span style={{color:G}}>BUFF</span><span style={{color:"#333",margin:"0 5px"}}>✦</span><span style={{color:"#f1f5f9"}}>Marketplace</span>\n'
    '          </div>\n'
    '          <div style={{fontSize:9,color:"#333",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:1}}>Planning Platform</div>\n'
    '        </div>',
    '<div style={{marginRight:48,padding:"10px 0"}}>\n'
    '          <div style={{fontSize:26,fontWeight:900,letterSpacing:"-0.05em",lineHeight:1}}>\n'
    '            <span style={{color:G}}>BUFF</span>'
    '<span style={{color:"#2a2a2a",margin:"0 10px",fontWeight:400}}>✦</span>'
    '<span style={{color:"#f1f5f9"}}>Marketplace</span>\n'
    '          </div>\n'
    '          <div style={{fontSize:10,color:"#555",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginTop:6}}>Planning Platform</div>\n'
    '        </div>'
)

# Nav tab — bigger font + padding
jsx = jsx.replace(
    'padding:"18px 16px",fontSize:12,fontWeight:tab===t.id?800:500,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,borderBottom:tab===t.id?`2px solid ${G}`:"2px solid transparent",transition:"all 0.15s",marginBottom:"-1px"',
    'padding:"20px 18px",fontSize:13,fontWeight:tab===t.id?800:500,fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,borderBottom:tab===t.id?`2px solid ${G}`:"2px solid transparent",transition:"all 0.15s",marginBottom:"-1px"'
)

# Page content padding
jsx = jsx.replace(
    '      <div style={{padding:28}}>',
    '      <div style={{padding:36}}>'
)

# ══════════════════════════════════════════════════════════════════════════════
# STRUCTURE 1 — Remove allocate icon (not needed), add Allocate tab icon
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '  close:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,',
    '  close:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,\n'
    '  allocate:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,'
)

# ══════════════════════════════════════════════════════════════════════════════
# STRUCTURE 2 — App: update tabs + renders (no floating button)
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '  const TABS = [\n'
    '    { id:"overview",  label:"Overview",  Icon:Icon.overview  },\n'
    '    { id:"products",  label:"Products",  Icon:Icon.products  },\n'
    '    { id:"countries", label:"Countries", Icon:Icon.countries },\n'
    '  ];',
    '  const TABS = [\n'
    '    { id:"overview",  label:"Overview",  Icon:Icon.overview  },\n'
    '    { id:"products",  label:"Products",  Icon:Icon.products  },\n'
    '    { id:"countries", label:"Countries", Icon:Icon.countries },\n'
    '    { id:"allocate",  label:"Allocate",  Icon:Icon.allocate  },\n'
    '  ];'
)

jsx = jsx.replace(
    '        {tab==="overview"  && <OverviewTab  products={products} allocs={allocs}/>}\n'
    '        {tab==="products"  && <ProductsTab  products={products} setProducts={setProducts}/>}\n'
    '        {tab==="countries" && <CountriesTab products={products} allocs={allocs} setAllocs={setAllocs}/>}',
    '        {tab==="overview"  && <OverviewTab  products={products} allocs={allocs}/>}\n'
    '        {tab==="products"  && <ProductsTab  products={products} setProducts={setProducts}/>}\n'
    '        {tab==="countries" && <CountriesTab products={products} allocs={allocs} setAllocs={setAllocs}/>}\n'
    '        {tab==="allocate"  && <AllocateTab  products={products} allocs={allocs} setProducts={setProducts} setAllocs={setAllocs}/>}'
)

# ══════════════════════════════════════════════════════════════════════════════
# INJECT — StepIndicator + AllocateTab before App
# ══════════════════════════════════════════════════════════════════════════════

NEW_COMPONENTS = r"""
// ── STEP INDICATOR ────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ["Product Details", "Pulse Config", "Country Allocation"];
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", marginBottom:36 }}>
      {steps.map((label, i) => {
        const n = i + 1, done = n < step, active = n === step;
        return (
          <React.Fragment key={n}>
            {i > 0 && (
              <div style={{ flex:1, height:2, background:done?G:"#1a1a1a", margin:"13px 8px 0", minWidth:48 }}/>
            )}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, minWidth:90 }}>
              <div style={{
                width:30, height:30, borderRadius:"50%",
                background:    done ? G        : "transparent",
                border:        `2px solid ${done||active ? G : "#2a2a2a"}`,
                color:         done ? "#0a0a0a" : active ? G : "#333",
                fontWeight:900, fontSize:13,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>{done ? "✓" : n}</div>
              <div style={{
                fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em",
                textAlign:"center", lineHeight:1.3,
                color: active ? G : done ? "#888" : "#333",
              }}>{label}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── ALLOCATE TAB (full-page 3-step wizard) ────────────────────────────────────

function AllocateTab({ products, allocs, setProducts, setAllocs }) {
  const BLANK = {
    brand:"", category:"Gaming", priceToBuffLocal:"", currency:"USD",
    provider:"GCOW", type:"Regular", bpRegular:"", bpPremium:"",
    discountPct:0, demandLevel:"Medium",
  };
  const [step,      setStep]      = useState(1);
  const [submitted, setSubmitted] = useState(null); // null | { brand, countries }

  // Step 1
  const [f, setF]   = useState(BLANK);
  const set = (k,v) => setF(p => ({ ...p, [k]: v }));

  // Step 2
  const [pulses,   setPulses]   = useState(2);
  const [qtyPulse, setQtyPulse] = useState(5);

  // Step 3
  const [selected,  setSelected]  = useState([]);
  const [cSettings, setCSettings] = useState({});

  // ── Derived ────────────────────────────────────────────────────────────────
  const priceUSD  = (parseFloat(f.priceToBuffLocal)||0) * (FX[f.currency]||1);
  const dailyQty  = pulses * qtyPulse;
  const intervalH = pulses > 0 ? (24/pulses).toFixed(1) : "—";
  const util      = calcUtilization(f.demandLevel, pulses);
  const utilColor = util >= 0.70 ? G : util >= 0.50 ? "#fb923c" : "#f87171";
  const plannedD  = priceUSD * dailyQty;
  const realD     = plannedD * util;
  const realM     = realD * 30.5;
  const { reg, prem } = calcPricesAfterDiscount({
    ...f,
    bpRegular:   parseFloat(f.bpRegular)   || null,
    bpPremium:   parseFloat(f.bpPremium)   || null,
    discountPct: parseFloat(f.discountPct) || 0,
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  const step1Valid = f.brand.trim() && parseFloat(f.priceToBuffLocal) > 0 && parseFloat(f.bpRegular) > 0;

  // ── Country helpers ────────────────────────────────────────────────────────
  function toggleCountry(c) {
    if (selected.includes(c)) {
      setSelected(s => s.filter(x => x !== c));
    } else {
      setSelected(s => [...s, c]);
      setCSettings(s => ({ ...s, [c]: s[c] || { pulsesPerDay:pulses, qtyPerPulse:qtyPulse } }));
    }
  }
  function toggleAll() {
    if (selected.length === COUNTRIES.length) {
      setSelected([]);
    } else {
      setSelected([...COUNTRIES]);
      setCSettings(s => {
        const next = {...s};
        COUNTRIES.forEach(c => { if (!next[c]) next[c] = { pulsesPerDay:pulses, qtyPerPulse:qtyPulse }; });
        return next;
      });
    }
  }
  function updC(c, key, val) {
    setCSettings(s => ({ ...s, [c]: { ...s[c], [key]: Math.max(1, parseInt(val)||1) } }));
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = selected.reduce((acc, c) => {
    const cs = cSettings[c] || { pulsesPerDay:pulses, qtyPerPulse:qtyPulse };
    const u  = calcUtilization(f.demandLevel, cs.pulsesPerDay);
    const rd = priceUSD * cs.pulsesPerDay * cs.qtyPerPulse * u;
    return { daily: acc.daily + rd, monthly: acc.monthly + rd*30.5 };
  }, { daily:0, monthly:0 });

  // ── Reset & Submit ─────────────────────────────────────────────────────────
  function resetForm() {
    setStep(1); setF(BLANK); setPulses(2); setQtyPulse(5);
    setSelected([]); setCSettings({});
  }
  function handleReset() {
    if (window.confirm("Clear all form data and start over?")) { resetForm(); setSubmitted(null); }
  }
  function handleSubmit() {
    const newId = Date.now();
    const newProd = {
      id: newId, brand: f.brand.trim(),
      priceToBuffLocal: parseFloat(f.priceToBuffLocal),
      currency: f.currency, category: f.category, provider: f.provider, type: f.type,
      bpRegular:   parseFloat(f.bpRegular)   || null,
      bpPremium:   parseFloat(f.bpPremium)   || null,
      discountPct: parseFloat(f.discountPct) || 0,
      demandLevel: f.demandLevel,
    };
    setProducts(ps => [...ps, newProd]);
    setAllocs(a => {
      const next = {...a};
      selected.forEach(c => {
        const cs = cSettings[c] || { pulsesPerDay:pulses, qtyPerPulse:qtyPulse };
        next[c] = [...(next[c]||[]), { productId:newId, pulsesPerDay:cs.pulsesPerDay, qtyPerPulse:cs.qtyPerPulse }];
      });
      return next;
    });
    setSubmitted({ brand: f.brand.trim(), countries: selected.length });
    resetForm();
  }

  // ── Sub-components ─────────────────────────────────────────────────────────
  const SLabel = ({ children }) => (
    <div style={{ fontSize:11, fontWeight:700, color:G, letterSpacing:"0.08em", textTransform:"uppercase",
      marginBottom:20, paddingBottom:10, borderBottom:"1px solid #1a1a1a" }}>{children}</div>
  );
  const CalcCard = ({ label, value, color="#f1f5f9", accent, sub }) => (
    <div style={{ background:accent?"rgba(200,255,0,0.05)":"#111",
      border:accent?"1px solid rgba(200,255,0,0.15)":"none", borderRadius:12, padding:"18px 20px" }}>
      <div style={{ fontSize:9, color:accent?"rgba(200,255,0,0.5)":"#555", fontWeight:700,
        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:900, color, letterSpacing:"-0.03em", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#333", marginTop:6 }}>{sub}</div>}
    </div>
  );
  const TH3 = (s, c="#444") => (
    <th style={{ textAlign:"left", padding:"12px 16px", color:c, fontWeight:700,
      fontSize:11, letterSpacing:"0.05em", textTransform:"uppercase", whiteSpace:"nowrap",
      borderBottom:"1px solid #1a1a1a" }}>{s}</th>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ maxWidth:640, margin:"60px auto", textAlign:"center" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(200,255,0,0.08)",
          border:"2px solid rgba(200,255,0,0.35)", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:30, margin:"0 auto 20px", color:G }}>✓</div>
        <div style={{ fontSize:26, fontWeight:900, color:"#f1f5f9", marginBottom:10 }}>
          Product Created!
        </div>
        <div style={{ fontSize:14, color:"#555", marginBottom:32 }}>
          <strong style={{color:"#f1f5f9"}}>{submitted.brand}</strong> has been added to the catalogue
          {submitted.countries > 0 && <> and allocated to <strong style={{color:G}}>{submitted.countries}</strong> countr{submitted.countries===1?"y":"ies"}</>}.
        </div>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <Btn variant="primary" onClick={() => setSubmitted(null)}><Icon.plus/> Create Another</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:920, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:32, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, color:"#f1f5f9", letterSpacing:"-0.03em" }}>
            Create New Product
          </div>
          <div style={{ fontSize:14, color:"#555", marginTop:6 }}>
            Define a product and allocate it across markets in one flow
          </div>
        </div>
        <Btn variant="ghost" onClick={handleReset}>Reset Form</Btn>
      </div>

      <StepIndicator step={step}/>

      {/* ════ STEP 1 ════ */}
      {step === 1 && (
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:16, padding:36 }}>
          <SLabel>Product Information</SLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="Brand Name">
                <Input value={f.brand} onChange={e=>set("brand",e.target.value)}
                  placeholder="e.g. Roblox, Steam, Amazon…"/>
              </Field>
            </div>
            <Field label="Category">
              <Select value={f.category} onChange={e=>set("category",e.target.value)}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Provider">
              <Select value={f.provider} onChange={e=>set("provider",e.target.value)}>
                {PROVIDERS.map(p=><option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Price to Buff (local currency)">
              <Input type="number" min={0} step="0.01" value={f.priceToBuffLocal}
                onChange={e=>set("priceToBuffLocal",e.target.value)} placeholder="e.g. 10"/>
            </Field>
            <Field label="Currency">
              <Select value={f.currency} onChange={e=>set("currency",e.target.value)}>
                {CURRENCIES.map(c=><option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Product Type">
              <Select value={f.type} onChange={e=>set("type",e.target.value)}>
                {TYPES.map(t=><option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Demand Level" hint="Affects how much of the planned budget is actually spent">
              <Select value={f.demandLevel} onChange={e=>set("demandLevel",e.target.value)}>
                {DEMAND_LEVELS.map(d=><option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="BP Regular Price (Buff Points)">
              <Input type="number" min={0} value={f.bpRegular}
                onChange={e=>set("bpRegular",e.target.value)} placeholder="e.g. 2200"/>
            </Field>
            <Field label="BP Premium Price" hint="Optional — leave blank if not applicable">
              <Input type="number" min={0} value={f.bpPremium}
                onChange={e=>set("bpPremium",e.target.value)} placeholder="Leave blank if N/A"/>
            </Field>
            <Field label="Discount %">
              <Input type="number" min={0} max={100} value={f.discountPct}
                onChange={e=>set("discountPct",e.target.value)}/>
            </Field>
          </div>
          {(f.priceToBuffLocal && f.bpRegular) && (
            <div style={{ marginTop:24, padding:"18px 22px",
              background:"rgba(200,255,0,0.04)", border:"1px solid rgba(200,255,0,0.12)", borderRadius:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:G, marginBottom:14,
                textTransform:"uppercase", letterSpacing:"0.07em" }}>Product Preview</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
                {[
                  ["USD Price",               usd(priceUSD)],
                  ["Demand Base Rate",         Math.round((DEMAND_BASE[f.demandLevel]||0)*100)+"%"],
                  ["BP Regular (after disc.)", reg  ? num(reg)+" pts"  : "—"],
                  ["BP Premium (after disc.)", prem ? num(prem)+" pts" : "—"],
                ].map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:11, color:"#555", marginBottom:5 }}>{l}</div>
                    <div style={{ fontSize:17, fontWeight:800, color:"#f1f5f9" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ STEP 2 ════ */}
      {step === 2 && (
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:16, padding:36 }}>
          <SLabel>Pulse Delivery Settings</SLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:28 }}>
            <Field label="Pulses per Day"
              hint={`Releases one batch every ${intervalH}h — fewer pulses = higher utilization`}>
              <Input type="number" min={1} max={24} value={pulses}
                onChange={e=>setPulses(Math.max(1,parseInt(e.target.value)||1))}/>
            </Field>
            <Field label="Qty per Pulse" hint={`${dailyQty} cards distributed per day total`}>
              <Input type="number" min={1} value={qtyPulse}
                onChange={e=>setQtyPulse(Math.max(1,parseInt(e.target.value)||1))}/>
            </Field>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:14 }}>
            <CalcCard label="Daily Qty"        value={String(dailyQty)}       sub="cards released per day"/>
            <CalcCard label="Pulse Interval"   value={`every ${intervalH}h`}  sub={`${pulses}× per day`}/>
            <CalcCard label="Utilization Rate" value={Math.round(util*100)+"%"} color={utilColor}
              sub="of budget actually spent"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
            <CalcCard label="Planned Daily"  value={usd(plannedD)} color="#555" sub="at 100% utilization"/>
            <CalcCard label="Real Daily"     value={usd(realD)}    color={G} accent sub="estimated actual spend"/>
            <CalcCard label="Real Monthly"   value={usd(realM)}    color={G} accent sub="×30.5 days"/>
          </div>
          <PulseInfo demandLevel={f.demandLevel} pulsesPerDay={pulses}/>
        </div>
      )}

      {/* ════ STEP 3 ════ */}
      {step === 3 && (
        <div>
          <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:16,
            padding:36, marginBottom:16 }}>
            <SLabel>Country Allocation</SLabel>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:13, color:"#555" }}>
                {selected.length === 0
                  ? "Select which markets to allocate this product to"
                  : `${selected.length} countr${selected.length===1?"y":"ies"} selected`}
              </div>
              <button onClick={toggleAll}
                style={{ background:"none", border:"1px solid #2a2a2a", color:"#888",
                  padding:"7px 18px", borderRadius:8, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>
                {selected.length === COUNTRIES.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div style={{ background:"#080808", border:"1px solid #111", borderRadius:12, overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr>
                      <th colSpan={5} style={{ borderBottom:"1px solid #111", padding:"4px 0" }}/>
                      <th colSpan={2} style={{ padding:"4px 16px", fontSize:9, fontWeight:700, color:"#555",
                        textTransform:"uppercase", letterSpacing:"0.1em", textAlign:"center",
                        borderBottom:"1px solid #111", borderLeft:"1px solid #111", borderRight:"1px solid #111" }}>PLANNED</th>
                      <th colSpan={2} style={{ padding:"4px 16px", fontSize:9, fontWeight:700, color:G,
                        textTransform:"uppercase", letterSpacing:"0.1em", textAlign:"center",
                        borderBottom:"1px solid #111", borderLeft:"1px solid #111" }}>REAL</th>
                    </tr>
                    <tr>
                      <th style={{ width:48, padding:"12px 16px", borderBottom:"1px solid #1a1a1a" }}/>
                      {TH3("Country")}
                      {TH3("Pulses/day")}
                      {TH3("Qty/pulse")}
                      {TH3("Daily Qty")}
                      {TH3("Utilization")}
                      {TH3("Daily",  "#555")}
                      {TH3("Monthly","#555")}
                      {TH3("Daily",  G)}
                      {TH3("Monthly",G)}
                    </tr>
                  </thead>
                  <tbody>
                    {COUNTRIES.map(c => {
                      const isSel = selected.includes(c);
                      const cs    = cSettings[c] || { pulsesPerDay:pulses, qtyPerPulse:qtyPulse };
                      const rUtil = isSel ? calcUtilization(f.demandLevel, cs.pulsesPerDay) : 0;
                      const rDq   = cs.pulsesPerDay * cs.qtyPerPulse;
                      const rPlan = priceUSD * rDq;
                      const rReal = rPlan * rUtil;
                      return (
                        <tr key={c} onClick={() => toggleCountry(c)}
                          style={{ borderBottom:"1px solid #0d0d0d",
                            background:isSel?"rgba(200,255,0,0.025)":"transparent", cursor:"pointer" }}>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ width:18, height:18, borderRadius:4,
                              border:`2px solid ${isSel?G:"#2a2a2a"}`,
                              background:isSel?G:"transparent",
                              display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {isSel && (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="#0a0a0a" strokeWidth="2.2"
                                    strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          </td>
                          <td style={{ padding:"12px 16px", fontWeight:800,
                            color:isSel?"#f1f5f9":"#444", fontSize:14 }}>{c}</td>
                          <td style={{ padding:"10px 16px" }} onClick={e=>e.stopPropagation()}>
                            {isSel
                              ? <input type="number" min={1} max={24} value={cs.pulsesPerDay}
                                  onChange={e=>updC(c,"pulsesPerDay",e.target.value)}
                                  style={{ ...inputStyle, width:64, padding:"6px 8px", textAlign:"center" }}/>
                              : <span style={{ color:"#222" }}>—</span>}
                          </td>
                          <td style={{ padding:"10px 16px" }} onClick={e=>e.stopPropagation()}>
                            {isSel
                              ? <input type="number" min={1} value={cs.qtyPerPulse}
                                  onChange={e=>updC(c,"qtyPerPulse",e.target.value)}
                                  style={{ ...inputStyle, width:64, padding:"6px 8px", textAlign:"center" }}/>
                              : <span style={{ color:"#222" }}>—</span>}
                          </td>
                          <td style={{ padding:"12px 16px", fontWeight:700,
                            color:isSel?"#f1f5f9":"#222", textAlign:"center" }}>
                            {isSel ? rDq : "—"}
                          </td>
                          <td style={{ padding:"12px 16px", minWidth:120 }}>
                            {isSel ? <UtilBar util={rUtil}/> : <span style={{ color:"#222" }}>—</span>}
                          </td>
                          <td style={{ padding:"12px 16px", color:isSel?"#555":"#222", fontWeight:600 }}>
                            {isSel ? usd(rPlan) : "—"}
                          </td>
                          <td style={{ padding:"12px 16px", color:isSel?"#555":"#222", fontWeight:600 }}>
                            {isSel ? usd(rPlan*30.5) : "—"}
                          </td>
                          <td style={{ padding:"12px 16px", fontWeight:700, color:isSel?G:"#222" }}>
                            {isSel ? usd(rReal) : "—"}
                          </td>
                          <td style={{ padding:"12px 16px", fontWeight:700, color:isSel?G:"#222" }}>
                            {isSel ? usd(rReal*30.5) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {selected.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:8 }}>
              <StatCard label="Countries Selected" value={String(selected.length)} color="#f1f5f9"
                sub="markets receiving this product"/>
              <StatCard label="Total Real Daily"   value={usd(totals.daily)}   color={G} accent
                sub="sum across selected countries"/>
              <StatCard label="Total Real Monthly" value={usd(totals.monthly)} color={G} accent
                sub="×30.5 days"/>
            </div>
          )}
        </div>
      )}

      {/* Footer nav */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        marginTop:28, paddingTop:22, borderTop:"1px solid #1a1a1a" }}>
        <Btn variant="ghost" onClick={handleReset}>Reset</Btn>
        <div style={{ display:"flex", gap:10 }}>
          {step > 1 && <Btn variant="ghost" onClick={() => setStep(s => s-1)}>← Back</Btn>}
          {step < 3 && (
            <Btn variant="primary" onClick={() => setStep(s => s+1)}
              disabled={step===1 && !step1Valid}>
              Next →
            </Btn>
          )}
          {step === 3 && (
            <Btn variant="primary" onClick={handleSubmit}>
              {selected.length > 0
                ? `Create & Allocate to ${selected.length} Countr${selected.length===1?"y":"ies"}`
                : "Create Product (no allocation)"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

"""

jsx = jsx.replace(
    '// ── APP ───────────────────────────────────────────────────────────────────────',
    NEW_COMPONENTS + '// ── APP ───────────────────────────────────────────────────────────────────────'
)

# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE SHEETS INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNtrHx-khtE3ZOQjMdl-OgPkWsctdSljQ0cj-U4kNQn4jrIvVEfxj-oeWdSwHXlSIn/exec"

# 1. Add SCRIPT_URL constant before App function
jsx = jsx.replace(
    'function App() {',
    f'const SCRIPT_URL = "{SCRIPT_URL}";\n\nfunction App() {{'
)

# 2. Extend App state with auth + saveStatus + loaded + saveTimer + useEffects
# Start with EMPTY state so old hardcoded data never flashes on screen
jsx = jsx.replace(
    '  const [tab,      setTab]      = useState("overview");\n'
    '  const [products, setProducts] = useState(INITIAL_PRODUCTS);\n'
    '  const [allocs,   setAllocs]   = useState(INITIAL_ALLOCS);\n'
    '\n'
    '  const TABS = [',

    '  const USERS = [\n'
    '    { user: "yuvalbukobza", pass: "071198", display: "Admin" },\n'
    '    { user: "itaiguzik",    pass: "123456", display: "itaiguzik" },\n'
    '    // הוסף משתמשים נוספים כאן:\n'
    '    // { user: "שם_משתמש", pass: "סיסמא", display: "שם תצוגה" },\n'
    '  ];\n'
    '\n'
    '  const [tab,        setTab]        = useState("overview");\n'
    '  const [products,   setProducts]   = useState([]);\n'
    '  const [allocs,     setAllocs]     = useState({});\n'
    '  const [saveStatus, setSaveStatus] = useState("loading");\n'
    '  const [loaded,     setLoaded]     = useState(false);\n'
    '  const saveTimer = useRef(null);\n'
    '\n'
    '  const [authed,      setAuthed]      = useState(() => sessionStorage.getItem("buff_auth") === "1");\n'
    '  const [displayName, setDisplayName] = useState(() => sessionStorage.getItem("buff_display") || "");\n'
    '  const [menuOpen,    setMenuOpen]    = useState(false);\n'
    '  const [loginU,      setLoginU]      = useState("");\n'
    '  const [loginP,      setLoginP]      = useState("");\n'
    '  const [loginErr,    setLoginErr]    = useState(false);\n'
    '\n'
    '  function handleLogin(e) {\n'
    '    e.preventDefault();\n'
    '    const match = USERS.find(u => u.user === loginU && u.pass === loginP);\n'
    '    if (match) {\n'
    '      sessionStorage.setItem("buff_auth", "1");\n'
    '      sessionStorage.setItem("buff_display", match.display);\n'
    '      setDisplayName(match.display);\n'
    '      setAuthed(true);\n'
    '    } else {\n'
    '      setLoginErr(true);\n'
    '      setLoginP("");\n'
    '    }\n'
    '  }\n'
    '\n'
    '  // Load from Google Sheets on mount (only when authed)\n'
    '  useEffect(() => {\n'
    '    if (!authed) return;\n'
    '    fetch(SCRIPT_URL)\n'
    '      .then(r => r.json())\n'
    '      .then(data => {\n'
    '        setProducts(data.products && data.products.length > 0 ? data.products : INITIAL_PRODUCTS);\n'
    '        setAllocs(data.allocs && Object.keys(data.allocs).length > 0 ? data.allocs : INITIAL_ALLOCS);\n'
    '        setSaveStatus("saved");\n'
    '        setLoaded(true);\n'
    '      })\n'
    '      .catch(() => {\n'
    '        setProducts(INITIAL_PRODUCTS);\n'
    '        setAllocs(INITIAL_ALLOCS);\n'
    '        setSaveStatus("error");\n'
    '        setLoaded(true);\n'
    '      });\n'
    '  }, [authed]);\n'
    '\n'
    '  // Auto-save on every change (debounced 1.5s)\n'
    '  useEffect(() => {\n'
    '    if (!loaded) return;\n'
    '    setSaveStatus("saving");\n'
    '    clearTimeout(saveTimer.current);\n'
    '    saveTimer.current = setTimeout(() => {\n'
    '      fetch(SCRIPT_URL, { method:"POST", mode:"no-cors", body:JSON.stringify({ products, allocs }) })\n'
    '        .then(() => setSaveStatus("saved"))\n'
    '        .catch(() => setSaveStatus("error"));\n'
    '    }, 1500);\n'
    '  }, [products, allocs]);\n'
    '\n'
    '  // Login screen\n'
    '  if (!authed) return (\n'
    '    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",\n'
    '      justifyContent:"center",fontFamily:"\'DM Sans\',\'Segoe UI\',sans-serif"}}>\n'
    '      <div style={{width:360,padding:"48px 40px",background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:20}}>\n'
    '        <div style={{textAlign:"center",marginBottom:36}}>\n'
    '          <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.05em",marginBottom:8}}>\n'
    '            <span style={{color:"#c8ff00"}}>BUFF</span>\n'
    '            <span style={{color:"#2a2a2a",margin:"0 10px",fontWeight:400}}>✦</span>\n'
    '            <span style={{color:"#f1f5f9"}}>Marketplace</span>\n'
    '          </div>\n'
    '          <div style={{fontSize:11,color:"#444",letterSpacing:"0.12em",textTransform:"uppercase"}}>Planning Platform</div>\n'
    '        </div>\n'
    '        <form onSubmit={handleLogin}>\n'
    '          <div style={{marginBottom:16}}>\n'
    '            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#555",marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Username</label>\n'
    '            <input value={loginU} onChange={e=>{setLoginU(e.target.value);setLoginErr(false);}} autoFocus\n'
    '              style={{width:"100%",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,\n'
    '                color:"#f1f5f9",fontSize:14,padding:"10px 13px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>\n'
    '          </div>\n'
    '          <div style={{marginBottom:24}}>\n'
    '            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#555",marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Password</label>\n'
    '            <input type="password" value={loginP} onChange={e=>{setLoginP(e.target.value);setLoginErr(false);}}\n'
    '              style={{width:"100%",background:"#111",border:`1px solid ${loginErr?"#ef4444":"#2a2a2a"}`,borderRadius:8,\n'
    '                color:"#f1f5f9",fontSize:14,padding:"10px 13px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>\n'
    '            {loginErr && <div style={{fontSize:12,color:"#ef4444",marginTop:6}}>Incorrect username or password.</div>}\n'
    '          </div>\n'
    '          <button type="submit" style={{width:"100%",background:"#c8ff00",color:"#0a0a0a",border:"none",\n'
    '            borderRadius:8,padding:"11px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>\n'
    '            Sign In\n'
    '          </button>\n'
    '        </form>\n'
    '      </div>\n'
    '    </div>\n'
    '  );\n'
    '\n'
    '  // Show loading screen until Sheets data is ready\n'
    '  if (!loaded) return (\n'
    '    <div style={{minHeight:"100vh",background:"#080808",display:"flex",flexDirection:"column",\n'
    '      alignItems:"center",justifyContent:"center",fontFamily:"\'DM Sans\',\'Segoe UI\',sans-serif"}}>\n'
    '      <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.05em",marginBottom:16}}>\n'
    '        <span style={{color:"#c8ff00"}}>BUFF</span><span style={{color:"#2a2a2a",margin:"0 10px",fontWeight:400}}>✦</span>\n'
    '        <span style={{color:"#f1f5f9"}}>Marketplace</span>\n'
    '      </div>\n'
    '      <div style={{fontSize:13,color:"#444",letterSpacing:"0.08em",textTransform:"uppercase"}}>Loading data from Google Sheets...</div>\n'
    '    </div>\n'
    '  );\n'
    '\n'
    '  const TABS = ['
)

# 3. Add save-status indicator to the right side of the header navbar
jsx = jsx.replace(
    '        ))}\n'
    '      </div>\n'
    '      <div style={{padding:36}}>',

    '        ))}\n'
    '        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:20,fontSize:12,fontWeight:600,paddingRight:8,position:"relative"}}>\n'
    '          <div>\n'
    '            <div onClick={() => setMenuOpen(o => !o)} style={{width:32,height:32,borderRadius:"50%",background:"rgba(200,255,0,0.1)",border:"1px solid rgba(200,255,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#c8ff00",cursor:"pointer"}}>\n'
    '              {displayName ? displayName.charAt(0).toUpperCase() : "?"}\n'
    '            </div>\n'
    '            {menuOpen && (\n'
    '              <div style={{position:"absolute",right:0,top:42,background:"#0d0d0d",border:"1px solid #222",borderRadius:12,padding:"20px 24px",minWidth:200,boxShadow:"0 20px 60px rgba(0,0,0,0.8)",zIndex:200}}>\n'
    '                <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(200,255,0,0.1)",border:"1px solid rgba(200,255,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#c8ff00",margin:"0 auto 12px"}}>\n'
    '                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}\n'
    '                </div>\n'
    '                <div style={{textAlign:"center",fontSize:15,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>{displayName}</div>\n'
    '                <div style={{textAlign:"center",fontSize:11,color:"#444",marginBottom:20,letterSpacing:"0.06em",textTransform:"uppercase"}}>{displayName==="Admin"?"Administrator":"Member"}</div>\n'
    '                <div style={{borderTop:"1px solid #1a1a1a",paddingTop:16}}>\n'
    '                  <button onClick={()=>{sessionStorage.clear();window.location.reload();}} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#f87171",padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sign Out</button>\n'
    '                </div>\n'
    '              </div>\n'
    '            )}\n'
    '          </div>\n'
    '          {saveStatus==="loading" && <><span style={{width:8,height:8,borderRadius:"50%",background:"#555",display:"inline-block",marginRight:6}}/>  <span style={{color:"#555"}}>Loading...</span></>}\n'
    '          {saveStatus==="saving"  && <><span style={{width:8,height:8,borderRadius:"50%",background:"#fb923c",display:"inline-block",marginRight:6}}/>  <span style={{color:"#fb923c"}}>Saving...</span></>}\n'
    '          {saveStatus==="saved"   && <><span style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",display:"inline-block",marginRight:6}}/>  <span style={{color:"#4ade80"}}>Saved to Sheets</span></>}\n'
    '          {saveStatus==="error"   && <><span style={{width:8,height:8,borderRadius:"50%",background:"#f87171",display:"inline-block",marginRight:6}}/>  <span style={{color:"#f87171"}}>Save failed</span></>}\n'
    '        </div>\n'
    '      </div>\n'
    '      <div style={{padding:36}}>'
)

# ══════════════════════════════════════════════════════════════════════════════
# BUILD: write JSX, compile, produce HTML
# ══════════════════════════════════════════════════════════════════════════════

with open(OUT_JSX, 'w', encoding='utf-8') as f:
    f.write(jsx)

result = subprocess.run(
    ['npx.cmd', 'babel', OUT_JSX, '--presets', '@babel/preset-react', '-o', OUT_JS],
    capture_output=True, text=True,
    cwd='c:/Users/Roman Averin/Desktop/ClaudeCodeTest'
)
if result.returncode != 0:
    print("BABEL ERROR:")
    print(result.stderr)
    sys.exit(1)

with open(OUT_JS, 'r', encoding='utf-8') as f:
    compiled = f.read()

html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BUFF Marketplace</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230d0d0d'/><text x='16' y='23' text-anchor='middle' font-family='Arial Black,sans-serif' font-weight='900' font-size='20' fill='%23c8ff00'>B</text></svg>"/>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body { background: #080808; min-width: 960px; }
    ::-webkit-scrollbar { width: 7px; height: 7px; }
    ::-webkit-scrollbar-track { background: #111; }
    ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
    table { border-collapse: collapse; }
    input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
    select option { background: #111; color: #f1f5f9; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
const { useState, useMemo, useEffect, useRef, useCallback } = React;
""" + compiled + """
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
  </script>
</body>
</html>"""

with open(OUT_HTML, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Done — {len(html):,} chars written to {OUT_HTML}")
