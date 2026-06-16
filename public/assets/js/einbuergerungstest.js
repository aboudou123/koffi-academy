(function () {
  "use strict";

  var STORAGE_KEY = "koffi-einbuergerungstest-progress-v1";
  var LANGUAGE_KEY = "preferred-lang";
  var EXAM_SIZE = 33;
  var EXAM_SECONDS = 60 * 60;
  var LETTERS = ["A", "B", "C", "D"];
  var questions = Array.isArray(window.EINBUERGERUNG_QUESTIONS) ? window.EINBUERGERUNG_QUESTIONS : [];
  var questionI18n = window.EINBUERGERUNG_QUESTION_I18N || {};

  var languageMeta = {
    de: { code: "DE", flag: "DE" },
    fr: { code: "FR", flag: "FR" },
    en: { code: "EN", flag: "EN" }
  };

  var categoryLabels = {
    de: {
      "Alltag und Gesellschaft": "Alltag und Gesellschaft",
      "Bildung, Arbeit und Familie": "Bildung, Arbeit und Familie",
      "Bundesstaat und Verwaltung": "Bundesstaat und Verwaltung",
      "Demokratie und Wahlen": "Demokratie und Wahlen",
      "Europa und Verantwortung": "Europa und Verantwortung",
      "Geschichte": "Geschichte",
      "Grundrechte": "Grundrechte",
      "Rechtsstaat": "Rechtsstaat",
      "Staat und Gesellschaft": "Staat und Gesellschaft"
    },
    fr: {
      "Alltag und Gesellschaft": "Vie quotidienne et société",
      "Bildung, Arbeit und Familie": "Éducation, travail et famille",
      "Bundesstaat und Verwaltung": "État fédéral et administration",
      "Demokratie und Wahlen": "Démocratie et élections",
      "Europa und Verantwortung": "Europe et responsabilité",
      "Geschichte": "Histoire",
      "Grundrechte": "Droits fondamentaux",
      "Rechtsstaat": "État de droit",
      "Staat und Gesellschaft": "État et société"
    },
    en: {
      "Alltag und Gesellschaft": "Everyday life and society",
      "Bildung, Arbeit und Familie": "Education, work and family",
      "Bundesstaat und Verwaltung": "Federal state and administration",
      "Demokratie und Wahlen": "Democracy and elections",
      "Europa und Verantwortung": "Europe and responsibility",
      "Geschichte": "History",
      "Grundrechte": "Fundamental rights",
      "Rechtsstaat": "Rule of law",
      "Staat und Gesellschaft": "State and society"
    }
  };

  var difficultyLabels = {
    de: { leicht: "leicht", normal: "normal", schwer: "schwer" },
    fr: { leicht: "facile", normal: "normal", schwer: "difficile" },
    en: { leicht: "easy", normal: "normal", schwer: "hard" }
  };

  var translations = {
    de: {
      "meta.title": "Koffi Academy | Einbürgerungstest Training",
      "nav.home": "Startseite",
      "nav.courses": "Kurse",
      "nav.catalog": "Kurskatalog",
      "nav.culture": "Culture",
      "nav.about": "Über mich",
      "nav.login": "Anmelden",
      "nav.register": "Registrieren",
      "lang.aria": "Sprache wählen",
      "hero.eyebrow": "Deutsch · Integration · Prüfungsvorbereitung",
      "hero.title": "Einbürgerungstest Training",
      "hero.lead": "Lerne die offiziellen Themen strukturiert, wiederhole deine Fehler gezielt und trainiere im Prüfungsmodus mit Timer. Dein Fortschritt bleibt lokal auf diesem Gerät gespeichert.",
      "hero.visualAria": "Einbürgerungstest Illustration",
      "hero.passportAlt": "Pädagogische Illustration für das Einbürgerungstest Training",
      "hero.visualTitle": "Training mit klarem Prüfungsfokus",
      "hero.visualText": "296 Fragen, Simulation und persönliche Wiederholung.",
      "button.startLearning": "Training starten",
      "button.examMode": "Prüfungsmodus",
      "button.continue": "Weiterlernen",
      "button.newSeries": "Neue Serie",
      "button.resetProgress": "Fortschritt zurücksetzen",
      "button.previous": "Vorherige Frage",
      "button.next": "Nächste Frage",
      "button.nextExam": "Nächste Prüfungsfrage",
      "button.restartExam": "Prüfung neu starten",
      "stat.questions": "Fragen",
      "stat.progress": "Fortschritt",
      "dashboard.eyebrow": "Dashboard",
      "dashboard.title": "Dein Lernstand",
      "dashboard.totalProgress": "Gesamtfortschritt",
      "dashboard.successRate": "Erfolgsquote",
      "dashboard.remaining": "Offene Fragen",
      "dashboard.review": "Fehler zur Wiederholung",
      "dashboard.streak": "Tagesserie",
      "dashboard.badge": "Aktueller Badge",
      "dashboard.avgExam": "Durchschnitt im Prüfungsmodus",
      "trainer.eyebrow": "Training",
      "trainer.title": "Lernen, üben, bestehen",
      "sidebar.mode": "Modus",
      "sidebar.actions": "Aktionen",
      "mode.learn": "Lernmodus",
      "mode.exam": "Prüfung",
      "mode.errors": "Meine Fehler",
      "mode.difficult": "Schwierige Fragen",
      "mode.favorites": "Favoriten",
      "mode.unseen": "Noch nicht gesehen",
      "filters.title": "Suche und Filter",
      "filters.keyword": "Suchbegriff",
      "filters.placeholder": "Bundestag, Grundgesetz, Wahl...",
      "filters.status": "Status",
      "filters.allQuestions": "Alle Fragen",
      "filters.success": "Richtig beantwortet",
      "filters.wrong": "Falsch beantwortet",
      "filters.favorites": "Favoriten",
      "filters.unseen": "Noch nicht gesehen",
      "filters.category": "Kategorie",
      "filters.allCategories": "Alle Kategorien",
      "result.count": "{count} Fragen verfügbar",
      "question.counter": "Frage {number} / {total}",
      "question.emptyCounter": "Keine Frage verfügbar",
      "question.emptyCategory": "Filter",
      "question.emptyDifficulty": "leer",
      "question.emptyText": "Keine passenden Fragen gefunden. Passe den Modus, die Suche oder die Filter an.",
      "question.loadingError": "Die Fragedaten konnten nicht geladen werden.",
      "favorite.add": "Frage als Favorit markieren",
      "favorite.remove": "Favorit entfernen",
      "answer.selected": "gewählt",
      "answer.wrong": "falsch",
      "answer.correct": "richtig",
      "feedback.correctTitle": "Richtig",
      "feedback.correctText": "Sehr gut. {explanation}",
      "feedback.tryAgain": "Noch einmal versuchen",
      "feedback.hint": "Hinweis",
      "feedback.finalHint": "Letzter Hinweis",
      "feedback.solution": "Auflösung",
      "feedback.answerRequired": "Antwort erforderlich",
      "feedback.chooseAnswer": "Bitte wähle zuerst eine Antwort aus.",
      "hint.level1": "Noch nicht richtig. Lies die Frage langsam und suche nach dem zentralen Begriff.",
      "hint.level3": "Letzter Hinweis: Drei Antworten wurden bereits ausgeschlossen. Beim nächsten Versuch wird die vollständige Auflösung angezeigt.",
      "hint.grundrechte": "Denke an die Grundrechte: Freiheit, Gleichheit, Würde und Schutz durch das Grundgesetz.",
      "hint.demokratie": "Achte darauf, wer wählen darf, wer gewählt wird und welche Rolle Parteien oder Parlamente haben.",
      "hint.rechtsstaat": "Im Rechtsstaat sind Staat, Bürgerinnen und Bürger an Gesetze und Gerichte gebunden.",
      "hint.geschichte": "Ordne die Frage zeitlich ein: Nationalsozialismus, Bundesrepublik, DDR, Wiedervereinigung oder Europa.",
      "hint.default": "Suche die Antwort, die am besten zu Demokratie, Alltag und Regeln in Deutschland passt.",
      "explanation.correct": "Die richtige Antwort ist: {answer}",
      "explanation.optionCorrect": "{letter}: richtig. Diese Antwort entspricht der geprüften Aussage.",
      "explanation.optionWrong": "{letter}: nicht richtig. Vergleiche diese Aussage mit der korrekten Antwort: {answer}",
      "vocab.title": "Wortschatz Deutsch / Französisch",
      "exam.answered": "{answered} / {total} beantwortet",
      "exam.resultEyebrow": "Prüfungsergebnis",
      "exam.scoreTitle": "Score: {correct} / {total}",
      "exam.scoreText": "Ergebnis: {score}%. Die detaillierte Auswertung ist jetzt verfügbar.",
      "exam.yourAnswer": "Deine Antwort: {answer}",
      "exam.correctAnswer": "Richtige Antwort: {answer}",
      "exam.noAnswer": "keine Antwort",
      "confirm.reset": "Fortschritt wirklich zurücksetzen?",
      "badge.none": "Noch kein Badge",
      "badge.firstCorrect": "Erste richtige Antwort",
      "badge.tenCorrect": "10 Fragen richtig beantwortet",
      "badge.fiftyDone": "50 Fragen bearbeitet",
      "badge.examDone": "Prüfungsmodus abgeschlossen",
      "badge.streakThree": "3 Tage Lernserie",
      "faq.title": "Häufige Fragen",
      "faq.q1": "Was ist der Einbürgerungstest?",
      "faq.a1": "Er prüft Wissen über Demokratie, Grundrechte, Geschichte und das Leben in Deutschland.",
      "faq.q2": "Wie funktioniert das Training?",
      "faq.a2": "Du beantwortest jeweils eine Frage. Nach mehreren Fehlversuchen erscheinen Hinweise und die Auflösung.",
      "faq.q3": "Wie funktioniert der Prüfungsmodus?",
      "faq.a3": "Du bekommst eine zufällige Fragenserie mit Timer. Die Auswertung erscheint am Ende.",
      "faq.q4": "Werden meine Fortschritte gespeichert?",
      "faq.a4": "Ja. Der Fortschritt wird lokal in deinem Browser gespeichert.",
      "faq.q5": "Kann ich nur meine Fehler wiederholen?",
      "faq.a5": "Ja. Nutze „Meine Fehler“ oder „Schwierige Fragen“, um gezielt zu wiederholen.",
      "footer.about": "Ein strukturierter Browser-Trainer für den Einbürgerungstest: lernen, wiederholen, prüfen und Fortschritt lokal speichern.",
      "footer.badgeQuestions": "296 Fragen",
      "footer.badgeOffline": "Offline-fähig",
      "footer.badgeLocal": "Ohne Backend",
      "footer.trainingLink": "Lernmodus",
      "footer.contact": "Kontakt",
      "footer.support": "Support kontaktieren",
      "footer.rights": "\u00a9 2026 Koffi Academy. Alle Rechte vorbehalten.",
      "footer.backTop": "Zurück nach oben"
    },
    fr: {
      "meta.title": "Koffi Academy | Entraînement au Einbürgerungstest",
      "nav.home": "Accueil",
      "nav.courses": "Cours",
      "nav.catalog": "Catalogue des cours",
      "nav.culture": "Culture",
      "nav.about": "À propos",
      "nav.login": "Connexion",
      "nav.register": "Inscription",
      "lang.aria": "Choisir la langue",
      "hero.eyebrow": "Allemand · Intégration · Préparation à l'examen",
      "hero.title": "Einbürgerungstest Training",
      "hero.lead": "Étudie les thèmes officiels avec méthode, révise précisément tes erreurs et entraîne-toi en mode examen avec minuterie. Ta progression reste enregistrée localement sur cet appareil.",
      "hero.visualAria": "Illustration de l'entraînement au Einbürgerungstest",
      "hero.passportAlt": "Illustration pédagogique pour l'entraînement au Einbürgerungstest",
      "hero.visualTitle": "Un entraînement centré sur l'examen",
      "hero.visualText": "296 questions, simulation et révision personnalisée.",
      "button.startLearning": "Commencer l'entraînement",
      "button.examMode": "Mode examen",
      "button.continue": "Reprendre l'entraînement",
      "button.newSeries": "Nouvelle série",
      "button.resetProgress": "Réinitialiser la progression",
      "button.previous": "Question précédente",
      "button.next": "Question suivante",
      "button.nextExam": "Question d'examen suivante",
      "button.restartExam": "Relancer un examen",
      "stat.questions": "Questions",
      "stat.progress": "Progression",
      "dashboard.eyebrow": "Tableau de bord",
      "dashboard.title": "Ton niveau d'apprentissage",
      "dashboard.totalProgress": "Progression totale",
      "dashboard.successRate": "Taux de réussite",
      "dashboard.remaining": "Questions restantes",
      "dashboard.review": "Erreurs à revoir",
      "dashboard.streak": "Série quotidienne",
      "dashboard.badge": "Badge actuel",
      "dashboard.avgExam": "Moyenne en mode examen",
      "trainer.eyebrow": "Entraînement",
      "trainer.title": "Apprendre, s'entraîner, réussir",
      "sidebar.mode": "Mode",
      "sidebar.actions": "Actions",
      "mode.learn": "Apprentissage",
      "mode.exam": "Examen",
      "mode.errors": "Mes erreurs",
      "mode.difficult": "Questions difficiles",
      "mode.favorites": "Favoris",
      "mode.unseen": "Non vues",
      "filters.title": "Recherche et filtres",
      "filters.keyword": "Mot-clé",
      "filters.placeholder": "Bundestag, Grundgesetz, Wahl...",
      "filters.status": "Statut",
      "filters.allQuestions": "Toutes les questions",
      "filters.success": "Réussies",
      "filters.wrong": "Ratées",
      "filters.favorites": "Favorites",
      "filters.unseen": "Non vues",
      "filters.category": "Catégorie",
      "filters.allCategories": "Toutes les catégories",
      "result.count": "{count} questions disponibles",
      "question.counter": "Question {number} / {total}",
      "question.emptyCounter": "Aucune question disponible",
      "question.emptyCategory": "Filtre",
      "question.emptyDifficulty": "vide",
      "question.emptyText": "Aucune question ne correspond. Modifie le mode, la recherche ou les filtres.",
      "question.loadingError": "Les données des questions n'ont pas pu être chargées.",
      "favorite.add": "Ajouter la question aux favoris",
      "favorite.remove": "Retirer des favoris",
      "answer.selected": "choisie",
      "answer.wrong": "faux",
      "answer.correct": "correct",
      "feedback.correctTitle": "Correct",
      "feedback.correctText": "Très bien. {explanation}",
      "feedback.tryAgain": "Essaie encore",
      "feedback.hint": "Indice",
      "feedback.finalHint": "Dernier indice",
      "feedback.solution": "Correction",
      "feedback.answerRequired": "Réponse requise",
      "feedback.chooseAnswer": "Choisis d'abord une réponse.",
      "hint.level1": "Ce n'est pas encore correct. Relis lentement la question et cherche le mot central.",
      "hint.level3": "Dernier indice : trois réponses ont déjà été écartées. Au prochain essai, la correction complète sera affichée.",
      "hint.grundrechte": "Pense aux droits fondamentaux : liberté, égalité, dignité et protection par la Loi fondamentale.",
      "hint.demokratie": "Observe qui peut voter, qui est élu et le rôle des partis ou des parlements.",
      "hint.rechtsstaat": "Dans un État de droit, l'État, les citoyennes et les citoyens sont liés par les lois et les tribunaux.",
      "hint.geschichte": "Situe la question dans le temps : national-socialisme, République fédérale, RDA, réunification ou Europe.",
      "hint.default": "Cherche la réponse qui correspond le mieux à la démocratie, à la vie quotidienne et aux règles en Allemagne.",
      "explanation.correct": "La bonne réponse est : {answer}",
      "explanation.optionCorrect": "{letter} : correct. Cette réponse correspond à l'énoncé attendu.",
      "explanation.optionWrong": "{letter} : incorrect. Compare cette proposition avec la bonne réponse : {answer}",
      "vocab.title": "Vocabulaire allemand / français",
      "exam.answered": "{answered} / {total} répondues",
      "exam.resultEyebrow": "Résultat de l'examen",
      "exam.scoreTitle": "Score : {correct} / {total}",
      "exam.scoreText": "Résultat : {score} %. La correction détaillée est maintenant disponible.",
      "exam.yourAnswer": "Ta réponse : {answer}",
      "exam.correctAnswer": "Bonne réponse : {answer}",
      "exam.noAnswer": "aucune réponse",
      "confirm.reset": "Réinitialiser vraiment toute la progression ?",
      "badge.none": "Aucun badge pour le moment",
      "badge.firstCorrect": "Première bonne réponse",
      "badge.tenCorrect": "10 questions réussies",
      "badge.fiftyDone": "50 questions terminées",
      "badge.examDone": "Mode examen terminé",
      "badge.streakThree": "Série de 3 jours",
      "faq.title": "Questions fréquentes",
      "faq.q1": "Qu'est-ce que le Einbürgerungstest ?",
      "faq.a1": "C'est un test de connaissances sur la démocratie, les droits fondamentaux, l'histoire et la vie en Allemagne.",
      "faq.q2": "Comment fonctionne l'entraînement ?",
      "faq.a2": "Tu réponds à une question à la fois. Après plusieurs erreurs, des indices puis la correction apparaissent.",
      "faq.q3": "Comment fonctionne le mode examen ?",
      "faq.a3": "Une série aléatoire de questions est lancée avec minuterie. Le résultat apparaît à la fin.",
      "faq.q4": "Mes progrès sont-ils sauvegardés ?",
      "faq.a4": "Oui. La progression est enregistrée localement dans ton navigateur.",
      "faq.q5": "Puis-je réviser uniquement mes erreurs ?",
      "faq.a5": "Oui. Utilise « Mes erreurs » ou « Questions difficiles » pour réviser de manière ciblée.",
      "footer.about": "Un entraînement structuré dans le navigateur pour le Einbürgerungstest : apprendre, réviser, simuler l'examen et enregistrer la progression localement.",
      "footer.badgeQuestions": "296 questions",
      "footer.badgeOffline": "Compatible hors ligne",
      "footer.badgeLocal": "Sans backend",
      "footer.trainingLink": "Apprentissage",
      "footer.contact": "Contact",
      "footer.support": "Contacter le support",
      "footer.rights": "\u00a9 2026 Koffi Academy. Tous droits réservés.",
      "footer.backTop": "Retour en haut"
    },
    en: {
      "meta.title": "Koffi Academy | Einbürgerungstest Training",
      "nav.home": "Home",
      "nav.courses": "Courses",
      "nav.catalog": "Course catalog",
      "nav.culture": "Culture",
      "nav.about": "About me",
      "nav.login": "Sign in",
      "nav.register": "Register",
      "lang.aria": "Choose language",
      "hero.eyebrow": "German · Integration · Exam preparation",
      "hero.title": "Einbürgerungstest Training",
      "hero.lead": "Study the official topics in a structured way, review your mistakes precisely, and practise in timed exam mode. Your progress is stored locally on this device.",
      "hero.visualAria": "Einbürgerungstest training illustration",
      "hero.passportAlt": "Educational illustration for Einbürgerungstest training",
      "hero.visualTitle": "Training focused on the exam",
      "hero.visualText": "296 questions, simulation and personalised review.",
      "button.startLearning": "Start training",
      "button.examMode": "Exam mode",
      "button.continue": "Resume training",
      "button.newSeries": "New set",
      "button.resetProgress": "Reset progress",
      "button.previous": "Previous question",
      "button.next": "Next question",
      "button.nextExam": "Next exam question",
      "button.restartExam": "Restart exam",
      "stat.questions": "Questions",
      "stat.progress": "Progress",
      "dashboard.eyebrow": "Dashboard",
      "dashboard.title": "Your learning status",
      "dashboard.totalProgress": "Overall progress",
      "dashboard.successRate": "Success rate",
      "dashboard.remaining": "Remaining questions",
      "dashboard.review": "Mistakes to review",
      "dashboard.streak": "Daily streak",
      "dashboard.badge": "Current badge",
      "dashboard.avgExam": "Average exam score",
      "trainer.eyebrow": "Training",
      "trainer.title": "Learn, practise, pass",
      "sidebar.mode": "Mode",
      "sidebar.actions": "Actions",
      "mode.learn": "Learning mode",
      "mode.exam": "Exam",
      "mode.errors": "My mistakes",
      "mode.difficult": "Difficult questions",
      "mode.favorites": "Favorites",
      "mode.unseen": "Not seen yet",
      "filters.title": "Search and filters",
      "filters.keyword": "Keyword",
      "filters.placeholder": "Bundestag, Grundgesetz, Wahl...",
      "filters.status": "Status",
      "filters.allQuestions": "All questions",
      "filters.success": "Answered correctly",
      "filters.wrong": "Answered incorrectly",
      "filters.favorites": "Favorites",
      "filters.unseen": "Not seen yet",
      "filters.category": "Category",
      "filters.allCategories": "All categories",
      "result.count": "{count} questions available",
      "question.counter": "Question {number} / {total}",
      "question.emptyCounter": "No question available",
      "question.emptyCategory": "Filter",
      "question.emptyDifficulty": "empty",
      "question.emptyText": "No matching questions found. Adjust the mode, search, or filters.",
      "question.loadingError": "The question data could not be loaded.",
      "favorite.add": "Add question to favorites",
      "favorite.remove": "Remove from favorites",
      "answer.selected": "selected",
      "answer.wrong": "wrong",
      "answer.correct": "correct",
      "feedback.correctTitle": "Correct",
      "feedback.correctText": "Well done. {explanation}",
      "feedback.tryAgain": "Try again",
      "feedback.hint": "Hint",
      "feedback.finalHint": "Final hint",
      "feedback.solution": "Solution",
      "feedback.answerRequired": "Answer required",
      "feedback.chooseAnswer": "Please choose an answer first.",
      "hint.level1": "Not correct yet. Read the question slowly and look for the key term.",
      "hint.level3": "Final hint: three answers have already been ruled out. The next attempt will show the full solution.",
      "hint.grundrechte": "Think of fundamental rights: freedom, equality, dignity, and protection by the Basic Law.",
      "hint.demokratie": "Pay attention to who may vote, who is elected, and the role of parties or parliaments.",
      "hint.rechtsstaat": "In a rule-of-law state, the state and citizens are bound by laws and courts.",
      "hint.geschichte": "Place the question in time: National Socialism, Federal Republic, GDR, reunification, or Europe.",
      "hint.default": "Look for the answer that best matches democracy, daily life, and rules in Germany.",
      "explanation.correct": "The correct answer is: {answer}",
      "explanation.optionCorrect": "{letter}: correct. This answer matches the expected statement.",
      "explanation.optionWrong": "{letter}: not correct. Compare this option with the correct answer: {answer}",
      "vocab.title": "German / French vocabulary",
      "exam.answered": "{answered} / {total} answered",
      "exam.resultEyebrow": "Exam result",
      "exam.scoreTitle": "Score: {correct} / {total}",
      "exam.scoreText": "Result: {score}%. The detailed review is now available.",
      "exam.yourAnswer": "Your answer: {answer}",
      "exam.correctAnswer": "Correct answer: {answer}",
      "exam.noAnswer": "no answer",
      "confirm.reset": "Do you really want to reset all progress?",
      "badge.none": "No badge yet",
      "badge.firstCorrect": "First correct answer",
      "badge.tenCorrect": "10 correct questions",
      "badge.fiftyDone": "50 questions completed",
      "badge.examDone": "Exam mode completed",
      "badge.streakThree": "3-day streak",
      "faq.title": "Frequently asked questions",
      "faq.q1": "What is the Einbürgerungstest?",
      "faq.a1": "It tests knowledge of democracy, fundamental rights, history, and life in Germany.",
      "faq.q2": "How does the training work?",
      "faq.a2": "You answer one question at a time. After several mistakes, hints and the solution are shown.",
      "faq.q3": "How does exam mode work?",
      "faq.a3": "A random set of questions starts with a timer. The result appears at the end.",
      "faq.q4": "Is my progress saved?",
      "faq.a4": "Yes. Progress is stored locally in your browser.",
      "faq.q5": "Can I review only my mistakes?",
      "faq.a5": "Yes. Use “My mistakes” or “Difficult questions” for focused review.",
      "footer.about": "A structured browser trainer for the Einbürgerungstest: learn, review, practise under exam conditions, and store progress locally.",
      "footer.badgeQuestions": "296 questions",
      "footer.badgeOffline": "Offline-ready",
      "footer.badgeLocal": "No backend",
      "footer.trainingLink": "Learning mode",
      "footer.contact": "Contact",
      "footer.support": "Contact support",
      "footer.rights": "\u00a9 2026 Koffi Academy. All rights reserved.",
      "footer.backTop": "Back to top"
    }
  };

  var ui = {};
  var progress = loadProgress();
  var currentLang = readPreferredLanguage();
  var session = {
    mode: "learn",
    queue: [],
    index: 0,
    wrongAttempts: 0,
    answered: false,
    revealed: false,
    selectedWrong: [],
    exam: null,
    timer: null
  };
  session.learningStates = {};

  var badges = [
    { key: "firstCorrect", labelKey: "badge.firstCorrect" },
    { key: "tenCorrect", labelKey: "badge.tenCorrect" },
    { key: "fiftyDone", labelKey: "badge.fiftyDone" },
    { key: "examDone", labelKey: "badge.examDone" },
    { key: "streakThree", labelKey: "badge.streakThree" }
  ];

  function emptyProgress() {
    return {
      seen: {},
      correct: {},
      wrong: {},
      mastered: {},
      favorites: {},
      xp: 0,
      badges: {},
      examScores: [],
      lastQuestionId: null,
      streak: { lastDay: "", count: 0 }
    };
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign(emptyProgress(), JSON.parse(raw)) : emptyProgress();
    } catch (error) {
      return emptyProgress();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {}
  }

  function readPreferredLanguage() {
    try {
      var saved = localStorage.getItem(LANGUAGE_KEY);
      return translations[saved] ? saved : "de";
    } catch (error) {
      return "de";
    }
  }

  function savePreferredLanguage(lang) {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch (error) {}
  }

  function t(key) {
    var table = translations[currentLang] || translations.de;
    return table[key] || translations.de[key] || key;
  }

  function format(key, values) {
    return t(key).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(values || {}, name) ? values[name] : match;
    });
  }

  function translateStaticDom() {
    document.documentElement.lang = currentLang;
    document.title = t("meta.title");

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (element) {
      element.setAttribute("alt", t(element.dataset.i18nAlt));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }

  function updateLanguageControl() {
    if (!ui.ebtLang || !ui.ebtLangBtn) {
      return;
    }
    var meta = languageMeta[currentLang] || languageMeta.de;
    ui.ebtLangBtn.dataset.lang = currentLang;
    ui.ebtLangBtn.setAttribute("aria-expanded", ui.ebtLang.classList.contains("is-open") ? "true" : "false");
    setText("ebtLangFlag", meta.flag);
    setText("ebtLangCode", meta.code);
    document.querySelectorAll(".ebt-lang__option").forEach(function (option) {
      var active = option.dataset.lang === currentLang;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function closeLanguageMenu() {
    if (!ui.ebtLang) {
      return;
    }
    ui.ebtLang.classList.remove("is-open");
    updateLanguageControl();
  }

  function applyLanguage(lang, skipDynamic) {
    if (!translations[lang]) {
      return;
    }
    currentLang = lang;
    savePreferredLanguage(lang);
    translateStaticDom();
    updateLanguageControl();

    if (skipDynamic || !ui.questionText) {
      return;
    }
    populateCategories();
    refreshBadges();
    updateDashboard();
    setText("resultCount", format("result.count", { count: session.queue.length }));
    if (session.exam && session.exam.finished) {
      var correct = session.exam.questions.reduce(function (sum, question, index) {
        return sum + (session.exam.answers[index] === question.correctIndex ? 1 : 0);
      }, 0);
      var score = Math.round((correct / session.exam.questions.length) * 100);
      renderExamResults(correct, score);
      return;
    }
    renderQuestion();
  }

  function localizedCategory(category) {
    var table = categoryLabels[currentLang] || categoryLabels.de;
    return table[category] || category;
  }

  function localizedDifficulty(difficulty) {
    var table = difficultyLabels[currentLang] || difficultyLabels.de;
    return table[difficulty] || difficulty;
  }

  function questionContent(question) {
    if (!question) {
      return { question: "", options: [] };
    }
    var translated = currentLang !== "de" && questionI18n[currentLang] ? questionI18n[currentLang][question.id] : null;
    if (translated && translated.question && Array.isArray(translated.options) && translated.options.length === question.options.length) {
      return {
        question: translated.question,
        options: translated.options
      };
    }
    return {
      question: question.question,
      options: question.options
    };
  }

  function questionSearchText(question) {
    var localized = questionContent(question);
    return [
      localized.question,
      question.question,
      localizedCategory(question.category),
      question.category,
      localizedDifficulty(question.difficulty),
      question.difficulty
    ].concat(localized.options, question.options).join(" ");
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var element = ui[id] || byId(id);
    if (element) {
      element.textContent = String(value);
    }
  }

  function countKeys(map) {
    return Object.keys(map || {}).filter(function (key) {
      return Boolean(map[key]);
    }).length;
  }

  function countNumberMap(map) {
    return Object.keys(map || {}).filter(function (key) {
      return Number(map[key]) > 0;
    }).length;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    var date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function updateDailyStreak() {
    var today = todayKey();
    if (progress.streak.lastDay === today) {
      return;
    }
    progress.streak.count = progress.streak.lastDay === yesterdayKey() ? progress.streak.count + 1 : 1;
    progress.streak.lastDay = today;
  }

  function totalCorrectAnswers() {
    return Object.keys(progress.correct).reduce(function (sum, key) {
      return sum + Number(progress.correct[key] || 0);
    }, 0);
  }

  function totalWrongAnswers() {
    return Object.keys(progress.wrong).reduce(function (sum, key) {
      return sum + Number(progress.wrong[key] || 0);
    }, 0);
  }

  function successRate() {
    var correct = totalCorrectAnswers();
    var wrong = totalWrongAnswers();
    return correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100);
  }

  function averageExamScore() {
    if (!progress.examScores.length) {
      return 0;
    }
    var total = progress.examScores.reduce(function (sum, score) {
      return sum + score;
    }, 0);
    return Math.round(total / progress.examScores.length);
  }

  function currentBadgeLabel() {
    for (var index = badges.length - 1; index >= 0; index -= 1) {
      if (progress.badges[badges[index].key]) {
        return t(badges[index].labelKey);
      }
    }
    return t("badge.none");
  }

  function refreshBadges() {
    if (totalCorrectAnswers() >= 1) {
      progress.badges.firstCorrect = true;
    }
    if (countNumberMap(progress.correct) >= 10) {
      progress.badges.tenCorrect = true;
    }
    if (countKeys(progress.seen) >= 50) {
      progress.badges.fiftyDone = true;
    }
    if (progress.examScores.length > 0) {
      progress.badges.examDone = true;
    }
    if (progress.streak.count >= 3) {
      progress.badges.streakThree = true;
    }
  }

  function updateDashboard() {
    var seen = countKeys(progress.seen);
    var review = countNumberMap(progress.wrong);
    var total = questions.length || 1;
    var percent = Math.round((seen / total) * 100);
    var rate = successRate();
    var badge = currentBadgeLabel();

    setText("heroQuestionTotal", questions.length);
    setText("heroProgress", percent + "%");
    setText("heroXp", progress.xp);
    setText("dashProgress", percent + "%");
    setText("scorePanelProgress", percent + "%");
    setText("dashSuccessRate", rate + "%");
    setText("dashSuccessRateHero", rate + "%");
    setText("dashRemaining", Math.max(questions.length - seen, 0));
    setText("dashReview", review);
    setText("scorePanelReview", review);
    setText("dashReviewHero", review);
    setText("dashXp", progress.xp);
    setText("dashStreak", progress.streak.count);
    setText("dashBadge", badge);
    setText("dashBadgeHero", badge);
    setText("dashAverageExam", averageExamScore() + "%");
  }

  function questionScore(question) {
    var id = question.id;
    var wrong = Number(progress.wrong[id] || 0);
    var unseen = progress.seen[id] ? 0 : 1;
    var hard = question.difficulty === "schwer" ? 1 : 0;
    return wrong * 6 + unseen * 3 + hard;
  }

  function filteredQuestions() {
    var search = (ui.searchInput.value || "").trim().toLowerCase();
    var status = ui.statusFilter.value;
    var category = ui.categoryFilter.value;

    var list = questions.filter(function (question) {
      var id = question.id;
      if (session.mode === "errors" && !progress.wrong[id]) {
        return false;
      }
      if (session.mode === "difficult" && question.difficulty !== "schwer" && Number(progress.wrong[id] || 0) < 2) {
        return false;
      }
      if (session.mode === "favorites" && !progress.favorites[id]) {
        return false;
      }
      if (session.mode === "unseen" && progress.seen[id]) {
        return false;
      }
      if (status === "success" && !progress.correct[id]) {
        return false;
      }
      if (status === "wrong" && !progress.wrong[id]) {
        return false;
      }
      if (status === "favorites" && !progress.favorites[id]) {
        return false;
      }
      if (status === "unseen" && progress.seen[id]) {
        return false;
      }
      if (category !== "all" && question.category !== category) {
        return false;
      }
      if (!search) {
        return true;
      }
      return questionSearchText(question).toLowerCase().includes(search);
    });

    return list.sort(function (a, b) {
      return questionScore(b) - questionScore(a);
    });
  }

  function rebuildQueue(preferredId) {
    if (session.mode === "exam") {
      return;
    }
    session.queue = filteredQuestions();
    var preferredIndex = preferredId ? session.queue.findIndex(function (question) {
      return question.id === preferredId;
    }) : -1;
    session.index = preferredIndex >= 0 ? preferredIndex : 0;
    session.wrongAttempts = 0;
    session.answered = false;
    session.revealed = false;
    session.selectedWrong = [];
    setText("resultCount", format("result.count", { count: session.queue.length }));
    renderQuestion();
  }

  function currentQuestion() {
    if (!session.queue.length) {
      return null;
    }
    return session.queue[session.index % session.queue.length];
  }

  function resetLearningState() {
    session.wrongAttempts = 0;
    session.answered = false;
    session.revealed = false;
    session.selectedWrong = [];
  }

  function saveCurrentLearningState() {
    if (session.mode === "exam") {
      return;
    }
    var question = currentQuestion();
    if (!question) {
      return;
    }
    session.learningStates[question.id] = {
      wrongAttempts: session.wrongAttempts,
      answered: session.answered,
      revealed: session.revealed,
      selectedWrong: session.selectedWrong.slice()
    };
  }

  function restoreLearningState(question) {
    if (session.mode === "exam" || !question) {
      return;
    }
    var saved = session.learningStates[question.id];
    if (!saved) {
      resetLearningState();
      return;
    }
    session.wrongAttempts = saved.wrongAttempts || 0;
    session.answered = Boolean(saved.answered);
    session.revealed = Boolean(saved.revealed);
    session.selectedWrong = Array.isArray(saved.selectedWrong) ? saved.selectedWrong.slice() : [];
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function renderQuestion() {
    var question = currentQuestion();
    clearFeedback();
    clearNode(ui.optionsList);
    ui.examResults.hidden = true;

    if (!question) {
      setText("questionCounter", t("question.emptyCounter"));
      ui.progressBar.style.width = "0%";
      setText("questionCategory", t("question.emptyCategory"));
      setText("questionDifficulty", t("question.emptyDifficulty"));
      setText("questionText", t("question.emptyText"));
      ui.nextBtn.disabled = true;
      ui.prevBtn.disabled = true;
      ui.favoriteBtn.disabled = true;
      return;
    }

    var total = session.mode === "exam" ? session.exam.questions.length : session.queue.length;
    var number = session.mode === "exam" ? session.exam.index + 1 : session.index + 1;
    var localized = questionContent(question);
    restoreLearningState(question);
    ui.progressBar.style.width = Math.round((number / total) * 100) + "%";
    setText("questionCounter", format("question.counter", { number: number, total: total }));
    setText("questionCategory", localizedCategory(question.category));
    setText("questionDifficulty", localizedDifficulty(question.difficulty));
    setText("questionText", localized.question);
    ui.favoriteBtn.disabled = false;
    ui.favoriteBtn.classList.toggle("is-active", Boolean(progress.favorites[question.id]));
    ui.favoriteBtn.setAttribute("aria-label", progress.favorites[question.id] ? t("favorite.remove") : t("favorite.add"));

    localized.options.forEach(function (option, index) {
      ui.optionsList.appendChild(createAnswerButton(question, option, index));
    });

    renderStoredLearningFeedback(question);
    updateNavigationButtons();
    ui.nextBtn.querySelector("span").textContent = session.mode === "exam" ? t("button.nextExam") : t("button.next");
    updateExamBar();
  }

  function renderStoredLearningFeedback(question) {
    if (session.mode === "exam") {
      return;
    }
    if (session.answered) {
      setFeedback("is-good", t("feedback.correctTitle"), [format("feedback.correctText", { explanation: localizedExplanation(question) })]);
      return;
    }
    if (session.revealed) {
      setRevealFeedback(question);
      return;
    }
    if (session.wrongAttempts === 1) {
      setFeedback("is-warn", t("feedback.tryAgain"), [hintFor(question, 1)]);
    } else if (session.wrongAttempts === 2) {
      setFeedback("is-warn", t("feedback.hint"), [hintFor(question, 2)]);
    } else if (session.wrongAttempts === 3) {
      setFeedback("is-warn", t("feedback.finalHint"), [hintFor(question, 3)]);
    }
  }

  function updateNavigationButtons() {
    if (session.mode === "exam") {
      ui.prevBtn.disabled = !session.exam || session.exam.index <= 0 || session.exam.finished;
      ui.nextBtn.disabled = !session.exam || session.exam.answers[session.exam.index] === undefined || session.exam.finished;
      return;
    }

    ui.prevBtn.disabled = session.index <= 0 || !session.queue.length;
    ui.nextBtn.disabled = !session.answered && !session.revealed;
  }

  function createAnswerButton(question, option, index) {
    var button = makeElement("button", "ebt-answer", "");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.dataset.index = String(index);

    var key = makeElement("span", "ebt-answer__key", LETTERS[index]);
    var text = makeElement("span", "ebt-answer__text", option);
    var state = makeElement("span", "ebt-answer__state", "");
    button.appendChild(key);
    button.appendChild(text);
    button.appendChild(state);

    if (session.mode === "exam" && session.exam.answers[session.exam.index] === index) {
      button.classList.add("is-selected");
      button.setAttribute("aria-checked", "true");
      state.textContent = t("answer.selected");
    }

    if (session.mode !== "exam") {
      if (session.selectedWrong.indexOf(index) >= 0) {
        button.classList.add("is-wrong");
        button.disabled = true;
        state.textContent = t("answer.wrong");
      }
      if (session.revealed || session.answered) {
        button.disabled = true;
        if (index === question.correctIndex) {
          button.classList.add("is-correct");
          state.textContent = t("answer.correct");
        }
      }
    }

    button.addEventListener("click", function () {
      if (session.mode === "exam") {
        selectExamAnswer(index);
      } else {
        selectLearningAnswer(index);
      }
    });

    return button;
  }

  function clearFeedback() {
    ui.feedbackBox.className = "ebt-feedback";
    clearNode(ui.feedbackBox);
  }

  function setFeedback(type, title, lines) {
    clearFeedback();
    ui.feedbackBox.classList.add(type);
    ui.feedbackBox.appendChild(makeElement("h4", "", title));
    lines.forEach(function (line) {
      ui.feedbackBox.appendChild(makeElement("p", "", line));
    });
  }

  function localizedExplanation(question) {
    var localized = questionContent(question);
    return format("explanation.correct", {
      answer: localized.options[question.correctIndex]
    });
  }

  function localizedOptionExplanation(question, index) {
    var localized = questionContent(question);
    var correctAnswer = localized.options[question.correctIndex];
    if (index === question.correctIndex) {
      return format("explanation.optionCorrect", { letter: LETTERS[index] });
    }
    return format("explanation.optionWrong", {
      letter: LETTERS[index],
      answer: correctAnswer
    });
  }

  function setRevealFeedback(question) {
    clearFeedback();
    ui.feedbackBox.classList.add("is-warn");
    ui.feedbackBox.appendChild(makeElement("h4", "", t("feedback.solution")));
    ui.feedbackBox.appendChild(makeElement("p", "", localizedExplanation(question)));

    var list = makeElement("ul", "", "");
    questionContent(question).options.forEach(function (option, index) {
      var item = makeElement("li", "", localizedOptionExplanation(question, index));
      list.appendChild(item);
    });
    ui.feedbackBox.appendChild(list);

    if (Array.isArray(question.vocabulary) && question.vocabulary.length) {
      ui.feedbackBox.appendChild(makeElement("h4", "", t("vocab.title")));
      question.vocabulary.forEach(function (entry) {
        ui.feedbackBox.appendChild(makeElement("p", "", entry.de + " = " + entry.fr));
      });
    }
  }

  function hintFor(question, level) {
    if (level === 1) {
      return t("hint.level1");
    }
    if (level === 3) {
      return t("hint.level3");
    }
    if (question.category === "Grundrechte") {
      return t("hint.grundrechte");
    }
    if (question.category === "Demokratie und Wahlen") {
      return t("hint.demokratie");
    }
    if (question.category === "Rechtsstaat") {
      return t("hint.rechtsstaat");
    }
    if (question.category === "Geschichte") {
      return t("hint.geschichte");
    }
    return t("hint.default");
  }

  function markProgress(question, correct) {
    var id = question.id;
    progress.seen[id] = true;
    progress.lastQuestionId = id;
    updateDailyStreak();

    if (correct) {
      progress.correct[id] = Number(progress.correct[id] || 0) + 1;
      progress.xp += 10;
      if (Number(progress.correct[id] || 0) >= 2) {
        progress.mastered[id] = true;
      }
    } else {
      progress.wrong[id] = Number(progress.wrong[id] || 0) + 1;
      progress.xp += 2;
      delete progress.mastered[id];
    }

    refreshBadges();
    saveProgress();
    updateDashboard();
  }

  function selectLearningAnswer(index) {
    var question = currentQuestion();
    if (!question || session.answered || session.revealed) {
      return;
    }

    if (session.wrongAttempts >= 3) {
      session.revealed = true;
      markProgress(question, false);
      setRevealFeedback(question);
      ui.nextBtn.disabled = false;
      saveCurrentLearningState();
      renderAnswerStates();
      return;
    }

    if (index === question.correctIndex) {
      session.answered = true;
      markProgress(question, true);
      setFeedback("is-good", t("feedback.correctTitle"), [format("feedback.correctText", { explanation: localizedExplanation(question) })]);
      ui.questionCard.classList.remove("ebt-answer-pop");
      void ui.questionCard.offsetWidth;
      ui.questionCard.classList.add("ebt-answer-pop");
      ui.nextBtn.disabled = false;
      saveCurrentLearningState();
      renderAnswerStates();
      return;
    }

    if (session.selectedWrong.indexOf(index) < 0) {
      session.selectedWrong.push(index);
    }
    session.wrongAttempts += 1;
    markProgress(question, false);

    if (session.wrongAttempts === 1) {
      setFeedback("is-warn", t("feedback.tryAgain"), [hintFor(question, 1)]);
    } else if (session.wrongAttempts === 2) {
      setFeedback("is-warn", t("feedback.hint"), [hintFor(question, 2)]);
    } else if (session.wrongAttempts === 3) {
      setFeedback("is-warn", t("feedback.finalHint"), [hintFor(question, 3)]);
    }

    saveCurrentLearningState();
    renderAnswerStates();
  }

  function renderAnswerStates() {
    var question = currentQuestion();
    clearNode(ui.optionsList);
    if (!question) {
      return;
    }
    questionContent(question).options.forEach(function (option, index) {
      ui.optionsList.appendChild(createAnswerButton(question, option, index));
    });
  }

  function nextQuestion() {
    if (session.mode === "exam") {
      nextExamQuestion();
      return;
    }
    if (!session.answered && !session.revealed) {
      setFeedback("is-warn", t("feedback.answerRequired"), [t("feedback.chooseAnswer")]);
      return;
    }
    saveCurrentLearningState();
    session.index = session.queue.length ? (session.index + 1) % session.queue.length : 0;
    renderQuestion();
  }

  function previousQuestion() {
    if (session.mode === "exam") {
      previousExamQuestion();
      return;
    }
    if (!session.queue.length || session.index <= 0) {
      return;
    }
    saveCurrentLearningState();
    session.index -= 1;
    renderQuestion();
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var index = copy.length - 1; index > 0; index -= 1) {
      var target = Math.floor(Math.random() * (index + 1));
      var temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
    }
    return copy;
  }

  function startExam() {
    stopExamTimer();
    session.mode = "exam";
    session.exam = {
      questions: shuffle(questions).slice(0, Math.min(EXAM_SIZE, questions.length)),
      index: 0,
      answers: [],
      remaining: EXAM_SECONDS,
      finished: false
    };
    setActiveMode("exam");
    ui.examBar.hidden = false;
    ui.examResults.hidden = true;
    session.queue = session.exam.questions;
    session.index = 0;
    startExamTimer();
    renderQuestion();
  }

  function stopExamTimer() {
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
  }

  function startExamTimer() {
    updateExamBar();
    session.timer = setInterval(function () {
      if (!session.exam || session.exam.finished) {
        stopExamTimer();
        return;
      }
      session.exam.remaining -= 1;
      updateExamBar();
      if (session.exam.remaining <= 0) {
        finishExam();
      }
    }, 1000);
  }

  function updateExamBar() {
    if (!session.exam || session.mode !== "exam") {
      ui.examBar.hidden = true;
      return;
    }
    var minutes = Math.floor(session.exam.remaining / 60);
    var seconds = session.exam.remaining % 60;
    setText("examTimer", String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0"));
    var answered = session.exam.answers.filter(function (answer) {
      return answer !== undefined && answer !== null;
    }).length;
    setText("examAnswered", format("exam.answered", { answered: answered, total: session.exam.questions.length }));
  }

  function selectExamAnswer(index) {
    if (!session.exam || session.exam.finished) {
      return;
    }
    session.exam.answers[session.exam.index] = index;
    ui.nextBtn.disabled = false;
    renderAnswerStates();
    updateExamBar();
  }

  function nextExamQuestion() {
    if (!session.exam) {
      return;
    }
    if (session.exam.answers[session.exam.index] === undefined) {
      setFeedback("is-warn", t("feedback.answerRequired"), [t("feedback.chooseAnswer")]);
      return;
    }
    if (session.exam.index >= session.exam.questions.length - 1) {
      finishExam();
      return;
    }
    session.exam.index += 1;
    session.index = session.exam.index;
    renderQuestion();
  }

  function previousExamQuestion() {
    if (!session.exam || session.exam.finished || session.exam.index <= 0) {
      return;
    }
    session.exam.index -= 1;
    session.index = session.exam.index;
    renderQuestion();
  }

  function finishExam() {
    if (!session.exam || session.exam.finished) {
      return;
    }
    stopExamTimer();
    session.exam.finished = true;
    var correct = 0;
    session.exam.questions.forEach(function (question, index) {
      var isCorrect = session.exam.answers[index] === question.correctIndex;
      if (isCorrect) {
        correct += 1;
      }
      markProgress(question, isCorrect);
    });
    var score = Math.round((correct / session.exam.questions.length) * 100);
    progress.examScores.push(score);
    progress.xp += 25;
    refreshBadges();
    saveProgress();
    updateDashboard();
    renderExamResults(correct, score);
  }

  function renderExamResults(correct, score) {
    ui.examResults.hidden = false;
    setText("examScoreTitle", format("exam.scoreTitle", { correct: correct, total: session.exam.questions.length }));
    setText("examScoreText", format("exam.scoreText", { score: score }));
    clearNode(ui.examResultList);

    session.exam.questions.forEach(function (question, index) {
      var chosen = session.exam.answers[index];
      var isCorrect = chosen === question.correctIndex;
      var localized = questionContent(question);
      var item = makeElement("article", "ebt-result-item " + (isCorrect ? "is-good" : "is-bad"), "");
      item.appendChild(makeElement("strong", "", (index + 1) + ". " + localized.question));
      item.appendChild(makeElement("span", "", format("exam.yourAnswer", { answer: chosen === undefined ? t("exam.noAnswer") : localized.options[chosen] })));
      item.appendChild(makeElement("span", "", format("exam.correctAnswer", { answer: localized.options[question.correctIndex] })));
      item.appendChild(makeElement("span", "", localizedExplanation(question)));
      ui.examResultList.appendChild(item);
    });

    ui.nextBtn.disabled = true;
    ui.prevBtn.disabled = true;
  }

  function setActiveMode(mode) {
    document.querySelectorAll(".ebt-mode").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.mode === mode);
    });
  }

  function setMode(mode) {
    stopExamTimer();
    session.mode = mode;
    session.exam = null;
    session.learningStates = {};
    ui.examBar.hidden = true;
    ui.examResults.hidden = true;
    setActiveMode(mode);
    if (mode === "exam") {
      startExam();
      return;
    }
    rebuildQueue();
  }

  function toggleFavorite() {
    var question = currentQuestion();
    if (!question) {
      return;
    }
    if (progress.favorites[question.id]) {
      delete progress.favorites[question.id];
    } else {
      progress.favorites[question.id] = true;
      progress.xp += 1;
    }
    saveProgress();
    updateDashboard();
    renderQuestion();
  }

  function continueLast() {
    setMode("learn");
    rebuildQueue(progress.lastQuestionId);
    document.getElementById("trainerTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetSession() {
    if (session.mode === "exam") {
      startExam();
      return;
    }
    session.learningStates = {};
    rebuildQueue();
  }

  function resetProgress() {
    var confirmed = window.confirm(t("confirm.reset"));
    if (!confirmed) {
      return;
    }
    progress = emptyProgress();
    session.learningStates = {};
    saveProgress();
    updateDashboard();
    populateCategories();
    rebuildQueue();
  }

  function populateCategories() {
    var current = ui.categoryFilter.value || "all";
    clearNode(ui.categoryFilter);
    ui.categoryFilter.appendChild(new Option(t("filters.allCategories"), "all"));
    Array.from(new Set(questions.map(function (question) {
      return question.category;
    }))).sort().forEach(function (category) {
      ui.categoryFilter.appendChild(new Option(localizedCategory(category), category));
    });
    ui.categoryFilter.value = Array.from(ui.categoryFilter.options).some(function (option) {
      return option.value === current;
    }) ? current : "all";
  }

  function bindEvents() {
    document.querySelectorAll(".ebt-mode").forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.dataset.mode);
      });
    });
    ui.prevBtn.addEventListener("click", previousQuestion);
    ui.nextBtn.addEventListener("click", nextQuestion);
    ui.favoriteBtn.addEventListener("click", toggleFavorite);
    ui.searchInput.addEventListener("input", function () { rebuildQueue(); });
    ui.statusFilter.addEventListener("change", function () { rebuildQueue(); });
    ui.categoryFilter.addEventListener("change", function () { rebuildQueue(); });
    ui.resetSessionBtn.addEventListener("click", resetSession);
    ui.resetProgressBtn.addEventListener("click", resetProgress);
    ui.continueBtn.addEventListener("click", continueLast);
    ui.startLearningHero.addEventListener("click", function () {
      setMode("learn");
      document.getElementById("trainerTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    ui.startExamHero.addEventListener("click", function () {
      startExam();
      document.getElementById("trainerTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    ui.restartExamBtn.addEventListener("click", startExam);
    if (ui.ebtLangBtn && ui.ebtLang) {
      ui.ebtLangBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        ui.ebtLang.classList.toggle("is-open");
        updateLanguageControl();
      });
      document.querySelectorAll(".ebt-lang__option").forEach(function (option) {
        option.addEventListener("click", function (event) {
          event.stopPropagation();
          applyLanguage(option.dataset.lang);
          closeLanguageMenu();
        });
      });
      document.addEventListener("click", function (event) {
        if (!ui.ebtLang.contains(event.target)) {
          closeLanguageMenu();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        closeLanguageMenu();
      }
      if (/^[1-4]$/.test(event.key)) {
        var index = Number(event.key) - 1;
        if (session.mode === "exam") {
          selectExamAnswer(index);
        } else {
          selectLearningAnswer(index);
        }
      }
      if (event.key === "Enter" && !ui.nextBtn.disabled) {
        nextQuestion();
      }
      if (event.key === "ArrowLeft" && !ui.prevBtn.disabled) {
        previousQuestion();
      }
      if (event.key === "ArrowRight" && !ui.nextBtn.disabled) {
        nextQuestion();
      }
    });
  }

  function collectUi() {
    [
      "heroQuestionTotal",
      "heroProgress",
      "heroXp",
      "ebtLang",
      "ebtLangBtn",
      "ebtLangFlag",
      "ebtLangCode",
      "dashSuccessRateHero",
      "dashReviewHero",
      "dashBadgeHero",
      "scorePanelProgress",
      "scorePanelReview",
      "dashProgress",
      "dashSuccessRate",
      "dashRemaining",
      "dashReview",
      "dashXp",
      "dashStreak",
      "dashBadge",
      "dashAverageExam",
      "continueBtn",
      "searchInput",
      "statusFilter",
      "categoryFilter",
      "resultCount",
      "resetSessionBtn",
      "resetProgressBtn",
      "examBar",
      "examTimer",
      "examAnswered",
      "questionCounter",
      "progressBar",
      "questionCategory",
      "questionDifficulty",
      "questionText",
      "optionsList",
      "feedbackBox",
      "prevBtn",
      "nextBtn",
      "favoriteBtn",
      "questionCard",
      "examResults",
      "examScoreTitle",
      "examScoreText",
      "examResultList",
      "restartExamBtn",
      "startLearningHero",
      "startExamHero"
    ].forEach(function (id) {
      ui[id] = byId(id);
    });
  }

  function init() {
    collectUi();
    applyLanguage(currentLang, true);
    if (!questions.length) {
      setText("questionText", t("question.loadingError"));
      return;
    }
    populateCategories();
    refreshBadges();
    updateDashboard();
    bindEvents();
    rebuildQueue(progress.lastQuestionId);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
