const fs = require("fs");
const vm = require("vm");

const sourcePath = "public/assets/js/einbuergerungstest-data.js";
const outputPath = "public/assets/js/einbuergerungstest-question-i18n.js";
const SOURCE_LANGUAGE = "de";
const TARGET_LANGUAGES = ["fr", "en"];

function loadQuestions() {
  const code = fs.readFileSync(sourcePath, "utf8") + ";globalThis.questions=EINBUERGERUNG_QUESTIONS;";
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.globalThis.questions;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function protectTerms(text) {
  return text
    .replace(/\bBundestag\b/g, "xkoffiterm001x")
    .replace(/\bBundesrat\b/g, "xkoffiterm002x")
    .replace(/\bBundespräsident\b/g, "xkoffiterm003x")
    .replace(/\bBundespräsidentin\b/g, "xkoffiterm004x")
    .replace(/\bBundeskanzler\b/g, "xkoffiterm005x")
    .replace(/\bBundeskanzlerin\b/g, "xkoffiterm006x")
    .replace(/\bBundesverfassungsgericht\b/g, "xkoffiterm007x")
    .replace(/\bGrundgesetz\b/g, "xkoffiterm008x")
    .replace(/\bDDR\b/g, "xkoffiterm009x")
    .replace(/\bBRD\b/g, "xkoffiterm010x")
    .replace(/\bCDU\b/g, "xkoffiterm011x")
    .replace(/\bCSU\b/g, "xkoffiterm012x")
    .replace(/\bSPD\b/g, "xkoffiterm013x")
    .replace(/\bFDP\b/g, "xkoffiterm014x")
    .replace(/\bBündnis 90\/Die Grünen\b/g, "xkoffiterm015x")
    .replace(/\bAfD\b/g, "xkoffiterm016x");
}

function restoreTerms(text, lang) {
  const grundgesetz = lang === "fr" ? "Loi fondamentale" : "Basic Law";
  return polishTranslation(normalizeText(text)
    .replace(/xkoffiterm001x/g, "Bundestag")
    .replace(/xkoffiterm002x/g, "Bundesrat")
    .replace(/xkoffiterm003x/g, lang === "fr" ? "président fédéral" : "Federal President")
    .replace(/xkoffiterm004x/g, lang === "fr" ? "présidente fédérale" : "Federal President")
    .replace(/xkoffiterm005x/g, lang === "fr" ? "chancelier fédéral" : "Federal Chancellor")
    .replace(/xkoffiterm006x/g, lang === "fr" ? "chancelière fédérale" : "Federal Chancellor")
    .replace(/xkoffiterm007x/g, lang === "fr" ? "Cour constitutionnelle fédérale" : "Federal Constitutional Court")
    .replace(/xkoffiterm008x/g, grundgesetz)
    .replace(/xkoffiterm009x/g, lang === "fr" ? "RDA" : "GDR")
    .replace(/xkoffiterm010x/g, lang === "fr" ? "RFA" : "FRG")
    .replace(/xkoffiterm011x/g, "CDU")
    .replace(/xkoffiterm012x/g, "CSU")
    .replace(/xkoffiterm013x/g, "SPD")
    .replace(/xkoffiterm014x/g, "FDP")
    .replace(/xkoffiterm015x/g, lang === "fr" ? "Alliance 90/Les Verts" : "Alliance 90/The Greens")
    .replace(/xkoffiterm016x/g, "AfD"), lang);
}

function polishTranslation(text, lang) {
  if (lang === "fr") {
    return text
      .replace(/\ble Loi fondamentale\b/g, "la Loi fondamentale")
      .replace(/\bdu Loi fondamentale\b/g, "de la Loi fondamentale")
      .replace(/\bau Loi fondamentale\b/g, "à la Loi fondamentale")
      .replace(/\bLoi fondamentale allemand\b/g, "Loi fondamentale allemande")
      .replace(/\bla Loi fondamentale allemand\b/g, "la Loi fondamentale allemande")
      .replace(/\bLoi fondamentale d'Allemagne\b/g, "Loi fondamentale allemande")
      .replace(/\bdroit allemand\b/g, "loi allemande")
      .replace(/\bappartement\b/g, "logement")
      .replace(/\bVigilantisme\b/g, "Justice privée")
      .replace(/\bLoi du poing\b/g, "Droit du plus fort")
      .replace(/\ballemand Bundestag\b/g, "au Bundestag allemand")
      .replace(/\bAllemand Bundestag\b/g, "au Bundestag allemand")
      .replace(/\bde Bundestag\b/g, "du Bundestag")
      .replace(/\bà Bundestag\b/g, "au Bundestag")
      .replace(/\bdans Bundestag\b/g, "au Bundestag")
      .replace(/\bconstitution de la République fédérale allemande\b/g, "constitution de la République fédérale d'Allemagne")
      .replace(/\bSeules les personnes n’ayant jamais été en prison sont autorisées à voter\./g, "Seules les personnes qui n'ont jamais été en prison peuvent voter.");
  }
  if (lang === "en") {
    return text
      .replace(/\bGerman Basic Law\b/g, "Basic Law")
      .replace(/\bBasic Law of Germany\b/g, "Basic Law")
      .replace(/\bin German Bundestag\b/g, "in the German Bundestag")
      .replace(/\bof Bundestag\b/g, "of the Bundestag")
      .replace(/\bto Bundestag\b/g, "to the Bundestag")
      .replace(/\bat Bundestag\b/g, "in the Bundestag")
      .replace(/\bFist law\b/g, "rule of force")
      .replace(/\bapartment\b/g, "housing");
  }
  return text;
}

async function translateBatch(texts, lang) {
  const separator = "\n<<<KOFFI_SPLIT>>>\n";
  const protectedText = texts.map(protectTerms).join(separator);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", SOURCE_LANGUAGE);
  url.searchParams.set("tl", lang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedText);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation request failed for ${lang}: ${response.status}`);
  }
  const json = await response.json();
  const translated = (json[0] || []).map((part) => part[0]).join("");
  const parts = translated.split(/<<<\s*KOFFI_SPLIT\s*>>>/i).map((part) => restoreTerms(part, lang));
  if (parts.length !== texts.length) {
    throw new Error(`Unexpected translation split count for ${lang}: got ${parts.length}, expected ${texts.length}`);
  }
  return parts;
}

async function translateAll() {
  const questions = loadQuestions();
  const result = {};
  const chunkSize = 18;

  for (const lang of TARGET_LANGUAGES) {
    result[lang] = {};
    for (let offset = 0; offset < questions.length; offset += chunkSize) {
      const chunk = questions.slice(offset, offset + chunkSize);
      const flat = [];
      chunk.forEach((question) => {
        flat.push(question.question);
        question.options.forEach((option) => flat.push(option));
      });

      const translated = await translateBatch(flat, lang);
      let cursor = 0;
      chunk.forEach((question) => {
        result[lang][question.id] = {
          question: translated[cursor++],
          options: [
            translated[cursor++],
            translated[cursor++],
            translated[cursor++],
            translated[cursor++]
          ]
        };
      });
      console.log(`${lang}: ${Math.min(offset + chunk.length, questions.length)} / ${questions.length}`);
    }
  }

  const output = [
    "(function () {",
    "  \"use strict\";",
    `  window.EINBUERGERUNG_QUESTION_I18N = ${JSON.stringify(result, null, 2)};`,
    "})();",
    ""
  ].join("\n");
  fs.writeFileSync(outputPath, output, "utf8");
}

translateAll().catch((error) => {
  console.error(error);
  process.exit(1);
});
