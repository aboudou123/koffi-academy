/*
 * idp-golden-path.js
 * Module additif pour /idp-demo : un "Golden Path / Scaffolder" qui genere un
 * bundle d'artefacts realistes (repo, K8s, CI/CD, docs, governance, Backstage)
 * pour un nouveau microservice. 100% cote navigateur, aucune dependance.
 */
(function () {
  "use strict";

  var ORG = "koffi-academy";

  // Helper : expression GitHub Actions / Backstage ( ${{ ... }} ) sans casser le JS
  function expr(x) { return "${{ " + x + " }}"; }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  // ── Generateurs de fichiers ────────────────────────────────────────────────
  function dockerfile(c) {
    if (c.lang === "Python") {
      return [
        "FROM python:3.12-slim",
        "WORKDIR /app",
        "COPY requirements.txt .",
        "RUN pip install --no-cache-dir -r requirements.txt",
        "COPY . .",
        "EXPOSE " + c.port,
        "USER 1000",
        'CMD ["python", "-m", "app"]'
      ].join("\n");
    }
    if (c.lang === "Go") {
      return [
        "FROM golang:1.22 AS build",
        "WORKDIR /src",
        "COPY . .",
        "RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server",
        "",
        "FROM gcr.io/distroless/static:nonroot",
        "COPY --from=build /app/server /server",
        "EXPOSE " + c.port,
        'ENTRYPOINT ["/server"]'
      ].join("\n");
    }
    if (c.lang === "Java") {
      return [
        "FROM eclipse-temurin:21-jdk AS build",
        "WORKDIR /src",
        "COPY . .",
        "RUN ./mvnw -q package -DskipTests",
        "",
        "FROM eclipse-temurin:21-jre",
        "COPY --from=build /src/target/app.jar /app.jar",
        "EXPOSE " + c.port,
        'ENTRYPOINT ["java", "-jar", "/app.jar"]'
      ].join("\n");
    }
    // Node.js (defaut)
    return [
      "FROM node:20-alpine",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm ci --omit=dev",
      "COPY . .",
      "EXPOSE " + c.port,
      "USER node",
      'CMD ["node", "src/index.js"]'
    ].join("\n");
  }

  function deploymentYaml(c) {
    return [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: " + c.name,
      "  namespace: " + c.ns,
      "  labels:",
      "    app: " + c.name,
      "    app.kubernetes.io/managed-by: backstage",
      "    backstage.io/owner: " + c.team,
      "spec:",
      "  replicas: " + c.replicas,
      "  selector:",
      "    matchLabels:",
      "      app: " + c.name,
      "  template:",
      "    metadata:",
      "      labels:",
      "        app: " + c.name,
      "    spec:",
      "      securityContext:",
      "        runAsNonRoot: true",
      "      containers:",
      "        - name: " + c.name,
      "          image: " + c.image + ":latest",
      "          ports:",
      "            - containerPort: " + c.port,
      "          resources:",
      '            requests: { cpu: "100m", memory: "128Mi" }',
      '            limits: { cpu: "500m", memory: "256Mi" }',
      "          readinessProbe:",
      "            httpGet: { path: /health, port: " + c.port + " }",
      "            initialDelaySeconds: 5",
      "          livenessProbe:",
      "            httpGet: { path: /health, port: " + c.port + " }",
      "            initialDelaySeconds: 10",
      "          envFrom:",
      "            - configMapRef: { name: " + c.name + "-config }",
      "            - secretRef: { name: " + c.name + "-secrets }"
    ].join("\n");
  }

  function serviceYaml(c) {
    return [
      "apiVersion: v1",
      "kind: Service",
      "metadata:",
      "  name: " + c.name,
      "  namespace: " + c.ns,
      "spec:",
      "  type: ClusterIP",
      "  selector:",
      "    app: " + c.name,
      "  ports:",
      "    - port: 80",
      "      targetPort: " + c.port
    ].join("\n");
  }

  function ingressYaml(c) {
    return [
      "apiVersion: networking.k8s.io/v1",
      "kind: Ingress",
      "metadata:",
      "  name: " + c.name,
      "  namespace: " + c.ns,
      "  annotations:",
      "    cert-manager.io/cluster-issuer: letsencrypt-prod",
      "spec:",
      "  ingressClassName: nginx",
      "  tls:",
      "    - hosts: [" + c.host + "]",
      "      secretName: " + c.name + "-tls",
      "  rules:",
      "    - host: " + c.host,
      "      http:",
      "        paths:",
      "          - path: /",
      "            pathType: Prefix",
      "            backend:",
      "              service:",
      "                name: " + c.name,
      "                port: { number: 80 }"
    ].join("\n");
  }

  function ciYaml(c) {
    return [
      "name: CI/CD",
      "on:",
      "  push: { branches: [main] }",
      "  pull_request:",
      "permissions:",
      "  contents: read",
      "  packages: write",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - name: Build image",
      "        run: docker build -t " + c.image + ":" + expr("github.sha") + " .",
      "      - name: Login to GHCR",
      "        run: echo " + expr("secrets.GITHUB_TOKEN") +
        " | docker login ghcr.io -u " + expr("github.actor") + " --password-stdin",
      "      - name: Push image",
      "        if: github.ref == 'refs/heads/main'",
      "        run: docker push " + c.image + ":" + expr("github.sha"),
      "  deploy:",
      "    needs: build",
      "    if: github.ref == 'refs/heads/main'",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Deploy to Kubernetes",
      "        run: kubectl set image deployment/" + c.name + " " + c.name + "=" +
        c.image + ":" + expr("github.sha") + " -n " + c.ns
    ].join("\n");
  }

  function readme(c) {
    return [
      "# " + c.name,
      "",
      "> " + c.desc,
      "",
      "Service genere via le **Golden Path** de la Koffi Academy IDP.",
      "",
      "## Stack",
      "- Runtime : " + c.lang,
      "- Port : " + c.port,
      "- Owner : `" + c.team + "`",
      "",
      "## Lokale Entwicklung",
      "```bash",
      "docker build -t " + c.name + " .",
      "docker run -p " + c.port + ":" + c.port + " " + c.name,
      "```",
      "",
      "## Deployment",
      "```bash",
      "kubectl apply -f k8s/ -n " + c.ns,
      "```",
      "",
      "## Endpunkte",
      "- Health : `GET /health`",
      "- URL : https://" + c.host
    ].join("\n");
  }

  function techdocs(c) {
    return [
      "# " + c.name,
      "",
      c.desc,
      "",
      "## Architektur",
      "Microservice (" + c.lang + ") deployt auf Kubernetes, verwaltet durch die IDP.",
      "",
      "## Ownership",
      "Verantwortliches Team: **" + c.team + "**",
      "",
      "## Runbook",
      "1. Logs : `kubectl logs -l app=" + c.name + " -n " + c.ns + "`",
      "2. Skalieren : `kubectl scale deployment/" + c.name + " --replicas=N -n " + c.ns + "`"
    ].join("\n");
  }

  function mkdocs(c) {
    return [
      "site_name: " + c.name,
      "nav:",
      "  - Home: index.md",
      "plugins:",
      "  - techdocs-core"
    ].join("\n");
  }

  function codeowners(c) {
    return [
      "# Automatisch generiert durch den Golden Path",
      "* @" + ORG + "/" + c.ns,
      "/k8s/ @" + ORG + "/platform",
      "/.github/ @" + ORG + "/platform"
    ].join("\n");
  }

  function security(c) {
    return [
      "# Security Policy",
      "",
      "## Meldung von Schwachstellen",
      "Bitte Sicherheitsprobleme vertraulich an security@lingenieur.de melden.",
      "Keine offentlichen Issues fur Schwachstellen.",
      "",
      "## Verantwortliches Team",
      c.team
    ].join("\n");
  }

  function catalogInfo(c) {
    return [
      "apiVersion: backstage.io/v1alpha1",
      "kind: Component",
      "metadata:",
      "  name: " + c.name,
      "  description: " + c.desc,
      "  annotations:",
      "    github.com/project-slug: " + ORG + "/" + c.name,
      "    backstage.io/techdocs-ref: dir:.",
      "spec:",
      "  type: service",
      "  lifecycle: production",
      "  owner: " + c.team,
      "  system: idp"
    ].join("\n");
  }

  function templateYaml(c) {
    return [
      "apiVersion: scaffolder.backstage.io/v1beta3",
      "kind: Template",
      "metadata:",
      "  name: golden-path-microservice",
      "  title: Golden Path - Microservice",
      "  description: Erstellt einen standardisierten Microservice mit K8s, CI/CD, Docs und Governance.",
      "spec:",
      "  owner: platform",
      "  type: service",
      "  parameters:",
      "    - title: Service",
      "      required: [name, owner]",
      "      properties:",
      "        name: { title: Name, type: string }",
      "        owner: { title: Team, type: string }",
      "        port: { title: Port, type: number, default: " + c.port + " }",
      "  steps:",
      "    - id: fetch",
      "      name: Fetch Skeleton",
      "      action: fetch:template",
      "      input:",
      "        url: ./skeleton",
      "        values:",
      "          name: " + expr("parameters.name"),
      "          owner: " + expr("parameters.owner"),
      "    - id: publish",
      "      name: Publish to GitHub",
      "      action: publish:github",
      "      input:",
      "        repoUrl: github.com?owner=" + ORG + "&repo=" + expr("parameters.name"),
      "    - id: register",
      "      name: Register in Catalog",
      "      action: catalog:register",
      "      input:",
      "        repoContentsUrl: " + expr("steps.publish.output.repoContentsUrl"),
      "        catalogInfoPath: /catalog-info.yaml",
      "  output:",
      "    links:",
      "      - title: Repository",
      "        url: " + expr("steps.publish.output.remoteUrl")
    ].join("\n");
  }

  function buildFiles(c) {
    var f = [];
    function add(group, path, lang, content) {
      f.push({ group: group, path: path, lang: lang, content: content });
    }
    add("Repo", "Dockerfile", "docker", dockerfile(c));
    add("Kubernetes", "k8s/deployment.yaml", "yaml", deploymentYaml(c));
    add("Kubernetes", "k8s/service.yaml", "yaml", serviceYaml(c));
    add("Kubernetes", "k8s/ingress.yaml", "yaml", ingressYaml(c));
    add("CI/CD", ".github/workflows/ci-cd.yaml", "yaml", ciYaml(c));
    add("Dokumentation", "README.md", "md", readme(c));
    add("Dokumentation", "docs/index.md", "md", techdocs(c));
    add("Dokumentation", "mkdocs.yml", "yaml", mkdocs(c));
    add("Governance", "CODEOWNERS", "txt", codeowners(c));
    add("Governance", "SECURITY.md", "md", security(c));
    add("Backstage", "catalog-info.yaml", "yaml", catalogInfo(c));
    add("Backstage", "template.yaml", "yaml", templateYaml(c));
    return f;
  }

  function repoTree(files, name) {
    var lines = [name + "/"];
    var paths = files.map(function (x) { return x.path; }).sort();
    paths.forEach(function (p, i) {
      var last = i === paths.length - 1;
      lines.push((last ? "└── " : "├── ") + p);
    });
    return lines.join("\n");
  }

  function scaffoldScript(files, c) {
    var out = [
      "#!/usr/bin/env bash",
      "# Golden Path Scaffold - " + c.name,
      "# Generiert durch die Koffi Academy IDP",
      "set -euo pipefail",
      "",
      'mkdir -p "' + c.name + '" && cd "' + c.name + '"',
      ""
    ];
    files.forEach(function (file) {
      var dir = file.path.indexOf("/") !== -1 ? file.path.replace(/\/[^/]*$/, "") : "";
      if (dir) out.push('mkdir -p "' + dir + '"');
      out.push("cat > '" + file.path + "' <<'GP_EOF'");
      out.push(file.content);
      out.push("GP_EOF");
      out.push("");
    });
    out.push('git init -q && git add . && git commit -qm "feat: scaffold ' + c.name + ' via Golden Path"');
    out.push('echo "Service ' + c.name + ' erstellt. Naechster Schritt: git push."');
    return out.join("\n");
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById("gp-style")) return;
    var s = document.createElement("style");
    s.id = "gp-style";
    s.textContent = [
      ".gp-banner{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between;background:linear-gradient(120deg,#07294d,#0e3d72);color:#fff;border-radius:14px;padding:18px 22px;margin:0 0 22px}",
      ".gp-banner h3{margin:0 0 4px;font-size:17px;font-weight:800}",
      ".gp-banner p{margin:0;font-size:13.5px;color:rgba(255,255,255,.78)}",
      ".gp-banner button{display:inline-flex;align-items:center;gap:9px;background:linear-gradient(135deg,#f9d77e,#d6a02d);color:#07294d;border:none;border-radius:10px;padding:12px 20px;font-weight:800;font-size:14.5px;cursor:pointer;transition:transform .16s}",
      ".gp-banner button:hover{transform:translateY(-2px)}",
      ".gp-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,16,31,.66);backdrop-filter:blur(4px)}",
      ".gp-ov.open{display:flex}",
      ".gp-modal{background:#fff;border-radius:18px;width:100%;max-width:980px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.5)}",
      ".gp-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;background:#07294d;color:#fff}",
      ".gp-head h2{margin:0;font-size:17px;font-weight:800}",
      ".gp-x{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}",
      ".gp-body{padding:22px;overflow:auto}",
      ".gp-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".gp-field{display:flex;flex-direction:column;gap:6px}",
      ".gp-field.full{grid-column:1/-1}",
      ".gp-field label{font-size:12.5px;font-weight:700;color:#34465c}",
      ".gp-field input,.gp-field select{padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;font-size:14px;font-family:inherit}",
      ".gp-go{grid-column:1/-1;background:#07294d;color:#fff;border:none;border-radius:10px;padding:13px;font-weight:800;font-size:15px;cursor:pointer}",
      ".gp-go:hover{background:#0a3a6b}",
      ".gp-res{display:grid;grid-template-columns:240px 1fr;gap:16px;min-height:380px}",
      ".gp-files{border-right:1px solid #e5e9f0;padding-right:8px;max-height:62vh;overflow:auto}",
      ".gp-grp{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:12px 0 5px}",
      ".gp-file{display:block;width:100%;text-align:left;border:none;background:none;padding:7px 9px;border-radius:7px;font-size:13px;color:#0f1c2e;cursor:pointer;font-family:'JetBrains Mono',monospace}",
      ".gp-file:hover{background:#f1f5f9}",
      ".gp-file.on{background:#07294d;color:#fff}",
      ".gp-view{display:flex;flex-direction:column;min-width:0}",
      ".gp-vbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}",
      ".gp-vpath{font-family:'JetBrains Mono',monospace;font-size:13px;color:#475569;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".gp-vbtns{display:flex;gap:8px;flex:none}",
      ".gp-btn{border:1px solid #d1d9e3;background:#fff;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;color:#07294d}",
      ".gp-btn:hover{background:#f1f5f9}",
      ".gp-btn.p{background:#07294d;color:#fff;border-color:#07294d}",
      ".gp-pre{margin:0;background:#0b1f3a;color:#e6edf3;border-radius:10px;padding:14px;overflow:auto;max-height:56vh;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.55;white-space:pre}",
      ".gp-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}",
      ".gp-top h3{margin:0;font-size:15px;color:#07294d}",
      "@media(max-width:680px){.gp-form{grid-template-columns:1fr}.gp-res{grid-template-columns:1fr}.gp-files{border-right:none;border-bottom:1px solid #e5e9f0;max-height:160px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function modalHtml() {
    return [
      '<div class="gp-modal">',
      '  <div class="gp-head"><h2><i class="fa-solid fa-wand-magic-sparkles"></i> Golden Path: Neuer Microservice</h2><button class="gp-x" type="button" aria-label="Schliessen" id="gpX">&times;</button></div>',
      '  <div class="gp-body" id="gpBody"></div>',
      "</div>"
    ].join("\n");
  }

  function formHtml() {
    return [
      '<div class="gp-form">',
      '  <div class="gp-field"><label>Service-Name</label><input id="gpName" value="payment-service"></div>',
      '  <div class="gp-field"><label>Team / Owner</label><select id="gpTeam"><option>platform</option><option>payments</option><option>data</option><option>security</option></select></div>',
      '  <div class="gp-field"><label>Runtime</label><select id="gpLang"><option>Node.js</option><option>Python</option><option>Go</option><option>Java</option></select></div>',
      '  <div class="gp-field"><label>Port</label><input id="gpPort" type="number" value="8080"></div>',
      '  <div class="gp-field"><label>Replicas</label><input id="gpReps" type="number" value="2"></div>',
      '  <div class="gp-field"><label>Host (Ingress)</label><input id="gpHost" value="payment-service.idp.lingenieur.de"></div>',
      '  <div class="gp-field full"><label>Beschreibung</label><input id="gpDesc" value="Zahlungs-Microservice"></div>',
      '  <button class="gp-go" type="button" id="gpGo"><i class="fa-solid fa-bolt"></i> Generieren</button>',
      "</div>"
    ].join("\n");
  }

  function readForm() {
    var name = (document.getElementById("gpName").value || "my-service").trim()
      .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "my-service";
    var team = document.getElementById("gpTeam").value;
    var c = {
      name: name,
      team: team,
      ns: team.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      lang: document.getElementById("gpLang").value,
      port: parseInt(document.getElementById("gpPort").value, 10) || 8080,
      replicas: parseInt(document.getElementById("gpReps").value, 10) || 2,
      host: (document.getElementById("gpHost").value || (name + ".idp.lingenieur.de")).trim(),
      desc: (document.getElementById("gpDesc").value || "Microservice").trim()
    };
    c.image = "ghcr.io/" + ORG + "/" + name;
    return c;
  }

  function download(filename, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function renderResult(c) {
    var files = buildFiles(c);
    files.unshift({ group: "Repo", path: "Struktur", lang: "txt", content: repoTree(files, c.name) });
    var body = document.getElementById("gpBody");

    var groups = [];
    files.forEach(function (f) { if (groups.indexOf(f.group) === -1) groups.push(f.group); });

    var list = "";
    groups.forEach(function (g) {
      list += '<div class="gp-grp">' + esc(g) + "</div>";
      files.forEach(function (f, idx) {
        if (f.group !== g) return;
        list += '<button type="button" class="gp-file" data-idx="' + idx + '">' + esc(f.path) + "</button>";
      });
    });

    body.innerHTML = [
      '<div class="gp-top">',
      "  <h3>" + esc(c.name) + " &middot; " + esc(c.lang) + " &middot; " + files.length + " Dateien</h3>",
      '  <div class="gp-vbtns">',
      '    <button class="gp-btn" type="button" id="gpBack"><i class="fa-solid fa-arrow-left"></i> Zurueck</button>',
      '    <button class="gp-btn p" type="button" id="gpDlAll"><i class="fa-solid fa-download"></i> scaffold.sh</button>',
      "  </div>",
      "</div>",
      '<div class="gp-res">',
      '  <div class="gp-files" id="gpFiles">' + list + "</div>",
      '  <div class="gp-view">',
      '    <div class="gp-vbar"><span class="gp-vpath" id="gpPath"></span><span class="gp-vbtns">',
      '      <button class="gp-btn" type="button" id="gpCopy"><i class="fa-regular fa-copy"></i> Kopieren</button>',
      '      <button class="gp-btn" type="button" id="gpDl"><i class="fa-solid fa-download"></i> Datei</button>',
      "    </span></div>",
      '    <pre class="gp-pre" id="gpPre"></pre>',
      "  </div>",
      "</div>"
    ].join("\n");

    var current = 0;
    function show(idx) {
      current = idx;
      var f = files[idx];
      document.getElementById("gpPath").textContent = f.path;
      document.getElementById("gpPre").textContent = f.content;
      var btns = body.querySelectorAll(".gp-file");
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("on", parseInt(btns[i].getAttribute("data-idx"), 10) === idx);
      }
    }
    body.querySelectorAll(".gp-file").forEach(function (b) {
      b.addEventListener("click", function () { show(parseInt(b.getAttribute("data-idx"), 10)); });
    });
    document.getElementById("gpBack").addEventListener("click", function () { renderForm(); });
    document.getElementById("gpCopy").addEventListener("click", function () {
      var f = files[current];
      if (navigator.clipboard) navigator.clipboard.writeText(f.content);
      var b = document.getElementById("gpCopy");
      var t = b.innerHTML; b.innerHTML = '<i class="fa-solid fa-check"></i> Kopiert';
      setTimeout(function () { b.innerHTML = t; }, 1400);
    });
    document.getElementById("gpDl").addEventListener("click", function () {
      var f = files[current];
      download(f.path.replace(/\//g, "_"), f.content);
    });
    document.getElementById("gpDlAll").addEventListener("click", function () {
      download("scaffold-" + c.name + ".sh", scaffoldScript(buildFiles(c), c));
    });
    show(0);
  }

  function renderForm() {
    var body = document.getElementById("gpBody");
    body.innerHTML = formHtml();
    document.getElementById("gpGo").addEventListener("click", function () {
      renderResult(readForm());
    });
  }

  function ensureModal() {
    var ov = document.getElementById("gpOverlay");
    if (ov) return ov;
    injectStyle();
    ov = document.createElement("div");
    ov.id = "gpOverlay";
    ov.className = "gp-ov";
    ov.innerHTML = modalHtml();
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
    ov.querySelector("#gpX").addEventListener("click", closeModal);
    return ov;
  }

  function openModal() {
    ensureModal().classList.add("open");
    renderForm();
  }
  function closeModal() {
    var ov = document.getElementById("gpOverlay");
    if (ov) ov.classList.remove("open");
  }

  // ── Carte "Golden Path" injectee dans la grille des actions ────────────────
  function gpLang() { return window.lang === "fr" || window.lang === "en" ? window.lang : "de"; }
  function gpRunLabel() { var l = gpLang(); return l === "fr" ? "Exécuter" : l === "en" ? "Run" : "Ausführen"; }
  function gpComplexityLabel() { var l = gpLang(); return l === "fr" ? "Moyen" : l === "en" ? "Medium" : "Mittel"; }
  function gpTitle() { var l = gpLang(); return l === "fr" ? "Golden Path : Microservice" : "Golden Path: Microservice"; }
  function gpDesc() {
    var l = gpLang();
    if (l === "fr") return "Créer un microservice standardisé : repo, Kubernetes, CI/CD, docs, gouvernance et Backstage en une étape.";
    if (l === "en") return "Create a standardized microservice: repo, Kubernetes, CI/CD, docs, governance and Backstage in one step.";
    return "Neuen Microservice standardisiert erstellen: Repo, Kubernetes, CI/CD, Docs, Governance und Backstage in einem Schritt.";
  }

  function gpCardHtml() {
    return '<div class="action-card" id="gpCard" style="--card-color:#d6a02d;--card-icon-bg:#fff3d6" data-id="golden-path">' +
      '<div class="card-header">' +
        '<div class="card-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>' +
        '<div class="card-meta">' +
          '<div class="card-title">' + gpTitle() + "</div>" +
          '<div class="card-category">GOLDEN PATH</div>' +
        "</div>" +
      "</div>" +
      '<p class="card-desc">' + gpDesc() + "</p>" +
      '<div class="card-tags">' +
        '<span class="card-tag purple">Backstage</span>' +
        '<span class="card-tag blue">Kubernetes</span>' +
        '<span class="card-tag green">CI/CD</span>' +
      "</div>" +
      '<div class="card-footer">' +
        '<div class="card-complexity"><div class="complexity-dots"><span class="cd on"></span><span class="cd on"></span><span class="cd"></span></div> ' + gpComplexityLabel() + "</div>" +
        '<button class="run-btn" type="button" style="background:#d6a02d"><i class="fa-solid fa-play"></i> ' + gpRunLabel() + "</button>" +
      "</div>" +
    "</div>";
  }

  function gpShouldShow() {
    var active = document.querySelector(".filter-row .filter-tab.active");
    var filter = active ? active.getAttribute("data-filter") : "all";
    if (filter && filter !== "all" && filter !== "cicd" && filter !== "kubernetes") return false;
    var s = document.getElementById("cardSearch");
    var q = s ? s.value.trim().toLowerCase() : "";
    if (q && "golden path microservice scaffolder backstage kubernetes ci/cd repo service".indexOf(q) === -1) return false;
    return true;
  }

  function injectCard() {
    var grid = document.getElementById("cardsGrid");
    if (!grid) return;
    var existing = document.getElementById("gpCard");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!gpShouldShow()) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = gpCardHtml();
    var card = tmp.firstChild;
    grid.insertBefore(card, grid.firstChild);
    var btn = card.querySelector(".run-btn");
    if (btn) btn.addEventListener("click", openModal);
  }

  var gpObs = null;
  function watchGrid() {
    var grid = document.getElementById("cardsGrid");
    if (!grid) return false;
    injectCard();
    if (!gpObs) {
      gpObs = new MutationObserver(function () {
        gpObs.disconnect();
        injectCard();
        gpObs.observe(grid, { childList: true });
      });
      gpObs.observe(grid, { childList: true });
    }
    return true;
  }

  function init() {
    injectStyle();
    if (watchGrid()) return;
    // La SPA rend peut-etre la grille plus tard : on reessaie jusqu'a la trouver.
    var tries = 0;
    var iv = setInterval(function () {
      if (watchGrid() || ++tries > 40) clearInterval(iv);
    }, 300);
  }

  window.gpOpen = openModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
