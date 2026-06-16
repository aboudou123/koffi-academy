/* Koffi Academy — bandeau d'annonce rotatif (header-top).
 * Remplace l'ancien message par des messages de bienvenue professionnels,
 * qui défilent toutes les 2 minutes. Multilingue (DE/FR/EN selon la langue active). */
(function () {
  "use strict";
  var MSG = {
    de: [
      "Willkommen bei der Koffi Academy — Ihre Cloud- & DevOps-Reise beginnt hier.",
      "Lernen an echten Laboren: Cloud, Kubernetes, Terraform, Observability & KI.",
      "Praxisnahes Engineering-Know-how, geprüft an realen Pipelines.",
      "Werden Sie der Engineer der nächsten Generation — Schritt für Schritt."
    ],
    fr: [
      "Bienvenue à la Koffi Academy — votre montée en compétences Cloud & DevOps commence ici.",
      "Apprenez sur de vrais laboratoires : Cloud, Kubernetes, Terraform, observabilité & IA.",
      "Un savoir-faire d'ingénieur concret, validé sur des pipelines réels.",
      "Devenez l'ingénieur de la prochaine génération — pas à pas."
    ],
    en: [
      "Welcome to Koffi Academy — your Cloud & DevOps journey starts here.",
      "Learn on real-world labs: Cloud, Kubernetes, Terraform, observability & AI.",
      "Concrete engineering skills, proven on real pipelines.",
      "Become the engineer of the next generation — step by step."
    ]
  };
  var INTERVAL = 120000; // 2 minutes
  var idx = 0;

  function lang() {
    var l = document.documentElement.lang || localStorage.getItem("preferred-lang") || "de";
    return MSG[l] ? l : "de";
  }
  function nodes() { return document.querySelectorAll(".header-top-content p"); }

  function render() {
    var arr = MSG[lang()];
    var text = arr[idx % arr.length];
    nodes().forEach(function (p) {
      if (p.textContent === text) return;
      p.style.transition = "opacity .4s ease";
      p.style.opacity = "0";
      setTimeout(function () { p.textContent = text; p.style.opacity = "1"; }, 220);
    });
  }
  function advance() { idx++; render(); }

  document.addEventListener("DOMContentLoaded", function () {
    render();
    setInterval(advance, INTERVAL);
    // Re-render shortly after a language switch so the banner follows the chosen language
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-lang-btn],[data-lang],.lang-btn")) setTimeout(render, 60);
    });
  });
})();
