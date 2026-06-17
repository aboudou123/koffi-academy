/* Koffi Academy — menu mobile (hamburger) pour les en-têtes custom.
 * Couvre l'en-tête moderne (.kh / .kh__nav) et la page profil (.navbar / .nav-menu).
 * Les styles CSS mobiles sont dans modern-header.css — ce fichier gère uniquement
 * le comportement JS (burger toggle, profile navbar). */
(function () {
  "use strict";

  /* Navbar profile page + styles utilitaires mineurs non couverts par modern-header.css */
  var st = document.createElement("style"); st.textContent =
    ".nav-burger{display:none;background:transparent;border:0;cursor:pointer;padding:6px 9px;line-height:1;border-radius:8px;color:#07294d;font-size:22px}" +
    ".nav-burger:hover{background:#f1f5f9}" +
    ".kh__burger{display:none;background:transparent;border:0;cursor:pointer;padding:6px 9px;line-height:1;border-radius:8px;color:#fff;font-size:22px}" +
    ".kh__burger:before{content:\"\\2630\";font-family:Arial,sans-serif;font-weight:700;line-height:1}" +
    ".kh__burger i{display:none}" +
    ".kh__burger:hover{background:rgba(255,255,255,.12)}" +
    "@media(max-width:860px){" +
      ".nav-burger{display:inline-flex;align-items:center;justify-content:center}" +
      ".navbar .wrap{position:relative}" +
      ".navbar .nav-menu{position:absolute;top:calc(100% + 1px);left:0;right:0;flex-direction:column;align-items:stretch;gap:2px;background:#fff;border-top:1px solid #e2e8f0;padding:10px 18px 18px;box-shadow:0 20px 44px rgba(7,41,77,.16);display:none;z-index:80}" +
      ".navbar .nav-menu.is-open{display:flex}" +
      ".navbar .nav-menu a{padding:12px 10px;color:#07294d;font-weight:600}" +
      ".navbar .nav-menu .nm-drop{flex-direction:column;align-items:stretch}" +
      ".navbar .nav-menu .nm-drop>i{display:none}" +
      ".navbar .nav-menu .nm-menu{position:static;opacity:1;visibility:visible;transform:none;box-shadow:none;border:0;padding:0 0 4px 16px}" +
      ".kh__burger{display:inline-flex!important;align-items:center;justify-content:center;flex-shrink:0}" +
      ".kh .kh__in{position:relative;gap:10px}" +
      ".kh .kh__brand{min-width:0}" +
      ".kh .kh__name{white-space:normal;line-height:1.15}" +
      ".kh .kh__nav{position:absolute!important;top:calc(100% + 1px)!important;left:0!important;right:0!important;display:none!important;flex-direction:column!important;align-items:stretch!important;gap:0!important;background:#0a2240!important;border-top:2px solid rgba(214,160,45,.5)!important;padding:8px 14px 16px!important;box-shadow:0 24px 50px rgba(0,0,0,.55)!important;z-index:80!important}" +
      ".kh .kh__nav.is-open{display:flex!important}" +
      ".kh .kh__nav>a{display:block;padding:14px 12px!important;font-size:15.5px!important;font-weight:600;color:rgba(255,255,255,.9)!important;border-radius:9px;border-bottom:1px solid rgba(255,255,255,.06);white-space:normal}" +
      ".kh .kh__nav>a:hover,.kh .kh__nav>a:active{background:rgba(255,255,255,.08)!important;color:#fff!important}" +
      ".kh .kh__nav>a.active{color:#f9d77e!important;background:rgba(214,160,45,.12)!important}" +
      ".kh .kh__nav .kh__drop{display:flex!important;flex-direction:column!important;align-items:stretch!important;border-bottom:1px solid rgba(255,255,255,.06)}" +
      ".kh .kh__nav .kh__droplabel{padding:14px 12px!important;font-size:15.5px!important;font-weight:600;color:rgba(255,255,255,.9)!important;white-space:normal}" +
      ".kh .kh__nav .kh__drop>i{display:none!important}" +
      ".kh .kh__nav .kh__menu{position:static!important;opacity:1!important;visibility:visible!important;transform:none!important;background:rgba(255,255,255,.05)!important;border:0!important;border-left:2px solid rgba(214,160,45,.5)!important;border-radius:0 0 8px 8px!important;box-shadow:none!important;padding:4px 0 8px 12px!important;min-width:0!important;margin-bottom:6px!important;transition:none!important}" +
      ".kh .kh__nav .kh__menu a{display:block;padding:11px 12px!important;font-size:14.5px!important;font-weight:600;color:rgba(255,255,255,.85)!important;border-radius:7px;text-decoration:none;white-space:normal}" +
      ".kh .kh__nav .kh__menu a:hover,.kh .kh__nav .kh__menu a:active{background:rgba(255,255,255,.09)!important;color:#fff!important}" +
      ".kh .kh__nav .kh__menu a.active{color:#f9d77e!important}" +
      ".kh .kh__nav .kh__auth{display:flex!important;gap:10px;margin:12px 0 0;padding-top:12px;border-top:1px solid rgba(255,255,255,.10)}" +
      ".kh .kh__nav .kh__login,.kh .kh__nav .kh__btn{flex:1;text-align:center;padding:11px 12px!important;font-size:14.5px!important}" +
    "}" +
    ":where(a,button,input,select,textarea,[tabindex],.chip,.lab-cta,.btn,.kh__nav a,.seg button,.kl-opt,.kl-btn):focus-visible{outline:2px solid #f89035;outline-offset:2px;border-radius:6px}" +
    "button:disabled,.btn:disabled,[aria-disabled=\"true\"]{opacity:.55;cursor:not-allowed}";
  document.head.appendChild(st);

  function wire(container, nav, cls, icon) {
    if (!container || !nav || container.querySelector("." + cls)) return;
    var b = document.createElement("button");
    b.className = cls; b.setAttribute("aria-label", "Menu"); b.setAttribute("aria-expanded", "false");
    b.innerHTML = '<i class="' + icon + '"></i>';
    container.appendChild(b);
    b.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      b.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) { nav.classList.remove("is-open"); b.setAttribute("aria-expanded","false"); } });
  }

  var commonLabels = {
    de: {
      home: "Startseite",
      courses: "Kurse",
      labs: "Labore",
      catalog: "Kurskatalog",
      devPortal: "Dev Portal",
      blog: "Blog",
      culture: "Kultur",
      profile: "Profil",
      aboutMe: "Über mich",
      events: "Veranstaltungen",
      sponsor: "Sponsor",
      contact: "Kontakt",
      login: "Anmelden",
      register: "Registrieren"
    },
    en: {
      home: "Home",
      courses: "Courses",
      labs: "Labs",
      catalog: "Course catalog",
      devPortal: "Dev Portal",
      blog: "Blog",
      culture: "Culture",
      profile: "Profile",
      aboutMe: "About me",
      events: "Events",
      sponsor: "Sponsor",
      contact: "Contact",
      login: "Login",
      register: "Register"
    },
    fr: {
      home: "Accueil",
      courses: "Cours",
      labs: "Laboratoires",
      catalog: "Catalogue de cours",
      devPortal: "Dev Portal",
      blog: "Blog",
      culture: "Culture",
      profile: "Profil",
      aboutMe: "À propos de moi",
      events: "Événements",
      sponsor: "Sponsor",
      contact: "Contact",
      login: "Connexion",
      register: "Inscription"
    }
  };

  function currentLang(lang) {
    var l = lang || localStorage.getItem("preferred-lang") || document.documentElement.lang || "de";
    l = String(l).slice(0, 2).toLowerCase();
    return commonLabels[l] ? l : "de";
  }

  function cleanHref(a) {
    return (a.getAttribute("href") || "").split(/[?#]/)[0].replace(/\\/g, "/");
  }

  function inSharedNav(a) {
    return !!a.closest("header,.kh,.navbar,footer,.simple-footer,.site-footer,.kf");
  }

  function isActionLink(a) {
    return !!a.closest(".btn,.kh__cta,.hero-btn,.go-btn,.nav-cta,.lab__link,.cta__btns,.go-actions,.hero__cta,.fiche__cta,.cta-actions");
  }

  function canReplace(a, aliases) {
    var current = a.textContent.replace(/\s+/g, " ").trim();
    var key = a.getAttribute("data-i18n") || a.getAttribute("data-i18n-html") || "";
    return aliases.indexOf(current) !== -1 || /^(nav|foot|footer\.nav)[.-]/.test(key) || /^nav[A-Z]/.test(key);
  }

  function text(a, value, aliases) {
    if (!a || !value) return;
    if (isActionLink(a) || !canReplace(a, aliases || [])) return;
    a.textContent = value;
  }

  function applyCommonLabels(lang) {
    var l = commonLabels[currentLang(lang)];
    document.querySelectorAll(".kh__droplabel,.nm-drop > a").forEach(function (el) {
      var txt = el.textContent.trim();
      if (/^(Kurse|Cours|Courses)$/.test(txt) || /nav[-.]?courses|navCourses/.test(el.getAttribute("data-i18n") || "")) {
        el.textContent = l.courses;
      }
    });
    document.querySelectorAll("a[href]").forEach(function (a) {
      if (!inSharedNav(a)) return;
      var href = cleanHref(a);
      if (/(^|\/)index\.html$/.test(href)) return text(a, l.home, ["Startseite", "Home", "Accueil"]);
      if (/(^|\/)laboratoire\.html$/.test(href)) return text(a, l.labs, ["Laboratoire", "Laboratoires", "Labore", "Labs"]);
      if (/(^|\/)courses\/courses\.html$/.test(href)) return text(a, l.catalog, ["Kurskatalog", "Course catalog", "Course Catalog", "Catalogue de cours"]);
      if (/(^|\/)idp-demo\.html$/.test(href)) return text(a, l.devPortal, ["Dev Portal"]);
      if (/(^|\/)blog\.html$/.test(href)) return text(a, l.blog, ["Blog"]);
      if (/(^|\/)culture\.html$/.test(href)) return text(a, l.culture, ["Culture", "Kultur"]);
      if (/(^|\/)koffi-profile\.html$/.test(href)) return text(a, a.closest("footer") ? l.profile : l.aboutMe, ["Profil", "Profile", "Über mich", "About me", "About Me", "À propos de moi"]);
      if (/(^|\/)event\.html$/.test(href)) return text(a, l.events, ["Veranstaltungen", "Events", "Événements"]);
      if (/(^|\/)(sponsor|pricing)\.html$/.test(href)) return text(a, l.sponsor, ["Sponsor"]);
      if (/(^|\/)contact\.html$/.test(href)) return text(a, l.contact, ["Kontakt", "Contact"]);
      if (/(^|\/)login\.html$/.test(href)) return text(a, l.login, ["Anmelden", "Login", "Connexion"]);
      if (/(^|\/)register\.html$/.test(href)) return text(a, l.register, ["Registrieren", "Register", "Inscription"]);
    });
  }

  function wrapLanguageSetter(name) {
    var fn = window[name];
    if (typeof fn !== "function" || fn.__koffiCommonWrapped) return;
    window[name] = function (lang) {
      var result = fn.apply(this, arguments);
      applyCommonLabels(lang);
      return result;
    };
    window[name].__koffiCommonWrapped = true;
  }

  function patchLanguageSetters() {
    ["setLanguage", "setLang", "setHomeLang", "setLabDetailLang", "setLabsLang"].forEach(wrapLanguageSetter);
  }

  document.addEventListener("click", function (e) {
    var pick = e.target.closest("[data-kl],[data-lang],[data-lang-btn]");
    if (!pick) return;
    var lang = pick.getAttribute("data-kl") || pick.getAttribute("data-lang") || pick.getAttribute("data-lang-btn");
    setTimeout(function () { applyCommonLabels(lang); patchLanguageSetters(); }, 0);
  });

  document.addEventListener("DOMContentLoaded", function () {
    var khIn = document.querySelector(".kh .kh__in");
    wire(khIn, khIn && khIn.querySelector(".kh__nav"), "kh__burger", "fa-solid fa-bars");
    var nbWrap = document.querySelector(".navbar .wrap");
    wire(nbWrap, nbWrap && nbWrap.querySelector(".nav-menu"), "nav-burger", "fas fa-bars");
    patchLanguageSetters();
    applyCommonLabels();
    setTimeout(function () { patchLanguageSetters(); applyCommonLabels(); }, 120);
  });
  patchLanguageSetters();
})();
