/* Koffi Academy — menu mobile (hamburger) pour les en-têtes custom.
 * Couvre l'en-tête moderne (.kh / .kh__nav) et la page profil (.navbar / .nav-menu).
 * Ajoute un bouton burger ≤860px et replie la navigation en panneau vertical. */
(function () {
  "use strict";
  var css =
  ".kh__burger,.nav-burger{display:none;background:transparent;border:0;cursor:pointer;padding:6px 9px;line-height:1;border-radius:8px}" +
  ".kh__burger{color:#fff;font-size:22px}.kh__burger:hover{background:rgba(255,255,255,.12)}" +
  ".nav-burger{color:#07294d;font-size:22px}.nav-burger:hover{background:#f1f5f9}" +
  "@media(max-width:860px){" +
    ".kh .kh__in{position:relative}" +
    ".kh__burger{display:inline-flex;align-items:center;justify-content:center}" +

    /* Panneau mobile principal */
    ".kh .kh__nav{position:absolute;top:calc(100% + 1px);left:0;right:0;flex-direction:column;align-items:stretch;gap:0;background:#0a2240;border-top:2px solid rgba(214,160,45,.5);padding:8px 14px 16px;box-shadow:0 24px 50px rgba(0,0,0,.55);display:none;z-index:80}" +
    ".kh .kh__nav.is-open{display:flex}" +

    /* Liens principaux */
    ".kh .kh__nav>a{padding:14px 12px;font-size:15.5px;font-weight:600;color:rgba(255,255,255,.9);border-radius:9px;border-bottom:1px solid rgba(255,255,255,.06)}" +
    ".kh .kh__nav>a:last-of-type{border-bottom:0}" +
    ".kh .kh__nav>a:hover,.kh .kh__nav>a:active{background:rgba(255,255,255,.08);color:#fff}" +
    ".kh .kh__nav>a.active{color:#f9d77e;background:rgba(214,160,45,.12)}" +

    /* Dropdown Kurse */
    ".kh .kh__nav .kh__drop{flex-direction:column;align-items:stretch;border-bottom:1px solid rgba(255,255,255,.06)}" +
    ".kh .kh__nav .kh__droplabel{padding:14px 12px;font-size:15.5px;font-weight:600;color:rgba(255,255,255,.9)}" +
    ".kh .kh__nav .kh__drop>i{display:none}" +

    /* Sous-menu — fond légèrement différent + texte blanc visible */
    ".kh .kh__nav .kh__menu{position:static;opacity:1;visibility:visible;transform:none;background:rgba(255,255,255,.04);border:0;border-left:2px solid rgba(214,160,45,.45);border-radius:0 0 8px 8px;box-shadow:none;padding:4px 0 8px 12px;min-width:0;margin-bottom:6px}" +
    ".kh .kh__nav .kh__menu a{display:block;padding:11px 12px;font-size:14.5px;font-weight:600;color:rgba(255,255,255,.80);border-radius:7px}" +
    ".kh .kh__nav .kh__menu a:hover,.kh .kh__nav .kh__menu a:active{background:rgba(255,255,255,.08);color:#fff}" +
    ".kh .kh__nav .kh__menu a.active{color:#f9d77e}" +

    /* Boutons Auth */
    ".kh .kh__nav .kh__auth{display:flex !important;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.10);margin-left:0}" +
    ".kh .kh__nav .kh__auth .kh__login{flex:1;text-align:center;padding:11px 12px;font-size:14.5px;border-color:rgba(255,255,255,.5)}" +
    ".kh .kh__nav .kh__auth .kh__btn{flex:1;text-align:center;padding:11px 12px;font-size:14.5px}" +

    /* Navbar profile page */
    ".navbar .wrap{position:relative}" +
    ".nav-burger{display:inline-flex;align-items:center;justify-content:center}" +
    ".navbar .nav-menu{position:absolute;top:calc(100% + 1px);left:0;right:0;flex-direction:column;align-items:stretch;gap:2px;background:#fff;border-top:1px solid #e2e8f0;padding:10px 18px 18px;box-shadow:0 20px 44px rgba(7,41,77,.16);display:none;z-index:80}" +
    ".navbar .nav-menu.is-open{display:flex}" +
    ".navbar .nav-menu a{padding:12px 10px;color:#07294d;font-weight:600}" +
    ".navbar .nav-menu .nm-drop{flex-direction:column;align-items:stretch}" +
    ".navbar .nav-menu .nm-drop>i{display:none}" +
    ".navbar .nav-menu .nm-menu{position:static;opacity:1;visibility:visible;transform:none;box-shadow:none;border:0;padding:0 0 4px 16px}" +
  "}";
  var st = document.createElement("style"); st.textContent = css +
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
