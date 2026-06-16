/* Koffi Academy — Popup de contact premium. Auto-injecté, branché sur tous les « Kontakt ». */
(function () {
  "use strict";
  var EMAIL = "info@lingenieur.de";
  var TEL = "01775061655";
  var WA = "https://wa.me/491775061655?text=" + encodeURIComponent("Hallo Koffi Academy, ich interessiere mich für Ihre Inhalte.");

  var CSS =
  "#kk-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,18,40,.68);backdrop-filter:blur(6px);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s}"+
  "#kk-ov.kk-open{opacity:1;visibility:visible}"+
  "#kk-modal{font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif;width:100%;max-width:350px;background:#0d2040;border-radius:26px;box-shadow:0 32px 80px rgba(0,0,0,.6);padding:24px 20px 22px;position:relative;transform:scale(.94);transition:transform .25s cubic-bezier(.34,1.3,.5,1)}"+
  "#kk-ov.kk-open #kk-modal{transform:scale(1)}"+
  "#kk-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border:0;border-radius:8px;background:rgba(255,255,255,.13);color:#fff;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .18s}"+
  "#kk-close:hover{background:rgba(255,255,255,.26)}"+
  ".kk-btn{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;padding:19px 24px;border-radius:15px;border:0;text-decoration:none;cursor:pointer;font-family:inherit;font-size:17px;font-weight:800;letter-spacing:-.01em;margin-bottom:12px;transition:transform .18s,filter .18s;box-sizing:border-box}"+
  ".kk-btn:last-child{margin-bottom:0}"+
  ".kk-btn:hover{transform:translateY(-2px);filter:brightness(1.08)}"+
  ".kk-btn:active{transform:translateY(0);filter:brightness(.94)}"+
  ".kk-btn i{font-size:20px;flex-shrink:0}"+
  ".kk-btn-call{background:linear-gradient(to right,#1565C0,#00BCD4);color:#fff;box-shadow:0 6px 24px rgba(21,101,192,.45)}"+
  ".kk-btn-email{background:#ffffff;color:#07294d;box-shadow:0 6px 20px rgba(0,0,0,.18)}"+
  ".kk-btn-wa{background:#00897B;color:#fff;box-shadow:0 6px 24px rgba(0,137,123,.45)}"+
  "@media(max-width:480px){#kk-modal{padding:20px 16px 18px;border-radius:20px}.kk-btn{padding:17px 20px;font-size:16px}}";

  var HTML =
  '<div id="kk-modal" role="dialog" aria-modal="true" aria-label="Kontakt">'+
    '<button id="kk-close" type="button" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button>'+
    '<a class="kk-btn kk-btn-call" href="tel:'+TEL+'">'+
      '<i class="fa-solid fa-phone"></i><span>Anrufen</span></a>'+
    '<a class="kk-btn kk-btn-email" href="mailto:'+EMAIL+'">'+
      '<i class="fa-solid fa-envelope"></i><span>E-Mail</span></a>'+
    '<a class="kk-btn kk-btn-wa" id="kk-wa" href="'+WA+'" target="_blank" rel="noopener noreferrer">'+
      '<i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span></a>'+
  '</div>';

  var ov, lastFocus;
  function build(){
    var st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
    ov=document.createElement("div"); ov.id="kk-ov"; ov.innerHTML=HTML; document.body.appendChild(ov);
    ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
    ov.querySelector("#kk-close").addEventListener("click", close);
    // WhatsApp: open a real top-level tab (avoids api.whatsapp.com being blocked inside a frame → ERR_BLOCKED_BY_RESPONSE)
    var wa=ov.querySelector("#kk-wa");
    if(wa){ wa.addEventListener("click", function(e){
      e.preventDefault();
      var win=window.open(WA, "_blank", "noopener,noreferrer");
      if(win){ try{ win.opener=null; }catch(_){} return; }
      // Popup blocked → escape any framing by navigating the top-most window
      try{ if(window.top && window.top!==window){ window.top.location.href=WA; return; } }catch(_){}
      location.href=WA;
    }); }
  }
  function open(){
    if(!ov) build();
    lastFocus=document.activeElement;
    ov.classList.add("kk-open");
    document.body.style.overflow="hidden";
    document.addEventListener("keydown", onKey);
    setTimeout(function(){ var c=ov.querySelector("#kk-close"); if(c)c.focus(); },60);
  }
  function close(){
    if(!ov) return;
    ov.classList.remove("kk-open");
    document.body.style.overflow="";
    document.removeEventListener("keydown", onKey);
    if(lastFocus&&lastFocus.focus) lastFocus.focus();
  }
  function onKey(e){
    if(e.key==="Escape"){ close(); return; }
    if(e.key==="Tab"){
      var f=ov.querySelectorAll('a[href],button');
      if(!f.length) return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  }
  // Expose pour les onclick existants (ex: koffi-profile openContactMail)
  window.openKontakt = open;
  window.openContactMail = function(e){ if(e&&e.preventDefault) e.preventDefault(); open(); };

  function isKontakt(a){
    if(!a||a.closest("#kk-ov")) return false;
    var oc=a.getAttribute("onclick")||"";
    if(/openContactMail|openKontakt/i.test(oc)) return true;
    var href=a.getAttribute("href")||"";
    if(/(^|\/)contact\.html($|[?#])/i.test(href)) return true;
    var t=(a.textContent||"").replace(/\s+/g," ").trim().toLowerCase();
    return t==="kontakt"||t==="contact"||t==="kontakt aufnehmen"||t==="kontakt & support";
  }
  document.addEventListener("click", function(e){
    var a=e.target.closest("a,button"); if(!a) return;
    if(isKontakt(a)){ e.preventDefault(); e.stopPropagation(); open(); }
  });
})();
