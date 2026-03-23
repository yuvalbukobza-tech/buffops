import io, sys, subprocess, os, base64
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('c:/Users/Roman Averin/Desktop/download.jpeg', 'rb') as f:
    LOGO_B64 = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()

SRC = 'c:/Users/Roman Averin/Downloads/buff-marketplace.jsx'
OUT_HTML = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/buff-marketplace.html'
OUT_JSX  = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/app.jsx'
OUT_JS   = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/app.js'

with open(SRC, 'r', encoding='utf-8') as f:
    jsx = f.read()

jsx = jsx.replace('import { useState, useMemo } from "react";\n', '')
jsx = jsx.replace('const PROVIDERS  = ["GCOW","Internal","Other"];', 'const PROVIDERS  = ["GCOW","Loot Keys","Kinguin","Internal","Other"];')
jsx = jsx.replace('<span style={{color:G}}>BUFF</span><span style={{color:"#333",margin:"0 5px"}}>✦</span><span style={{color:"#f1f5f9"}}>Marketplace</span>', '<span style={{color:G}}>Buff</span><span style={{color:"#f1f5f9"}}>Ops</span>')
jsx = jsx.replace('<Field label="Provider"><Select value={f.provider} onChange={e=>set("provider",e.target.value)}>{PROVIDERS.map(p=><option key={p}>{p}</option>)}</Select></Field>', '<Field label="Vendor"><Select value={f.provider} onChange={e=>set("provider",e.target.value)}>{PROVIDERS.map(p=><option key={p}>{p}</option>)}</Select></Field>')
jsx = jsx.replace('discountPct:15,demandLevel:"Medium" };', 'discountPct:0,demandLevel:"Medium" };')
jsx = jsx.replace('export default function App', 'function App')

# Replace entire ProductsTab with new version (countries column + visualization)
OLD_PRODUCTS_TAB = '''function ProductsTab({ products, setProducts }) {
  const [modal,        setModal]        = useState(null);
  const [filterCat,    setFilterCat]    = useState("All");
  const [filterBrand,  setFilterBrand]  = useState("All");
  const [filterDemand, setFilterDemand] = useState("All");

  const brands  = ["All",...Array.from(new Set(products.map(p=>p.brand))).sort()];
  const filtered = products.filter(p=>{
    if(filterCat!=="All" && p.category!==filterCat) return false;
    if(filterBrand!=="All" && p.brand!==filterBrand) return false;
    if(filterDemand!=="All" && p.demandLevel!==filterDemand) return false;
    return true;
  });

  function save(form) {
    const parsed={...form,id:modal==="add"?Date.now():modal.id,priceToBuffLocal:parseFloat(form.priceToBuffLocal),discountPct:parseFloat(form.discountPct),bpRegular:parseFloat(form.bpRegular)||null,bpPremium:parseFloat(form.bpPremium)||null};
    setProducts(ps=>modal==="add"?[...ps,parsed]:ps.map(p=>p.id===modal.id?parsed:p));
    setModal(null);
  }

  const TH = s => <th style={{textAlign:"left",padding:"10px 12px",color:"#444",fontWeight:700,fontSize:10,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <Select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...inputStyle,width:140}}>
          {["All",...CATEGORIES].map(c=><option key={c}>{c}</option>)}
        </Select>
        <Select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} style={{...inputStyle,width:140}}>
          {brands.map(b=><option key={b}>{b}</option>)}
        </Select>
        <Select value={filterDemand} onChange={e=>setFilterDemand(e.target.value)} style={{...inputStyle,width:140}}>
          {["All",...DEMAND_LEVELS].map(d=><option key={d}>{d}</option>)}
        </Select>
        <div style={{flex:1}}/>
        <Btn variant="primary" onClick={()=>setModal("add")}><Icon.plus/> Add product</Btn>
      </div>

      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>{["Brand","Category","Price","USD","Vendor","Type","Demand","BP Reg.","BP Prem.","Disc.","After disc.",""].map(TH)}</tr></thead>
          <tbody>
            {filtered.map(p=>{
              const {reg,prem}=calcPricesAfterDiscount(p);
              return (
                <tr key={p.id} style={{borderBottom:"1px solid #0d0d0d"}}>
                  <td style={{padding:"10px 12px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}</td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.category.toLowerCase()}>{p.category}</Badge></td>
                  <td style={{padding:"10px 12px",color:"#555"}}>{p.priceToBuffLocal} {p.currency}</td>
                  <td style={{padding:"10px 12px",fontWeight:700,color:"#f1f5f9"}}>{usd(calcPriceUSD(p))}</td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.provider.toLowerCase()}>{p.provider}</Badge></td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.type.toLowerCase()}>{p.type}</Badge></td>
                  <td style={{padding:"10px 12px"}}>
                    <span style={{fontSize:10,fontWeight:700,color:demandColor(p.demandLevel),background:demandBg(p.demandLevel),padding:"2px 7px",borderRadius:4,border:`1px solid ${demandColor(p.demandLevel)}33`}}>{p.demandLevel}</span>
                  </td>
                  <td style={{padding:"10px 12px",color:"#555"}}>{num(p.bpRegular)}</td>
                  <td style={{padding:"10px 12px",color:"#555"}}>{p.bpPremium?num(p.bpPremium):"—"}</td>
                  <td style={{padding:"10px 12px",color:"#fb923c",fontWeight:700}}>{p.discountPct}%</td>
                  <td style={{padding:"10px 12px"}}><div style={{fontSize:11}}><span style={{color:"#38bdf8"}}>{num(reg)} pts</span>{prem&&<><br/><span style={{color:"#a78bfa"}}>{num(prem)} pts</span></>}</div></td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setModal(p)} style={{background:"#1a1a1a",border:"none",color:"#888",cursor:"pointer",padding:"5px 7px",borderRadius:6,display:"flex"}}><Icon.edit/></button>
                      <button onClick={()=>{ if(window.confirm("Delete this product?")) setProducts(ps=>ps.filter(x=>x.id!==p.id)); }} style={{background:"#1a1a1a",border:"none",color:"#ef4444",cursor:"pointer",padding:"5px 7px",borderRadius:6,display:"flex"}}><Icon.trash/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>No products match the selected filters.</div>}
      </div>
      {modal&&<Modal title={modal==="add"?"Add product":"Edit product"} onClose={()=>setModal(null)}><ProductForm initial={modal==="add"?null:modal} onSave={save} onClose={()=>setModal(null)}/></Modal>}
    </div>
  );
}'''

NEW_PRODUCTS_TAB = '''function ProductsTab({ products, setProducts, allocs, setTab }) {
  const [modal,        setModal]        = useState(null);
  const [filterCat,    setFilterCat]    = useState("All");
  const [filterBrand,  setFilterBrand]  = useState("All");
  const [filterDemand, setFilterDemand] = useState("All");

  const brands   = ["All",...Array.from(new Set(products.map(p=>p.brand))).sort()];
  const filtered = products.filter(p=>{
    if(filterCat!=="All" && p.category!==filterCat) return false;
    if(filterBrand!=="All" && p.brand!==filterBrand) return false;
    if(filterDemand!=="All" && p.demandLevel!==filterDemand) return false;
    return true;
  });

  // Countries allocated per product
  function getCountries(pid) {
    return COUNTRIES.filter(c=>(allocs[c]||[]).some(r=>r.productId===pid));
  }

  // Bar chart: monthly real budget by brand
  const brandBudgets = useMemo(()=>{
    const map={};
    products.forEach(p=>{
      const total=COUNTRIES.reduce((s,c)=>{
        return s+(allocs[c]||[]).filter(r=>r.productId===p.id).reduce((ss,r)=>ss+calcRealDaily(p,r)*30.5,0);
      },0);
      map[p.brand]=(map[p.brand]||0)+total;
    });
    return Object.entries(map).map(([brand,budget])=>({brand,budget})).sort((a,b)=>b.budget-a.budget).slice(0,10);
  },[products,allocs]);
  const maxBudget = brandBudgets.length ? brandBudgets[0].budget : 1;

  // Category distribution
  const catCounts = useMemo(()=>{
    const map={};
    products.forEach(p=>{ map[p.category]=(map[p.category]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[products]);
  const catColors = { Gaming:"#4ade80", Shopping:"#a78bfa", Entertainment:"#fb923c", Charity:"#86efac", Other:"#555" };

  function save(form) {
    const parsed={...form,id:modal==="add"?Date.now():modal.id,priceToBuffLocal:parseFloat(form.priceToBuffLocal),discountPct:parseFloat(form.discountPct),bpRegular:parseFloat(form.bpRegular)||null,bpPremium:parseFloat(form.bpPremium)||null};
    setProducts(ps=>modal==="add"?[...ps,parsed]:ps.map(p=>p.id===modal.id?parsed:p));
    setModal(null);
  }

  const TH = (s,c="#444") => <th style={{textAlign:"left",padding:"13px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s}</th>;

  return (
    <div>

      {/* ── VISUALIZATION ── */}
      {products.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16,marginBottom:20}}>

          {/* Bar chart */}
          <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"24px 28px"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9",marginBottom:6,letterSpacing:"-0.02em"}}>Monthly Budget by Brand</div>
            <div style={{fontSize:11,color:"#444",marginBottom:20}}>Real estimated spend per brand across all countries</div>
            {brandBudgets.length===0
              ? <div style={{color:"#333",fontSize:12}}>No allocations yet</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {brandBudgets.map(({brand,budget})=>(
                    <div key={brand} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:80,fontSize:12,fontWeight:700,color:"#888",textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{brand}</div>
                      <div style={{flex:1,height:8,background:"#1a1a1a",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${(budget/maxBudget)*100}%`,height:"100%",background:"#c8ff00",borderRadius:4}}/>
                      </div>
                      <div style={{width:72,fontSize:12,fontWeight:700,color:"#f1f5f9",flexShrink:0}}>{usd(budget)}/mo</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Category distribution */}
          <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"24px 28px"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9",marginBottom:6,letterSpacing:"-0.02em"}}>By Category</div>
            <div style={{fontSize:11,color:"#444",marginBottom:20}}>Product count per category</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {catCounts.map(([cat,count])=>(
                <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:catColors[cat]||"#555",flexShrink:0}}/>
                    <span style={{fontSize:12,color:"#888"}}>{cat}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:80,height:5,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${(count/products.length)*100}%`,height:"100%",background:catColors[cat]||"#555",borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9",width:20,textAlign:"right"}}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{borderTop:"1px solid #1a1a1a",marginTop:16,paddingTop:12,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#444"}}>Total products</span>
              <span style={{fontSize:13,fontWeight:800,color:"#c8ff00"}}>{products.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── FILTERS ── */}
      <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap",alignItems:"flex-end",padding:"16px 20px",background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12}}>
        <div style={{fontSize:10,fontWeight:800,color:"#333",letterSpacing:"0.08em",textTransform:"uppercase",alignSelf:"center",marginRight:8}}>Filters</div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Category</div>
          <Select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{...inputStyle,width:150}}>
            {["All",...CATEGORIES].map(c=><option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Brand</div>
          <Select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} style={{...inputStyle,width:150}}>
            {brands.map(b=><option key={b}>{b}</option>)}
          </Select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Demand Level</div>
          <Select value={filterDemand} onChange={e=>setFilterDemand(e.target.value)} style={{...inputStyle,width:150}}>
            {["All",...DEMAND_LEVELS].map(d=><option key={d}>{d}</option>)}
          </Select>
        </div>
        <div style={{flex:1}}/>
        <Btn variant="primary" onClick={()=>setTab("allocate")}><Icon.plus/> Add Product</Btn>
      </div>

      {/* ── TABLE ── */}
      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:14,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em"}}>Product Catalogue</span>
          <span style={{fontSize:12,color:"#444"}}>{filtered.length} product{filtered.length!==1?"s":""}</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>{[TH("Brand"),TH("Category"),TH("USD Price"),TH("Provider"),TH("Type"),TH("Demand"),TH("BP Regular"),TH("BP Premium"),TH("Disc."),TH("Countries","#c8ff00"),TH("")]}</tr></thead>
          <tbody>
            {filtered.map(p=>{
              const {reg,prem}=calcPricesAfterDiscount(p);
              const countries=getCountries(p.id);
              return (
                <tr key={p.id} style={{borderBottom:"1px solid #111"}}>
                  <td style={{padding:"14px 16px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}</td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.category.toLowerCase()}>{p.category}</Badge></td>
                  <td style={{padding:"10px 12px",fontWeight:700,color:"#f1f5f9"}}>{usd(calcPriceUSD(p))}</td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.provider.toLowerCase()}>{p.provider}</Badge></td>
                  <td style={{padding:"10px 12px"}}><Badge variant={p.type.toLowerCase()}>{p.type}</Badge></td>
                  <td style={{padding:"10px 12px"}}>
                    <span style={{fontSize:10,fontWeight:700,color:demandColor(p.demandLevel),background:demandBg(p.demandLevel),padding:"2px 7px",borderRadius:4,border:`1px solid ${demandColor(p.demandLevel)}33`}}>{p.demandLevel}</span>
                  </td>
                  <td style={{padding:"10px 12px",color:"#555"}}>{num(p.bpRegular)}</td>
                  <td style={{padding:"10px 12px",color:"#555"}}>{p.bpPremium?num(p.bpPremium):"—"}</td>
                  <td style={{padding:"10px 12px",color:"#fb923c",fontWeight:700}}>{p.discountPct}%</td>
                  <td style={{padding:"10px 16px"}}>
                    {countries.length===0
                      ? <span style={{color:"#2a2a2a",fontSize:11,fontStyle:"italic"}}>Not allocated</span>
                      : <div style={{display:"flex",flexWrap:"wrap",gap:4,maxWidth:220}}>
                          {countries.map(c=>(
                            <span key={c} style={{fontSize:10,fontWeight:700,color:"#c8ff00",background:"rgba(200,255,0,0.07)",border:"1px solid rgba(200,255,0,0.18)",padding:"2px 6px",borderRadius:4}}>{c}</span>
                          ))}
                        </div>
                    }
                  </td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setModal(p)} style={{background:"#1a1a1a",border:"none",color:"#888",cursor:"pointer",padding:"5px 7px",borderRadius:6,display:"flex"}}><Icon.edit/></button>
                      <button onClick={()=>{ if(window.confirm("Delete this product?")) setProducts(ps=>ps.filter(x=>x.id!==p.id)); }} style={{background:"#1a1a1a",border:"none",color:"#ef4444",cursor:"pointer",padding:"5px 7px",borderRadius:6,display:"flex"}}><Icon.trash/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>No products match the selected filters.</div>}
      </div>
      {modal&&<Modal title={modal==="add"?"Add product":"Edit product"} onClose={()=>setModal(null)}><ProductForm initial={modal==="add"?null:modal} onSave={save} onClose={()=>setModal(null)}/></Modal>}
    </div>
  );
}'''

jsx = jsx.replace(OLD_PRODUCTS_TAB, NEW_PRODUCTS_TAB)

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
    '        <Btn variant="primary" onClick={()=>setTab("allocate")}><Icon.plus/> Add Product</Btn>\n'
    '      </div>'
)
jsx = jsx.replace(old_prod_filters, new_prod_filters)

# Products table: section header + cleaner column names
old_prod_table_start = (
    '      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>\n'
    '        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>\n'
    '          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>'
    '{["Brand","Category","Price","USD","Vendor","Type","Demand","BP Reg.","BP Prem.","Disc.","After disc.",""].map(TH)}'
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
# DESIGN 5b — AllocationForm: better product-selector with empty states
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '      <div style={{display:"flex",gap:10,marginBottom:20}}>\n'
    '        <Select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{...inputStyle,flex:1}}>\n'
    '          <option value="">Select a product to add…</option>\n'
    '          {unallocated.map(p=><option key={p.id} value={p.id}>{p.brand} — ${p.priceToBuffLocal} {p.currency} ({p.type}) · {p.demandLevel} demand</option>)}\n'
    '        </Select>\n'
    '        <Btn variant="success" onClick={addProduct} disabled={!selProd}><Icon.plus/> Add</Btn>\n'
    '      </div>',

    '      {products.length === 0 ? (\n'
    '        <div style={{padding:"14px 18px",background:"rgba(251,146,60,0.06)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,fontSize:12,color:"#fb923c",marginBottom:20}}>\n'
    '          ⚠ No products in catalog yet — go to the <strong>Allocate</strong> tab to add products first.\n'
    '        </div>\n'
    '      ) : (\n'
    '        <div style={{display:"flex",gap:10,marginBottom:20}}>\n'
    '          <Select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{...inputStyle,flex:1}}>\n'
    '            <option value="">{unallocated.length === 0 ? "All catalog products already added" : "Choose a product to add to this country…"}</option>\n'
    '            {unallocated.map(p=><option key={p.id} value={p.id}>{usd(calcPriceUSD(p))} {p.brand} ({p.type}) · {p.demandLevel} demand</option>)}\n'
    '          </Select>\n'
    '          <Btn variant="success" onClick={addProduct} disabled={!selProd||unallocated.length===0}><Icon.plus/> Add</Btn>\n'
    '        </div>\n'
    '      )}'
)

# ══════════════════════════════════════════════════════════════════════════════
# DESIGN 6 — App logo + nav tabs + page padding
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '<div style={{marginRight:36,padding:"16px 0"}}>\n'
    '          <div style={{fontSize:15,fontWeight:900,letterSpacing:"-0.03em"}}>\n'
    '            <span style={{color:G}}>Buff</span><span style={{color:"#f1f5f9"}}>Ops</span>\n'
    '          </div>\n'
    '          <div style={{fontSize:9,color:"#333",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:1}}>Planning Platform</div>\n'
    '        </div>',
    '<div style={{marginRight:48,padding:"10px 0"}}>\n'
    '          <div style={{fontSize:26,fontWeight:900,letterSpacing:"-0.05em",lineHeight:1}}>\n'
    '            <span style={{color:G}}>Buff</span><span style={{color:"#f1f5f9"}}>Ops</span>\n'
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
    '  allocate:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,\n'
    '  analytics: ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,\n'
    '  dashboard: ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,\n'
    '  budget:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>,\n'
    '  admin:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,'
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
    '    { id:"dashboard",  label:"Dashboard",  Icon:Icon.dashboard },\n'
    '    { id:"products",   label:"Products",   Icon:Icon.products  },\n'
    '    { id:"countries",  label:"Countries",  Icon:Icon.countries },\n'
    '    { id:"allocate",   label:"Allocate",   Icon:Icon.allocate  },\n'
    '    { id:"budget",     label:"Budget",     Icon:Icon.budget    },\n'
    '    ...(isAdmin ? [{ id:"admin", label:"Admin", Icon:Icon.admin }] : []),\n'
    '  ];'
)

jsx = jsx.replace(
    '        {tab==="overview"  && <OverviewTab  products={products} allocs={allocs}/>}\n'
    '        {tab==="products"  && <ProductsTab  products={products} setProducts={setProducts}/>}\n'
    '        {tab==="countries" && <CountriesTab products={products} allocs={allocs} setAllocs={setAllocs}/>}',
    '        {tab==="dashboard" && <DashboardTab products={products} allocs={allocs} dateFrom={analyticsFrom} setDateFrom={setAnalyticsFrom} dateTo={analyticsTo} setDateTo={setAnalyticsTo} status={analyticsStatus} setStatus={setAnalyticsStatus} realRows={analyticsRows} setRealRows={setAnalyticsRows} errorMsg={analyticsError} setErrorMsg={setAnalyticsError}/>}\n'
    '        {tab==="products"  && <ProductsTab  products={products} setProducts={setProducts} allocs={allocs} setTab={setTab}/>}\n'
    '        {tab==="countries" && <CountriesTab products={products} allocs={allocs} setAllocs={setAllocs}/>}\n'
    '        {tab==="allocate"  && <AllocateTab  products={products} allocs={allocs} setProducts={setProducts} setAllocs={setAllocs}/>}\n'
    '        {tab==="budget"    && <BudgetTab    products={products} allocs={allocs} orders={orders} setOrders={setOrders} transactions={transactions} setTransactions={setTransactions} displayName={displayName} appUsers={appUsers} isAdmin={isAdmin} analyticsRows={analyticsRows} analyticsFrom={analyticsFrom} analyticsTo={analyticsTo} analyticsStatus={analyticsStatus}/>}\n'
    '        {tab==="admin"     && isAdmin && <AdminTab appUsers={appUsers} setAppUsers={setAppUsers}/>}'
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
    type:"Regular", bpRegular:"", bpPremium:"",
    discountPct:0, demandLevel:"Medium", redashName:"",
    vendor:"GCOW", purpose:"MP", lootkeyscode:"",
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
      currency: f.currency, category: f.category, provider: f.vendor||"GCOW", type: f.type,
      bpRegular:   parseFloat(f.bpRegular)   || null,
      bpPremium:   parseFloat(f.bpPremium)   || null,
      discountPct: parseFloat(f.discountPct) || 0,
      demandLevel: f.demandLevel,
      redashName: (f.redashName||"").trim(),
      vendor: f.vendor||"GCOW",
      purpose: f.purpose||"MP",
      lootkeyscode: (f.lootkeyscode||"").trim(),
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
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="Redash Product Name (optional)" hint="Exact product name as it appears in Redash (e.g. '$10 Riot Access Code'). Used to match Redash data to this product. If left blank, auto-matching by brand name + price is used.">
                <Input value={f.redashName||""} onChange={e=>set("redashName",e.target.value)}
                  placeholder="e.g. $10 Riot Access Code — leave blank for auto-match"/>
              </Field>
            </div>
            <Field label="Category">
              <Select value={f.category} onChange={e=>set("category",e.target.value)}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Vendor" hint="Who we purchase this product from">
              <Select value={f.vendor||"GCOW"} onChange={e=>set("vendor",e.target.value)}>
                {VENDORS.map(v=><option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Purpose" hint="MP = Marketplace, Raffles, Buff Pass">
              <Select value={f.purpose||"MP"} onChange={e=>set("purpose",e.target.value)}>
                {PURPOSES.map(p=><option key={p}>{p}</option>)}
              </Select>
            </Field>
            {(f.vendor||"GCOW")==="Loot Keys" && (
              <div style={{gridColumn:"1/-1"}}>
                <Field label="Loot Keys Code" hint="Internal Loot Keys product code (e.g. STEAM-10-USD)">
                  <Input value={f.lootkeyscode||""} onChange={e=>set("lootkeyscode",e.target.value)}
                    placeholder="e.g. STEAM-10-USD"/>
                </Field>
              </div>
            )}
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

// ── COUNTRY DRILL-DOWN ────────────────────────────────────────────────────────

function hashNum(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function CountryDrillDown({ country, globalFrom, globalTo, allocs, products, onBack }) {
  const [dateFrom, setDateFrom] = useState(globalFrom);
  const [dateTo,   setDateTo]   = useState(globalTo);
  const days = Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1);

  // Products allocated to this country
  const countryProds = (allocs[country] || [])
    .map(a => products.find(p => p.id === a.productId))
    .filter(Boolean);

  const [selId, setSelId] = useState(() => countryProds[0]?.id ?? null);
  const selProd = countryProds.find(p => p.id === selId) || countryProds[0] || null;

  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  // Deterministic mock data — stable per product+date, realistic daily shape
  const mockDaily = useMemo(() => {
    if (!selProd) return [];
    const pid   = String(selProd.id);
    const base  = 25 + (hashNum(pid) % 55);
    const start = new Date(dateFrom + "T00:00:00");
    return Array.from({ length: days }, (_, i) => {
      const d  = new Date(start); d.setDate(d.getDate() + i);
      const ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
      const dow = d.getDay();
      const wf  = (dow === 0 || dow === 6) ? 0.62 : 1;
      const noise = hashNum(pid + ds) % 32;
      const wave  = Math.round(Math.sin(i / 7 * Math.PI) * 8);
      return { date: ds, v: Math.max(0, Math.round((base + noise + wave) * wf)) };
    });
  }, [selProd?.id, dateFrom, dateTo]);

  // ── Real daily data — Redash query 2613 ─────────────────────────────────────
  const [dailyData,   setDailyData]   = useState(null);  // null = not yet fetched
  const [dailyStatus, setDailyStatus] = useState("idle"); // idle|loading|done|error
  const [dailyError,  setDailyError]  = useState("");

  // Reset when product or date range changes — user must re-fetch
  useEffect(() => {
    setDailyData(null); setDailyStatus("idle"); setDailyError("");
  }, [selId, dateFrom, dateTo]);

  async function fetchDailyData() {
    if (!selProd) return;
    setDailyStatus("loading"); setDailyData(null); setDailyError("");
    try {
      const url = `${PROXY_URL}?action=redash_daily&country=${encodeURIComponent(country)}&from=${dateFrom}&to=${dateTo}&product=${encodeURIComponent(selProd.brand)}`;
      const r = await fetch(url);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const rows = (d.rows || [])
        .map(row => ({
          date: row.date || row.day || row.purchase_date || "",
          v:    Number(row.purchases || row.purchase_count || row.count || 0),
        }))
        .filter(r => r.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      setDailyData(rows);
      setDailyStatus("done");
    } catch(e) {
      setDailyError(e.message);
      setDailyStatus("error");
    }
  }

  // Active data: real when fetched, mock otherwise
  const activeData = useMemo(() => dailyData !== null ? dailyData : mockDaily, [dailyData, mockDaily]);
  const usingMock  = dailyData === null;

  // Build / rebuild Chart.js instance whenever data changes
  useEffect(() => {
    if (!chartRef.current || typeof Chart === "undefined") return;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!activeData.length) return;
    const useLine = days > 28;
    chartInst.current = new Chart(chartRef.current, {
      type: useLine ? "line" : "bar",
      data: {
        labels: activeData.map(d => {
          const dt = new Date(d.date + "T00:00:00");
          return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        }),
        datasets: [{
          data: activeData.map(d => d.v),
          backgroundColor: useLine ? "rgba(200,255,0,0.07)" : "rgba(200,255,0,0.6)",
          borderColor: "#c8ff00",
          borderWidth: useLine ? 2 : 1,
          borderRadius: useLine ? 0 : 3,
          fill: useLine,
          tension: 0.35,
          pointRadius: days > 60 ? 0 : 3,
          pointBackgroundColor: "#c8ff00",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111",
            borderColor: "#2a2a2a",
            borderWidth: 1,
            titleColor: "#666",
            bodyColor: "#f1f5f9",
            padding: 10,
            callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString()} purchases` },
          },
        },
        scales: {
          x: {
            ticks: { color: "#444", maxTicksLimit: 15, font: { size: 10 } },
            grid:  { color: "rgba(255,255,255,0.03)" },
            border: { color: "#1a1a1a" },
          },
          y: {
            ticks: { color: "#444", font: { size: 11 } },
            grid:  { color: "rgba(255,255,255,0.05)" },
            border: { color: "#1a1a1a" },
            beginAtZero: true,
          },
        },
      },
    });
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [activeData]);

  const total = activeData.reduce((s, d) => s + d.v, 0);
  const avg   = days > 0 ? Math.round(total / days) : 0;
  const peak  = activeData.length ? Math.max(...activeData.map(d => d.v)) : 0;

  // ── Planned baseline — derived from allocs (no extra API call needed) ───────
  const allocation    = (allocs[country] || []).find(a => a.productId === selId);
  const plannedPerDay = allocation ? allocation.pulsesPerDay * allocation.qtyPerPulse : 0;
  const totalPlanned  = plannedPerDay * days;
  const gap           = total - totalPlanned;
  const coverage      = totalPlanned > 0 ? Math.round(total / totalPlanned * 100) : null;

  // Per-day deviation vs planned, 20% anomaly threshold
  const deviations = useMemo(() => activeData.map(d => {
    const dev    = d.v - plannedPerDay;
    const devPct = plannedPerDay > 0 ? dev / plannedPerDay : null;
    return { date:d.date, real:d.v, dev, devPct, isAnomaly: devPct!==null && Math.abs(devPct) > 0.20 };
  }), [activeData, plannedPerDay]);
  const anomalyCount = deviations.filter(d => d.isAnomaly).length;

  // Chart 2: combo — bars = real (green/red by gap), line = planned (dashed)
  const chart2Ref  = useRef(null);
  const chart2Inst = useRef(null);

  useEffect(() => {
    if (!chart2Ref.current || typeof Chart === "undefined" || !deviations.length) return;
    if (chart2Inst.current) { chart2Inst.current.destroy(); chart2Inst.current = null; }
    const labels = deviations.map(d => {
      const dt = new Date(d.date + "T00:00:00");
      return dt.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
    });
    const barBg  = deviations.map(d => d.devPct===null?"rgba(100,100,100,0.4)":d.dev>=0?"rgba(74,222,128,0.6)":"rgba(248,113,113,0.6)");
    const barBdr = deviations.map(d => d.devPct===null?"#555":d.dev>=0?"#4ade80":"#f87171");
    chart2Inst.current = new Chart(chart2Ref.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { type:"bar",  label:"Real",    data:deviations.map(d=>d.real),
            backgroundColor:barBg, borderColor:barBdr, borderWidth:1, borderRadius:3, order:2 },
          { type:"line", label:"Planned", data:deviations.map(()=>plannedPerDay),
            borderColor:"rgba(255,255,255,0.22)", borderWidth:2, borderDash:[5,4],
            pointRadius:0, fill:false, tension:0, order:1 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:{duration:250},
        plugins: {
          legend:{ display:true, labels:{ color:"#555", boxWidth:12, font:{size:11} } },
          tooltip:{
            backgroundColor:"#111", borderColor:"#2a2a2a", borderWidth:1,
            titleColor:"#666", bodyColor:"#f1f5f9", padding:10,
            callbacks:{
              afterBody: items => {
                const d = deviations[items[0]?.dataIndex];
                if (!d) return [];
                const pct = d.devPct!==null ? ` (${d.dev>=0?"+":""}${Math.round(d.devPct*100)}%)` : "";
                return [`Gap: ${d.dev>=0?"+":""}${d.dev.toLocaleString()}${pct}`, d.isAnomaly?"⚠ Anomaly (>20%)":""];
              },
            },
          },
        },
        scales: {
          x:{ ticks:{color:"#444",maxTicksLimit:15,font:{size:10}}, grid:{color:"rgba(255,255,255,0.03)"}, border:{color:"#1a1a1a"} },
          y:{ ticks:{color:"#444",font:{size:11}}, grid:{color:"rgba(255,255,255,0.05)"}, border:{color:"#1a1a1a"}, beginAtZero:true },
        },
      },
    });
    return () => { if (chart2Inst.current) { chart2Inst.current.destroy(); chart2Inst.current = null; } };
  }, [deviations, plannedPerDay]);

  return (
    <div>
      {/* ── Back + title ── */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}>
        <button onClick={onBack}
          style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",padding:"8px 16px",
            borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:6}}>
          ← Back
        </button>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>Country Detail</div>
          <div style={{fontSize:24,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em"}}>{country}</div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12,
        padding:"18px 22px",marginBottom:24,display:"flex",gap:20,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>Product</div>
          {countryProds.length === 0
            ? <span style={{color:"#444",fontSize:13}}>No products allocated</span>
            : <select value={selId ?? ""} onChange={e => setSelId(Number(e.target.value))}
                style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",
                  fontSize:13,padding:"9px 13px",outline:"none",fontFamily:"inherit",minWidth:220}}>
                {countryProds.map(p => <option key={p.id} value={p.id}>{usd(calcPriceUSD(p))} {p.brand}</option>)}
              </select>
          }
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>From</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>To</div>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
        </div>
        {(dateFrom !== globalFrom || dateTo !== globalTo) && (
          <button onClick={() => { setDateFrom(globalFrom); setDateTo(globalTo); }}
            style={{background:"none",border:"1px solid #2a2a2a",color:"#555",padding:"8px 14px",
              borderRadius:8,cursor:"pointer",fontSize:11,fontFamily:"inherit",alignSelf:"flex-end"}}>
            Reset to global
          </button>
        )}
        <div style={{marginLeft:"auto",alignSelf:"flex-end"}}>
          <button onClick={fetchDailyData} disabled={dailyStatus==="loading"||!selProd}
            style={{background:"#c8ff00",color:"#0a0a0a",border:"none",borderRadius:8,
              padding:"9px 20px",fontSize:12,fontWeight:800,fontFamily:"inherit",
              cursor:dailyStatus==="loading"||!selProd?"not-allowed":"pointer",
              opacity:dailyStatus==="loading"?0.6:1}}>
            {dailyStatus==="loading"?"Loading...":dailyStatus==="done"?"↺ Refresh":"Fetch Real Data"}
          </button>
          {dailyStatus==="error"&&<div style={{fontSize:11,color:"#f87171",marginTop:5,maxWidth:220}}>{dailyError}</div>}
        </div>
      </div>

      {/* ── Viz 1: Daily purchases by product ── */}
      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"24px 28px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:4}}>
              Daily Purchases — {selProd ? selProd.brand : "—"}
            </div>
            <div style={{fontSize:11,color:"#555"}}>
              {dateFrom} → {dateTo} · {days} day{days!==1?"s":""} · {usingMock?<span style={{color:"rgba(200,255,0,0.3)"}}>mock data</span>:<span style={{color:"#4ade80",fontWeight:700}}>live data</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:24,flexShrink:0}}>
            {[["Total",total.toLocaleString()],["Daily avg",avg.toLocaleString()],["Peak",peak.toLocaleString()]].map(([l,v])=>(
              <div key={l} style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{l}</div>
                <div style={{fontSize:18,fontWeight:900,color:"#c8ff00",letterSpacing:"-0.02em"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{position:"relative",height:260}}>
          {countryProds.length === 0
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#333",fontSize:13}}>No products allocated to this country</div>
            : <canvas ref={chartRef}/>
          }
        </div>
      </div>

      {/* ── Viz 2: Allocation vs Reality — Anomaly View ── */}
      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"24px 28px"}}>

        {/* Header + summary stats */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:4}}>
              Allocation vs Reality — Anomaly View
            </div>
            <div style={{fontSize:11,color:"#555"}}>
              Planned: {plannedPerDay.toLocaleString()} units/day · threshold ±20% · {usingMock?<span style={{color:"rgba(200,255,0,0.3)"}}>mock data</span>:<span style={{color:"#4ade80",fontWeight:700}}>live data</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:20,flexShrink:0}}>
            {[
              ["Total Planned", totalPlanned.toLocaleString(),                           "#555"],
              ["Total Real",    total.toLocaleString(),                                  "#c8ff00"],
              ["Gap",           (gap>=0?"+":"")+gap.toLocaleString(),                    gap>=0?"#4ade80":"#f87171"],
              ["Coverage",      coverage!==null?coverage+"%":"—",                        coverage===null?"#555":coverage>=80?"#4ade80":coverage>=50?"#fb923c":"#f87171"],
              ["Anomaly days",  String(anomalyCount),                                    anomalyCount>0?"#fb923c":"#4ade80"],
            ].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{l}</div>
                <div style={{fontSize:16,fontWeight:900,color:c,letterSpacing:"-0.02em"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Combo chart: green/red bars = real, dashed line = planned */}
        <div style={{position:"relative",height:240,marginBottom:anomalyCount>0?20:0}}>
          {plannedPerDay === 0
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#333",fontSize:13}}>
                No allocation found for this product in {country}
              </div>
            : <canvas ref={chart2Ref}/>
          }
        </div>

        {/* Anomaly day list */}
        {anomalyCount > 0 && (
          <div style={{borderTop:"1px solid #1a1a1a",paddingTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#fb923c",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>
              ⚠ Anomaly Days ({anomalyCount})
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {deviations.filter(d=>d.isAnomaly).map(d=>(
                <div key={d.date} style={{background:"rgba(251,146,60,0.07)",border:"1px solid rgba(251,146,60,0.18)",borderRadius:8,padding:"6px 12px",fontSize:11}}>
                  <span style={{color:"#f1f5f9",fontWeight:700}}>{d.date}</span>
                  <span style={{color:d.dev>=0?"#4ade80":"#f87171",marginLeft:8,fontWeight:700}}>
                    {d.dev>=0?"+":""}{d.dev.toLocaleString()} ({d.devPct!==null?Math.round(d.devPct*100):0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REAL DATA CONNECTION POINT ─────────────────────────────────────────
            Replace mockDaily with a Redash query returning per-day data:
              [{ date: "YYYY-MM-DD", country: "XX", product_name: "Brand", purchases: N }]
            Filter: rows where country === props.country && product_name matches selProd.brand
            Map to mockDaily shape: { date, v: purchases }
            Trigger: useEffect on [selId, dateFrom, dateTo] — fetch + setMockDaily (or new state)
        ──────────────────────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}

// ── PRODUCT MATCHING ──────────────────────────────────────────────────────────
// Score-based match: Redash product name (e.g. "$10 Riot Access Code US")
// vs internal allocs (brand="Riot", price=$10).
// Scoring:
//   4 — brand substring match AND price match  → strong match
//   3 — brand substring match, no $ in Redash name (no price to compare)
//   2 — brand substring match, prices differ   → weak (different tier)
//   1 — price match only, no brand             → ignored
// Requires score ≥ 3; picks highest scorer when multiple allocs qualify.

// Returns { alloc, score, via } or null.
// Matching priority:
//   1. redashName configured on product → exact Redash name match (score 5, most reliable)
//   2. brand + price both match         → score 4
//   3. brand match, no $ in Redash name → score 3
//   4. brand match, price differs       → score 2 (weak — different tier)
// Only score ≥ 3 is considered a real match; score 2 is flagged as weak.
function matchProduct(redashName, countryAllocs, products) {
  const redashPrice = priceFromName(redashName);
  const nameLower   = redashName.toLowerCase();
  let bestScore = 0, bestResult = null;

  for (const alloc of countryAllocs) {
    const prod = products.find(p => p.id === alloc.productId);
    if (!prod) continue;

    const configuredName = (prod.redashName || "").trim();
    const internalUsd    = calcPriceUSD(prod);
    let score = 0, via = "";

    if (configuredName) {
      // Priority 1: user-configured Redash product name (includes price in name)
      if (nameLower.includes(configuredName.toLowerCase())) { score = 5; via = "exact"; }
    } else {
      // Priority 2-4: auto-match by brand + price
      const brandLower = prod.brand.toLowerCase();
      const hasBrand   = nameLower.includes(brandLower);
      const hasPrice   = redashPrice > 0 && internalUsd > 0;
      const priceClose = hasPrice && Math.abs(redashPrice - internalUsd) / Math.max(redashPrice, internalUsd) < 0.02;

      if      (hasBrand && priceClose) { score = 4; via = "auto"; }
      else if (hasBrand && !hasPrice)  { score = 3; via = "auto"; }
      else if (hasBrand)               { score = 2; via = "auto"; }
    }

    if (score > bestScore) { bestScore = score; bestResult = { alloc, score, via }; }
  }

  if (bestScore >= 3) return bestResult;
  if (bestScore === 2) return { ...bestResult, weak: true };
  return null;
}

// ── COUNTRY PRODUCT VIEW ──────────────────────────────────────────────────────
// Drill-down from Dashboard: shows products from Redash 2672 for one country,
// matched against planned allocations with gap/utilization per product.

function CountryProductView({ country, globalFrom, globalTo, allocs, products, realRows, days, onBack }) {
  const [selProduct, setSelProduct] = useState(null);

  const fmtUsd = v => {
    const abs = Math.abs(v);
    const s = abs >= 1000 ? (abs/1000).toFixed(1)+"K" : abs.toFixed(0);
    return (v < 0 ? "-" : "") + "$" + s;
  };

  // Group Redash rows for this country by product_name
  const redashProducts = useMemo(() => {
    const map = {};
    realRows
      .filter(r => (r.country || "").toUpperCase() === country)
      .forEach(r => {
        const k = r.product_name || "Unknown";
        if (!map[k]) map[k] = { name: k, units: 0, spend: 0 };
        map[k].units += Number(r.purchases) || 0;
        map[k].spend += (Number(r.purchases) || 0) * priceFromName(k);
      });
    return Object.values(map).sort((a, b) => b.spend - a.spend);
  }, [realRows, country]);

  const countryAllocs = allocs[country] || [];

  // Use score-based matching
  function findMatch(redashName) {
    return matchProduct(redashName, countryAllocs, products);
  }

  // Planned $ total for an alloc over the period
  function plannedTotal(alloc) {
    const prod = products.find(p => p.id === alloc.productId);
    if (!prod) return 0;
    return alloc.pulsesPerDay * alloc.qtyPerPulse * calcPriceUSD(prod) * days;
  }

  // Planned products that had no Redash match (score >= 3)
  const matchedProdIds = new Set(
    redashProducts.map(rp => findMatch(rp.name)).filter(m => m && !m.weak).map(m => m.alloc.productId)
  );
  const unmatchedAllocs = countryAllocs.filter(a => !matchedProdIds.has(a.productId));

  const totalActual  = redashProducts.reduce((s, p) => s + p.spend, 0);
  const totalPlanned = countryAllocs.reduce((s, a) => s + plannedTotal(a), 0);
  const overallUtil  = totalPlanned > 0 ? totalActual / totalPlanned : null;

  const TH = (s, c="#444") => <th style={{textAlign:"left",padding:"11px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;

  // Navigate to per-day chart
  if (selProduct !== null) return (
    <CountryDrillDown
      country={country}
      globalFrom={globalFrom}
      globalTo={globalTo}
      allocs={allocs}
      products={products}
      onBack={() => setSelProduct(null)}
    />
  );

  return (
    <div>
      {/* Back + title */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}>
        <button onClick={onBack}
          style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",padding:"8px 16px",
            borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:6}}>
          ← Back
        </button>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>Country Detail</div>
          <div style={{fontSize:24,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em"}}>{country}</div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          { label:"Period",         value:`${days}d`,               sub:`${globalFrom} → ${globalTo}`,    color:"#f1f5f9" },
          { label:"Actual Spend",   value:fmtUsd(totalActual),      sub:"from Redash 2672",               color:"#c8ff00" },
          { label:"Planned Spend",  value:fmtUsd(totalPlanned),     sub:`${fmtUsd(Math.round(totalPlanned/days))}/day × ${days} days`,  color:"#555"    },
          { label:"Utilization",    value:overallUtil!==null?Math.round(overallUtil*100)+"%":"—",
            sub:"actual ÷ planned",
            color:overallUtil===null?"#555":overallUtil>=0.8?"#4ade80":overallUtil>=0.5?"#fb923c":"#f87171" },
        ].map(({label,value,sub,color})=>(
          <div key={label} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"16px 20px"}}>
            <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{label}</div>
            <div style={{fontSize:20,fontWeight:900,color,letterSpacing:"-0.03em",lineHeight:1}}>{value}</div>
            <div style={{fontSize:11,color:"#333",marginTop:5}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Products table */}
      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Products — Redash vs Plan</div>
          <div style={{fontSize:11,color:"#333"}}>Click a row for daily chart →</div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{[
            TH("Product (Redash)"),
            TH("Units"),
            TH("Actual Spend","#c8ff00"),
            TH("Matched Plan","#555"),
            TH("Planned Total","#555"),
            TH("Gap"),
            TH("Utilization"),
          ]}</tr></thead>
          <tbody>
            {redashProducts.map(({name,units,spend})=>{
              const matchResult = findMatch(name);
              const alloc       = matchResult ? matchResult.alloc : null;
              const isWeak      = matchResult ? !!matchResult.weak : false;
              const matchedProd = alloc ? products.find(p => p.id === alloc.productId) : null;
              const planned     = alloc && !isWeak ? plannedTotal(alloc) : null;
              const gap         = planned !== null ? spend - planned : null;
              const util        = planned !== null && planned > 0 ? spend / planned : null;
              const pct         = util !== null ? Math.round(util*100) : null;
              const col         = pct===null?"#444":pct>=80?"#4ade80":pct>=50?"#fb923c":"#f87171";
              return (
                <tr key={name}
                  onClick={()=>setSelProduct(name)}
                  style={{borderBottom:"1px solid #111",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(200,255,0,0.03)"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"10px 16px"}}>
                    <div style={{fontWeight:700,color:"#f1f5f9"}}>{name}</div>
                  </td>
                  <td style={{padding:"10px 16px",color:"#888"}}>{units.toLocaleString()}</td>
                  <td style={{padding:"10px 16px",fontWeight:700,color:"#c8ff00"}}>{fmtUsd(spend)}</td>
                  <td style={{padding:"10px 16px",fontSize:12}}>
                    {matchedProd && !isWeak ? (
                      <>
                        <span style={{color:"#888",fontWeight:700}}>{matchedProd.brand}</span>
                        {matchedProd.redashName ? <span style={{fontSize:10,color:G,marginLeft:6,fontWeight:700}} title={matchedProd.redashName}>exact</span> : <span style={{fontSize:10,color:"#444",marginLeft:6}}>auto</span>}
                        <br/>
                        <span style={{color:"#333"}}>{alloc.pulsesPerDay}×{alloc.qtyPerPulse}/d · {usd(calcPriceUSD(matchedProd))}</span>
                      </>
                    ) : matchedProd && isWeak ? (
                      <span style={{color:"#fb923c",fontSize:11}}>⚠ {matchedProd.brand} (price mismatch)</span>
                    ) : (
                      <span style={{color:"#2a2a2a"}}>— no match</span>
                    )}
                  </td>
                  <td style={{padding:"10px 16px",color:"#555"}}>
                    {planned!==null ? (
                      <>
                        <div style={{fontWeight:700,color:"#888"}}>{fmtUsd(planned)}</div>
                        <div style={{fontSize:11,color:"#333",marginTop:2}}>{fmtUsd(Math.round(planned/days))}/day</div>
                      </>
                    ) : "—"}
                  </td>
                  <td style={{padding:"10px 16px",fontWeight:700,color:gap===null?"#333":gap>=0?"#4ade80":"#f87171"}}>
                    {gap!==null?(gap>=0?"+":"")+fmtUsd(gap):"—"}
                  </td>
                  <td style={{padding:"10px 16px",minWidth:130}}>
                    {pct!==null ? (
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${Math.min(pct/150*100,100)}%`,height:"100%",background:col,borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:col,width:38,textAlign:"right"}}>{pct}%</span>
                      </div>
                    ) : <span style={{color:"#333",fontSize:11}}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {redashProducts.length===0 && (
          <div style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>
            No Redash data found for <strong style={{color:"#f1f5f9"}}>{country}</strong> in this period.
          </div>
        )}
      </div>

      {/* Planned products with no Redash match */}
      {unmatchedAllocs.length > 0 && (
        <div style={{background:"#0d0d0d",border:"1px solid rgba(251,146,60,0.2)",borderRadius:14,padding:"20px 24px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#fb923c",marginBottom:12}}>
            ⚠ Planned products with no Redash match ({unmatchedAllocs.length})
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {unmatchedAllocs.map(a => {
              const prod = products.find(p => p.id === a.productId);
              if (!prod) return null;
              return (
                <div key={a.productId} style={{background:"rgba(251,146,60,0.05)",border:"1px solid rgba(251,146,60,0.15)",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{prod.brand}</div>
                  <div style={{fontSize:11,color:"#555",marginTop:3}}>
                    {a.pulsesPerDay}×{a.qtyPerPulse}/d · {fmtUsd(plannedTotal(a))} planned · {usd(calcPriceUSD(prod))}/unit
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ANALYTICS TAB ─────────────────────────────────────────────────────────────

const REDASH_URL  = "https://redash.app.buff.game";
const REDASH_KEY  = "01qFvUfEP15v9DPFCPAcl8Fc9mWeWcPKtaN13ZxZ";
const REDASH_QID  = 2672;
const PROXY_URL   = "https://script.google.com/macros/s/AKfycbwwvjZHPkTUIkTrRvdA6TRfxspBKppKa5wm-AsvPnlZ7__EOJiIxPsTxDDXXqtzVSsy/exec";

function AnalyticsTab({ products, allocs, dateFrom, setDateFrom, dateTo, setDateTo, status, setStatus, realRows, setRealRows, errorMsg, setErrorMsg }) {

  const days = Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1);
  const [drillCountry, setDrillCountry] = useState(null);

  async function pollJob(jobId) {
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const r = await fetch(`${REDASH_URL}/api/jobs/${jobId}`, { headers:{ Authorization:`Key ${REDASH_KEY}` } });
      const d = await r.json();
      if (d.job.status === 3) return d.job.query_result_id;
      if (d.job.status === 4) throw new Error(d.job.error || "Query failed");
    }
    throw new Error("Timeout waiting for query");
  }

  async function fetchData() {
    setStatus("loading"); setRealRows([]); setErrorMsg("");
    try {
      const r = await fetch(`${PROXY_URL}?action=redash&from=${dateFrom}&to=${dateTo}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRealRows(d.rows || []);
      setStatus("done");
    } catch(e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }

  // Build comparison: for each country in allocs, sum planned vs real
  const comparison = useMemo(() => {
    const realByCountry = {};
    realRows.forEach(r => {
      const c = (r.country||"").toUpperCase();
      if (!realByCountry[c]) realByCountry[c] = 0;
      realByCountry[c] += Number(r.purchases) || 0;
    });

    return COUNTRIES.map(c => {
      const rows = allocs[c] || [];
      const plannedPerDay = rows.reduce((s, r) => s + r.pulsesPerDay * r.qtyPerPulse, 0);
      const planned = plannedPerDay * days;
      const real    = realByCountry[c] || 0;
      const util    = planned > 0 ? real / planned : null;
      return { country:c, planned, real, util, active: planned > 0 || real > 0 };
    }).filter(r => r.active).sort((a,b) => b.real - a.real);
  }, [realRows, allocs, days]);

  // Top products
  const topProducts = useMemo(() => {
    const map = {};
    realRows.forEach(r => {
      const k = r.product_name || "Unknown";
      map[k] = (map[k]||0) + (Number(r.purchases)||0);
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [realRows]);

  const maxReal = comparison.length ? Math.max(...comparison.map(r=>r.real), 1) : 1;
  const maxProd = topProducts.length ? topProducts[0][1] : 1;

  const TH = (s,c="#444") => <th style={{textAlign:"left",padding:"11px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;

  if (drillCountry !== null) return (
    <CountryDrillDown
      country={drillCountry}
      globalFrom={dateFrom}
      globalTo={dateTo}
      allocs={allocs}
      products={products}
      onBack={() => setDrillCountry(null)}
    />
  );

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em",marginBottom:4}}>Analytics</div>
          <div style={{fontSize:13,color:"#555"}}>Real purchases from Redash vs planned allocations</div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>From</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>To</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
          </div>
          <button onClick={fetchData} disabled={status==="loading"}
            style={{background:"#c8ff00",color:"#0a0a0a",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:800,cursor:status==="loading"?"not-allowed":"pointer",fontFamily:"inherit",opacity:status==="loading"?0.6:1}}>
            {status==="loading" ? "Loading..." : "Fetch Data"}
          </button>
        </div>
      </div>

      {/* Large range warning */}
      {days > 90 && status !== "loading" && (
        <div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:18}}>⚠️</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#fb923c",marginBottom:2}}>Large date range ({days} days)</div>
            <div style={{fontSize:12,color:"#7a4a1a"}}>Queries over 90 days may take longer or timeout. Consider splitting into smaller ranges.</div>
          </div>
        </div>
      )}

      {/* Error */}
      {status==="error" && (
        <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"16px 20px",color:"#f87171",marginBottom:20,fontSize:13}}>
          {errorMsg.includes("Timeout")
            ? <><strong>Timeout</strong> — the query took too long. Try a smaller date range (under 90 days).</>
            : <>Error: {errorMsg}</>}
        </div>
      )}

      {/* Loading */}
      {status==="loading" && (
        <div style={{textAlign:"center",padding:60,color:"#444",fontSize:13}}>
          <div style={{fontSize:28,marginBottom:12}}>⏳</div>
          Querying Redash...{days > 90 ? " large range, this may take a few minutes" : " this may take up to 30 seconds"}
        </div>
      )}

      {/* Results */}
      {status==="done" && (
        <div>
          {/* Summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              { label:"Period", value:`${days} days`, sub:`${dateFrom} → ${dateTo}` },
              { label:"Total Real Purchases", value:realRows.reduce((s,r)=>s+(Number(r.purchases)||0),0).toLocaleString(), sub:"confirmed transactions" },
              { label:"Countries Active", value:comparison.filter(r=>r.real>0).length, sub:`of ${comparison.length} planned` },
              { label:"Avg Utilization", value: (() => { const active=comparison.filter(r=>r.util!==null); return active.length ? Math.round(active.reduce((s,r)=>s+r.util,0)/active.length*100)+"%" : "—"; })(), sub:"real ÷ planned" },
            ].map(({label,value,sub})=>(
              <div key={label} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"18px 20px"}}>
                <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{label}</div>
                <div style={{fontSize:24,fontWeight:900,color:"#c8ff00",letterSpacing:"-0.03em",lineHeight:1}}>{value}</div>
                <div style={{fontSize:11,color:"#333",marginTop:6}}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,marginBottom:16}}>
            {/* Planned vs Real table */}
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Planned vs Real — by Country</div>
                <div style={{fontSize:11,color:"#333"}}>Click a row to drill down →</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>{[TH("Country"),TH("Planned","#555"),TH("Real","#c8ff00"),TH("Utilization")]}</tr></thead>
                <tbody>
                  {comparison.map(({country,planned,real,util})=>{
                    const pct = util !== null ? Math.round(util*100) : null;
                    const bar = util !== null ? Math.min(util, 1.5) : 0;
                    const col = pct===null?"#444":pct>=80?"#4ade80":pct>=50?"#fb923c":"#f87171";
                    return (
                      <tr key={country}
                        onClick={()=>setDrillCountry(country)}
                        style={{borderBottom:"1px solid #111",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(200,255,0,0.03)"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"10px 16px",fontWeight:800,color:"#c8ff00"}}>{country}</td>
                        <td style={{padding:"10px 16px",color:"#555"}}>{planned.toLocaleString()}</td>
                        <td style={{padding:"10px 16px",fontWeight:700,color:"#c8ff00"}}>{real.toLocaleString()}</td>
                        <td style={{padding:"10px 16px",minWidth:160}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:`${Math.min(bar/1.5*100,100)}%`,height:"100%",background:col,borderRadius:3}}/>
                            </div>
                            <span style={{fontSize:12,fontWeight:700,color:col,width:38,textAlign:"right"}}>
                              {pct!==null?pct+"%":"—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {comparison.length===0&&<div style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>No allocation data found for this period.</div>}
            </div>

            {/* Top products */}
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"20px 24px"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>Top Products</div>
              <div style={{fontSize:11,color:"#444",marginBottom:20}}>By real purchase count</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {topProducts.map(([name,count])=>(
                  <div key={name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#f1f5f9",flexShrink:0,marginLeft:8}}>{count.toLocaleString()}</span>
                    </div>
                    <div style={{height:5,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${(count/maxProd)*100}%`,height:"100%",background:"#c8ff00",borderRadius:3}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {status==="idle" && (
        <div style={{textAlign:"center",padding:80,color:"#333",fontSize:13}}>
          <div style={{fontSize:32,marginBottom:16}}>📊</div>
          Select a date range and click <strong style={{color:"#f1f5f9"}}>Fetch Data</strong> to load real purchase data from Redash
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD TAB ─────────────────────────────────────────────────────────────

function priceFromName(name) {
  const m = /\$(\d+(?:\.\d+)?)/.exec(name || "");
  return m ? parseFloat(m[1]) : 0;
}

function DashboardTab({ products, allocs, dateFrom, setDateFrom, dateTo, setDateTo, status, setStatus, realRows, setRealRows, errorMsg, setErrorMsg }) {
  const days = Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1);
  const [drillCountry, setDrillCountry] = useState(null);

  async function fetchData() {
    setStatus("loading"); setRealRows([]); setErrorMsg("");
    try {
      const r = await fetch(`${PROXY_URL}?action=redash&from=${dateFrom}&to=${dateTo}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRealRows(d.rows || []);
      setStatus("done");
    } catch(e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }

  // Planned budget per country — always available from allocs
  const plannedOnly = useMemo(() => {
    return COUNTRIES.map(c => {
      const rows = allocs[c] || [];
      const planned = rows.reduce((s, a) => {
        const prod = products.find(p => p.id === a.productId);
        return s + a.pulsesPerDay * a.qtyPerPulse * (prod ? calcPriceUSD(prod) : 0) * days;
      }, 0);
      return { country: c, planned };
    }).filter(r => r.planned > 0).sort((a, b) => b.planned - a.planned);
  }, [allocs, products, days]);

  // Actual spend by country (from Redash) merged with planned
  const comparison = useMemo(() => {
    const spendByCountry = {};
    if (status === "done") {
      realRows.forEach(r => {
        const c = (r.country || "").toUpperCase();
        const price = priceFromName(r.product_name);
        if (!spendByCountry[c]) spendByCountry[c] = 0;
        spendByCountry[c] += (Number(r.purchases) || 0) * price;
      });
    }
    return plannedOnly.map(({ country, planned }) => {
      const actual = spendByCountry[country] || 0;
      const util = status === "done" && planned > 0 ? actual / planned : null;
      return { country, planned, actual, util };
    });
  }, [plannedOnly, realRows, status]);

  // Top products by actual spend
  const topProducts = useMemo(() => {
    const map = {};
    realRows.forEach(r => {
      const k = r.product_name || "Unknown";
      const price = priceFromName(r.product_name);
      map[k] = (map[k] || 0) + (Number(r.purchases) || 0) * price;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [realRows]);

  const totalPlanned = plannedOnly.reduce((s, r) => s + r.planned, 0);
  const totalActual  = realRows.reduce((s, r) => s + (Number(r.purchases)||0) * priceFromName(r.product_name), 0);

  // Planned vs actual by vendor (for visualization)
  const plannedByVendor = useMemo(() => {
    const m = {};
    Object.values(allocs).forEach(cr => cr.forEach(alloc => {
      const p = products.find(x => x.id === alloc.productId);
      if (!p) return;
      const v = p.vendor || p.provider || "Unknown";
      if (!m[v]) m[v] = 0;
      m[v] += calcRealDaily(p, alloc) * days;
    }));
    return m;
  }, [products, allocs, days]);

  const actualByVendor = useMemo(() => {
    if (status !== "done") return {};
    const allAllocRows = Object.values(allocs).flat();
    const m = {};
    realRows.forEach(r => {
      const match = matchProduct(r.product_name, allAllocRows, products);
      if (!match) return;
      const prod = products.find(p => p.id === match.alloc.productId);
      const v = prod ? (prod.vendor || prod.provider || "Unknown") : null;
      if (!v) return;
      if (!m[v]) m[v] = 0;
      m[v] += (Number(r.purchases) || 0) * priceFromName(r.product_name);
    });
    return m;
  }, [realRows, status, products, allocs]);

  const vendorKeys = useMemo(() => {
    const all = new Set([...Object.keys(plannedByVendor), ...Object.keys(actualByVendor)]);
    return [...all].sort();
  }, [plannedByVendor, actualByVendor]);

  const avgUtil = (() => {
    const active = comparison.filter(r => r.util !== null);
    return active.length ? active.reduce((s, r) => s + r.util, 0) / active.length : null;
  })();
  const offTarget = comparison.filter(r => r.util !== null && (r.util < 0.5 || r.util > 1.5)).length;
  const maxProd = topProducts.length ? topProducts[0][1] : 1;

  const fmtUsd = v => {
    const abs = Math.abs(v);
    const s = abs >= 1000 ? (abs/1000).toFixed(1)+"K" : abs.toFixed(0);
    return (v < 0 ? "-" : "") + "$" + s;
  };

  const TH = (s, c="#444") => <th style={{textAlign:"left",padding:"11px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;

  return (
    <div>
      {/* ── Header: title + date pickers ── */}
      <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em",marginBottom:4}}>
            Dashboard
            {drillCountry && <span style={{fontSize:16,color:"#555",fontWeight:500,marginLeft:16}}>→ <span style={{color:"#c8ff00"}}>{drillCountry}</span></span>}
          </div>
          <div style={{fontSize:13,color:"#555"}}>Budget utilization — planned spend vs actual</div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>From</div>
            <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setStatus("idle");}}
              style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,letterSpacing:"0.07em",textTransform:"uppercase"}}>To</div>
            <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value); setStatus("idle");}}
              style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"}}/>
          </div>
        </div>
      </div>

      {/* ── Fetch section ── */}
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        {days > 90 && status !== "loading" && (
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 16px",background:"rgba(251,146,60,0.07)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:8}}>
            <span>⚠️</span>
            <span style={{fontSize:12,color:"#fb923c"}}>Large range ({days} days) — queries may take longer or timeout. Consider using under 90 days.</span>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <button onClick={fetchData} disabled={status==="loading"}
            style={{background:"#c8ff00",color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:status==="loading"?"not-allowed":"pointer",fontFamily:"inherit",opacity:status==="loading"?0.6:1,flexShrink:0}}>
            {status==="loading" ? "Loading..." : status==="done" ? "↺ Refresh" : "Fetch Real Data"}
          </button>
          {status==="loading" && (
            <span style={{color:"#444",fontSize:13}}>⏳ Querying Redash...{days>90?" this may take a few minutes":" this may take up to 30 seconds"}</span>
          )}
          {status==="error" && (
            <span style={{color:"#f87171",fontSize:13}}>
              {errorMsg.includes("Timeout") ? <><strong>Timeout</strong> — try a smaller date range</> : <>Error: {errorMsg}</>}
            </span>
          )}
          {status==="done" && (
            <div style={{display:"flex",gap:28,flex:1,flexWrap:"wrap"}}>
              {[
                { label:"Actual Spend",    value:fmtUsd(totalActual),                                        color:"#c8ff00" },
                { label:"Avg Utilization", value:avgUtil!==null?Math.round(avgUtil*100)+"%":"—",              color:avgUtil===null?"#555":avgUtil>=0.8?"#4ade80":avgUtil>=0.5?"#fb923c":"#f87171" },
                { label:"Off Target",      value:String(offTarget),                                           color:offTarget>0?"#f87171":"#4ade80",  sub:offTarget>0?"below 50% or over 150%":"all on track" },
              ].map(({label,value,color,sub})=>(
                <div key={label}>
                  <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{label}</div>
                  <div style={{fontSize:20,fontWeight:900,color,letterSpacing:"-0.02em"}}>{value}</div>
                  {sub&&<div style={{fontSize:10,color:"#333",marginTop:2}}>{sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drillCountry ? (
        <CountryProductView
          country={drillCountry}
          globalFrom={dateFrom}
          globalTo={dateTo}
          allocs={allocs}
          products={products}
          realRows={realRows}
          days={days}
          onBack={() => setDrillCountry(null)}
        />
      ) : (<>

      {/* ── Always-visible planned KPIs ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Period</div>
          <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em",lineHeight:1}}>{days}d</div>
          <div style={{fontSize:11,color:"#333",marginTop:6}}>{dateFrom} → {dateTo}</div>
        </div>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Planned Spend</div>
          <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em",lineHeight:1}}>{fmtUsd(totalPlanned)}</div>
          <div style={{fontSize:11,color:"#333",marginTop:6}}>across {plannedOnly.length} countr{plannedOnly.length===1?"y":"ies"}</div>
        </div>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"18px 20px"}}>
          <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Countries with Plan</div>
          <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.03em",lineHeight:1}}>{plannedOnly.length}</div>
          <div style={{fontSize:11,color:"#333",marginTop:6}}>active allocations</div>
        </div>
      </div>

      {/* ── Main table + top products ── */}
      <div style={{display:"grid",gridTemplateColumns:status==="done"?"1fr 300px":"1fr",gap:16}}>

        {/* Spend by country table */}
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Spend by Country</div>
            <div style={{fontSize:11,color:"#333"}}>
              {status==="done" ? "Click a row to drill down →" : "Planned spend — fetch data to compare with actual"}
            </div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr>{[
                TH("Country"),
                TH("Planned $","#555"),
                ...(status==="done" ? [TH("Actual $","#c8ff00"), TH("Gap"), TH("Utilization")] : []),
              ]}</tr>
            </thead>
            <tbody>
              {comparison.map(({country,planned,actual,util})=>{
                const pct = util!==null ? Math.round(util*100) : null;
                const bar = util!==null ? Math.min(util,1.5) : 0;
                const col = pct===null?"#444":pct>=80?"#4ade80":pct>=50?"#fb923c":"#f87171";
                const gap = actual - planned;
                return (
                  <tr key={country}
                    onClick={status==="done"?()=>setDrillCountry(country):undefined}
                    style={{borderBottom:"1px solid #111",cursor:status==="done"?"pointer":"default"}}
                    onMouseEnter={e=>{if(status==="done")e.currentTarget.style.background="rgba(200,255,0,0.03)";}}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={{padding:"10px 16px",fontWeight:800,color:"#c8ff00"}}>{country}</td>
                    <td style={{padding:"10px 16px",color:"#555"}}>{fmtUsd(planned)}</td>
                    {status==="done" && <>
                      <td style={{padding:"10px 16px",fontWeight:700,color:"#f1f5f9"}}>{fmtUsd(actual)}</td>
                      <td style={{padding:"10px 16px",color:gap>=0?"#4ade80":"#f87171",fontWeight:700}}>
                        {gap>=0?"+":""}{fmtUsd(gap)}
                      </td>
                      <td style={{padding:"10px 16px",minWidth:140}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:`${Math.min(bar/1.5*100,100)}%`,height:"100%",background:col,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:col,width:38,textAlign:"right"}}>
                            {pct!==null?pct+"%":"—"}
                          </span>
                        </div>
                      </td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {comparison.length===0 && (
            <div style={{padding:48,textAlign:"center",color:"#333",fontSize:13}}>
              <div style={{fontSize:28,marginBottom:12}}>📋</div>
              No allocations configured. Add products in the <strong style={{color:"#f1f5f9"}}>Allocate</strong> tab.
            </div>
          )}
        </div>

        {/* Top products by actual spend */}
        {status==="done" && (
          <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"20px 24px"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>Top Products</div>
            <div style={{fontSize:11,color:"#444",marginBottom:20}}>By actual spend ($)</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {topProducts.length===0
                ? <div style={{color:"#333",fontSize:13}}>No product data returned</div>
                : topProducts.map(([name,spend])=>(
                  <div key={name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:175}}>{name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#c8ff00",flexShrink:0,marginLeft:8}}>{fmtUsd(spend)}</span>
                    </div>
                    <div style={{height:5,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${(spend/maxProd)*100}%`,height:"100%",background:"#c8ff00",borderRadius:3}}/>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* SVG Budget Chart: Planned vs Actual */}
      {status==="done" && vendorKeys.length>0 && (
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:"20px 24px",marginTop:16}}>
          {/* Header + legend */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Budget Utilization — Planned vs Actual</div>
              <div style={{fontSize:11,color:"#444",marginTop:3}}>{days}-day period · {dateFrom} → {dateTo}</div>
            </div>
            <div style={{display:"flex",gap:16,alignItems:"center",paddingTop:2}}>
              <span style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:12,height:12,background:"#1e3a5f",display:"inline-block",borderRadius:2,flexShrink:0}}/>
                <span style={{fontSize:11,color:"#555"}}>Planned</span>
              </span>
              <span style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:12,height:12,background:"#4ade80",display:"inline-block",borderRadius:2,flexShrink:0}}/>
                <span style={{fontSize:11,color:"#555"}}>Actual</span>
              </span>
              <span style={{display:"flex",alignItems:"center",gap:5}}>
                <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="#3b4a5a" strokeWidth="2" strokeDasharray="4,3"/></svg>
                <span style={{fontSize:11,color:"#555"}}>Target</span>
              </span>
            </div>
          </div>

          {/* SVG grouped bar chart */}
          {(()=>{
            const W=700, H=290;
            const PL=72, PR=20, PT=22, PB=68;
            const cW=W-PL-PR, cH=H-PT-PB;
            const n=vendorKeys.length;
            const rawMax=Math.max(...Object.values(plannedByVendor),...Object.values(actualByVendor),1);
            const mag=Math.pow(10,Math.floor(Math.log10(rawMax)||0));
            const niceMax=Math.ceil(rawMax/mag)*mag*1.15;
            const TICKS=4;
            const gW=cW/Math.max(n,1);
            const bW=Math.min(gW*0.27,46);
            const bG=bW*0.3;
            const toY=v=>PT+cH*(1-v/niceMax);
            const bY=toY(0);

            return (
              <svg width="100%" viewBox={"0 0 "+W+" "+H} style={{display:"block",overflow:"visible"}}>
                {/* Y-axis grid + labels */}
                {Array.from({length:TICKS+1},(_,i)=>{
                  const v=(i/TICKS)*niceMax;
                  const y=toY(v);
                  return <g key={i}>
                    <line x1={PL} y1={y} x2={PL+cW} y2={y} stroke={i===0?"#252525":"#141414"} strokeWidth={1}/>
                    <text x={PL-6} y={y+4} textAnchor="end" fill="#3a3a3a" fontSize={10} fontFamily="'Segoe UI',sans-serif">{fmtUsd(v)}</text>
                  </g>;
                })}

                {/* Bars per vendor */}
                {vendorKeys.map((v,i)=>{
                  const pl=plannedByVendor[v]||0;
                  const ac=actualByVendor[v]||0;
                  const ut=pl>0?ac/pl:null;
                  const col=ut===null?"#555":ut>=0.9?"#4ade80":ut>=0.5?"#fb923c":"#f87171";
                  const cx=PL+i*gW+gW/2;
                  const pY=toY(pl);
                  const aY=toY(ac);
                  const gap=ac-pl;
                  return <g key={v}>
                    {/* Planned bar */}
                    <rect x={cx-bW-bG/2} y={pY} width={bW} height={bY-pY} fill="#1e3a5f" rx={3} opacity="0.85"/>
                    {pl>0&&<text x={cx-bW/2-bG/2} y={pY-6} textAnchor="middle" fill="#3b5270" fontSize={9} fontFamily="'Segoe UI',sans-serif">{fmtUsd(pl)}</text>}

                    {/* Actual bar */}
                    <rect x={cx+bG/2} y={aY} width={bW} height={bY-aY} fill={col} rx={3}/>
                    {ac>0&&<text x={cx+bW/2+bG/2} y={aY-6} textAnchor="middle" fill={col} fontSize={10} fontFamily="'Segoe UI',sans-serif" fontWeight="700">{fmtUsd(ac)}</text>}

                    {/* Target dashed line at planned height */}
                    {pl>0&&<line x1={cx-bW-bG/2-5} x2={cx+bW+bG/2+5} y1={pY} y2={pY} stroke="#3b4a5a" strokeWidth={2} strokeDasharray="4,3"/>}

                    {/* Gap indicator: small label between bars */}
                    {pl>0&&ac>0&&(
                      <text x={cx} y={Math.min(pY,aY)-14} textAnchor="middle"
                        fill={gap>=0?"rgba(74,222,128,0.7)":"rgba(248,113,113,0.7)"}
                        fontSize={9} fontFamily="'Segoe UI',sans-serif" fontWeight="700">
                        {gap>=0?"+":""}{fmtUsd(gap)}
                      </text>
                    )}

                    {/* X-axis label */}
                    <text x={cx} y={bY+18} textAnchor="middle" fill="#888" fontSize={12} fontFamily="'Segoe UI',sans-serif" fontWeight="700">{v}</text>

                    {/* Utilization % */}
                    {ut!==null&&(
                      <text x={cx} y={bY+34} textAnchor="middle" fill={col} fontSize={13} fontFamily="'Segoe UI',sans-serif" fontWeight="900">
                        {Math.round(ut*100)}%
                      </text>
                    )}
                  </g>;
                })}

                {/* Axes */}
                <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke="#252525" strokeWidth={1}/>
                <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke="#252525" strokeWidth={1}/>
              </svg>
            );
          })()}

          {/* Country utilization horizontal mini-bars */}
          {comparison.filter(r=>r.util!==null).length>0 && (
            <div style={{marginTop:20,borderTop:"1px solid #111",paddingTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.07em"}}>Utilization by Country</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px 16px"}}>
                {comparison.filter(r=>r.util!==null).sort((a,b)=>b.util-a.util).map(r=>{
                  const pct=Math.round(r.util*100);
                  const col=pct>=80?"#4ade80":pct>=50?"#fb923c":"#f87171";
                  const w=Math.min(r.util,1.5)/1.5*100;
                  return (
                    <div key={r.country}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:11,color:"#888",fontWeight:700}}>{r.country}</span>
                        <span style={{fontSize:11,color:col,fontWeight:800}}>{pct}%</span>
                      </div>
                      <div style={{height:5,background:"#111",borderRadius:3,overflow:"hidden",position:"relative"}}>
                        <div style={{position:"absolute",left:0,top:0,height:"100%",width:"66.7%",borderRight:"1px dashed #252525"}}/>
                        <div style={{height:"100%",width:w+"%",background:col,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary totals */}
          {(()=>{
            const vTP=Object.values(plannedByVendor).reduce((s,x)=>s+x,0);
            const vTA=Object.values(actualByVendor).reduce((s,x)=>s+x,0);
            const vTG=vTA-vTP;
            const ov=vTP>0?vTA/vTP:null;
            return (
              <div style={{display:"flex",gap:24,marginTop:20,padding:"14px 20px",background:"#111",borderRadius:10,flexWrap:"wrap",alignItems:"center"}}>
                {[
                  {label:"Total Planned",val:fmtUsd(vTP),col:"#555"},
                  {label:"Total Actual",val:fmtUsd(vTA),col:"#f1f5f9"},
                  {label:"Total Gap",val:(vTG>=0?"+":"")+fmtUsd(vTG),col:vTG>=0?"#4ade80":"#f87171"},
                ].map(({label,val,col})=>(
                  <div key={label}>
                    <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:18,fontWeight:900,color:col}}>{val}</div>
                  </div>
                ))}
                {ov!==null&&(
                  <div style={{marginLeft:"auto",textAlign:"center",borderLeft:"1px solid #1a1a1a",paddingLeft:24}}>
                    <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Overall Utilization</div>
                    <div style={{fontSize:32,fontWeight:900,lineHeight:1,color:ov>=0.9?"#4ade80":ov>=0.5?"#fb923c":"#f87171"}}>{Math.round(ov*100)}%</div>
                    <div style={{fontSize:10,color:"#333",marginTop:4}}>of planned budget</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Idle hint */}
      {(status==="idle"||status==="error") && comparison.length>0 && status!=="error" && (
        <div style={{marginTop:16,padding:"14px 20px",background:"rgba(200,255,0,0.04)",border:"1px solid rgba(200,255,0,0.12)",borderRadius:12,fontSize:12,color:"#555",textAlign:"center"}}>
          Showing planned spend — click <strong style={{color:"#f1f5f9"}}>Fetch Real Data</strong> to load actual spend from Redash
        </div>
      )}
      </>)}
    </div>
  );
}

"""

NEW_BUDGET_COMPONENTS = """
// ── ADMIN TAB ────────────────────────────────────────────────────────────────────
function AdminTab({ appUsers, setAppUsers }) {
  const BLANK = { firstName:"", lastName:"", email:"", role:"", defaultRecipient:false, username:"", password:"" };
  const [modal,      setModal]      = useState(null);
  const [form,       setForm]       = useState(BLANK);
  const [showPass,   setShowPass]   = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));
  const inpS = {background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  function syncToCloud() {
    setSyncStatus("saving");
    fetch(SCRIPT_URL+"?action=getAll")
      .then(r=>r.json())
      .then(data=>{
        const merged = { ...data, appUsers };
        return fetch(SCRIPT_URL, { method:"POST", mode:"no-cors", body:JSON.stringify(merged) });
      })
      .then(()=>{ setSyncStatus("saved"); setTimeout(()=>setSyncStatus("idle"),3000); })
      .catch(()=>{ setSyncStatus("error"); setTimeout(()=>setSyncStatus("idle"),3000); });
  }

  function save() {
    if (!form.email || !form.username) return;
    if (modal==="add") {
      setAppUsers(p=>[...p, {...form, id:Date.now()}]);
    } else {
      setAppUsers(p=>p.map(u=>u.id===modal.id?{...u,...form}:u));
    }
    setModal(null); setForm(BLANK);
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>User Management</div>
          <div style={{fontSize:12,color:"#555"}}>Manage app users and default email recipients for Finance Request notifications.</div>
        </div>
        <div style={{display:"flex",gap:10,flexShrink:0}}>
          <button onClick={syncToCloud} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:syncStatus==="saved"?"#4ade80":syncStatus==="error"?"#f87171":"#888",borderRadius:8,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {syncStatus==="saving"?"Syncing...":syncStatus==="saved"?"Synced!":syncStatus==="error"?"Error":"Sync to Cloud"}
          </button>
          <button onClick={()=>{setForm(BLANK);setModal("add");}} style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ Add User</button>
        </div>
      </div>

      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid #1a1a1a"}}>
            {["Name","Username","Email","Role","Default Recipient",""].map((h,i)=>(
              <th key={i} style={{textAlign:"left",padding:"11px 16px",color:"#444",fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {appUsers.length===0&&<tr><td colSpan={6} style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>No users yet. Add the first one.</td></tr>}
            {appUsers.map(u=>(
              <tr key={u.id} style={{borderBottom:"1px solid #111"}}>
                <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{u.firstName} {u.lastName}</td>
                <td style={{padding:"11px 16px",color:"#888",fontFamily:"monospace"}}>{u.username||"—"}</td>
                <td style={{padding:"11px 16px",color:"#888"}}>{u.email}</td>
                <td style={{padding:"11px 16px"}}>
                  {u.role&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(200,255,0,0.08)",color:G,border:"1px solid rgba(200,255,0,0.2)"}}>{u.role}</span>}
                </td>
                <td style={{padding:"11px 16px"}}>
                  <input type="checkbox" checked={!!u.defaultRecipient}
                    onChange={e=>setAppUsers(p=>p.map(x=>x.id===u.id?{...x,defaultRecipient:e.target.checked}:x))}
                    style={{accentColor:G,width:16,height:16,cursor:"pointer"}}/>
                </td>
                <td style={{padding:"11px 16px"}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setForm({firstName:u.firstName,lastName:u.lastName,email:u.email,role:u.role||"",defaultRecipient:!!u.defaultRecipient,username:u.username||"",password:u.password||""});setModal(u);}}
                      style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Edit</button>
                    <button onClick={()=>{if(window.confirm("Delete "+u.firstName+"?")) setAppUsers(p=>p.filter(x=>x.id!==u.id));}}
                      style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#ef4444",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:28,width:"100%",maxWidth:440}}>
            <div style={{fontSize:16,fontWeight:900,color:"#f1f5f9",marginBottom:20}}>{modal==="add"?"Add User":"Edit User"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>First Name</div>
                <input value={form.firstName} onChange={e=>setF("firstName",e.target.value)} style={inpS} placeholder="Yuval"/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Last Name</div>
                <input value={form.lastName} onChange={e=>setF("lastName",e.target.value)} style={inpS} placeholder="Cohen"/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Email</div>
              <input type="email" value={form.email} onChange={e=>setF("email",e.target.value)} style={inpS} placeholder="yuval@buff.game"/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Role</div>
              <input value={form.role} onChange={e=>setF("role",e.target.value)} style={inpS} placeholder="Finance / Product / Marketing..."/>
            </div>
            <div style={{borderTop:"1px solid #1a1a1a",paddingTop:14,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>Login Credentials</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Username</div>
                  <input value={form.username} onChange={e=>setF("username",e.target.value)} style={inpS} placeholder="yuval123"/>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Password</div>
                  <div style={{position:"relative"}}>
                    <input type={showPass?"text":"password"} value={form.password} onChange={e=>setF("password",e.target.value)} style={{...inpS,paddingRight:36}} placeholder="••••••••"/>
                    <button type="button" onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>{showPass?"Hide":"Show"}</button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
              <input type="checkbox" id="defRecip" checked={!!form.defaultRecipient} onChange={e=>setF("defaultRecipient",e.target.checked)} style={{accentColor:G,width:16,height:16,cursor:"pointer"}}/>
              <label htmlFor="defRecip" style={{fontSize:13,color:"#888",cursor:"pointer"}}>Default recipient for Finance Request emails</label>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)} style={{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
              <button onClick={save} disabled={!form.email||!form.username} style={{flex:2,background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:800,cursor:(form.email&&form.username)?"pointer":"not-allowed",fontFamily:"inherit",opacity:(form.email&&form.username)?1:0.4}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BUDGET CONSTANTS ────────────────────────────────────────────────────────────
const VENDORS  = ["GCOW","Loot Keys","Kinguin","Internal","Other"];
const PURPOSES = ["MP","Raffles","Buff Pass"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── BUDGET OVERVIEW ────────────────────────────────────────────────────────────
function BudgetOverview({ products, allocs }) {
  const TH = (s,c="#444") => <th style={{textAlign:"left",padding:"11px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;
  const purposeColor = pu => pu==="MP"?G:pu==="Raffles"?"#a78bfa":"#38bdf8";
  const purposeBg    = pu => pu==="MP"?"rgba(200,255,0,0.07)":pu==="Raffles"?"rgba(168,139,250,0.09)":"rgba(56,189,248,0.09)";

  const allocFlat = useMemo(() => {
    const res = [];
    Object.entries(allocs).forEach(([country, rows]) => {
      rows.forEach(r => {
        const p = products.find(x => x.id === r.productId);
        if (!p) return;
        res.push({ country, prod: p, alloc: r });
      });
    });
    return res;
  }, [allocs, products]);

  const vendorMap = useMemo(() => {
    const m = {};
    allocFlat.forEach(({ prod, alloc }) => {
      const v = prod.vendor || prod.provider || "Unknown";
      if (!m[v]) m[v] = 0;
      m[v] += calcRealDaily(prod, alloc);
    });
    return Object.entries(m).sort();
  }, [allocFlat]);

  const purposeRows = useMemo(() => {
    const m = {};
    allocFlat.forEach(({ prod, alloc }) => {
      const v  = prod.vendor || prod.provider || "Unknown";
      const pu = prod.purpose || "MP";
      const k  = v + "|||" + pu;
      if (!m[k]) m[k] = { vendor:v, purpose:pu, daily:0 };
      m[k].daily += calcRealDaily(prod, alloc);
    });
    return Object.values(m).sort((a,b) => a.vendor.localeCompare(b.vendor)||a.purpose.localeCompare(b.purpose));
  }, [allocFlat]);

  const rafflesRows = useMemo(() => {
    const m = {};
    allocFlat.forEach(({ prod, alloc }) => {
      if ((prod.purpose||"") !== "Raffles") return;
      if (!m[prod.id]) m[prod.id] = { prod, qty:0, daily:0 };
      m[prod.id].qty   += calcDailyQty(alloc) * 30;
      m[prod.id].daily += calcRealDaily(prod, alloc);
    });
    return Object.values(m);
  }, [allocFlat]);

  const totalV = vendorMap.reduce((s,[,v])=>s+v,0);
  const totalP = purposeRows.reduce((s,r)=>s+r.daily,0);
  const totalR = rafflesRows.reduce((s,r)=>s+r.daily*30,0);

  const Block = ({title,sub,children,empty}) => (
    <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{title}</div>
        {sub&&<div style={{fontSize:11,color:"#555",marginTop:2}}>{sub}</div>}
      </div>
      {children || <div style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>{empty}</div>}
    </div>
  );
  const Foot = ({cols,vals}) => (
    <tfoot><tr style={{background:"rgba(200,255,0,0.04)",borderTop:"1px solid rgba(200,255,0,0.15)"}}>
      {vals.map((v,i)=><td key={i} style={{padding:"11px 16px",fontWeight:900,color:G,whiteSpace:"nowrap"}} colSpan={i===0?cols:1}>{v}</td>)}
    </tr></tfoot>
  );

  return (
    <div>
      <Block title="Total Budget by Vendor" sub="Real daily budgets (demand × pulse utilization)"
             empty="No vendor data — add products with a Vendor field in the Allocate tab.">
        {vendorMap.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{[TH("Vendor"),TH("Daily Budget"),TH("15-Day"),TH("30-Day")]}</tr></thead>
          <tbody>{vendorMap.map(([v,daily])=>(
            <tr key={v} style={{borderBottom:"1px solid #111"}}>
              <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{v}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(daily)}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(daily*15)}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(daily*30)}</td>
            </tr>
          ))}</tbody>
          <Foot cols={1} vals={["Grand Total",usd(totalV),usd(totalV*15),usd(totalV*30)]}/>
        </table>}
      </Block>

      <Block title="Total Real Budget by Purpose" sub="Vendor × Purpose breakdown"
             empty="No data — add products with Vendor and Purpose fields.">
        {purposeRows.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{[TH("Vendor"),TH("Purpose"),TH("Daily Budget"),TH("15-Day"),TH("Monthly")]}</tr></thead>
          <tbody>{purposeRows.map(r=>(
            <tr key={r.vendor+r.purpose} style={{borderBottom:"1px solid #111"}}>
              <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{r.vendor}</td>
              <td style={{padding:"11px 16px"}}>
                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:purposeBg(r.purpose),color:purposeColor(r.purpose),border:`1px solid ${purposeColor(r.purpose)}33`}}>{r.purpose}</span>
              </td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(r.daily)}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(r.daily*15)}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(r.daily*30)}</td>
            </tr>
          ))}</tbody>
          <Foot cols={2} vals={["Grand Total",usd(totalP),usd(totalP*15),usd(totalP*30)]}/>
        </table>}
      </Block>

      <Block title="Monthly Raffles Plan" sub="Products with Purpose = Raffles"
             empty="No Raffles products — set Purpose = Raffles in the Allocate tab.">
        {rafflesRows.length>0&&<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{[TH("Vendor"),TH("Brand"),TH("Unit Price"),TH("Monthly Qty"),TH("Monthly Budget")]}</tr></thead>
          <tbody>{rafflesRows.map(r=>(
            <tr key={r.prod.id} style={{borderBottom:"1px solid #111"}}>
              <td style={{padding:"11px 16px",color:"#555"}}>{r.prod.vendor||r.prod.provider||"—"}</td>
              <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{r.prod.brand}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{usd(calcPriceUSD(r.prod))}</td>
              <td style={{padding:"11px 16px",color:"#888"}}>{Math.round(r.qty).toLocaleString()}</td>
              <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{usd(r.daily*30)}</td>
            </tr>
          ))}</tbody>
          <Foot cols={4} vals={["Grand Total",usd(totalR)]}/>
        </table>}
      </Block>
    </div>
  );
}

// ── VENDOR ORDERS ──────────────────────────────────────────────────────────────
function VendorOrders({ products, allocs, orders, setOrders, transactions, setTransactions, displayName, isAdmin }) {
  const today = new Date().toISOString().slice(0,10);
  const _vod = () => { try{return JSON.parse(localStorage.getItem('voOrderDraft'))||{};}catch{return{};} };
  const [step,         setStep]        = useState(()=>_vod().step||1);
  const [setup,        setSetup]       = useState(()=>_vod().setup||{ vendor:"Loot Keys", period:"first", month:new Date().getMonth()+1, year:new Date().getFullYear(), date:today });
  const [inventory,    setInventory]   = useState(()=>_vod().inventory||{});
  const [generated,    setGenerated]   = useState(false);
  const [viewOrder,    setViewOrder]   = useState(null);
  const [step2Amounts, setStep2Amounts]= useState(()=>_vod().step2Amounts||{});
  useEffect(()=>{ if(!generated) localStorage.setItem('voOrderDraft',JSON.stringify({step,setup,inventory,step2Amounts})); },[step,setup,inventory,step2Amounts,generated]);
  const setS   = (k,v) => setSetup(p=>({...p,[k]:v}));
  const updInv = (pid,k,v) => setInventory(p=>({ ...p, [pid]:{ qtyWeHaveNow:0,daysBudgetFor:15,extraItems:0,...(p[pid]||{}),[k]:Number(v)||0 } }));

  const vendorProds = useMemo(()=>products.filter(p=>(p.vendor||p.provider||"")===setup.vendor),[products,setup.vendor]);

  const rows = useMemo(()=>vendorProds.map(prod=>{
    let dq=0;
    Object.values(allocs).forEach(cr=>{ const a=cr.find(r=>r.productId===prod.id); if(a) dq+=calcDailyQty(a); });
    const inv  = {qtyWeHaveNow:0,daysBudgetFor:15,extraItems:0,...(inventory[prod.id]||{})};
    const need = Math.max(0,Math.ceil(dq*inv.daysBudgetFor)-inv.qtyWeHaveNow);
    const price= calcPriceUSD(prod);
    return { prod, dq, need, price, budget:need*price, extra:inv.extraItems, extraBudget:inv.extraItems*price, totalQty:need+inv.extraItems, totalBudget:(need+inv.extraItems)*price, ...inv };
  }),[vendorProds,allocs,inventory]);

  const gcowRows = useMemo(()=>{
    if(setup.vendor==="Loot Keys") return [];
    const m={};
    vendorProds.forEach(prod=>{
      const pu=prod.purpose||"MP"; let d=0;
      Object.values(allocs).forEach(cr=>{ const a=cr.find(r=>r.productId===prod.id); if(a) d+=calcRealDaily(prod,a); });
      if(!m[pu]) m[pu]={purpose:pu,daily:0}; m[pu].daily+=d;
    });
    return Object.values(m);
  },[vendorProds,allocs,setup.vendor]);

  const isLK       = setup.vendor==="Loot Keys";
  const grandTotal = rows.reduce((s,r)=>s+r.totalBudget,0);
  const gcowTotal  = gcowRows.reduce((s,r)=>s+(step2Amounts[r.purpose]!==undefined ? Number(step2Amounts[r.purpose])||0 : r.daily*15),0);
  const periodLabel= o=>`${o.period==="first"?"First":"Second"} Half ${MONTH_NAMES[o.month-1]} ${o.year}`;

  function doGenerate() {
    const order = { id:Date.now(), vendor:setup.vendor, period:setup.period, month:setup.month, year:setup.year, date:setup.date,
      items:rows.map(r=>({ productId:r.prod.id, brand:r.prod.brand, lootkeyscode:r.prod.lootkeyscode||"",
        denom:r.prod.priceToBuffLocal, region:r.prod.currency, currency:r.prod.currency, price:r.price,
        qtyWeHaveNow:r.qtyWeHaveNow, daysBudgetFor:r.daysBudgetFor, need:r.need, budget:r.budget,
        extra:r.extra, extraBudget:r.extraBudget, totalQty:r.totalQty, totalBudget:r.totalBudget })),
      totalUSD:isLK?grandTotal:gcowTotal, status:"draft", createdAt:new Date().toISOString() };
    setOrders(p=>[order,...p]);
    setFinNote(""); setFinQtys({}); setFinAmounts({}); setFinSent(false);
    setGenerated(true); setStep(3);
  }

  function downloadCSV(order) {
    const hdr=["Date","Vendor","Period","Brand","LK Code","Qty","Unit Price","Denom","Region","Total"];
    const data=order.items.map(it=>[order.date,order.vendor,periodLabel(order),it.brand,it.lootkeyscode,it.totalQty,it.price.toFixed(2),it.denom,it.region,it.totalBudget.toFixed(2)]);
    const csv=[hdr,...data].map(r=>r.map(c=>`"${c}"`).join(",")).join("\\n");
    const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:`order_${order.vendor.replace(/\\s/g,"_")}_${order.date}.csv`});
    a.click();
  }

  const TH=(s,c="#444")=><th style={{textAlign:"left",padding:"10px 14px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;
  const inpS={background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const numS={...inpS,width:80,textAlign:"center",padding:"6px 8px"};

  if(viewOrder) {
    const o=viewOrder;
    const byBrand={};
    o.items.forEach(it=>{ if(!byBrand[it.brand]) byBrand[it.brand]=[]; byBrand[it.brand].push(it); });
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
          <button onClick={()=>setViewOrder(null)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>← Back</button>
          <div style={{fontSize:18,fontWeight:900,color:"#f1f5f9"}}>{o.vendor} — {periodLabel(o)}</div>
          <div style={{flex:1}}/>
          {o.vendor==="Loot Keys"&&<button onClick={()=>downloadCSV(o)} style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>↓ Download CSV</button>}
          {isAdmin&&<button onClick={()=>{ if(window.confirm("Delete this order?")){ setOrders(p=>p.filter(x=>x.id!==o.id)); setViewOrder(null); }}} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#f87171",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 Delete</button>}
        </div>
        <div style={{fontSize:12,color:"#555",marginBottom:20}}>{o.date} · Status: <span style={{color:o.status==="draft"?"#fb923c":o.status==="sent"?"#38bdf8":G,fontWeight:700}}>{o.status}</span> · Total: <span style={{color:G,fontWeight:800}}>{usd(o.totalUSD)}</span></div>
        {Object.entries(byBrand).map(([brand,items])=>(
          <div key={brand} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 18px",borderBottom:"1px solid #1a1a1a",fontWeight:800,color:"#f1f5f9"}}>{brand}</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{[TH("LK Code"),TH("Denom"),TH("Region"),TH("Qty","#f1f5f9"),TH("Unit $"),TH("Total",G)]}</tr></thead>
              <tbody>{items.map((it,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #111"}}>
                  <td style={{padding:"9px 14px",color:"#888"}}>{it.lootkeyscode||"—"}</td>
                  <td style={{padding:"9px 14px",color:"#555"}}>{it.denom}</td>
                  <td style={{padding:"9px 14px",color:"#555"}}>{it.region}</td>
                  <td style={{padding:"9px 14px",fontWeight:800,color:"#f1f5f9"}}>{it.totalQty.toLocaleString()}</td>
                  <td style={{padding:"9px 14px",color:"#555"}}>{usd(it.price)}</td>
                  <td style={{padding:"9px 14px",fontWeight:700,color:G}}>{usd(it.totalBudget)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{background:"rgba(200,255,0,0.03)",borderTop:"1px solid #1a1a1a"}}>
                <td colSpan={5} style={{padding:"9px 14px",fontWeight:700,color:"#555"}}>Subtotal</td>
                <td style={{padding:"9px 14px",fontWeight:900,color:G}}>{usd(items.reduce((s,it)=>s+it.totalBudget,0))}</td>
              </tr></tfoot>
            </table>
          </div>
        ))}
        <div style={{background:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.2)",borderRadius:12,padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:14,fontWeight:900,color:"#f1f5f9"}}>Grand Total</span>
          <span style={{fontSize:20,fontWeight:900,color:G}}>{usd(o.totalUSD)}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Step progress bar */}
      <div style={{display:"flex",marginBottom:24,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,overflow:"hidden"}}>
        {["Order Setup","Inventory & Qty","Generate"].map((label,i)=>(
          <button key={i} onClick={()=>i<step-1?setStep(i+1):null}
            style={{flex:1,padding:"12px 8px",border:"none",borderRight:"1px solid #1a1a1a",background:step===i+1?"rgba(200,255,0,0.07)":"transparent",
              color:step===i+1?G:step>i+1?"#888":"#333",fontWeight:700,fontSize:12,
              cursor:i<step-1?"pointer":"default",fontFamily:"inherit",
              borderBottom:step===i+1?`2px solid ${G}`:"2px solid transparent"}}>
            <span style={{marginRight:6}}>{step>i+1?"✓":i+1}</span>{label}
          </button>
        ))}
      </div>

      {step===1&&(
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:32}}>
          <div style={{fontSize:12,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:20}}>Order Setup</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24}}>
            {[
              {label:"Vendor",   el:<select value={setup.vendor} onChange={e=>setS("vendor",e.target.value)} style={inpS}>{VENDORS.map(v=><option key={v}>{v}</option>)}</select>},
              {label:"Period",   el:<select value={setup.period} onChange={e=>setS("period",e.target.value)} style={inpS}><option value="first">First Half (1–15)</option><option value="second">Second Half (16–end)</option></select>},
              {label:"Month",    el:<select value={setup.month}  onChange={e=>setS("month",Number(e.target.value))} style={inpS}>{MONTH_NAMES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>},
              {label:"Year",     el:<input type="number" value={setup.year} onChange={e=>setS("year",Number(e.target.value))} style={inpS}/>},
              {label:"Order Date",el:<input type="date" value={setup.date} onChange={e=>setS("date",e.target.value)} style={inpS}/>},
            ].map(({label,el})=>(
              <div key={label}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
                {el}
              </div>
            ))}
          </div>
          {vendorProds.length===0&&<div style={{padding:"12px 16px",background:"rgba(251,146,60,0.06)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:8,fontSize:12,color:"#fb923c",marginBottom:16}}>⚠ No products found for <strong>{setup.vendor}</strong> — add products with Vendor = {setup.vendor} in the Allocate tab.</div>}
          <button onClick={()=>setStep(2)} disabled={vendorProds.length===0}
            style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px 28px",fontSize:13,fontWeight:800,cursor:vendorProds.length===0?"not-allowed":"pointer",fontFamily:"inherit",opacity:vendorProds.length===0?0.4:1}}>
            Continue →
          </button>
        </div>
      )}

      {step===2&&(
        <div>
          <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{setup.vendor} — {periodLabel(setup)}</div>
              <div style={{fontSize:11,color:"#555",marginTop:2}}>{isLK?"Enter current inventory — quantities auto-calculated":"Budget transfer summary by Purpose"}</div>
            </div>
            {isLK?(
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:900}}>
                  <thead><tr>{[TH("Brand"),TH("LK Code"),TH("Unit $"),TH("Daily Qty"),TH("Days"),TH("Have Now"),TH("Need","#f1f5f9"),TH("Budget"),TH("Extra"),TH("Extra $"),TH("Total Qty",G),TH("Total $",G)]}</tr></thead>
                  <tbody>{rows.map(r=>(
                    <tr key={r.prod.id} style={{borderBottom:"1px solid #111"}}>
                      <td style={{padding:"9px 14px",fontWeight:700,color:"#f1f5f9"}}>{r.prod.brand}</td>
                      <td style={{padding:"9px 14px",color:"#555",fontSize:11}}>{r.prod.lootkeyscode||"—"}</td>
                      <td style={{padding:"9px 14px",color:"#888"}}>{usd(r.price)}</td>
                      <td style={{padding:"9px 14px",color:"#888"}}>{r.dq}</td>
                      <td style={{padding:"9px 14px"}}><input type="number" min={1} value={r.daysBudgetFor||15} onChange={e=>updInv(r.prod.id,"daysBudgetFor",e.target.value)} style={numS}/></td>
                      <td style={{padding:"9px 14px"}}><input type="number" min={0} value={r.qtyWeHaveNow||0} onChange={e=>updInv(r.prod.id,"qtyWeHaveNow",e.target.value)} style={numS}/></td>
                      <td style={{padding:"9px 14px",fontWeight:800,color:"#f1f5f9"}}>{r.need.toLocaleString()}</td>
                      <td style={{padding:"9px 14px",color:"#888"}}>{usd(r.budget)}</td>
                      <td style={{padding:"9px 14px"}}><input type="number" min={0} value={r.extra||0} onChange={e=>updInv(r.prod.id,"extraItems",e.target.value)} style={numS}/></td>
                      <td style={{padding:"9px 14px",color:"#555"}}>{usd(r.extraBudget)}</td>
                      <td style={{padding:"9px 14px",fontWeight:900,color:G}}>{r.totalQty.toLocaleString()}</td>
                      <td style={{padding:"9px 14px",fontWeight:900,color:G}}>{usd(r.totalBudget)}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr style={{background:"rgba(200,255,0,0.04)",borderTop:"1px solid rgba(200,255,0,0.2)"}}>
                    <td colSpan={10} style={{padding:"11px 14px",fontWeight:900,color:G}}>Total</td>
                    <td style={{padding:"11px 14px",fontWeight:900,color:G}}>{rows.reduce((s,r)=>s+r.totalQty,0).toLocaleString()}</td>
                    <td style={{padding:"11px 14px",fontWeight:900,color:G}}>{usd(grandTotal)}</td>
                  </tr></tfoot>
                </table>
              </div>
            ):(
              <div style={{padding:24}}>
                <div style={{fontSize:12,color:"#555",marginBottom:16}}>Amount to transfer to <strong style={{color:"#f1f5f9"}}>{setup.vendor}</strong> account — by Purpose. Edit amounts if needed:</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr>{[TH("Purpose"),TH("Daily Budget"),TH("Days"),TH("Calculated"),TH("Amount to Transfer","#f1f5f9")]}</tr></thead>
                  <tbody>{gcowRows.map(r=>{
                    const calc = r.daily*15;
                    const override = step2Amounts[r.purpose];
                    const val = override!==undefined ? override : calc.toFixed(2);
                    return (
                    <tr key={r.purpose} style={{borderBottom:"1px solid #111"}}>
                      <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{r.purpose}</td>
                      <td style={{padding:"11px 16px",color:"#888"}}>{usd(r.daily)}</td>
                      <td style={{padding:"11px 16px",color:"#555"}}>15</td>
                      <td style={{padding:"11px 16px",color:"#555"}}>{usd(calc)}</td>
                      <td style={{padding:"11px 16px"}}>
                        <input type="number" min={0} step={0.01} value={val}
                          onChange={e=>setStep2Amounts(p=>({...p,[r.purpose]:e.target.value}))}
                          style={{background:"#0d0d0d",border:`1px solid ${override!==undefined&&Number(override)!==calc?"rgba(200,255,0,0.4)":"#2a2a2a"}`,borderRadius:6,color:"#f1f5f9",fontSize:13,padding:"7px 10px",outline:"none",fontFamily:"inherit",width:110,textAlign:"right"}}/>
                      </td>
                    </tr>
                    );
                  })}</tbody>
                  <tfoot><tr style={{background:"rgba(200,255,0,0.04)",borderTop:"1px solid rgba(200,255,0,0.2)"}}>
                    <td colSpan={4} style={{padding:"11px 16px",fontWeight:900,color:G}}>Total to Transfer</td>
                    <td style={{padding:"11px 16px",fontWeight:900,color:G}}>{usd(gcowTotal)}</td>
                  </tr></tfoot>
                </table>
                {Object.keys(step2Amounts).some(k=>gcowRows.find(r=>r.purpose===k)&&Number(step2Amounts[k])!==gcowRows.find(r=>r.purpose===k).daily*15)&&(
                  <div style={{marginTop:10,fontSize:11,color:"rgba(200,255,0,0.6)"}}>✎ Amounts have been manually adjusted (highlighted in green border)</div>
                )}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:12}}>
            <button onClick={()=>setStep(1)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
            <button onClick={doGenerate} style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              Generate Order →
            </button>
          </div>
        </div>
      )}

      {step===3&&generated&&(
        <div style={{background:"#0d0d0d",border:"1px solid rgba(200,255,0,0.15)",borderRadius:14,padding:36,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:16}}>✓</div>
          <div style={{fontSize:18,fontWeight:900,color:G,marginBottom:8}}>Order Generated!</div>
          <div style={{fontSize:13,color:"#555",marginBottom:28}}>
            Order saved for {periodLabel(setup)}. Go to the <strong style={{color:"#888"}}>Finance Requests</strong> tab to submit a budget transfer to the finance team.
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            {orders.length>0&&<button onClick={()=>setViewOrder(orders[0])} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#f1f5f9",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>View Order</button>}
            <button onClick={()=>{localStorage.removeItem('voOrderDraft');setStep(1);setInventory({});setStep2Amounts({});setGenerated(false);}} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"10px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>New Order</button>
          </div>
        </div>
      )}

      {orders.length>0&&(
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden",marginTop:24}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Order History</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{[TH("Date"),TH("Vendor"),TH("Period"),TH("Total"),TH("Status"),TH("")]}</tr></thead>
            <tbody>{orders.map(o=>(
              <tr key={o.id} style={{borderBottom:"1px solid #111"}}>
                <td style={{padding:"11px 16px",color:"#888"}}>{o.date}</td>
                <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{o.vendor}</td>
                <td style={{padding:"11px 16px",color:"#555"}}>{periodLabel(o)}</td>
                <td style={{padding:"11px 16px",fontWeight:700,color:G}}>{usd(o.totalUSD)}</td>
                <td style={{padding:"11px 16px"}}>
                  <select value={o.status} onChange={e=>setOrders(p=>p.map(x=>x.id===o.id?{...x,status:e.target.value}:x))}
                    style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:6,color:o.status==="draft"?"#fb923c":o.status==="sent"?"#38bdf8":G,fontSize:11,padding:"4px 8px",outline:"none",fontFamily:"inherit",fontWeight:700}}>
                    <option value="draft">Draft</option><option value="sent">Sent</option><option value="delivered">Delivered</option>
                  </select>
                </td>
                <td style={{padding:"11px 16px",display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>setViewOrder(o)} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>View</button>
                  {isAdmin&&<button onClick={()=>{ if(window.confirm("Delete this order?")) setOrders(p=>p.filter(x=>x.id!==o.id)); }} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>🗑</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── FINANCE REQUESTS ───────────────────────────────────────────────────────────
function FinanceRequests({ products, allocs, appUsers, transactions, setTransactions, displayName, isAdmin }) {
  const today = new Date().toISOString().slice(0,10);
  const DEPTS = ["productDesktop","productMobile","marketing","buffPay"];
  const DEPT_LABELS = { productDesktop:"Product Desktop", productMobile:"Product Mobile", marketing:"Marketing", buffPay:"Buff Pay" };
  const nextId = useMemo(()=>transactions.length>0?Math.max(...transactions.map(t=>Number(t.id)||0))+1:1,[transactions]);
  const BLANK_TX = { vendor:"GCOW", note:"", enteredBy:displayName||"", dateRequested:today, productDesktop:"", productMobile:"", marketing:"", buffPay:"" };
  const [f,        setF]        = useState(BLANK_TX);
  const [emailPanel,     setEmailPanel]     = useState(false);
  const [emailTx,        setEmailTx]        = useState(null);
  const [emailRecips,    setEmailRecips]    = useState({});
  const [emailStatus,    setEmailStatus]    = useState("idle");
  const [toast,          setToast]          = useState("");
  const [editTx,         setEditTx]         = useState(null);
  const plannedByVendor = useMemo(()=>{
    const m = {};
    Object.values(allocs||{}).forEach(cr=>cr.forEach(alloc=>{
      const p = (products||[]).find(x=>x.id===alloc.productId);
      if(!p) return;
      const v = p.vendor||p.provider||"Unknown";
      if(!m[v]) m[v]=0;
      m[v]+=calcRealDaily(p,alloc);
    }));
    return m;
  },[products,allocs]);
  const [active,   setActive]   = useState({ productDesktop:true, productMobile:false, marketing:false, buffPay:false });
  const [success,  setSuccess]  = useState(false);
  const [filterV,  setFilterV]  = useState("All");
  const [filterS,  setFilterS]  = useState("All");
  const [filterM,  setFilterM]  = useState("All");
  const [updateId, setUpdateId] = useState("");
  const [updateSt, setUpdateSt] = useState("pending");
  const [detailTx, setDetailTx] = useState(null);
  const [chartModal, setChartModal] = useState(null);
  const setFld = (k,v) => setF(p=>({...p,[k]:v}));
  const DEPT_COLORS = { productDesktop:G, productMobile:"#38bdf8", marketing:"#fb923c", buffPay:"#a78bfa" };
  const totalAmount = useMemo(()=>DEPTS.filter(d=>active[d]).reduce((s,d)=>s+(parseFloat(f[d])||0),0),[f,active]);

  const monthlyData = useMemo(()=>{
    const now = new Date();
    const result = [];
    for(let i=11;i>=0;i--){
      const d = new Date(now.getFullYear(),now.getMonth()-i,1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleString("default",{month:"short",year:"2-digit"});
      const monthTxs = transactions.filter(t=>(t.dateRequested||"").startsWith(key));
      const total = monthTxs.reduce((s,t)=>s+(t.totalAmount||0),0);
      const depts = {};
      DEPTS.forEach(dept=>{ depts[dept]=monthTxs.reduce((s,t)=>s+(t[dept]||0),0); });
      result.push({key,label,total,depts,txs:monthTxs});
    }
    return result;
  },[transactions]);

  function handleSubmit(e) {
    e.preventDefault();
    const split = DEPTS.filter(d=>active[d]).map(d=>`${DEPT_LABELS[d]}: ${usd(parseFloat(f[d])||0)}`).join(" / ");
    const tx = { id:nextId, vendor:f.vendor,
      productDesktop:active.productDesktop?parseFloat(f.productDesktop)||0:0,
      productMobile: active.productMobile ?parseFloat(f.productMobile)||0:0,
      marketing:     active.marketing     ?parseFloat(f.marketing)||0:0,
      buffPay:       active.buffPay       ?parseFloat(f.buffPay)||0:0,
      totalAmount, note:f.note, enteredBy:f.enteredBy,
      dateRequested:f.dateRequested, status:"pending",
      lastUpdate:new Date().toISOString(), departmentsSplit:split };
    setTransactions(p=>[tx,...p]);
    setSuccess(true); setF({...BLANK_TX, enteredBy:displayName||""});
    setActive({ productDesktop:true, productMobile:false, marketing:false, buffPay:false });
    setTimeout(()=>setSuccess(false),3000);
    const defRecips = {};
    (appUsers||[]).forEach(u=>{ defRecips[u.id]=!!u.defaultRecipient; });
    setEmailRecips(defRecips);
    setEmailTx(tx);
    setEmailStatus("idle");
    setEmailPanel(true);
  }
  function handleUpdate() {
    const id=parseInt(updateId); if(!id) return;
    setTransactions(p=>p.map(t=>t.id===id?{...t,status:updateSt,lastUpdate:new Date().toISOString()}:t));
    setUpdateId("");
  }

  const allVendors = ["All",...Array.from(new Set(transactions.map(t=>t.vendor))).filter(Boolean)];
  const allMonths  = ["All",...Array.from(new Set(transactions.map(t=>(t.dateRequested||"").slice(0,7)))).filter(Boolean).sort().reverse()];
  const filtered   = useMemo(()=>transactions.filter(t=>{
    if(filterV!=="All"&&t.vendor!==filterV) return false;
    if(filterS!=="All"&&t.status!==filterS) return false;
    if(filterM!=="All"&&!(t.dateRequested||"").startsWith(filterM)) return false;
    return true;
  }),[transactions,filterV,filterS,filterM]);

  const inpS={background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const TH=(s,c="#444")=><th style={{textAlign:"left",padding:"11px 14px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;
  const statusColor=s=>s==="pending"?"#fb923c":s==="delivered"?G:"#555";

  return (
    <>
    <div style={{display:"grid",gridTemplateColumns:"400px 1fr",gap:20,alignItems:"start"}}>
      <div>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:26,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",marginBottom:20}}>New Finance Request</div>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Vendor</div>
              <select value={f.vendor} onChange={e=>setFld("vendor",e.target.value)} style={inpS}>
                {VENDORS.map(v=><option key={v}>{v}</option>)}
              </select>
              {(()=>{
                const planned15 = (plannedByVendor[f.vendor]||0)*15;
                if(!planned15) return null;
                return (
                  <div style={{marginTop:8,padding:"8px 12px",background:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.15)",borderRadius:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#555",fontWeight:600}}>Planned 15-day budget</span>
                    <span style={{fontSize:13,fontWeight:800,color:G}}>{usd(planned15)}</span>
                  </div>
                );
              })()}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Department Split</div>
              {DEPTS.map(d=>(
                <div key={d} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <input type="checkbox" checked={active[d]} onChange={e=>setActive(p=>({...p,[d]:e.target.checked}))} style={{accentColor:G,width:16,height:16,cursor:"pointer",flexShrink:0}}/>
                  <div style={{fontSize:12,color:active[d]?"#f1f5f9":"#555",fontWeight:600,width:130,flexShrink:0}}>{DEPT_LABELS[d]}</div>
                  <input type="number" min={0} step="0.01" value={f[d]||""} disabled={!active[d]} onChange={e=>setFld(d,e.target.value)} placeholder="0.00"
                    style={{...inpS,width:110,flex:"none",opacity:active[d]?1:0.3,padding:"7px 10px"}}/>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(200,255,0,0.05)",border:"1px solid rgba(200,255,0,0.15)",borderRadius:8,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Total</span>
              <span style={{fontSize:20,fontWeight:900,color:G}}>{usd(totalAmount)}</span>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Note</div>
              <textarea value={f.note} onChange={e=>setFld("note",e.target.value)} rows={2} style={{...inpS,resize:"vertical"}} placeholder="Optional notes…"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Entered By</div>
                <input value={f.enteredBy} onChange={e=>setFld("enteredBy",e.target.value)} style={inpS}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Date</div>
                <input type="date" value={f.dateRequested} onChange={e=>setFld("dateRequested",e.target.value)} style={inpS}/>
              </div>
            </div>
            {success&&<div style={{marginBottom:12,padding:"10px 14px",background:"rgba(200,255,0,0.08)",border:"1px solid rgba(200,255,0,0.25)",borderRadius:8,fontSize:12,color:G,fontWeight:700}}>✓ Transaction #{nextId-1} submitted!</div>}
            <button type="submit" disabled={totalAmount===0} style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"11px",fontSize:13,fontWeight:800,cursor:totalAmount===0?"not-allowed":"pointer",fontFamily:"inherit",opacity:totalAmount===0?0.4:1,width:"100%"}}>
              Submit Finance Request
            </button>
          </form>
        </div>
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,padding:22}}>
          <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9",marginBottom:14}}>Update Transaction Status</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={updateId} onChange={e=>setUpdateId(e.target.value)} placeholder="TX ID" style={{...inpS,width:90,flex:"none",padding:"8px 10px"}}/>
            <select value={updateSt} onChange={e=>setUpdateSt(e.target.value)} style={{...inpS,flex:1}}>
              <option value="pending">Pending</option><option value="delivered">Delivered</option>
            </select>
            <button onClick={handleUpdate} style={{background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"9px 14px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Update</button>
          </div>
        </div>
      </div>

      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #1a1a1a",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",flex:1}}>Transaction History</div>
          {[{val:filterV,set:setFilterV,opts:allVendors},{val:filterS,set:setFilterS,opts:["All","pending","delivered"]},{val:filterM,set:setFilterM,opts:allMonths}].map(({val,set,opts},i)=>(
            <select key={i} value={val} onChange={e=>set(e.target.value)} style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:12,padding:"6px 10px",outline:"none",fontFamily:"inherit"}}>
              {opts.map(o=><option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
            <thead><tr>{[TH("ID"),TH("Vendor"),TH("Total",G),TH("Date"),TH("Status"),TH("By"),TH("Note"),TH("Split")]}</tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={8} style={{padding:32,textAlign:"center",color:"#333",fontSize:13}}>No transactions yet.</td></tr>}
              {filtered.map(t=>(
                <tr key={t.id} onClick={()=>setDetailTx(t)}
                  style={{borderBottom:"1px solid #111",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(200,255,0,0.03)"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"10px 14px",fontWeight:700,color:"#f1f5f9"}}>#{t.id}</td>
                  <td style={{padding:"10px 14px",color:"#888"}}>{t.vendor}</td>
                  <td style={{padding:"10px 14px",fontWeight:800,color:G}}>{usd(t.totalAmount)}</td>
                  <td style={{padding:"10px 14px",color:"#555"}}>{t.dateRequested}</td>
                  <td style={{padding:"10px 14px"}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:4,background:`${statusColor(t.status)}15`,color:statusColor(t.status),border:`1px solid ${statusColor(t.status)}33`,textTransform:"capitalize"}}>{t.status}</span>
                  </td>
                  <td style={{padding:"10px 14px",color:"#555"}}>{t.enteredBy||"—"}</td>
                  <td style={{padding:"10px 14px",color:"#444",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.note}>{t.note||"—"}</td>
                  <td style={{padding:"10px 14px",color:"#333",fontSize:11,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.departmentsSplit||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{borderTop:"1px solid #1a1a1a",padding:"20px 18px",background:"#0a0a0a"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#f1f5f9",marginBottom:16,letterSpacing:"0.04em"}}>Total Transfers per Month — Last 12 Months</div>
          {(()=>{
            const hasData = monthlyData.some(d=>d.total>0);
            const maxVal = Math.max(...monthlyData.map(d=>d.total),1);
            return (
              <div>
                <div style={{display:"flex",alignItems:"flex-end",gap:4,height:140,marginBottom:4}}>
                  {monthlyData.map(d=>{
                    const barH = d.total>0 ? Math.max((d.total/maxVal)*110,6) : 4;
                    const activeDepts = DEPTS.filter(dep=>d.depts[dep]>0);
                    return (
                      <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end",gap:2}}>
                        {d.total>0&&<div style={{fontSize:8,color:"#888",fontWeight:700,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>
                          {"$"+Math.round(d.total).toLocaleString()}
                        </div>}
                        <div style={{width:"100%",display:"flex",flexDirection:"column",borderRadius:"3px 3px 0 0",overflow:"hidden",height:`${barH}px`,cursor:activeDepts.length>0?"pointer":"default"}}>
                          {d.total>0 ? DEPTS.filter(dep=>d.depts[dep]>0).map((dep,idx,arr)=>(
                            <div key={dep}
                              onClick={()=>setChartModal({month:d,dept:dep})}
                              title={`${DEPT_LABELS[dep]}: $${Math.round(d.depts[dep]).toLocaleString()}`}
                              style={{width:"100%",height:`${(d.depts[dep]/d.total)*100}%`,
                                background:DEPT_COLORS[dep],opacity:0.8,
                                borderTop:idx>0?"1px solid rgba(0,0,0,0.2)":""}}/>
                          )) : <div style={{width:"100%",height:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid #1a1a1a"}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:4,marginBottom:14}}>
                  {monthlyData.map(d=>(
                    <div key={d.key} style={{flex:1,textAlign:"center",fontSize:9,color:"#555",whiteSpace:"nowrap"}}>{d.label}</div>
                  ))}
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  {DEPTS.map(dep=>(
                    <div key={dep} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:10,height:10,borderRadius:2,background:DEPT_COLORS[dep],opacity:0.8}}/>
                      <span style={{fontSize:11,color:"#555"}}>{DEPT_LABELS[dep]}</span>
                    </div>
                  ))}
                </div>
                {!hasData&&<div style={{textAlign:"center",fontSize:11,color:"#333",marginTop:12}}>No transactions recorded yet</div>}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
    {/* Transaction detail modal */}
    {detailTx&&(
      <div onClick={()=>setDetailTx(null)}
        style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div onClick={e=>e.stopPropagation()}
          style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",position:"relative"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>Finance Request #{detailTx.id}</div>
              <div style={{fontSize:12,color:"#555"}}>{detailTx.vendor} · {detailTx.dateRequested} · by {detailTx.enteredBy||"—"}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:12,flexShrink:0}}>
              {isAdmin&&<button onClick={()=>{ setEditTx({...detailTx}); setDetailTx(null); }} style={{background:"rgba(200,255,0,0.08)",border:"1px solid rgba(200,255,0,0.25)",color:G,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✏ Edit</button>}
              {isAdmin&&<button onClick={()=>{ if(window.confirm("Delete this request?")){ setTransactions(p=>p.filter(t=>t.id!==detailTx.id)); setDetailTx(null); }}} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>🗑 Delete</button>}
              <button onClick={()=>setDetailTx(null)} style={{background:"none",border:"1px solid #2a2a2a",color:"#555",borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✕</button>
            </div>
          </div>
          {/* Total + status */}
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <div style={{flex:1,background:"#111",borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Total Amount</div>
              <div style={{fontSize:26,fontWeight:900,color:G}}>{usd(detailTx.totalAmount)}</div>
            </div>
            <div style={{background:"#111",borderRadius:10,padding:"14px 16px",minWidth:110,textAlign:"center"}}>
              <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Status</div>
              <select value={detailTx.status}
                onChange={e=>{
                  const ns=e.target.value;
                  setTransactions(p=>p.map(t=>t.id===detailTx.id?{...t,status:ns,lastUpdate:new Date().toISOString()}:t));
                  setDetailTx(p=>({...p,status:ns}));
                  const currentUser=(appUsers||[]).find(u=>((u.firstName+" "+u.lastName).trim()===displayName)||u.username===displayName);
                  const senderEmail=currentUser?.email||"";
                  const toList=(appUsers||[]).filter(u=>u.defaultRecipient&&u.email).map(u=>u.email).join(",");
                  if(toList){
                    const NLs=String.fromCharCode(10);
                    const sbody=["Transaction status has been updated.","","Vendor: "+detailTx.vendor,"Transaction ID: #"+detailTx.id,"Amount: "+usd(detailTx.totalAmount),"New Status: "+ns.charAt(0).toUpperCase()+ns.slice(1),"Updated by: "+displayName+(senderEmail?" <"+senderEmail+">":""),"Date: "+new Date().toISOString().slice(0,10),"","Note: Reply to this email to reach the person who made this update."].join(NLs);
                    const ssubj="Status Update: Finance Request #"+detailTx.id+" - "+detailTx.vendor+" - "+ns.charAt(0).toUpperCase()+ns.slice(1);
                    const sparams=new URLSearchParams({action:"sendEmail",to:toList,subject:ssubj,body:sbody,senderName:displayName,senderEmail});
                    fetch(SCRIPT_URL+"?"+sparams.toString()).then(()=>{ setToast("Email sent successfully!"); setTimeout(()=>setToast(""),3000); }).catch(()=>{});
                  }
                }}
                style={{background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:6,color:statusColor(detailTx.status),fontSize:12,padding:"6px 10px",outline:"none",fontFamily:"inherit",fontWeight:800,cursor:"pointer",width:"100%"}}>
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
          {/* Department breakdown */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Department Breakdown</div>
            {DEPTS.filter(d=>detailTx[d]>0).length===0
              ? <div style={{fontSize:12,color:"#333"}}>No department split recorded.</div>
              : DEPTS.filter(d=>detailTx[d]>0).map(d=>{
                  const pct = detailTx.totalAmount>0 ? detailTx[d]/detailTx.totalAmount : 0;
                  return (
                    <div key={d} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,color:"#f1f5f9",fontWeight:600}}>{DEPT_LABELS[d]}</span>
                        <span style={{fontSize:13,fontWeight:800,color:G}}>{usd(detailTx[d])} <span style={{fontSize:11,color:"#555",fontWeight:400}}>({Math.round(pct*100)}%)</span></span>
                      </div>
                      <div style={{height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:(pct*100)+"%",height:"100%",background:G,borderRadius:3,opacity:0.7}}/>
                      </div>
                    </div>
                  );
                })
            }
          </div>
          {/* Note */}
          {detailTx.note&&(
            <div style={{marginBottom:20,padding:"12px 14px",background:"#111",borderRadius:8}}>
              <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Note</div>
              <div style={{fontSize:13,color:"#888",lineHeight:1.6}}>{detailTx.note}</div>
            </div>
          )}
          {/* Email button */}
          {(()=>{
            const subj = "Finance Request #"+detailTx.id+" — "+detailTx.vendor+" — "+detailTx.dateRequested;
            const NL2 = String.fromCharCode(10);
            const deptLines = DEPTS.filter(d=>detailTx[d]>0).map(d=>"  - "+DEPT_LABELS[d]+": "+usd(detailTx[d])).join(NL2);
            const body = [
              "Hi Finance Team,","",
              "Finance Request #"+detailTx.id+" details:","",
              "Vendor: "+detailTx.vendor,
              "Date: "+detailTx.dateRequested,
              "Total: "+usd(detailTx.totalAmount),
              "Status: "+detailTx.status,"",
              "Department Breakdown:",
              deptLines||"  (no split recorded)",
              ...(detailTx.note?["","Notes: "+detailTx.note]:[]),
              "","Requested by: "+(detailTx.enteredBy||"—")
            ].join(NL2);
            const href = "mailto:?subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(body);
            return (
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <a href={href} style={{display:"inline-flex",alignItems:"center",gap:8,background:G,color:"#0a0a0a",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:800,textDecoration:"none",fontFamily:"inherit"}}>
                  📧 Send Email
                </a>
                <button onClick={()=>navigator.clipboard?.writeText(body).catch(()=>{})}
                  style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"10px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                  Copy Email Text
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    )}
    {/* Edit Transaction Modal */}
    {editTx&&(
      <div onClick={()=>setEditTx(null)}
        style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",zIndex:2500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div onClick={e=>e.stopPropagation()}
          style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:900,color:"#f1f5f9"}}>Edit Request #{editTx.id}</div>
            <button onClick={()=>setEditTx(null)} style={{background:"none",border:"1px solid #2a2a2a",color:"#555",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✕</button>
          </div>
          {/* Vendor */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Vendor</div>
            <input value={editTx.vendor} onChange={e=>setEditTx(p=>({...p,vendor:e.target.value}))}
              style={{width:"100%",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"9px 12px",fontFamily:"inherit",outline:"none"}}/>
          </div>
          {/* Date */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Date</div>
            <input type="date" value={editTx.dateRequested} onChange={e=>setEditTx(p=>({...p,dateRequested:e.target.value}))}
              style={{width:"100%",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"9px 12px",fontFamily:"inherit",outline:"none"}}/>
          </div>
          {/* Status */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Status</div>
            <select value={editTx.status} onChange={e=>setEditTx(p=>({...p,status:e.target.value}))}
              style={{width:"100%",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:statusColor(editTx.status),fontSize:13,padding:"9px 12px",fontFamily:"inherit",outline:"none",fontWeight:700,cursor:"pointer"}}>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          {/* Dept amounts */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Department Amounts</div>
            {DEPTS.map(d=>(
              <div key={d} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{fontSize:12,color:"#f1f5f9",fontWeight:600,width:140,flexShrink:0}}>{DEPT_LABELS[d]}</div>
                <input type="number" min="0" placeholder="0" value={editTx[d]||""} onChange={e=>setEditTx(p=>({...p,[d]:e.target.value}))}
                  style={{flex:1,background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:G,fontSize:13,padding:"7px 10px",fontFamily:"inherit",outline:"none",textAlign:"right"}}/>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8,fontSize:13,fontWeight:800,color:G}}>
              Total: {usd(DEPTS.reduce((s,d)=>s+(parseFloat(editTx[d])||0),0))}
            </div>
          </div>
          {/* Note */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Note</div>
            <textarea value={editTx.note||""} onChange={e=>setEditTx(p=>({...p,note:e.target.value}))}
              rows={3} style={{width:"100%",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#888",fontSize:13,padding:"9px 12px",fontFamily:"inherit",outline:"none",resize:"vertical"}}/>
          </div>
          <button onClick={()=>{
            const total=DEPTS.reduce((s,d)=>s+(parseFloat(editTx[d])||0),0);
            const split=DEPTS.filter(d=>parseFloat(editTx[d])>0).map(d=>DEPT_LABELS[d]+": "+usd(parseFloat(editTx[d]))).join(" / ");
            const updated={...editTx,totalAmount:total,departmentsSplit:split};
            Object.keys(updated).forEach(k=>{ if(DEPTS.includes(k)) updated[k]=parseFloat(updated[k])||0; });
            setTransactions(p=>p.map(t=>t.id===updated.id?updated:t));
            setEditTx(null);
            setToast("Request updated!"); setTimeout(()=>setToast(""),3000);
          }} style={{width:"100%",background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            Save Changes
          </button>
        </div>
      </div>
    )}
    {/* Email Panel Modal */}
    {emailPanel&&emailTx&&(
      <div onClick={()=>setEmailPanel(false)}
        style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div onClick={e=>e.stopPropagation()}
          style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:900,color:"#f1f5f9"}}>Send Finance Request Email</div>
            <button onClick={()=>setEmailPanel(false)} style={{background:"none",border:"1px solid #2a2a2a",color:"#555",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>x</button>
          </div>
          {/* Recipients */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>Recipients</div>
            {(appUsers||[]).length===0 && <div style={{fontSize:12,color:"#333",padding:"10px 0"}}>No users configured. Go to the Admin tab to add recipients.</div>}
            {(appUsers||[]).map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:"#111",borderRadius:8}}>
                <input type="checkbox" checked={!!emailRecips[u.id]} onChange={e=>setEmailRecips(p=>({...p,[u.id]:e.target.checked}))} style={{accentColor:G,width:15,height:15,cursor:"pointer",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{u.firstName} {u.lastName}</div>
                  <div style={{fontSize:11,color:"#555"}}>{u.email} · {u.role||"—"}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Email preview */}
          {(()=>{
            const NL3 = String.fromCharCode(10);
            const deptLines = DEPTS.map(d=>"  "+DEPT_LABELS[d]+": "+usd(emailTx[d]||0)).join(NL3);
            const body = [
              "A new transaction has been created.","",
              "Vendor: "+emailTx.vendor,
              "Transaction ID: "+emailTx.id,
              "Amount: "+usd(emailTx.totalAmount),
              "Date Requested: "+emailTx.dateRequested,
              "Entered By: "+(emailTx.enteredBy||displayName||"—"),
              ...(emailTx.note?["Notes: "+emailTx.note]:[]),
              "","Departments Breakdown:",
              deptLines
            ].join(NL3);
            const subj = "Finance Request #"+emailTx.id+" - "+emailTx.vendor+" - "+usd(emailTx.totalAmount);
            const toList = (appUsers||[]).filter(u=>emailRecips[u.id]).map(u=>u.email);
            const toStr = toList.join(",");
            function sendEmail() {
              if(toList.length===0) { alert("Select at least one recipient."); return; }
              setEmailStatus("sending");
              const params = new URLSearchParams({ action:"sendEmail", to:toStr, subject:subj, body });
              fetch(SCRIPT_URL+"?"+params.toString())
                .then(r=>r.json())
                .then(data=>{ if(data.ok){ setEmailPanel(false); setEmailStatus("idle"); setToast("Email sent successfully!"); setTimeout(()=>setToast(""),3000); } else setEmailStatus(data.error||"error"); })
                .catch(err=>setEmailStatus("error"));
            }
            return (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Email Preview</div>
                <div style={{fontSize:11,color:"#555",marginBottom:4}}><strong style={{color:"#888"}}>To:</strong> {toList.join(", ")||"(no recipients selected)"}</div>
                <div style={{fontSize:11,color:"#555",marginBottom:10}}><strong style={{color:"#888"}}>Subject:</strong> {subj}</div>
                <pre style={{fontSize:11,color:"#444",background:"#111",borderRadius:8,padding:"12px 14px",overflowX:"auto",whiteSpace:"pre-wrap",lineHeight:1.7,maxHeight:180,overflowY:"auto",marginBottom:16}}>{body}</pre>
                {emailStatus==="sent" && <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:8,fontSize:12,color:"#4ade80",fontWeight:700}}>Email sent successfully!</div>}
                {emailStatus!=="idle"&&emailStatus!=="sending"&&emailStatus!=="sent" && <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:12,color:"#f87171",fontWeight:700}}>Error: {emailStatus}</div>}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={sendEmail} disabled={emailStatus==="sending"||emailStatus==="sent"}
                    style={{flex:1,background:G,color:"#0a0a0a",border:"none",borderRadius:8,padding:"11px",fontSize:13,fontWeight:800,cursor:emailStatus==="sent"?"not-allowed":"pointer",fontFamily:"inherit",opacity:emailStatus==="sent"?0.5:1}}>
                    {emailStatus==="sending"?"Sending...":emailStatus==="sent"?"Sent!":"Send via Gmail"}
                  </button>
                  <button onClick={()=>navigator.clipboard?.writeText(body).catch(()=>{})}
                    style={{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#888",borderRadius:8,padding:"11px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Copy</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    )}
    {toast&&(
      <div style={{position:"fixed",bottom:24,right:24,background:"#0d0d0d",border:"1px solid rgba(74,222,128,0.35)",borderRadius:10,padding:"13px 20px",fontSize:13,fontWeight:700,color:"#4ade80",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.55)",display:"flex",alignItems:"center",gap:8}}>
        ✓ {toast}
      </div>
    )}
    {chartModal&&(
      <div onClick={()=>setChartModal(null)}
        style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div onClick={e=>e.stopPropagation()}
          style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:16,padding:28,width:"100%",maxWidth:420}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:DEPT_COLORS[chartModal.dept]}}>{DEPT_LABELS[chartModal.dept]}</div>
              <div style={{fontSize:12,color:"#555",marginTop:2}}>{chartModal.month.label}</div>
            </div>
            <button onClick={()=>setChartModal(null)} style={{background:"none",border:"1px solid #2a2a2a",color:"#555",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✕</button>
          </div>
          <div style={{marginBottom:16}}>
            {chartModal.month.txs.filter(t=>(t[chartModal.dept]||0)>0).map(t=>(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a1a1a"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{t.vendor}</div>
                  <div style={{fontSize:11,color:"#555",marginTop:2}}>{t.dateRequested} · #{t.id}</div>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:DEPT_COLORS[chartModal.dept]}}>{usd(t[chartModal.dept])}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid #1a1a1a"}}>
            <span style={{fontSize:11,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Total</span>
            <span style={{fontSize:20,fontWeight:900,color:DEPT_COLORS[chartModal.dept]}}>{usd(chartModal.month.depts[chartModal.dept])}</span>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── BUDGET VS ACTUAL ────────────────────────────────────────────────────────────
function BudgetVsActual({ products, allocs, analyticsRows, analyticsFrom, analyticsTo, analyticsStatus }) {
  const [localRows,   setLocalRows]   = useState(null);
  const [localFrom,   setLocalFrom]   = useState(analyticsFrom);
  const [localTo,     setLocalTo]     = useState(analyticsTo);
  const [localStatus, setLocalStatus] = useState("idle");
  const [errMsg,      setErrMsg]      = useState("");

  const rows   = localRows !== null ? localRows   : analyticsRows;
  const from   = localRows !== null ? localFrom   : analyticsFrom;
  const to     = localRows !== null ? localTo     : analyticsTo;
  const status = localRows !== null ? localStatus : analyticsStatus;
  const days   = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const usingDash = localRows === null && analyticsStatus === "done";

  async function fetchLocal() {
    setLocalStatus("loading"); setLocalRows([]); setErrMsg("");
    try {
      const r = await fetch(`${PROXY_URL}?action=redash&from=${localFrom}&to=${localTo}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setLocalRows(d.rows || []);
      setLocalStatus("done");
    } catch(e) { setErrMsg(e.message); setLocalStatus("error"); }
  }

  const plannedByVendor = useMemo(() => {
    const m = {};
    Object.values(allocs).forEach(cr => cr.forEach(alloc => {
      const p = products.find(x => x.id === alloc.productId);
      if (!p) return;
      const v = p.vendor || p.provider || "Unknown";
      if (!m[v]) m[v] = 0;
      m[v] += calcRealDaily(p, alloc);
    }));
    return m;
  }, [products, allocs]);

  const actualByVendor = useMemo(() => {
    if (status !== "done" || !rows.length) return {};
    const allAllocRows = Object.values(allocs).flat();
    const m = {};
    rows.forEach(r => {
      const match = matchProduct(r.product_name, allAllocRows, products);
      if (!match) return;
      const prod = products.find(p => p.id === match.alloc.productId);
      const v = prod ? (prod.vendor || prod.provider || "Unknown") : null;
      if (!v) return;
      if (!m[v]) m[v] = 0;
      m[v] += (Number(r.purchases) || 0) * priceFromName(r.product_name);
    });
    return m;
  }, [rows, status, products, allocs]);

  const vendors = useMemo(() => {
    const all = new Set([...Object.keys(plannedByVendor), ...Object.keys(actualByVendor)]);
    return [...all].sort();
  }, [plannedByVendor, actualByVendor]);

  const TH = (s,c="#444") => <th style={{textAlign:"left",padding:"11px 16px",color:c,fontWeight:700,fontSize:11,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap",borderBottom:"1px solid #1a1a1a"}}>{s}</th>;
  const hasData = status === "done" && rows.length > 0;
  const inpS = {background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f1f5f9",fontSize:13,padding:"8px 12px",outline:"none",fontFamily:"inherit"};

  const totalPlanned = Object.values(plannedByVendor).reduce((s,v)=>s+v,0) * days;
  const totalActual  = Object.values(actualByVendor).reduce((s,v)=>s+v,0);
  const totalGap     = totalActual - totalPlanned;
  const gapCol = g => g >= 0 ? "#4ade80" : Math.abs(g) < Math.abs(totalPlanned) * 0.2 ? "#fb923c" : "#f87171";

  return (
    <div>
      <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:12,padding:"16px 20px",marginBottom:20,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
        {usingDash && (
          <div style={{fontSize:11,color:"#4ade80",padding:"4px 10px",background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:6,alignSelf:"center",whiteSpace:"nowrap"}}>
            ✓ Using Dashboard data
          </div>
        )}
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>From</div>
          <input type="date" value={localFrom} onChange={e=>setLocalFrom(e.target.value)} style={inpS}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>To</div>
          <input type="date" value={localTo} onChange={e=>setLocalTo(e.target.value)} style={inpS}/>
        </div>
        <button onClick={fetchLocal} disabled={localStatus==="loading"}
          style={{background:"#c8ff00",color:"#0a0a0a",border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:800,cursor:localStatus==="loading"?"not-allowed":"pointer",fontFamily:"inherit",opacity:localStatus==="loading"?0.6:1}}>
          {localStatus==="loading"?"Loading...":localRows!==null?"↺ Refresh":"Fetch Data"}
        </button>
        {errMsg && <div style={{fontSize:12,color:"#f87171",alignSelf:"center"}}>{errMsg}</div>}
      </div>

      {!hasData && (
        <div style={{padding:40,textAlign:"center",color:"#333",fontSize:13}}>
          {analyticsStatus !== "done" ? "Fetch data above — or load data from the Dashboard tab first." : "No Redash data to compare."}
        </div>
      )}

      {hasData && (
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:14,overflow:"hidden",marginBottom:20}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Planned vs Actual — by Vendor</div>
            <div style={{fontSize:11,color:"#555",marginTop:2}}>{days}-day period · {from} → {to}</div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{[TH("Vendor"),TH("Planned /day"),TH(`Planned ${days}d`),TH("Actual Spend"),TH("Gap"),TH("Utilization")]}</tr></thead>
            <tbody>
              {vendors.map(v => {
                const pd = plannedByVendor[v] || 0;
                const pt = pd * days;
                const ac = actualByVendor[v] || 0;
                const gp = ac - pt;
                const ut = pt > 0 ? ac / pt : null;
                return (
                  <tr key={v} style={{borderBottom:"1px solid #111"}}>
                    <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{v}</td>
                    <td style={{padding:"11px 16px",color:"#888"}}>{usd(pd)}</td>
                    <td style={{padding:"11px 16px",color:"#888"}}>{usd(pt)}</td>
                    <td style={{padding:"11px 16px",fontWeight:700,color:"#f1f5f9"}}>{usd(ac)}</td>
                    <td style={{padding:"11px 16px",fontWeight:700,color:gapCol(gp)}}>{gp>=0?"+":""}{usd(gp)}</td>
                    <td style={{padding:"11px 16px"}}>
                      {ut!==null
                        ? <span style={{fontWeight:700,color:ut>=0.9?"#4ade80":ut>=0.6?"#fb923c":"#f87171"}}>{Math.round(ut*100)}%</span>
                        : <span style={{color:"#333"}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr style={{background:"rgba(200,255,0,0.04)",borderTop:"1px solid rgba(200,255,0,0.15)"}}>
              <td colSpan={2} style={{padding:"11px 16px",fontWeight:900,color:"#555"}}>Total</td>
              <td style={{padding:"11px 16px",fontWeight:900,color:G}}>{usd(totalPlanned)}</td>
              <td style={{padding:"11px 16px",fontWeight:900,color:G}}>{usd(totalActual)}</td>
              <td style={{padding:"11px 16px",fontWeight:900,color:gapCol(totalGap)}}>{totalGap>=0?"+":""}{usd(totalGap)}</td>
              <td style={{padding:"11px 16px",fontWeight:900,color:totalPlanned>0?(totalActual/totalPlanned>=0.9?"#4ade80":totalActual/totalPlanned>=0.6?"#fb923c":"#f87171"):"#333"}}>
                {totalPlanned>0?`${Math.round(totalActual/totalPlanned*100)}%`:"—"}
              </td>
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── BUDGET TAB ──────────────────────────────────────────────────────────────────
function BudgetTab({ products, allocs, orders, setOrders, transactions, setTransactions, displayName, appUsers, isAdmin, analyticsRows, analyticsFrom, analyticsTo, analyticsStatus }) {
  const [sub, setSub] = useState("overview");
  const SUB = [
    { id:"overview",  label:"Budget Overview"   },
    { id:"vs-actual", label:"Planned vs Actual"  },
    { id:"orders",    label:"Vendor Orders"      },
    { id:"finance",   label:"Finance Requests"   },
  ];
  return (
    <div>
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid #1a1a1a",paddingBottom:0}}>
        {SUB.map(t=>(
          <button key={t.id} onClick={()=>setSub(t.id)}
            style={{background:"none",border:"none",borderBottom:sub===t.id?`2px solid ${G}`:"2px solid transparent",
              color:sub===t.id?G:"#555",padding:"8px 22px",fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",marginBottom:-1,transition:"color 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {sub==="overview"  &&<BudgetOverview  products={products} allocs={allocs}/>}
      {sub==="vs-actual" &&<BudgetVsActual  products={products} allocs={allocs} analyticsRows={analyticsRows} analyticsFrom={analyticsFrom} analyticsTo={analyticsTo} analyticsStatus={analyticsStatus}/>}
      {sub==="orders"    &&<VendorOrders    products={products} allocs={allocs} orders={orders} setOrders={setOrders} transactions={transactions} setTransactions={setTransactions} displayName={displayName} isAdmin={isAdmin}/>}
      {sub==="finance"   &&<FinanceRequests products={products} allocs={allocs} appUsers={appUsers} transactions={transactions} setTransactions={setTransactions} displayName={displayName} isAdmin={isAdmin}/>}
    </div>
  );
}

"""

jsx = jsx.replace(
    '// ── APP ───────────────────────────────────────────────────────────────────────',
    NEW_COMPONENTS + NEW_BUDGET_COMPONENTS + '// ── APP ───────────────────────────────────────────────────────────────────────'
)

# ══════════════════════════════════════════════════════════════════════════════
# COUNTRIES TAB — add unit price column
# ══════════════════════════════════════════════════════════════════════════════
jsx = jsx.replace(
    '["Brand","Demand","Pulses/day","Qty/pulse","Daily qty","Interval","Utilization","Planned daily","Real daily","Planned monthly","Real monthly"].map(TH)',
    '["Brand","Unit $","Pulses/day","Qty/pulse","Daily qty","Interval","Utilization","Planned daily","Real daily","Planned monthly","Real monthly"].map(TH)'
)

jsx = jsx.replace(
    '                          <td style={{padding:"10px 16px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}<div style={{fontSize:10,color:"#333",marginTop:1}}>{p.type}</div></td>\n'
    '                          <td style={{padding:"10px 16px"}}><span style={{fontSize:10,fontWeight:700,color:demandColor(p.demandLevel),background:demandBg(p.demandLevel),padding:"2px 6px",borderRadius:4,border:`1px solid ${demandColor(p.demandLevel)}33`}}>{p.demandLevel}</span></td>',
    '                          <td style={{padding:"10px 16px",fontWeight:800,color:"#f1f5f9"}}>{p.brand}<div style={{fontSize:10,color:"#333",marginTop:1}}>{p.type}</div></td>\n'
    '                          <td style={{padding:"10px 16px"}}>\n'
    '                            <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{usd(calcPriceUSD(p))}</div>\n'
    '                            <div style={{fontSize:10,color:"#444",marginTop:2}}>×{r.qtyPerPulse} = {usd(calcPriceUSD(p)*r.qtyPerPulse)}</div>\n'
    '                          </td>\n'
    '                          <td style={{padding:"10px 16px"}}><span style={{fontSize:10,fontWeight:700,color:demandColor(p.demandLevel),background:demandBg(p.demandLevel),padding:"2px 6px",borderRadius:4,border:`1px solid ${demandColor(p.demandLevel)}33`}}>{p.demandLevel}</span></td>'
)

# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE SHEETS INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwvjZHPkTUIkTrRvdA6TRfxspBKppKa5wm-AsvPnlZ7__EOJiIxPsTxDDXXqtzVSsy/exec"

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
    '    { user: "yuvalbukobza", pass: "1205", display: "Yuval Bukobza", isAdmin: true },\n'
    '    { user: "itaiguzik",    pass: "123456789", display: "itaiguzik" },\n'
    '    // הוסף משתמשים נוספים כאן:\n'
    '    // { user: "שם_משתמש", pass: "סיסמא", display: "שם תצוגה" },\n'
    '  ];\n'
    '\n'
    '  const [tab,        setTab]        = useState("dashboard");\n'
    '  const [products,      setProducts]      = useState([]);\n'
    '  const [allocs,        setAllocs]        = useState({});\n'
    '  const [orders,        setOrders]        = useState([]);\n'
    '  const [transactions,  setTransactions]  = useState([]);\n'
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
    '  const today0        = new Date().toISOString().slice(0,10);\n'
    '  const firstOfMonth0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);\n'
    '  const [analyticsFrom,   setAnalyticsFrom]   = useState(firstOfMonth0);\n'
    '  const [analyticsTo,     setAnalyticsTo]     = useState(today0);\n'
    '  const [analyticsStatus, setAnalyticsStatus] = useState("idle");\n'
    '  const [analyticsRows,   setAnalyticsRows]   = useState([]);\n'
    '  const [analyticsError,  setAnalyticsError]  = useState("");\n'
    '\n'
    '  const [isAdmin,      setIsAdmin]      = useState(()=>sessionStorage.getItem("buff_admin")==="1");\n'
    '  const [appUsers,     setAppUsers]     = useState(()=>{ try{return JSON.parse(localStorage.getItem("buff_appUsers"))||[];}catch{return[];} });\n'
    '  useEffect(()=>{ localStorage.setItem("buff_appUsers",JSON.stringify(appUsers)); },[appUsers]);\n'
    '\n'
    '  // Pre-auth: silently load appUsers from Sheets in background\n'
    '  useEffect(()=>{\n'
    '    fetch(SCRIPT_URL)\n'
    '      .then(r=>r.json())\n'
    '      .then(data=>{\n'
    '        if(data.appUsers&&data.appUsers.length>0){\n'
    '          setAppUsers(data.appUsers);\n'
    '          localStorage.setItem("buff_appUsers",JSON.stringify(data.appUsers));\n'
    '        }\n'
    '      })\n'
    '      .catch(()=>{});\n'
    '  },[]);\n'
    '\n'
    '  function handleLogin(e) {\n'
    '    e.preventDefault();\n'
    '    const dynUsers = [...USERS, ...(appUsers||[]).filter(u=>u.username&&u.password).map(u=>({ user:u.username, pass:u.password, display:((u.firstName+" "+u.lastName).trim()||u.username), isAdmin:false }))];\n'
    '    const match = dynUsers.find(u => u.user === loginU && u.pass === loginP);\n'
    '    if (match) {\n'
    '      const appU = (appUsers||[]).find(u=>u.username===loginU);\n'
    '      const fullName = appU ? ((appU.firstName+" "+appU.lastName).trim()||match.display) : match.display;\n'
    '      const adminFlag = !!match.isAdmin;\n'
    '      sessionStorage.setItem("buff_auth", "1");\n'
    '      sessionStorage.setItem("buff_display", fullName);\n'
    '      sessionStorage.setItem("buff_admin", adminFlag ? "1" : "0");\n'
    '      setDisplayName(fullName);\n'
    '      setIsAdmin(adminFlag);\n'
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
    '        setProducts(data.products || []);\n'
    '        setAllocs(data.allocs || {});\n'
    '        setOrders(data.orders || []);\n'
    '        setTransactions(data.transactions || []);\n'
    '        if (data.appUsers) { setAppUsers(data.appUsers); localStorage.setItem("buff_appUsers",JSON.stringify(data.appUsers)); }\n'
    '        setSaveStatus("saved");\n'
    '        setLoaded(true);\n'
    '      })\n'
    '      .catch(() => {\n'
    '        setProducts([]);\n'
    '        setAllocs({});\n'
    '        setOrders([]);\n'
    '        setTransactions([]);\n'
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
    '      fetch(SCRIPT_URL, { method:"POST", mode:"no-cors", body:JSON.stringify({ products, allocs, orders, transactions, appUsers }) })\n'
    '        .then(() => setSaveStatus("saved"))\n'
    '        .catch(() => setSaveStatus("error"));\n'
    '    }, 1500);\n'
    '  }, [products, allocs, orders, transactions, appUsers]);\n'
    '\n'
    '  // Login screen\n'
    '  if (!authed) return (\n'
    '    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",\n'
    '      justifyContent:"center",fontFamily:"\'DM Sans\',\'Segoe UI\',sans-serif"}}>\n'
    '      <div style={{width:360,padding:"48px 40px",background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:20}}>\n'
    '        <div style={{textAlign:"center",marginBottom:36}}>\n'
    '          <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.05em",marginBottom:8}}>\n'
    '            <span style={{color:"#c8ff00"}}>Buff</span>\n'
    '            <span style={{color:"#f1f5f9"}}>Ops</span>\n'
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
    '        <span style={{color:"#c8ff00"}}>Buff</span><span style={{color:"#f1f5f9"}}>Ops</span>\n'
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
    '                <div style={{textAlign:"center",fontSize:11,color:"#444",marginBottom:20,letterSpacing:"0.06em",textTransform:"uppercase"}}>{isAdmin?"Administrator":"Member"}</div>\n'
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
  <title>BuffOps</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230d0d0d'/><text x='16' y='23' text-anchor='middle' font-family='Arial Black,sans-serif' font-weight='900' font-size='20' fill='%23c8ff00'>B</text></svg>"/>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
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

INDEX_HTML = 'c:/Users/Roman Averin/Desktop/ClaudeCodeTest/index.html'
with open(INDEX_HTML, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Done — {len(html):,} chars written to {OUT_HTML} + index.html")
