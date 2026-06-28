/*
 * idp-create-env.js
 * Rend la carte "Environment erstellen" reellement fonctionnelle : provisionne un
 * environnement complet (Namespace, ResourceQuota/LimitRange, ConfigMap, Secret,
 * Deployment, Service, Ingress) dans un vrai cluster kind via GitHub Actions.
 * Gratuit, additif, reutilise le token de session (gp_gh_token).
 */
(function () {
  "use strict";

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function getToken() { try { return sessionStorage.getItem("gp_gh_token") || ""; } catch (e) { return ""; } }
  function setToken(t) { try { sessionStorage.setItem("gp_gh_token", t); } catch (e) {} }
  function forgetToken() { try { sessionStorage.removeItem("gp_gh_token"); } catch (e) {} }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  // ── Manifestes generes (valeurs injectees au moment de la creation) ─────────
  function namespaceYaml(c) {
    return [
      "apiVersion: v1",
      "kind: Namespace",
      "metadata:",
      "  name: " + c.namespace,
      "  labels: { env-type: " + c.envType + ", managed-by: idp, environment: " + c.envName + " }"
    ].join("\n");
  }
  function quotaYaml(c) {
    return [
      "apiVersion: v1",
      "kind: ResourceQuota",
      "metadata: { name: env-quota, namespace: " + c.namespace + " }",
      "spec:",
      "  hard:",
      '    requests.cpu: "' + c.cpu + '"',
      "    requests.memory: " + c.memory,
      '    limits.cpu: "' + c.cpu + '"',
      "    limits.memory: " + c.memory,
      '    pods: "' + c.pods + '"',
      "---",
      "apiVersion: v1",
      "kind: LimitRange",
      "metadata: { name: env-limits, namespace: " + c.namespace + " }",
      "spec:",
      "  limits:",
      "    - type: Container",
      '      default: { cpu: "250m", memory: "256Mi" }',
      '      defaultRequest: { cpu: "100m", memory: "128Mi" }'
    ].join("\n");
  }
  function configYaml(c) {
    return [
      "apiVersion: v1",
      "kind: ConfigMap",
      "metadata: { name: app-config, namespace: " + c.namespace + " }",
      "data:",
      "  APP_ENV: " + c.envType,
      '  LOG_LEVEL: "info"',
      '  FEATURE_FLAGS: "demo"',
      "---",
      "apiVersion: v1",
      "kind: Secret",
      "metadata: { name: app-secrets, namespace: " + c.namespace + " }",
      "type: Opaque",
      "data:",
      "  API_KEY: " + b64("demo-" + c.envName + "-key")
    ].join("\n");
  }
  function appYaml(c) {
    return [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata: { name: app, namespace: " + c.namespace + ", labels: { app: app } }",
      "spec:",
      "  replicas: 1",
      "  selector: { matchLabels: { app: app } }",
      "  template:",
      "    metadata: { labels: { app: app } }",
      "    spec:",
      "      containers:",
      "        - name: app",
      "          image: " + c.image,
      "          ports: [{ containerPort: 80 }]",
      "          envFrom:",
      "            - configMapRef: { name: app-config }",
      "            - secretRef: { name: app-secrets }",
      "          readinessProbe: { httpGet: { path: /, port: 80 }, initialDelaySeconds: 3, periodSeconds: 3 }",
      "---",
      "apiVersion: v1",
      "kind: Service",
      "metadata: { name: app, namespace: " + c.namespace + " }",
      "spec: { selector: { app: app }, ports: [{ port: 80, targetPort: 80 }] }",
      "---",
      "apiVersion: networking.k8s.io/v1",
      "kind: Ingress",
      "metadata: { name: app, namespace: " + c.namespace + ", annotations: { kubernetes.io/ingress.class: nginx } }",
      "spec:",
      "  rules:",
      "    - host: " + c.host,
      "      http:",
      "        paths:",
      "          - path: /",
      "            pathType: Prefix",
      "            backend: { service: { name: app, port: { number: 80 } } }"
    ].join("\n");
  }
  function workflow(c) {
    return [
      "name: Create Environment",
      "on:",
      "  push:",
      "    paths: [k8s/**, .github/workflows/create-env.yml]",
      "  workflow_dispatch: {}",
      "jobs:",
      "  provision:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - name: kind-Cluster erstellen",
      "        uses: helm/kind-action@v1",
      "      - name: Namespace anlegen",
      "        run: kubectl apply -f k8s/namespace.yaml",
      "      - name: Quotas und Limits anwenden",
      "        run: kubectl apply -f k8s/quota.yaml",
      "      - name: Config und Secrets anwenden",
      "        run: kubectl apply -f k8s/config.yaml",
      "      - name: Anwendung, Service und Ingress anwenden",
      "        run: kubectl apply -f k8s/app.yaml",
      "      - name: Auf Rollout warten",
      "        run: kubectl -n " + c.namespace + " rollout status deployment/app --timeout=120s",
      "      - name: Environment verifizieren",
      "        run: |",
      "          echo '== Namespace =='; kubectl get ns " + c.namespace,
      "          echo '== Quota / Limits =='; kubectl -n " + c.namespace + " get resourcequota,limitrange",
      "          echo '== Config / Secrets =='; kubectl -n " + c.namespace + " get configmap,secret",
      "          echo '== Workloads =='; kubectl -n " + c.namespace + " get deploy,svc,ingress,pods",
      "          echo '== Quota-Auslastung =='; kubectl -n " + c.namespace + " describe resourcequota env-quota"
    ].join("\n");
  }
  function readme(c) {
    return [
      "# Environment: " + c.envName,
      "",
      "Vollstaendiges " + c.envType + "-Environment, provisioniert in einem kind-Cluster",
      "via GitHub Actions (kostenlos, kein Cloud-Cluster).",
      "",
      "## Enthalten",
      "- Namespace `" + c.namespace + "`",
      "- ResourceQuota (CPU " + c.cpu + ", Memory " + c.memory + ", Pods " + c.pods + ") + LimitRange",
      "- ConfigMap `app-config` und Secret `app-secrets`",
      "- Deployment, Service und Ingress (Host `" + c.host + "`)",
      "",
      "Jeder Push provisioniert das Environment neu. Ergebnis live im Tab **Actions**."
    ].join("\n");
  }

  function buildFiles(c) {
    return [
      { path: ".github/workflows/create-env.yml", content: workflow(c) },
      { path: "k8s/namespace.yaml", content: namespaceYaml(c) },
      { path: "k8s/quota.yaml", content: quotaYaml(c) },
      { path: "k8s/config.yaml", content: configYaml(c) },
      { path: "k8s/app.yaml", content: appYaml(c) },
      { path: "README.md", content: readme(c) }
    ];
  }

  // ── API GitHub ─────────────────────────────────────────────────────────────
  function ghReq(method, url, token, body) {
    return fetch(url, {
      method: method,
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var msg = (data && data.message) || ("HTTP " + res.status);
          if (data && data.errors && data.errors.length) msg += " - " + data.errors.map(function (x) { return x.message || ((x.field || "") + " " + (x.code || "")).trim(); }).join("; ");
          var e = new Error(msg); e.status = res.status; throw e;
        }
        return data;
      });
    });
  }
  function ensureRepo(owner, repo, login, visibility, token, log) {
    return ghReq("GET", "https://api.github.com/repos/" + owner + "/" + repo, token).then(
      function () { log("Repository " + owner + "/" + repo + " gefunden."); },
      function (e) {
        if (e.status !== 404) throw e;
        log("Erstelle Repository " + owner + "/" + repo + " ...");
        var body = { name: repo, private: visibility === "private", auto_init: true, description: "IDP Environments (kind, namespaces, quotas)" };
        var url = owner.toLowerCase() === login.toLowerCase() ? "https://api.github.com/user/repos" : "https://api.github.com/orgs/" + owner + "/repos";
        return ghReq("POST", url, token, body).catch(function (er) {
          if (er.status === 404 || er.status === 403) { log("Organisation nicht zugaenglich, erstelle unter " + login + ".", "ce-err2"); return ghReq("POST", "https://api.github.com/user/repos", token, body); }
          throw er;
        });
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
  function provision(c, token, log) {
    var owner;
    return ghReq("GET", "https://api.github.com/user", token).then(function (me) {
      log("Authentifiziert als " + me.login);
      owner = (c.githubOwner && c.githubOwner.toLowerCase() !== me.login.toLowerCase()) ? c.githubOwner : me.login;
      return ensureRepo(owner, c.repo, me.login, c.visibility, token, log);
    }).then(function () {
      log("Schreibe Environment-Manifeste (" + c.namespace + ") ...");
      return pushFiles(owner, c.repo, buildFiles(c), "env: " + c.envName + " (" + c.namespace + ")", token, log);
    }).then(function () {
      log("Push erfolgreich. GitHub Actions provisioniert das Environment.", "ce-ok");
      return "https://github.com/" + owner + "/" + c.repo;
    });
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById("ce-style")) return;
    var s = document.createElement("style");
    s.id = "ce-style";
    s.textContent = [
      ".ce-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,16,31,.66);backdrop-filter:blur(4px)}",
      ".ce-ov.open{display:flex}",
      ".ce-modal{position:relative;background:#fff;border-radius:16px;width:100%;max-width:900px;max-height:93vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.5)}",
      ".ce-head{padding:20px 24px;background:linear-gradient(120deg,#0e7490,#06b6d4);color:#fff}",
      ".ce-head h2{margin:0;font-size:18px;font-weight:800}",
      ".ce-head p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.88);line-height:1.5}",
      ".ce-x{position:absolute;top:16px;right:18px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer}",
      ".ce-body{padding:22px 24px;overflow:auto}",
      ".ce-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".ce-field{display:flex;flex-direction:column;gap:6px}",
      ".ce-field label{font-size:12.5px;font-weight:700;color:#334155}",
      ".ce-field input,.ce-field select{padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;font-size:14px;font-family:inherit}",
      ".ce-field input:focus,.ce-field select:focus{outline:none;border-color:#06b6d4;box-shadow:0 0 0 3px rgba(6,182,212,.15)}",
      ".ce-tok{grid-column:1/-1;background:#f8fafc;border:1px solid #e5e9f0;border-radius:10px;padding:12px}",
      ".ce-tokok{font-size:13px;color:#1a7f4b;font-weight:600}",
      ".ce-link{background:none;border:none;color:#0e7490;font-weight:700;text-decoration:underline;cursor:pointer;font-size:13px;padding:0;margin-left:6px}",
      ".ce-note{font-size:12px;color:#5b6b80;margin-top:8px;line-height:1.5}",
      ".ce-err{color:#c0392b;font-size:11.5px;min-height:14px;font-weight:600}",
      ".ce-nav{display:flex;justify-content:space-between;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid #eef1f6}",
      ".ce-btn{border:1px solid #d1d9e3;background:#fff;border-radius:9px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;color:#0e7490}",
      ".ce-btn:hover{background:#f1f5f9}",
      ".ce-btn.p{background:#06b6d4;color:#fff;border-color:#06b6d4}",
      ".ce-btn.p:hover{background:#0aa2bd}",
      ".ce-log{background:#0b1020;border-radius:10px;padding:14px;max-height:48vh;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;color:#cdd6e6}",
      ".ce-logn{color:#5b6b86;width:26px;display:inline-block;text-align:right;margin-right:10px;user-select:none}",
      ".ce-logt{color:#22d3ee}",
      ".ce-ok{color:#9ece6a;font-weight:700}",
      ".ce-err2{color:#ff6b6b;font-weight:700}",
      "@media(max-width:680px){.ce-grid{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  var defaults = { envName: "dev-payments", envType: "development", cpu: "2", memory: "2Gi", pods: "10", image: "nginx:1.27-alpine", host: "dev-payments.idp.local", repo: "idp-environments-demo", githubOwner: "aboudou123", visibility: "private" };

  function ensureModal() {
    var ov = document.getElementById("ceOverlay");
    if (ov) return ov;
    injectStyle();
    ov = document.createElement("div");
    ov.id = "ceOverlay";
    ov.className = "ce-ov";
    ov.innerHTML =
      '<div class="ce-modal">' +
      '<div class="ce-head"><button class="ce-x" type="button" id="ceX">&times;</button>' +
      '<h2><i class="fa-solid fa-layer-group"></i> Environment erstellen</h2>' +
      "<p>Provisioniert ein vollstaendiges Environment in einem kind-Cluster via GitHub Actions: Namespace, ResourceQuota/LimitRange, ConfigMap, Secret, Deployment, Service und Ingress. Kostenlos.</p></div>" +
      '<div class="ce-body" id="ceBody"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#ceX").addEventListener("click", close); // ferme uniquement via X
    return ov;
  }
  function open() { ensureModal().classList.add("open"); renderForm(); }
  function close() { var ov = document.getElementById("ceOverlay"); if (ov) ov.classList.remove("open"); }

  function input(id, label, val) { return '<div class="ce-field"><label>' + esc(label) + '</label><input id="ce_' + id + '" value="' + esc(val) + '" autocomplete="off"></div>'; }
  function select(id, label, opts, val) {
    return '<div class="ce-field"><label>' + esc(label) + '</label><select id="ce_' + id + '">' +
      opts.map(function (o) { return '<option' + (o === val ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>";
  }
  function val(id) { var e = document.getElementById("ce_" + id); return e ? e.value.trim() : ""; }

  function renderForm() {
    var hasTok = !!getToken();
    var tok = hasTok
      ? '<div class="ce-tokok"><i class="fa-solid fa-circle-check"></i> GitHub-Token fuer diese Session gespeichert. <button type="button" class="ce-link" id="ceForget">Token aendern</button></div>'
      : '<label style="font-size:12.5px;font-weight:700;color:#334155">GitHub Personal Access Token (Scopes: repo, workflow)</label>' +
        '<input id="ce_token" type="password" placeholder="ghp_..." autocomplete="off" style="width:100%;padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;margin-top:6px"><div class="ce-err" id="ceerr_token"></div>';
    document.getElementById("ceBody").innerHTML =
      '<div class="ce-grid">' +
        input("envName", "Environment-Name", defaults.envName) +
        select("envType", "Typ", ["development", "staging", "preview"], defaults.envType) +
        input("namespace", "Namespace", "env-" + defaults.envName) +
        input("image", "Anwendungs-Image", defaults.image) +
        input("cpu", "CPU-Quota (Cores)", defaults.cpu) +
        input("memory", "Memory-Quota", defaults.memory) +
        input("pods", "Pods-Quota", defaults.pods) +
        input("host", "Ingress Host", defaults.host) +
        input("githubOwner", "GitHub Owner", defaults.githubOwner) +
        input("repo", "Ziel-Repository", defaults.repo) +
        '<div class="ce-tok">' + tok +
          '<div class="ce-note"><i class="fa-solid fa-shield-halved"></i> Token nur im Browser (sessionStorage). Provisionierung kostenlos in GitHub Actions (kind-Cluster).</div>' +
        "</div>" +
      "</div>" +
      '<div class="ce-nav"><span></span><button class="ce-btn p" type="button" id="ceGo"><i class="fa-solid fa-bolt"></i> Environment provisionieren</button></div>';
    var fg = document.getElementById("ceForget");
    if (fg) fg.addEventListener("click", function () { forgetToken(); renderForm(); });
    // Derive namespace from name si l'utilisateur n'a pas touche.
    var nameEl = document.getElementById("ce_envName"), nsEl = document.getElementById("ce_namespace");
    nameEl.addEventListener("input", function () { nsEl.value = "env-" + nameEl.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); });
    document.getElementById("ceGo").addEventListener("click", function () {
      var c = {
        envName: val("envName"), envType: val("envType"),
        namespace: val("namespace").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
        image: val("image"), cpu: val("cpu"), memory: val("memory"), pods: val("pods"),
        host: val("host"), githubOwner: val("githubOwner"), repo: val("repo"), visibility: defaults.visibility
      };
      if (!c.envName || !c.namespace || !c.image || !c.repo) { alert("Bitte Name, Namespace, Image und Repository ausfuellen."); return; }
      var token = getToken();
      if (!token) {
        var f = document.getElementById("ce_token");
        token = f ? f.value.trim() : "";
        if (!token) { document.getElementById("ceerr_token").textContent = "Token erforderlich (Scopes: repo, workflow)."; return; }
        setToken(token);
      }
      runProvision(c, token);
    });
  }

  function runProvision(c, token) {
    document.getElementById("ceBody").innerHTML =
      '<div class="ce-log" id="ceLog"></div>' +
      '<div class="ce-nav"><button class="ce-btn" type="button" id="ceBack"><i class="fa-solid fa-arrow-left"></i> Zurueck</button><span id="ceActions"></span></div>';
    document.getElementById("ceBack").addEventListener("click", renderForm);
    var logEl = document.getElementById("ceLog"), n = 0;
    function log(line, cls) {
      n++;
      var ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      logEl.insertAdjacentHTML("beforeend", '<div><span class="ce-logn">' + n + '</span><span class="ce-logt">' + ts + "</span> " + (cls ? '<span class="' + cls + '">' + esc(line) + "</span>" : esc(line)) + "</div>");
      logEl.scrollTop = logEl.scrollHeight;
    }
    log("Starte Environment-Provisionierung (" + c.namespace + ") ...", "ce-ok");
    provision(c, token, log).then(function (url) {
      document.getElementById("ceActions").innerHTML =
        '<a class="ce-btn p" href="' + url + '/actions" target="_blank" rel="noopener"><i class="fa-solid fa-play"></i> Provisionierung in Actions ansehen</a> ' +
        '<a class="ce-btn" href="' + url + '" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> Repository</a>';
    }).catch(function (err) {
      log("Fehler: " + (err && err.message ? err.message : "unbekannt"), "ce-err2");
      if (err && err.status === 403) log("Hinweis: Token-Scopes pruefen (repo, workflow).", "ce-err2");
      if (err && err.status === 401) { forgetToken(); log("Token ungueltig, wurde verworfen. Bitte neu eingeben.", "ce-err2"); }
      document.getElementById("ceActions").innerHTML = '<button class="ce-btn p" type="button" id="ceRetry">Erneut versuchen</button>';
      var r = document.getElementById("ceRetry"); if (r) r.addEventListener("click", renderForm);
    });
  }

  // ── Interception de la carte create-env ─────────────────────────────────────
  function hook() {
    if (typeof window.openModal === "function" && !window.openModal.__ceWrapped) {
      var original = window.openModal;
      window.openModal = function (id) {
        if (id === "create-env") { open(); return; }
        return original.apply(this, arguments);
      };
      window.openModal.__ceWrapped = true;
    }
  }
  function init() {
    injectStyle();
    hook();
    var tries = 0;
    var iv = setInterval(function () { hook(); if ((window.openModal && window.openModal.__ceWrapped) || ++tries > 40) clearInterval(iv); }, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
