/*
 * idp-deploy-prod.js
 * Rend la carte "In Produktion deployen" reellement fonctionnelle : declenche un
 * vrai pipeline GitHub Actions qui cree un cluster kind, deploie, fait un health
 * check et un rollback automatique. 100% gratuit (pas de cluster cloud), additif.
 * Reutilise le token GitHub memorise par le Golden Path (sessionStorage gp_gh_token).
 */
(function () {
  "use strict";

  function expr(x) { return "${{ " + x + " }}"; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function getToken() { try { return sessionStorage.getItem("gp_gh_token") || ""; } catch (e) { return ""; } }
  function setToken(t) { try { sessionStorage.setItem("gp_gh_token", t); } catch (e) {} }
  function forgetToken() { try { sessionStorage.removeItem("gp_gh_token"); } catch (e) {} }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  // ── Fichiers generes pour le repo de deploiement ───────────────────────────
  function deployConfig(c) {
    return [
      "IMAGE=" + c.image,
      "BASE_TAG=" + c.baseTag,
      "NEW_TAG=" + c.newTag,
      "REPLICAS=" + c.replicas,
      "DEPLOYMENT=" + c.deployment,
      "NAMESPACE=" + c.namespace,
      "SIMULATE_FAILURE=" + (c.simulateFailure ? "true" : "false")
    ].join("\n") + "\n";
  }

  function deploymentManifest(c) {
    return [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: " + c.deployment,
      "  namespace: " + c.namespace,
      "  labels: { app: " + c.deployment + " }",
      "spec:",
      "  replicas: " + c.replicas,
      "  selector: { matchLabels: { app: " + c.deployment + " } }",
      "  template:",
      "    metadata: { labels: { app: " + c.deployment + " } }",
      "    spec:",
      "      containers:",
      "        - name: " + c.deployment,
      "          image: " + c.image + ":" + c.baseTag,
      "          ports: [{ containerPort: 80 }]",
      "          readinessProbe:",
      "            httpGet: { path: /, port: 80 }",
      "            initialDelaySeconds: 3",
      "            periodSeconds: 3",
      "            failureThreshold: 3"
    ].join("\n");
  }

  function workflow() {
    return [
      "name: Production Rollout",
      "on:",
      "  push:",
      "    paths: [deploy.config, k8s/**, .github/workflows/deploy.yml]",
      "  workflow_dispatch: {}",
      "jobs:",
      "  rollout:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - name: Konfiguration laden",
      '        run: cat deploy.config >> "$GITHUB_ENV"',
      "      - name: kind-Cluster erstellen",
      "        uses: helm/kind-action@v1",
      "      - name: Namespace anlegen",
      '        run: kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -',
      "      - name: Baseline ausrollen (bekannte gute Version)",
      "        run: |",
      '          kubectl -n "$NAMESPACE" apply -f k8s/deployment.yaml',
      '          kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=120s',
      "      - name: Neue Version ausrollen",
      "        id: rollout",
      "        continue-on-error: true",
      "        run: |",
      '          if [ "$SIMULATE_FAILURE" = "true" ]; then',
      '            TARGET="$IMAGE:does-not-exist-9999"',
      '            echo "Simuliere fehlerhaftes Image: $TARGET"',
      "          else",
      '            TARGET="$IMAGE:$NEW_TAG"',
      "          fi",
      '          kubectl -n "$NAMESPACE" set image deployment/"$DEPLOYMENT" "$DEPLOYMENT=$TARGET"',
      '          echo "Health Check laeuft (rollout status, Timeout 60s) ..."',
      '          kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=60s',
      "      - name: Rollback bei fehlgeschlagenem Health Check",
      "        if: steps.rollout.outcome == 'failure'",
      "        run: |",
      '          echo "Health Check fehlgeschlagen -> automatischer Rollback"',
      '          kubectl -n "$NAMESPACE" rollout undo deployment/"$DEPLOYMENT"',
      '          kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=120s',
      '          echo "Rollback abgeschlossen: Baseline wiederhergestellt."',
      "      - name: Status anzeigen",
      "        run: |",
      '          kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o wide',
      '          kubectl -n "$NAMESPACE" get pods',
      "      - name: Job als fehlgeschlagen markieren wenn Rollback noetig war",
      "        if: steps.rollout.outcome == 'failure'",
      "        run: |",
      '          echo "Deployment wurde zurueckgerollt (Health Check fehlgeschlagen)."',
      "          exit 1"
    ].join("\n");
  }

  function readme(c) {
    return [
      "# Production Rollout Demo",
      "",
      "Reales Rollout mit Health Check und automatischem Rollback, ausgefuehrt in",
      "GitHub Actions auf einem kind-Cluster (kostenlos, kein Cloud-Cluster noetig).",
      "",
      "## Ablauf",
      "1. kind-Cluster wird erstellt.",
      "2. Baseline (" + c.image + ":" + c.baseTag + ") wird ausgerollt und auf Health geprueft.",
      "3. Neue Version (" + c.image + ":" + c.newTag + ") wird ausgerollt.",
      "4. `kubectl rollout status` als Health Check.",
      "5. Bei Fehler: automatischer `kubectl rollout undo` (Rollback).",
      "",
      "Konfiguration: siehe `deploy.config`. Jeder Push startet einen neuen Rollout.",
      "Ergebnis live im Tab **Actions**."
    ].join("\n");
  }

  function buildFiles(c) {
    return [
      { path: ".github/workflows/deploy.yml", content: workflow() },
      { path: "deploy.config", content: deployConfig(c) },
      { path: "k8s/deployment.yaml", content: deploymentManifest(c) },
      { path: "README.md", content: readme(c) }
    ];
  }

  // ── API GitHub ─────────────────────────────────────────────────────────────
  function ghReq(method, url, token, body) {
    return fetch(url, {
      method: method,
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var msg = (data && data.message) || ("HTTP " + res.status);
          if (data && data.errors && data.errors.length) {
            msg += " - " + data.errors.map(function (x) { return x.message || ((x.field || "") + " " + (x.code || "")).trim(); }).join("; ");
          }
          var e = new Error(msg); e.status = res.status; throw e;
        }
        return data;
      });
    });
  }

  function ensureRepo(owner, repo, login, visibility, token, log) {
    return ghReq("GET", "https://api.github.com/repos/" + owner + "/" + repo, token).then(
      function () { log("Repository " + owner + "/" + repo + " gefunden."); return false; },
      function (e) {
        if (e.status !== 404) throw e;
        log("Repository nicht vorhanden, erstelle " + owner + "/" + repo + " ...");
        var body = { name: repo, private: visibility === "private", auto_init: true, description: "Production Rollout Demo (kind, Health Check, Rollback)" };
        var url = owner.toLowerCase() === login.toLowerCase()
          ? "https://api.github.com/user/repos"
          : "https://api.github.com/orgs/" + owner + "/repos";
        return ghReq("POST", url, token, body).catch(function (er) {
          if (er.status === 404 || er.status === 403) {
            log("Organisation nicht zugaenglich, erstelle unter " + login + ".", "dp-err");
            owner = login;
            return ghReq("POST", "https://api.github.com/user/repos", token, body);
          }
          throw er;
        }).then(function () { return true; });
      }
    );
  }

  function pushFiles(owner, repo, files, message, token, log) {
    var full = owner + "/" + repo, branch, baseCommit, baseTree;
    return ghReq("GET", "https://api.github.com/repos/" + full, token).then(function (r) {
      branch = r.default_branch || "main";
      return ghReq("GET", "https://api.github.com/repos/" + full + "/git/ref/heads/" + branch, token);
    }).then(function (ref) {
      baseCommit = ref.object.sha;
      return ghReq("GET", "https://api.github.com/repos/" + full + "/git/commits/" + baseCommit, token);
    }).then(function (commit) {
      baseTree = commit.tree.sha;
      var tree = [], chain = Promise.resolve();
      files.forEach(function (f, i) {
        chain = chain.then(function () {
          log("Upload (" + (i + 1) + "/" + files.length + "): " + f.path);
          return ghReq("POST", "https://api.github.com/repos/" + full + "/git/blobs", token, { content: b64(f.content), encoding: "base64" })
            .then(function (b) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha }); });
        });
      });
      return chain.then(function () { return tree; });
    }).then(function (tree) {
      return ghReq("POST", "https://api.github.com/repos/" + full + "/git/trees", token, { base_tree: baseTree, tree: tree });
    }).then(function (t) {
      return ghReq("POST", "https://api.github.com/repos/" + full + "/git/commits", token, { message: message, tree: t.sha, parents: [baseCommit] });
    }).then(function (commit) {
      return ghReq("PATCH", "https://api.github.com/repos/" + full + "/git/refs/heads/" + branch, token, { sha: commit.sha, force: true });
    });
  }

  function deploy(c, token, log) {
    var owner;
    return ghReq("GET", "https://api.github.com/user", token).then(function (me) {
      log("Authentifiziert als " + me.login);
      owner = (c.githubOwner && c.githubOwner.toLowerCase() !== me.login.toLowerCase()) ? c.githubOwner : me.login;
      return ensureRepo(owner, c.repo, me.login, c.visibility, token, log);
    }).then(function () {
      log("Schreibe Rollout-Konfiguration und Workflow ...");
      var msg = c.simulateFailure
        ? "deploy: " + c.image + ":" + c.newTag + " (Rollback-Test)"
        : "deploy: " + c.image + ":" + c.newTag;
      return pushFiles(owner, c.repo, buildFiles(c), msg, token, log);
    }).then(function () {
      var url = "https://github.com/" + owner + "/" + c.repo;
      log("Push erfolgreich. GitHub Actions startet den Rollout automatisch.", "dp-ok");
      return url;
    });
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById("dp-style")) return;
    var s = document.createElement("style");
    s.id = "dp-style";
    s.textContent = [
      ".dp-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,16,31,.66);backdrop-filter:blur(4px)}",
      ".dp-ov.open{display:flex}",
      ".dp-modal{position:relative;background:#fff;border-radius:16px;width:100%;max-width:900px;max-height:93vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.5)}",
      ".dp-head{padding:20px 24px;background:linear-gradient(120deg,#0f766e,#10b981);color:#fff}",
      ".dp-head h2{margin:0;font-size:18px;font-weight:800}",
      ".dp-head p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.85);line-height:1.5}",
      ".dp-x{position:absolute;top:16px;right:18px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer}",
      ".dp-body{padding:22px 24px;overflow:auto}",
      ".dp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".dp-field{display:flex;flex-direction:column;gap:6px}",
      ".dp-field.full{grid-column:1/-1}",
      ".dp-field label{font-size:12.5px;font-weight:700;color:#334155}",
      ".dp-field input,.dp-field select{padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;font-size:14px;font-family:inherit}",
      ".dp-field input:focus,.dp-field select:focus{outline:none;border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.15)}",
      ".dp-fail{grid-column:1/-1;display:flex;align-items:center;gap:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:11px 13px;font-size:13.5px;font-weight:600;color:#9a3412}",
      ".dp-tok{grid-column:1/-1;background:#f8fafc;border:1px solid #e5e9f0;border-radius:10px;padding:12px}",
      ".dp-tokok{font-size:13px;color:#1a7f4b;font-weight:600}",
      ".dp-link{background:none;border:none;color:#0f766e;font-weight:700;text-decoration:underline;cursor:pointer;font-size:13px;padding:0;margin-left:6px}",
      ".dp-note{font-size:12px;color:#5b6b80;margin-top:8px;line-height:1.5}",
      ".dp-err{color:#c0392b;font-size:11.5px;min-height:14px;font-weight:600}",
      ".dp-nav{display:flex;justify-content:space-between;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid #eef1f6}",
      ".dp-btn{border:1px solid #d1d9e3;background:#fff;border-radius:9px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;color:#0f766e}",
      ".dp-btn:hover{background:#f1f5f9}",
      ".dp-btn.p{background:#10b981;color:#fff;border-color:#10b981}",
      ".dp-btn.p:hover{background:#0ea371}",
      ".dp-log{background:#0b1020;border-radius:10px;padding:14px;max-height:48vh;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;color:#cdd6e6}",
      ".dp-logn{color:#5b6b86;width:26px;display:inline-block;text-align:right;margin-right:10px;user-select:none}",
      ".dp-logt{color:#34d399}",
      ".dp-ok{color:#9ece6a;font-weight:700}",
      ".dp-err2{color:#ff6b6b;font-weight:700}",
      "@media(max-width:680px){.dp-grid{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  var defaults = {
    deployment: "web", image: "nginx", baseTag: "1.25-alpine", newTag: "1.27-alpine",
    replicas: 2, namespace: "production", repo: "idp-prod-deploy-demo", githubOwner: "aboudou123", visibility: "private"
  };

  function ensureModal() {
    var ov = document.getElementById("dpOverlay");
    if (ov) return ov;
    injectStyle();
    ov = document.createElement("div");
    ov.id = "dpOverlay";
    ov.className = "dp-ov";
    ov.innerHTML =
      '<div class="dp-modal">' +
      '<div class="dp-head"><button class="dp-x" type="button" id="dpX">&times;</button>' +
      '<h2><i class="fa-solid fa-rocket"></i> In Produktion deployen</h2>' +
      "<p>Reales Rollout in einem kind-Cluster via GitHub Actions: Baseline, neue Version, Health Check und automatischer Rollback. Kostenlos, kein Cloud-Cluster.</p></div>" +
      '<div class="dp-body" id="dpBody"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#dpX").addEventListener("click", close); // ne se ferme que via X
    return ov;
  }

  function open() { ensureModal().classList.add("open"); renderForm(); }
  function close() { var ov = document.getElementById("dpOverlay"); if (ov) ov.classList.remove("open"); }

  function field(id, label, val, full) {
    return '<div class="dp-field' + (full ? " full" : "") + '"><label>' + esc(label) + "</label>" +
      '<input id="dp_' + id + '" value="' + esc(val) + '" autocomplete="off"></div>';
  }

  function renderForm() {
    var hasTok = !!getToken();
    var tok = hasTok
      ? '<div class="dp-tokok"><i class="fa-solid fa-circle-check"></i> GitHub-Token fuer diese Session gespeichert. <button type="button" class="dp-link" id="dpForget">Token aendern</button></div>'
      : '<label style="font-size:12.5px;font-weight:700;color:#334155">GitHub Personal Access Token (Scopes: repo, workflow)</label>' +
        '<input id="dp_token" type="password" placeholder="ghp_..." autocomplete="off" style="width:100%;padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;margin-top:6px"><div class="dp-err" id="dperr_token"></div>';
    document.getElementById("dpBody").innerHTML =
      '<div class="dp-grid">' +
        field("deployment", "Deployment-Name", defaults.deployment) +
        field("image", "Container-Image", defaults.image) +
        field("baseTag", "Aktuelle Version (Baseline-Tag)", defaults.baseTag) +
        field("newTag", "Neue Version (Tag)", defaults.newTag) +
        field("replicas", "Replicas", defaults.replicas) +
        field("namespace", "Namespace", defaults.namespace) +
        field("githubOwner", "GitHub Owner", defaults.githubOwner) +
        field("repo", "Ziel-Repository", defaults.repo) +
        '<label class="dp-fail"><input type="checkbox" id="dp_fail"> Fehlerhaftes Image simulieren (Rollback testen)</label>' +
        '<div class="dp-tok">' + tok +
          '<div class="dp-note"><i class="fa-solid fa-shield-halved"></i> Token nur im Browser (sessionStorage), nicht gespeichert auf Servern. Das Rollout laeuft kostenlos auf GitHub Actions in einem kind-Cluster.</div>' +
        "</div>" +
      "</div>" +
      '<div class="dp-nav"><span></span>' +
        '<button class="dp-btn p" type="button" id="dpGo"><i class="fa-solid fa-rocket"></i> Deployment starten</button>' +
      "</div>";
    var fg = document.getElementById("dpForget");
    if (fg) fg.addEventListener("click", function () { forgetToken(); renderForm(); });
    document.getElementById("dpGo").addEventListener("click", function () {
      var c = {
        deployment: val("deployment"), image: val("image"), baseTag: val("baseTag"),
        newTag: val("newTag"), replicas: parseInt(val("replicas"), 10) || 2,
        namespace: val("namespace"), githubOwner: val("githubOwner"), repo: val("repo"),
        visibility: defaults.visibility, simulateFailure: document.getElementById("dp_fail").checked
      };
      if (!c.deployment || !c.image || !c.newTag || !c.repo) { alert("Bitte Deployment, Image, Neue Version und Repository ausfuellen."); return; }
      var token = getToken();
      if (!token) {
        var f = document.getElementById("dp_token");
        token = f ? f.value.trim() : "";
        if (!token) { document.getElementById("dperr_token").textContent = "Token erforderlich (Scopes: repo, workflow)."; return; }
        setToken(token);
      }
      runDeploy(c, token);
    });
  }

  function val(id) { var e = document.getElementById("dp_" + id); return e ? e.value.trim() : ""; }

  function runDeploy(c, token) {
    document.getElementById("dpBody").innerHTML =
      '<div class="dp-log" id="dpLog"></div>' +
      '<div class="dp-nav"><button class="dp-btn" type="button" id="dpBack"><i class="fa-solid fa-arrow-left"></i> Zurueck</button><span id="dpActions"></span></div>';
    document.getElementById("dpBack").addEventListener("click", renderForm);
    var logEl = document.getElementById("dpLog"), n = 0;
    function log(line, cls) {
      n++;
      var ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      logEl.insertAdjacentHTML("beforeend", '<div><span class="dp-logn">' + n + '</span><span class="dp-logt">' + ts + "</span> " + (cls ? '<span class="' + cls + '">' + esc(line) + "</span>" : esc(line)) + "</div>");
      logEl.scrollTop = logEl.scrollHeight;
    }
    log("Starte Production Rollout ...", "dp-ok");
    if (c.simulateFailure) log("Modus: Rollback-Test (fehlerhaftes Image wird simuliert).");
    deploy(c, token, log).then(function (url) {
      document.getElementById("dpActions").innerHTML =
        '<a class="dp-btn p" href="' + url + '/actions" target="_blank" rel="noopener"><i class="fa-solid fa-play"></i> Rollout in Actions ansehen</a> ' +
        '<a class="dp-btn" href="' + url + '" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> Repository</a>';
    }).catch(function (err) {
      log("Fehler: " + (err && err.message ? err.message : "unbekannt"), "dp-err2");
      if (err && err.status === 403) log("Hinweis: Token-Scopes pruefen (repo, workflow).", "dp-err2");
      if (err && err.status === 401) { forgetToken(); log("Token ungueltig, wurde verworfen. Bitte neu eingeben.", "dp-err2"); }
      document.getElementById("dpActions").innerHTML = '<button class="dp-btn p" type="button" id="dpRetry">Erneut versuchen</button>';
      var r = document.getElementById("dpRetry"); if (r) r.addEventListener("click", renderForm);
    });
  }

  // ── Interception de la carte deploy-prod (sans modifier la logique existante) ─
  function hook() {
    if (typeof window.openModal === "function" && !window.openModal.__dpWrapped) {
      var original = window.openModal;
      window.openModal = function (id) {
        if (id === "deploy-prod") { open(); return; }
        return original.apply(this, arguments);
      };
      window.openModal.__dpWrapped = true;
    }
  }

  function init() {
    injectStyle();
    hook();
    var tries = 0;
    var iv = setInterval(function () { hook(); if ((window.openModal && window.openModal.__dpWrapped) || ++tries > 40) clearInterval(iv); }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
