/*
 * Auto-détection de la langue à la première visite.
 * - Respecte un choix déjà enregistré (localStorage 'preferred-lang') : on n'écrase jamais.
 * - Sinon, déduit la langue depuis le navigateur/OS du visiteur :
 *     pays/locale francophone  -> 'fr'
 *     germanophone             -> 'de'
 *     anglophone               -> 'en'
 *     autre                    -> on laisse la page utiliser sa langue par défaut.
 * Doit être chargé dans le <head> (synchronement) AVANT le script i18n de la page,
 * afin que l'initialisation i18n lise déjà la bonne valeur dans localStorage.
 */
(function () {
  try {
    if (localStorage.getItem("preferred-lang")) return; // choix existant : ne rien forcer

    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ""];

    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || "").toLowerCase();
      if (code.indexOf("fr") === 0) { localStorage.setItem("preferred-lang", "fr"); return; }
      if (code.indexOf("de") === 0) { localStorage.setItem("preferred-lang", "de"); return; }
      if (code.indexOf("en") === 0) { localStorage.setItem("preferred-lang", "en"); return; }
    }
    // Aucune des trois langues détectée : on laisse le défaut de la page.
  } catch (e) { /* localStorage indisponible : on ignore silencieusement */ }
})();
