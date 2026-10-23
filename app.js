/* Ma DVDthèque — données conservées localement dans IndexedDB */
(() => {
"use strict";
const DB_NAME="ma-dvdtheque-db", DB_VERSION=1, STORE="movies";
const $=id=>document.getElementById(id);
let db, movies=[], currentView="collection", stream=null, scanTimer=null, scanBusy=false, formTmdbId="";
let pendingBarcode="", barcodeLookupActive=false;
const defaultGenres=["Action","Aventure","Animation","Biopic","Comédie","Drame","Fantastique","Guerre","Historique","Horreur","Policier","Romance","Science-fiction","Thriller","Western","Documentaire","Famille","Musical"];
const dialogs=["movieDialog","searchDialog","scanDialog","detailsDialog","settingsDialog","backupDialog"].map($);
function openDialog(d){if(!d.open)d.showModal()}
function closeDialog(d){if(d.open)d.close()}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateToday(){return new Date().toISOString().slice(0,10)}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function allMovies(){return new Promise((resolve,reject)=>{const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
function saveMovie(movie){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(movie);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function deleteMovie(id){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function replaceAll(list){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),s=tx.objectStore(STORE);s.clear();list.forEach(m=>s.put(m));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function settings(){return {key:localStorage.getItem("tmdbKey")||"",name:localStorage.getItem("collectionName")||"Les Films de Pitou"}}
function normalizeGenres(value){return [...new Set(String(value||"").split(",").map(x=>x.trim()).filter(Boolean))]}
function normalizeMovie(m){return {id:m.id||uid(),title:String(m.title||"Sans titre"),year:m.year||"",director:m.director||"",genres:Array.isArray(m.genres)?m.genres:normalizeGenres(m.genres),barcode:m.barcode||"",poster:m.poster||"",notes:m.notes||"",overview:m.overview||"",runtime:m.runtime||"",loaned:!!m.loaned,borrowerFirst:m.borrowerFirst||"",borrowerLast:m.borrowerLast||"",loanDate:m.loanDate||"",loanHistory:Array.isArray(m.loanHistory)?m.loanHistory:[],addedAt:m.addedAt||new Date().toISOString(),tmdbId:m.tmdbId||""}}
function movieMatches(m,q){const hay=[m.title,m.year,m.director,...m.genres,m.barcode,m.borrowerFirst,m.borrowerLast,m.notes].join(" ").toLocaleLowerCase("fr");return hay.includes(q.toLocaleLowerCase("fr"))}
function render(){
 const q=$("searchInput").value.trim(),genre=$("genreFilter").value,status=$("statusFilter").value,sort=$("sortSelect").value;
 let list=movies.filter(m=>(!q||movieMatches(m,q))&&(!genre||m.genres.includes(genre))&&(status==="all"||(status==="loaned"?m.loaned:!m.loaned)));
 if(currentView==="loans")list=list.filter(m=>m.loaned);
 list.sort((a,b)=>sort==="year-desc"?(Number(b.year)||0)-(Number(a.year)||0):sort==="year-asc"?(Number(a.year)||9999)-(Number(b.year)||9999):sort==="added-desc"?String(b.addedAt).localeCompare(String(a.addedAt)):a.title.localeCompare(b.title,"fr",{sensitivity:"base"}));
 $("totalCount").textContent=movies.length;$("loanCount").textContent=movies.filter(m=>m.loaned).length;
 $("genreCount").textContent=new Set(movies.flatMap(m=>m.genres)).size;
 $("resultCount").textContent=`${list.length} résultat${list.length>1?"s":""}`;
 $("movieGrid").innerHTML=list.map(m=>`<article class="movie-card" data-id="${esc(m.id)}" tabindex="0" aria-label="${esc(m.title)}">
  <div class="poster-wrap">${m.poster?`<img class="poster" loading="lazy" src="${esc(m.poster)}" alt="Affiche de ${esc(m.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`:""}<div class="poster-placeholder" style="display:${m.poster?"none":"grid"}">🎬</div>${m.loaned?'<span class="loan-badge">PRÊTÉ</span>':""}</div>
  <div class="card-body"><h3 class="card-title">${esc(m.title)}</h3><div class="card-meta">${esc(m.year||"Année inconnue")}${m.director?" · "+esc(m.director):""}</div><div class="card-genres">${m.genres.slice(0,2).map(g=>`<span class="chip">${esc(g)}</span>`).join("")}</div></div></article>`).join("");
 $("emptyState").classList.toggle("visible",list.length===0);
 $("movieGrid").style.display=list.length?"grid":"none";
 $("emptyState").querySelector("h3").textContent=movies.length?"Aucun film trouvé":"Ta vidéothèque commence ici";
 $("emptyState").querySelector("p").textContent=movies.length?"Essaie une autre recherche ou modifie les filtres.":"Ajoute un film par son titre ou scanne le code-barres de son boîtier.";
 $("emptyAddBtn").textContent=movies.length?"＋ Ajouter un DVD":"＋ Ajouter un DVD";
 const genres=[...new Set([...defaultGenres,...movies.flatMap(m=>m.genres)])].sort((a,b)=>a.localeCompare(b,"fr"));
 const old=$("genreFilter").value;$("genreFilter").innerHTML='<option value="">Tous les genres</option>'+genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("");$("genreFilter").value=genres.includes(old)?old:"";
 $("navCollection").classList.toggle("active",currentView==="collection");$("navLoans").classList.toggle("active",currentView==="loans");
 $("navAdd").classList.remove("active");$("navBackup").classList.remove("active");
}
async function refresh(){movies=(await allMovies()).map(normalizeMovie);render()}
function formMovie(m={}){
 formTmdbId=m.tmdbId||"";
 $("movieId").value=m.id||"";$("movieTitle").value=m.title||"";$("movieYear").value=m.year||"";$("movieDirector").value=m.director||"";
 $("movieGenres").value=(m.genres||[]).join(", ");$("movieBarcode").value=m.barcode||"";$("moviePoster").value=m.poster||"";$("movieNotes").value=m.notes||"";$("movieOverview").value=m.overview||"";
 $("movieLoaned").checked=!!m.loaned;$("borrowerFirst").value=m.borrowerFirst||"";$("borrowerLast").value=m.borrowerLast||"";$("loanDate").value=m.loanDate||dateToday();
 $("loanFields").classList.toggle("hidden",!m.loaned);$("formTitle").textContent=m.id?"Modifier le DVD":"Ajouter un film";$("formEyebrow").textContent=m.id?"MA COLLECTION":"NOUVEAU DVD";$("formMessage").textContent="";
 openDialog($("movieDialog"));
}
function buildMovieFromForm(){
 const old=movies.find(m=>m.id===$("movieId").value);
 const loaned=$("movieLoaned").checked,first=$("borrowerFirst").value.trim(),last=$("borrowerLast").value.trim(),date=$("loanDate").value||dateToday();
 if(loaned&&(!first||!last)){ $("formMessage").textContent="Renseigne le prénom et le nom de l’emprunteur.";return null}
 let history=old?.loanHistory||[];
 if(old&&old.loaned&&!loaned)history=[...history,{borrowerFirst:old.borrowerFirst,borrowerLast:old.borrowerLast,loanDate:old.loanDate,returnedAt:dateToday()}];
 if(loaned&&old?.loaned&&(old.borrowerFirst!==first||old.borrowerLast!==last||old.loanDate!==date)){
  history=[...history,{borrowerFirst:old.borrowerFirst,borrowerLast:old.borrowerLast,loanDate:old.loanDate,returnedAt:dateToday(),note:"Prêt modifié"}];
 }
 return normalizeMovie({...(old||{}),id:old?.id||uid(),title:$("movieTitle").value.trim(),year:$("movieYear").value,director:$("movieDirector").value.trim(),genres:normalizeGenres($("movieGenres").value),barcode:$("movieBarcode").value.trim(),poster:$("moviePoster").value.trim(),notes:$("movieNotes").value.trim(),overview:$("movieOverview").value.trim(),tmdbId:old?.tmdbId||formTmdbId,loaned,borrowerFirst:loaned?first:"",borrowerLast:loaned?last:"",loanDate:loaned?date:"",loanHistory:history,addedAt:old?.addedAt||new Date().toISOString()})
}
function normalizedTitle(value){
 return String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g," ").trim();
}
function findDuplicate(m){
 const title=normalizedTitle(m.title);
 const year=String(m.year||"").trim();
 const barcode=String(m.barcode||"").trim();
 return movies.find(other=>{
  if(other.id===m.id)return false; // Modifier un DVD n'est pas un doublon de lui-même.
  if(m.tmdbId&&other.tmdbId&&String(m.tmdbId)===String(other.tmdbId))return true;
  if(barcode&&String(other.barcode||"").trim()===barcode)return true;
  const sameTitle=title&&normalizedTitle(other.title)===title;
  // Si les deux années sont connues, elles doivent correspondre.
  return sameTitle&&(!year||!other.year||String(other.year).trim()===year);
 });
}
async function submitMovie(e){
 e.preventDefault();
 const m=buildMovieFromForm();
 if(!m)return;
 const duplicate=findDuplicate(m);
 if(duplicate){
  const details=[duplicate.title,duplicate.year?`(${duplicate.year})`:""].filter(Boolean).join(" ");
  const ok=window.confirm(`⚠️ Ce film figure déjà dans ta DVDthèque !\\n\\n${details}\\n\\nSouhaites-tu quand même ajouter cet exemplaire ?\\n\\nOK : ajouter quand même\\nAnnuler : revenir au formulaire`);
  if(!ok)return;
 }
 await saveMovie(m);
 closeDialog($("movieDialog"));
 await refresh();
 toast("DVD enregistré");
}
async function showDetails(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 $("detailsContent").innerHTML=`<div class="dialog-head"><div><p class="eyebrow">FICHE DVD</p><h2>Détails du film</h2></div><button type="button" class="icon-button close-dialog" aria-label="Fermer">×</button></div>
 <div class="detail-hero">${m.poster?`<img src="${esc(m.poster)}" alt="Affiche">`:'<div class="poster-placeholder">🎬</div>'}<div><h2>${esc(m.title)}</h2><div class="muted">${esc(m.year||"Année inconnue")}</div><p class="detail-info">${esc(m.director||"Réalisateur non renseigné")}</p>${m.loaned?'<span class="loan-badge">PRÊTÉ</span>':'<span class="chip">Disponible</span>'}</div></div>
 <p class="detail-label">GENRES</p><div class="card-genres">${m.genres.length?m.genres.map(g=>`<span class="chip">${esc(g)}</span>`).join(""):'<span class="muted">Non renseigné</span>'}</div>
 ${m.overview?`<p class="detail-label">RÉSUMÉ</p><p class="detail-info overview-text">${esc(m.overview)}</p>`:'<p class="detail-label">RÉSUMÉ</p><p class="detail-info muted" id="overviewLoading">Résumé non disponible pour ce film.</p>'}
 <div id="trailerArea" class="trailer-area" aria-live="polite">Recherche de la bande-annonce…</div>
 ${m.barcode?`<p class="detail-label">CODE-BARRES</p><p class="detail-info">${esc(m.barcode)}</p>`:""}
 ${m.loaned?`<p class="detail-label">PRÊT EN COURS</p><p class="detail-info"><strong>${esc(m.borrowerFirst)} ${esc(m.borrowerLast)}</strong><br>Depuis le ${esc(m.loanDate||"date inconnue")}</p>`:""}
 ${m.notes?`<p class="detail-label">NOTES</p><p class="detail-info">${esc(m.notes)}</p>`:""}
 <p class="detail-label">HISTORIQUE DES PRÊTS</p><div>${m.loanHistory.length?m.loanHistory.slice().reverse().map(h=>`<div class="history-item"><strong>${esc(h.borrowerFirst)} ${esc(h.borrowerLast)}</strong><br>Prêt le ${esc(h.loanDate||"date inconnue")}${h.returnedAt?" · rendu le "+esc(h.returnedAt):" · prêt non clôturé"}</div>`).join(""):'<p class="muted small">Aucun prêt précédent enregistré.</p>'}</div>
 <div class="dialog-actions"><button id="deleteMovieBtn" class="danger-button">Supprimer</button><button id="editMovieBtn" class="secondary">Modifier</button>${m.loaned?'<button id="returnMovieBtn" class="primary">Marquer comme rendu</button>':'<button id="loanMovieBtn" class="primary">Prêter ce DVD</button>'}</div>`;
 $("detailsContent").querySelector(".close-dialog").onclick=()=>closeDialog($("detailsDialog"));
 $("editMovieBtn").onclick=()=>{closeDialog($("detailsDialog"));formMovie(m)};
 $("deleteMovieBtn").onclick=async()=>{if(confirm(`Supprimer « ${m.title} » de la collection ?`)){await deleteMovie(m.id);closeDialog($("detailsDialog"));await refresh();toast("DVD supprimé")}};
 const loanBtn=$("returnMovieBtn")||$("loanMovieBtn");
 loanBtn.onclick=async()=>{closeDialog($("detailsDialog"));if(m.loaned){const updated={...m,loaned:false,loanHistory:[...m.loanHistory,{borrowerFirst:m.borrowerFirst,borrowerLast:m.borrowerLast,loanDate:m.loanDate,returnedAt:dateToday()}],borrowerFirst:"",borrowerLast:"",loanDate:""};await saveMovie(updated);await refresh();toast("DVD marqué comme rendu")}else formMovie({...m,loaned:true,loanDate:dateToday()})};
 openDialog($("detailsDialog"));
 loadTrailerForMovie(m, $("detailsContent").querySelector("#trailerArea"));
 // Les DVD ajoutés avant cette amélioration récupèrent leur résumé à la première ouverture.
 if(m.tmdbId&&!m.overview){
  const loading=$("detailsContent").querySelector("#overviewLoading");
  if(loading)loading.textContent="Récupération du résumé…";
  try{
   const detail=await getTMDB(`movie/${m.tmdbId}`);
   const updated=normalizeMovie({...m,overview:detail.overview||"",runtime:detail.runtime||m.runtime||"",genres:m.genres.length?m.genres:(detail.genres||[]).map(g=>g.name)});
   await saveMovie(updated);await refresh();
   if($("detailsDialog").open)showDetails(id);
  }catch(e){if(loading)loading.textContent="Résumé indisponible. Vérifie la connexion et la clé API dans Paramètres.";}
 }
}
async function loadTrailerForMovie(m, container){
 if(!container)return;
 try{
  let id=m.tmdbId;
  if(!id){
   const data=await getTMDB("search/movie",{query:m.title,include_adult:"false"});
   const norm=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
   const match=(data.results||[]).find(r=>(norm(r.title)===norm(m.title)||norm(r.original_title)===norm(m.title))&&(!m.year||String(r.release_date||"").slice(0,4)===String(m.year)));
   if(!match){if(container.isConnected)container.textContent="Bande-annonce indisponible : film non identifié dans TMDB.";return}
   id=match.id;
  }
  await loadTrailer(id,container);
 }catch(e){if(container.isConnected)container.textContent="Bande-annonce indisponible : vérifie la connexion ou la clé TMDB."}
}
async function loadTrailer(tmdbId, container){
 if(!container)return;
 // The area belongs to one specific opening of the movie dialog.
 const isCurrent=()=>container.isConnected && $("detailsDialog").open;
 try{
  let data=await getTMDB(`movie/${encodeURIComponent(tmdbId)}/videos`);
  let videos=Array.isArray(data.results)?data.results:[];
  if(!videos.some(v=>v.site==="YouTube" && v.type==="Trailer" && v.key)){
   data=await getTMDB(`movie/${encodeURIComponent(tmdbId)}/videos`,{language:"en-US"});
   videos=videos.concat(Array.isArray(data.results)?data.results:[]);
  }
  const youtube=videos.filter(v=>v.site==="YouTube" && v.key && /^[a-zA-Z0-9_-]{11}$/.test(v.key));
  const video=youtube.find(v=>v.type==="Trailer" && v.official && v.iso_639_1==="fr")
   ||youtube.find(v=>v.type==="Trailer" && v.iso_639_1==="fr")
   ||youtube.find(v=>v.type==="Trailer" && v.official)
   ||youtube.find(v=>v.type==="Trailer")
   ||youtube.find(v=>v.type==="Teaser");
  if(!isCurrent())return;
  if(!video){container.textContent="Aucune bande-annonce disponible sur TMDB pour ce film.";return;}
  const link=document.createElement("a");
  link.className="primary trailer-link";
  link.textContent="▶ Voir la bande-annonce";
  link.href=`https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`;
  link.target="_blank";
  link.rel="noopener noreferrer";
  link.setAttribute("aria-label","Voir la bande-annonce sur YouTube (nouvel onglet)");
  container.replaceChildren(link);
 }catch(e){if(isCurrent())container.textContent="Impossible de charger la bande-annonce (connexion ou clé TMDB).";}
}
async function getTMDB(path,params={}){
 const key=settings().key;if(!key)throw new Error("Configure d’abord ta clé API TMDB dans les paramètres ⚙.");
 const url=new URL("https://api.themoviedb.org/3/"+path);url.searchParams.set("api_key",key);url.searchParams.set("language","fr-FR");
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
 const res=await fetch(url);if(!res.ok){if(res.status===401)throw new Error("Clé API invalide. Vérifie-la dans les paramètres.");throw new Error("La recherche TMDB a échoué ("+res.status+"). Réessaie plus tard.")}return res.json()
}
async function searchTMDB(query){
 $("tmdbResults").innerHTML="";$("tmdbMessage").textContent="Recherche en cours…";
 try{const data=await getTMDB("search/movie",{query,include_adult:"false",page:"1"});const results=data.results||[];
 if(!results.length){$("tmdbMessage").textContent="Aucun résultat. Essaie le titre original ou saisis le film manuellement.";return}
 $("tmdbMessage").textContent=`${results.length} résultat(s) trouvé(s). Sélectionne le bon film.`;
 $("tmdbResults").innerHTML=results.slice(0,12).map(r=>{const poster=r.poster_path?"https://image.tmdb.org/t/p/w342"+r.poster_path:"";return `<div class="tmdb-result"><img src="${esc(poster)}" alt="" onerror="this.style.visibility='hidden'"><div><h3>${esc(r.title||r.original_title||"Sans titre")}</h3><p>${esc((r.release_date||"").slice(0,4)||"Année inconnue")}<br>${esc((r.overview||"").slice(0,115))}${(r.overview||"").length>115?"…":""}</p></div><button type="button" class="primary select-tmdb" data-id="${r.id}">Choisir</button></div>`}).join("");
 $("tmdbResults").querySelectorAll(".select-tmdb").forEach(btn=>btn.onclick=()=>selectTMDB(results.find(r=>String(r.id)===btn.dataset.id)));
 }catch(e){$("tmdbMessage").textContent=e.message}
}
async function selectTMDB(r){
 let director="";
 try{const credits=await getTMDB(`movie/${r.id}/credits`);director=(credits.crew||[]).find(p=>p.job==="Director")?.name||""}catch(_){}
 const poster=r.poster_path?"https://image.tmdb.org/t/p/w500"+r.poster_path:"";
 const m={barcode:pendingBarcode,title:r.title||r.original_title||"",year:(r.release_date||"").slice(0,4),director,genres:[],poster,overview:r.overview||"",tmdbId:r.id};
 try{const detail=await getTMDB(`movie/${r.id}`);m.genres=(detail.genres||[]).map(g=>g.name);m.overview=detail.overview||m.overview;m.runtime=detail.runtime||""}catch(_){}
 closeDialog($("searchDialog"));formMovie(m);pendingBarcode="";
}
async function openSearch(){ pendingBarcode="";$("tmdbQuery").value="";$("tmdbResults").innerHTML="";$("tmdbMessage").textContent="";openDialog($("searchDialog"));setTimeout(()=>$("tmdbQuery").focus(),100)}
function validEAN13(code){
 if(!/^\\d{13}$/.test(code))return true; // Certains scanners lisent aussi UPC-A ou EAN-8.
 const digits=code.split("").map(Number);
 const sum=digits.slice(0,12).reduce((total,n,i)=>total+n*(i%2===0?1:3),0);
 return (10-sum%10)%10===digits[12];
}
function cleanProductTitle(title){
 return String(title||"").replace(/\\b(dvd|blu[ -]?ray|édition|edition|collector|zone\\s*2|pal|format|coffret)\\b/gi," ")
 .replace(/\\([^)]*(dvd|blu-ray|zone|pal)[^)]*\\)/gi," ").replace(/[|_]+/g," ").replace(/\\s+/g," ").trim();
}
async function fetchJsonTimeout(url,ms=8500){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),ms);
 try{const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
 if(response.status===404)return null;
 if(response.status===429)throw new Error("Limite temporaire de la base de codes-barres atteinte.");
 if(!response.ok)throw new Error("Service indisponible ("+response.status+").");
 return response.json();
 }finally{clearTimeout(timeout)}
}
async function lookupBarcodeTitle(code){
 // UPCitemdb : formule publique gratuite sans clé ; sa couverture des DVD est variable.
 let lastError="";
 try{
  const data=await fetchJsonTimeout("https://api.upcitemdb.com/prod/trial/lookup?upc="+encodeURIComponent(code));
  const item=(data?.items||[]).find(x=>x.title);
  if(item)return {title:cleanProductTitle(item.title),source:"UPCitemdb"};
 }catch(e){lastError=e.message}
 // Base collaborative libre : une seconde chance pour les codes absents.
 try{
  const data=await fetchJsonTimeout("https://world.openproductsfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields=product_name,product_name_fr");
  const title=data?.product?.product_name_fr||data?.product?.product_name;
  if(title)return {title:cleanProductTitle(title),source:"Open Products Facts"};
 }catch(e){lastError=lastError||e.message}
 return {title:"",error:lastError};
}
async function handleBarcode(code){
 code=String(code||"").replace(/\\s/g,"");
 if(barcodeLookupActive)return;
 if(!validEAN13(code)){ $("scanStatus").textContent="Ce code EAN-13 semble mal lu. Réessaie le scan.";return}
 barcodeLookupActive=true;pendingBarcode=code;
 stopScanner();closeDialog($("scanDialog"));
 // Une édition connue dans la collection ne nécessite pas de recherche externe.
 const existing=movies.find(m=>String(m.barcode||"")===code);
 if(existing){
  const again=confirm("Ce code-barres existe déjà dans ta collection : "+existing.title+".\\n\\nAjouter tout de même un nouvel exemplaire ?");
  if(!again){barcodeLookupActive=false;return}
  formMovie({...existing,id:"",barcode:code,loaned:false,borrowerFirst:"",borrowerLast:"",loanHistory:[]});
  barcodeLookupActive=false;return;
 }
 const editing=$("movieDialog").open;
 if(editing){$("movieBarcode").value=code;$("formMessage").textContent="Recherche automatique du DVD en cours…"}
 else{openDialog($("searchDialog"));}
 if(!editing){$("tmdbMessage").textContent="Recherche du DVD par son code-barres…";$("tmdbResults").innerHTML=""}
 const product=await lookupBarcodeTitle(code);
 barcodeLookupActive=false;
 if(product.title){
  if(editing)closeDialog($("movieDialog"));
  openDialog($("searchDialog"));
  $("tmdbQuery").value=product.title;
  $("tmdbMessage").textContent="Code-barres reconnu via "+product.source+". Recherche du film sur TMDB…";
  await searchTMDB(product.title);
  // Le code-barres reste associé au film sélectionné dans les résultats TMDB.
 }else{
  if(editing){$("formMessage").textContent="Code-barres enregistré, mais aucun titre trouvé automatiquement."}
  else{$("tmdbMessage").textContent="Code-barres non trouvé dans les bases gratuites. Recherche par titre possible ci-dessous."+ (product.error?" ("+product.error+")":"")}
 }
}
async function startScanner(){
 openDialog($("scanDialog"));$("scanStatus").textContent="";$("manualBarcode").value="";
 if(!navigator.mediaDevices?.getUserMedia){$("scanStatus").textContent="La caméra n’est pas disponible ici. Saisis le code-barres manuellement.";return}
 if(!("BarcodeDetector" in window)){$("scanStatus").textContent="Le scan automatique n’est pas pris en charge par ce navigateur. Saisis le code-barres manuellement.";return}
 try{
  const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  const video=$("scanVideo");video.srcObject=stream;await video.play();$("scanStatus").textContent="Place le code-barres dans le cadre de la caméra.";
  scanBusy=false;clearInterval(scanTimer);
  scanTimer=setInterval(async()=>{if(scanBusy||!video.videoWidth)return;scanBusy=true;try{const codes=await detector.detect(video);if(codes.length){const code=codes[0].rawValue;$("manualBarcode").value=code;stopScanner();await handleBarcode(code)}}catch(e){$("scanStatus").textContent="Erreur pendant la recherche : "+e.message}finally{scanBusy=false}},350);
 }catch(e){$("scanStatus").textContent="Impossible d’accéder à la caméra. Vérifie l’autorisation ou saisis le numéro manuellement."}
}
function stopScanner(){clearInterval(scanTimer);scanTimer=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$("scanVideo").srcObject=null}
async function useManualBarcode(){
 const code=$("manualBarcode").value.trim();if(!code){$("scanStatus").textContent="Saisis un numéro de code-barres.";return}
 await handleBarcode(code);
}
function exportBackup(){
 const payload={app:"Les Films de Pitou",version:1,exportedAt:new Date().toISOString(),movies};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`ma-dvdtheque-${dateToday()}.json`;a.click();URL.revokeObjectURL(url);
 $("backupMessage").textContent=`Sauvegarde exportée (${movies.length} DVD). Conserve ce fichier dans un endroit sûr.`;
}
async function importBackup(file){
 try{const parsed=JSON.parse(await file.text());const list=Array.isArray(parsed)?parsed:parsed.movies;if(!Array.isArray(list))throw new Error("Ce fichier ne contient pas de collection reconnue.");
 if(!confirm(`Restaurer ${list.length} DVD ? La collection actuelle sera remplacée.`))return;
 const cleaned=list.map(normalizeMovie);await replaceAll(cleaned);await refresh();$("backupMessage").textContent=`Restauration terminée : ${cleaned.length} DVD importés.`;toast("Collection restaurée");
 }catch(e){$("backupMessage").textContent="Impossible de restaurer ce fichier : "+e.message}
 $("importFile").value="";
}
function wire(){
 $("searchInput").addEventListener("input",render);["genreFilter","statusFilter","sortSelect"].forEach(id=>$(id).addEventListener("change",render));
 $("movieGrid").addEventListener("click",e=>{const card=e.target.closest(".movie-card");if(card)showDetails(card.dataset.id)});
 $("movieGrid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("movie-card")){e.preventDefault();showDetails(e.target.dataset.id)}});
 $("movieForm").addEventListener("submit",submitMovie);
 $("movieLoaned").addEventListener("change",()=> $("loanFields").classList.toggle("hidden",!$("movieLoaned").checked));
 $("navCollection").onclick=()=>{currentView="collection";$("statusFilter").value="all";render();window.scrollTo({top:0,behavior:"smooth"})};
 $("navLoans").onclick=()=>{currentView="loans";$("statusFilter").value="loaned";render();window.scrollTo({top:0,behavior:"smooth"})};
 const addAction=()=>{openSearch()};
 $("manualAddBtn").onclick=()=>{closeDialog($("searchDialog"));formMovie({})};
 $("scanAddBtn").onclick=()=>{closeDialog($("searchDialog"));formMovie({});startScanner()};
 $("navAdd").onclick=addAction;$("emptyAddBtn").onclick=addAction;
 $("scanFromForm").onclick=()=>startScanner();
 $("searchForm").addEventListener("submit",e=>{e.preventDefault();if($("tmdbQuery").value.trim())searchTMDB($("tmdbQuery").value.trim())});
 $("settingsBtn").onclick=()=>{const s=settings();$("tmdbKey").value=s.key;$("collectionName").value=s.name;openDialog($("settingsDialog"))};
 $("settingsForm").addEventListener("submit",e=>{e.preventDefault();localStorage.setItem("tmdbKey",$("tmdbKey").value.trim());localStorage.setItem("collectionName",$("collectionName").value.trim()||"Les Films de Pitou");document.querySelector(".brand h1").textContent=localStorage.getItem("collectionName");closeDialog($("settingsDialog"));toast("Paramètres enregistrés")});
 $("navBackup").onclick=()=>{$("backupMessage").textContent="";openDialog($("backupDialog"))};
 $("exportBtn").onclick=exportBackup;$("importFile").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)importBackup(f)});
 $("useManualBarcode").onclick=useManualBarcode;$("stopScan").onclick=()=>{stopScanner();closeDialog($("scanDialog"))};
 dialogs.forEach(d=>{d.addEventListener("click",e=>{if(e.target===d)closeDialog(d)});d.querySelectorAll?.(".close-dialog").forEach(b=>b.addEventListener("click",()=>{if(d.id==="scanDialog")stopScanner();closeDialog(d)}));d.addEventListener("close",()=>{if(d.id==="scanDialog")stopScanner()})});
}
async function init(){
 try{
 const previousName=localStorage.getItem("collectionName");
 if(!previousName||previousName==="Ma DVDthèque")localStorage.setItem("collectionName","Les Films de Pitou");
 db=await openDB();wire();document.querySelector(".brand h1").textContent=settings().name;await refresh();if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});}
 catch(e){alert("Impossible d’ouvrir la base de données locale. Essaie avec Chrome en mode normal.");console.error(e)}
}
document.addEventListener("DOMContentLoaded",init);
})();