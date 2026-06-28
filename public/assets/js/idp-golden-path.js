/*
 * idp-golden-path.js
 * Module additif pour /idp-demo : reproduit fidelement un Golden Path Backstage
 * "Enterprise Service Onboarding" (assistant 6 etapes + log scaffolder + bundle
 * d'artefacts). 100% cote navigateur, aucune dependance. N'altere rien d'existant.
 */
(function () {
  "use strict";

  // ── Validateurs (format ; le champ vide est traite comme "Pflichtfeld") ─────
  function vGithub(v) { if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/.test(v)) return "Gueltiger GitHub-Name: Buchstaben, Ziffern, Bindestriche."; }
  function vPort(v) { if (!/^\d+$/.test(v) || +v < 1 || +v > 65535) return "Ganzzahl zwischen 1 und 65535."; }

  // ── Definition des champs : AUCUNE valeur par defaut, saisie manuelle ───────
  var FIELDS = {
    serviceName: { label: "Technischer Servicename", ph: "z. B. payment-service", validate: function (v) { if (!/^[a-z][a-z0-9-]{1,48}[a-z0-9]$/.test(v)) return "Kleinbuchstaben, Ziffern, Bindestriche; Anfang ein Buchstabe."; } },
    serviceTitle: { label: "Anzeigename", ph: "z. B. Payment Service", validate: function (v) { if (v.length < 3) return "Mindestens 3 Zeichen."; } },
    description: { label: "Beschreibung", ph: "Kurze fachliche Beschreibung des Service", validate: function (v) { if (v.length < 10) return "Mindestens 10 Zeichen."; } },
    owner: { label: "Verantwortlicher Owner", ph: "group:default/team-name", validate: function (v) { if (!/^(group|user):[a-z0-9-]+\/[a-z0-9-]+$/.test(v)) return "Format: group:default/team oder user:default/name."; } },
    system: { label: "Zugehoeriges System", type: "select", opts: ["manufacturing-platform", "developer-platform"] },
    lifecycle: { label: "Lebenszyklus", type: "select", opts: ["experimental", "production", "deprecated"] },
    businessCriticality: { label: "Business Criticality", type: "select", opts: ["low", "medium", "high", "critical"] },
    dataClassification: { label: "Data Classification", type: "select", opts: ["public", "internal", "confidential", "restricted"] },
    githubOwner: { label: "GitHub Owner oder Organisation", ph: "z. B. meine-org", validate: vGithub },
    repositoryName: { label: "Repository-Name", ph: "z. B. payment-service", validate: function (v) { if (!/^[A-Za-z0-9._-]{1,100}$/.test(v)) return "Erlaubt: Buchstaben, Ziffern, . _ -"; } },
    codeOwnerUsername: { label: "GitHub CODEOWNER", ph: "GitHub-Benutzername", validate: vGithub },
    namespace: { label: "Kubernetes Namespace", ph: "z. B. payments", validate: function (v) { if (v.length > 63 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(v)) return "DNS-1123: Kleinbuchstaben/Ziffern/Bindestriche, max 63."; } },
    servicePort: { label: "Service Port", type: "number", ph: "z. B. 80", validate: vPort },
    containerPort: { label: "Container Port", type: "number", ph: "z. B. 8080", validate: vPort },
    serviceHost: { label: "Ingress Host", ph: "z. B. payment.example.com", validate: function (v) { if (!/^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/.test(v)) return "Gueltiger Hostname, z. B. service.example.com."; } },
    pipelineName: { label: "Pipeline-Name", ph: "z. B. payment-service-ci", validate: function (v) { if (!/^[a-z0-9][a-z0-9-]*$/.test(v)) return "Kleinbuchstaben, Ziffern, Bindestriche."; } },
    runtime: { label: "Runtime", type: "select", opts: ["nodejs", "python", "go", "java"] }
  };

  function fieldError(key, v) {
    v = (v == null ? "" : String(v)).trim();
    if (!v) return "Pflichtfeld.";
    var fn = FIELDS[key].validate;
    return fn ? (fn(v) || "") : "";
  }

  var STEPS = [
    { title: "Service-Informationen", fields: ["serviceName", "serviceTitle", "description"] },
    { title: "Governance und Catalog-Zuordnung", fields: ["owner", "system", "lifecycle", "businessCriticality", "dataClassification"] },
    { title: "GitHub-Veroeffentlichung", fields: ["githubOwner", "repositoryName", "codeOwnerUsername"] },
    { title: "Deployment-Vorbereitung", fields: ["namespace", "servicePort", "containerPort", "serviceHost"] },
    { title: "CI/CD-Metadaten", fields: ["pipelineName", "runtime"] },
    { title: "Review", fields: [] }
  ];

  var state = { step: 0, cfg: null };

  function defaults() {
    var c = {};
    Object.keys(FIELDS).forEach(function (k) { c[k] = ""; });
    return c;
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
  }

  // ── Generateurs de fichiers ────────────────────────────────────────────────
  function image(c) { return "ghcr.io/" + c.githubOwner + "/" + c.repositoryName; }

  function srcFile(c) {
    if (c.runtime === "python") {
      return {
        path: "src/main.py",
        content: [
          "from http.server import BaseHTTPRequestHandler, HTTPServer",
          "import os",
          "",
          "PORT = int(os.environ.get('PORT', " + c.containerPort + "))",
          "",
          "class Handler(BaseHTTPRequestHandler):",
          "    def do_GET(self):",
          "        if self.path == '/health':",
          "            self.send_response(200); self.end_headers(); self.wfile.write(b'ok'); return",
          "        self.send_response(200); self.end_headers()",
          "        self.wfile.write(b'" + c.serviceTitle + "')",
          "",
          "if __name__ == '__main__':",
          "    HTTPServer(('', PORT), Handler).serve_forever()"
        ].join("\n")
      };
    }
    if (c.runtime === "go") {
      return {
        path: "cmd/server/main.go",
        content: [
          "package main",
          "",
          'import ( "net/http"; "os" )',
          "",
          "func main() {",
          '\tport := os.Getenv("PORT"); if port == "" { port = "' + c.containerPort + '" }',
          '\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })',
          '\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("' + c.serviceTitle + '")) })',
          '\thttp.ListenAndServe(":"+port, nil)',
          "}"
        ].join("\n")
      };
    }
    if (c.runtime === "java") {
      return {
        path: "src/main/java/com/example/App.java",
        content: [
          "package com.example;",
          "import com.sun.net.httpserver.HttpServer;",
          "import java.net.InetSocketAddress;",
          "",
          "public class App {",
          "  public static void main(String[] a) throws Exception {",
          "    int port = Integer.parseInt(System.getenv().getOrDefault(\"PORT\", \"" + c.containerPort + "\"));",
          "    HttpServer s = HttpServer.create(new InetSocketAddress(port), 0);",
          "    s.createContext(\"/health\", e -> { byte[] b=\"ok\".getBytes(); e.sendResponseHeaders(200,b.length); e.getResponseBody().write(b); e.close(); });",
          "    s.start();",
          "  }",
          "}"
        ].join("\n")
      };
    }
    // nodejs (defaut) -> src/index.ts
    return {
      path: "src/index.ts",
      content: [
        'import http from "http";',
        "",
        "const port = Number(process.env.PORT) || " + c.containerPort + ";",
        "",
        "const server = http.createServer((req, res) => {",
        '  if (req.url === "/health") {',
        '    res.writeHead(200, { "content-type": "application/json" });',
        '    res.end(JSON.stringify({ status: "ok" }));',
        "    return;",
        "  }",
        '  res.writeHead(200, { "content-type": "text/plain" });',
        '  res.end("' + c.serviceTitle + '");',
        "});",
        "",
        "server.listen(port, () => console.log(`" + c.serviceName + " listening on ${port}`));"
      ].join("\n")
    };
  }

  function dockerfile(c) {
    if (c.runtime === "python") return ["FROM python:3.12-slim", "WORKDIR /app", "COPY requirements.txt .", "RUN pip install --no-cache-dir -r requirements.txt", "COPY . .", "EXPOSE " + c.containerPort, "USER 1000", 'CMD ["python", "-m", "src.main"]'].join("\n");
    if (c.runtime === "go") return ["FROM golang:1.22 AS build", "WORKDIR /src", "COPY . .", "RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server", "", "FROM gcr.io/distroless/static:nonroot", "COPY --from=build /app/server /server", "EXPOSE " + c.containerPort, 'ENTRYPOINT ["/server"]'].join("\n");
    if (c.runtime === "java") return ["FROM eclipse-temurin:21-jdk AS build", "WORKDIR /src", "COPY . .", "RUN ./mvnw -q package -DskipTests", "", "FROM eclipse-temurin:21-jre", "COPY --from=build /src/target/app.jar /app.jar", "EXPOSE " + c.containerPort, 'ENTRYPOINT ["java", "-jar", "/app.jar"]'].join("\n");
    return ["FROM node:20-alpine", "WORKDIR /app", "COPY package*.json ./", "RUN npm ci", "COPY . .", "RUN npm run build", "EXPOSE " + c.containerPort, "USER node", 'CMD ["node", "dist/index.js"]'].join("\n");
  }

  function catalogInfo(c) {
    return [
      "apiVersion: backstage.io/v1alpha1",
      "kind: Component",
      "metadata:",
      "  name: " + c.serviceName,
      "  title: " + c.serviceTitle,
      "  description: " + c.description,
      "  annotations:",
      "    github.com/project-slug: " + c.githubOwner + "/" + c.repositoryName,
      "    backstage.io/techdocs-ref: dir:.",
      "  labels:",
      "    business-criticality: " + c.businessCriticality,
      "    data-classification: " + c.dataClassification,
      "  tags:",
      "    - golden-path",
      "    - " + c.runtime,
      "spec:",
      "  type: service",
      "  lifecycle: " + c.lifecycle,
      "  owner: " + c.owner,
      "  system: " + c.system
    ].join("\n");
  }

  function azurePipelines(c) {
    return [
      "trigger:",
      "  branches: { include: [main] }",
      "",
      "pool:",
      "  vmImage: ubuntu-latest",
      "",
      "variables:",
      "  imageName: " + c.serviceName,
      "  namespace: " + c.namespace,
      "",
      "stages:",
      "  - stage: Validate",
      "    jobs:",
      "      - job: lint_test",
      "        steps:",
      "          - script: echo \"Lint & Tests fuer " + c.serviceName + "\"",
      "  - stage: Build",
      "    dependsOn: Validate",
      "    jobs:",
      "      - job: docker_build",
      "        steps:",
      "          - script: docker build -t " + image(c) + ":$(Build.BuildId) .",
      "  - stage: Deploy",
      "    dependsOn: Build",
      "    condition: eq(variables['Build.SourceBranchName'], 'main')",
      "    jobs:",
      "      - deployment: deploy_k8s",
      "        environment: " + c.namespace,
      "        strategy:",
      "          runOnce:",
      "            deploy:",
      "              steps:",
      "                - script: kubectl set image deployment/" + c.serviceName + " " + c.serviceName + "=" + image(c) + ":$(Build.BuildId) -n " + c.namespace
    ].join("\n");
  }

  function deploymentYaml(c) {
    return [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: " + c.serviceName,
      "  namespace: " + c.namespace,
      "  labels:",
      "    app: " + c.serviceName,
      "    app.kubernetes.io/managed-by: backstage",
      "    business-criticality: " + c.businessCriticality,
      "spec:",
      "  replicas: 2",
      "  selector: { matchLabels: { app: " + c.serviceName + " } }",
      "  template:",
      "    metadata: { labels: { app: " + c.serviceName + " } }",
      "    spec:",
      "      securityContext: { runAsNonRoot: true }",
      "      containers:",
      "        - name: " + c.serviceName,
      "          image: " + image(c) + ":latest",
      "          ports: [{ containerPort: " + c.containerPort + " }]",
      "          resources:",
      '            requests: { cpu: "100m", memory: "128Mi" }',
      '            limits: { cpu: "500m", memory: "256Mi" }',
      "          readinessProbe: { httpGet: { path: /health, port: " + c.containerPort + " }, initialDelaySeconds: 5 }",
      "          livenessProbe: { httpGet: { path: /health, port: " + c.containerPort + " }, initialDelaySeconds: 10 }"
    ].join("\n");
  }

  function serviceYaml(c) {
    return [
      "apiVersion: v1",
      "kind: Service",
      "metadata: { name: " + c.serviceName + ", namespace: " + c.namespace + " }",
      "spec:",
      "  type: ClusterIP",
      "  selector: { app: " + c.serviceName + " }",
      "  ports:",
      "    - port: " + c.servicePort,
      "      targetPort: " + c.containerPort
    ].join("\n");
  }

  function ingressYaml(c) {
    return [
      "apiVersion: networking.k8s.io/v1",
      "kind: Ingress",
      "metadata:",
      "  name: " + c.serviceName,
      "  namespace: " + c.namespace,
      "  annotations: { cert-manager.io/cluster-issuer: letsencrypt-prod }",
      "spec:",
      "  ingressClassName: nginx",
      "  tls: [{ hosts: [" + c.serviceHost + "], secretName: " + c.serviceName + "-tls }]",
      "  rules:",
      "    - host: " + c.serviceHost,
      "      http:",
      "        paths:",
      "          - path: /",
      "            pathType: Prefix",
      "            backend: { service: { name: " + c.serviceName + ", port: { number: " + c.servicePort + " } } }"
    ].join("\n");
  }

  function readme(c) {
    return [
      "# " + c.serviceTitle,
      "",
      "Standardisierter Enterprise-Service, der ueber Backstage erzeugt wurde.",
      "",
      "## Zweck",
      "Dieser Service wurde ueber den Enterprise Service Onboarding Golden Path in Backstage erzeugt.",
      "",
      "## Metadaten",
      "| Feld | Wert |",
      "| --- | --- |",
      "| Owner | " + c.owner + " |",
      "| System | " + c.system + " |",
      "| Lifecycle | " + c.lifecycle + " |",
      "| Business Criticality | " + c.businessCriticality + " |",
      "| Data Classification | " + c.dataClassification + " |",
      "| Runtime | " + c.runtime + " |",
      "",
      "## Lokale Entwicklung",
      "```bash",
      "docker build -t " + c.serviceName + " .",
      "docker run -p " + c.containerPort + ":" + c.containerPort + " " + c.serviceName,
      "```",
      "",
      "## Deployment",
      "```bash",
      "kubectl apply -f k8s/ -n " + c.namespace,
      "```"
    ].join("\n");
  }

  function docsIndex(c) {
    return ["# " + c.serviceTitle, "", c.description, "", "Siehe [Architektur](architecture.md) und [Runbook](runbook.md)."].join("\n");
  }
  function docsArch(c) {
    return [
      "# Architektur",
      "",
      "- **Runtime:** " + c.runtime,
      "- **Container Port:** " + c.containerPort,
      "- **Service Port:** " + c.servicePort,
      "- **Namespace:** " + c.namespace,
      "- **Ingress:** https://" + c.serviceHost,
      "",
      "Der Service laeuft als containerisierter Workload auf Kubernetes und wird ueber " +
        "die Plattform-Pipeline (" + c.pipelineName + ") ausgeliefert."
    ].join("\n");
  }
  function docsRunbook(c) {
    return [
      "# Runbook",
      "",
      "## Health",
      "`GET /health` muss 200 liefern.",
      "",
      "## Logs",
      "```bash",
      "kubectl logs -l app=" + c.serviceName + " -n " + c.namespace,
      "```",
      "",
      "## Skalieren",
      "```bash",
      "kubectl scale deployment/" + c.serviceName + " --replicas=N -n " + c.namespace,
      "```",
      "",
      "## Eskalation",
      "Owner: " + c.owner
    ].join("\n");
  }
  function mkdocs(c) {
    return ["site_name: " + c.serviceTitle, "nav:", "  - Home: index.md", "  - Architektur: architecture.md", "  - Runbook: runbook.md", "plugins:", "  - techdocs-core"].join("\n");
  }
  function security(c) {
    return ["# Security Policy", "", "## Schwachstellen melden", "Bitte vertraulich an security@lingenieur.de melden, keine oeffentlichen Issues.", "", "## Data Classification", c.dataClassification, "", "## Verantwortlich", c.owner].join("\n");
  }
  function codeowners(c) {
    return ["# Automatisch generiert durch den Golden Path", "* @" + c.codeOwnerUsername, "/k8s/ @" + c.codeOwnerUsername, "/.github/ @" + c.codeOwnerUsername].join("\n");
  }
  function readiness(c) {
    return [
      "# Readiness Checklist - " + c.serviceTitle,
      "",
      "- [x] Repository erstellt und in Backstage registriert",
      "- [x] catalog-info.yaml mit Owner und System",
      "- [x] Dockerfile vorhanden",
      "- [x] Kubernetes-Manifests (Deployment, Service, Ingress)",
      "- [x] CI/CD-Pipeline (" + c.pipelineName + ")",
      "- [x] CODEOWNERS und SECURITY.md",
      "- [ ] Monitoring/Alerting eingerichtet",
      "- [ ] SLOs definiert",
      "- [ ] On-Call zugewiesen",
      "- [ ] Lasttest durchgefuehrt"
    ].join("\n");
  }

  function buildFiles(c) {
    var f = [];
    function add(group, path, content) { f.push({ group: group, path: path, content: content }); }
    var src = srcFile(c);
    add("Repo", "Dockerfile", dockerfile(c));
    add("Repo", src.path, src.content);
    add("Backstage", "catalog-info.yaml", catalogInfo(c));
    add("CI/CD", "azure-pipelines.yml", azurePipelines(c));
    add("Kubernetes", "k8s/deployment.yaml", deploymentYaml(c));
    add("Kubernetes", "k8s/service.yaml", serviceYaml(c));
    add("Kubernetes", "k8s/ingress.yaml", ingressYaml(c));
    add("Dokumentation", "README.md", readme(c));
    add("Dokumentation", "docs/index.md", docsIndex(c));
    add("Dokumentation", "docs/architecture.md", docsArch(c));
    add("Dokumentation", "docs/runbook.md", docsRunbook(c));
    add("Dokumentation", "mkdocs.yml", mkdocs(c));
    add("Governance", "SECURITY.md", security(c));
    add("Governance", ".github/CODEOWNERS", codeowners(c));
    add("Governance", "readiness-checklist.md", readiness(c));
    return f;
  }

  function repoTree(files, name) {
    var paths = files.map(function (x) { return x.path; }).sort();
    var lines = [name + "/"];
    paths.forEach(function (p, i) { lines.push((i === paths.length - 1 ? "\\__ " : "|__ ") + p); });
    return lines.join("\n");
  }

  function scaffoldScript(files, c) {
    var out = ["#!/usr/bin/env bash", "# Enterprise Service Onboarding Golden Path - " + c.serviceName, "set -euo pipefail", "", 'mkdir -p "' + c.repositoryName + '" && cd "' + c.repositoryName + '"', ""];
    files.forEach(function (file) {
      var dir = file.path.indexOf("/") !== -1 ? file.path.replace(/\/[^/]*$/, "") : "";
      if (dir) out.push('mkdir -p "' + dir + '"');
      out.push("cat > '" + file.path + "' <<'GP_EOF'");
      out.push(file.content);
      out.push("GP_EOF");
      out.push("");
    });
    out.push('git init -q && git add . && git commit -qm "initial commit"');
    out.push('echo "Repo ' + c.repositoryName + ' bereit. git push einrichten."');
    return out.join("\n");
  }

  function runLog(c, files) {
    var L = [];
    L.push("Beginning step Enterprise-Service-Struktur generieren");
    L.push("info: Fetching template content from remote URL");
    L.push("info: Processing " + files.length + " template files with input values " + JSON.stringify({
      serviceName: c.serviceName, owner: c.owner, system: c.system, runtime: c.runtime,
      namespace: c.namespace, repositoryName: c.repositoryName
    }));
    files.slice().sort(function (a, b) { return a.path < b.path ? -1 : 1; }).forEach(function (f) {
      L.push("info: Writing file " + f.path + " to template output path.");
    });
    L.push("Finished step Enterprise-Service-Struktur generieren");
    L.push("Beginning step Enterprise-Service nach GitHub veroeffentlichen");
    L.push("info: Init git repository");
    L.push("info: Adding files and creating initial commit");
    L.push("info: Creating repository " + c.githubOwner + "/" + c.repositoryName + " (private)");
    L.push("info: Pushing to remote origin");
    L.push("info: Repository created: https://github.com/" + c.githubOwner + "/" + c.repositoryName);
    L.push("Finished step Enterprise-Service nach GitHub veroeffentlichen");
    L.push("Beginning step Im Backstage Catalog registrieren");
    L.push("info: Registering catalog-info.yaml");
    L.push("Finished step Im Backstage Catalog registrieren");
    L.push("Run completed with status: ok");
    return L;
  }

  function download(filename, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById("gp-style")) return;
    var s = document.createElement("style");
    s.id = "gp-style";
    s.textContent = [
      ".gp-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,16,31,.66);backdrop-filter:blur(4px)}",
      ".gp-ov.open{display:flex}",
      ".gp-modal{background:#fff;border-radius:16px;width:100%;max-width:1040px;max-height:93vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.5)}",
      ".gp-head{padding:20px 24px;background:linear-gradient(120deg,#1b2a6b,#3b2e8f);color:#fff}",
      ".gp-head h2{margin:0;font-size:18px;font-weight:800}",
      ".gp-head p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.82);line-height:1.5}",
      ".gp-x{position:absolute;top:16px;right:18px;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1}",
      ".gp-body{padding:22px 24px;overflow:auto}",
      ".gp-steps{display:flex;align-items:flex-start;gap:0;margin-bottom:24px;overflow:auto}",
      ".gp-step{flex:1;min-width:96px;text-align:center;position:relative}",
      ".gp-step:not(:last-child)::after{content:'';position:absolute;top:15px;left:50%;width:100%;height:2px;background:#dfe3ee}",
      ".gp-step.done:not(:last-child)::after{background:#1b2a6b}",
      ".gp-dot{position:relative;z-index:1;width:32px;height:32px;border-radius:50%;margin:0 auto 7px;display:flex;align-items:center;justify-content:center;background:#dfe3ee;color:#64748b;font-weight:700;font-size:13px}",
      ".gp-step.cur .gp-dot{background:#1b2a6b;color:#fff}",
      ".gp-step.done .gp-dot{background:#1b2a6b;color:#fff}",
      ".gp-step span{font-size:11.5px;color:#475569;line-height:1.3;display:block;padding:0 4px}",
      ".gp-step.cur span{color:#1b2a6b;font-weight:700}",
      ".gp-stitle{font-size:16px;font-weight:800;color:#0f1c2e;margin:0 0 16px}",
      ".gp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
      ".gp-field{display:flex;flex-direction:column;gap:6px}",
      ".gp-field.full{grid-column:1/-1}",
      ".gp-field label{font-size:12.5px;font-weight:700;color:#34465c}",
      ".gp-field input,.gp-field select{padding:10px 12px;border:1px solid #d1d9e3;border-radius:9px;font-size:14px;font-family:inherit;background:#fff}",
      ".gp-field input:focus,.gp-field select:focus{outline:none;border-color:#1b2a6b;box-shadow:0 0 0 3px rgba(27,42,107,.12)}",
      ".gp-field input.invalid,.gp-field select.invalid{border-color:#c0392b;background:#fff7f6}",
      ".gp-err{color:#c0392b;font-size:11.5px;min-height:14px;font-weight:600}",
      ".gp-nav{display:flex;justify-content:space-between;gap:10px;margin-top:22px;padding-top:16px;border-top:1px solid #eef1f6}",
      ".gp-btn{border:1px solid #d1d9e3;background:#fff;border-radius:9px;padding:11px 20px;font-size:14px;font-weight:700;cursor:pointer;color:#1b2a6b}",
      ".gp-btn:hover{background:#f1f5f9}",
      ".gp-btn.p{background:#1b2a6b;color:#fff;border-color:#1b2a6b}",
      ".gp-btn.p:hover{background:#24337e}",
      ".gp-btn:disabled{opacity:.5;cursor:default}",
      ".gp-rev{width:100%;border-collapse:collapse;font-size:13.5px}",
      ".gp-rev td{padding:9px 12px;border-bottom:1px solid #eef1f6;vertical-align:top}",
      ".gp-rev td:first-child{color:#64748b;width:42%;font-weight:600}",
      ".gp-rev td:last-child{color:#0f1c2e;font-family:'JetBrains Mono',monospace}",
      ".gp-log{background:#0b1020;border-radius:10px;padding:14px;max-height:50vh;overflow:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7}",
      ".gp-logline{display:flex;gap:10px;color:#cdd6e6}",
      ".gp-logn{color:#5b6b86;flex:none;width:26px;text-align:right;user-select:none}",
      ".gp-logt{color:#7aa2f7}",
      ".gp-logbeg{color:#9ece6a;font-weight:700}",
      ".gp-res{display:grid;grid-template-columns:230px 1fr;gap:16px;min-height:340px}",
      ".gp-files{border-right:1px solid #e5e9f0;padding-right:8px;max-height:58vh;overflow:auto}",
      ".gp-grp{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:12px 0 5px}",
      ".gp-file{display:block;width:100%;text-align:left;border:none;background:none;padding:7px 9px;border-radius:7px;font-size:12.5px;color:#0f1c2e;cursor:pointer;font-family:'JetBrains Mono',monospace}",
      ".gp-file:hover{background:#f1f5f9}.gp-file.on{background:#1b2a6b;color:#fff}",
      ".gp-view{display:flex;flex-direction:column;min-width:0}",
      ".gp-vbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}",
      ".gp-vpath{font-family:'JetBrains Mono',monospace;font-size:13px;color:#475569;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".gp-vbtns{display:flex;gap:8px;flex:none}",
      ".gp-pre{margin:0;background:#0b1f3a;color:#e6edf3;border-radius:10px;padding:14px;overflow:auto;max-height:52vh;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.55;white-space:pre}",
      ".gp-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}",
      ".gp-top h3{margin:0;font-size:15px;color:#1b2a6b}",
      "@media(max-width:680px){.gp-grid{grid-template-columns:1fr}.gp-res{grid-template-columns:1fr}.gp-files{border-right:none;border-bottom:1px solid #e5e9f0;max-height:150px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ── Rendu de l'assistant ────────────────────────────────────────────────────
  function body() { return document.getElementById("gpBody"); }

  function stepperHtml() {
    return '<div class="gp-steps">' + STEPS.map(function (st, i) {
      var cls = i === state.step ? "cur" : (i < state.step ? "done" : "");
      var dot = i < state.step ? '<i class="fa-solid fa-check"></i>' : String(i + 1);
      return '<div class="gp-step ' + cls + '"><div class="gp-dot">' + dot + "</div><span>" + esc(st.title) + "</span></div>";
    }).join("") + "</div>";
  }

  function fieldHtml(key) {
    var f = FIELDS[key], val = state.cfg[key] || "", full = key === "description" ? " full" : "";
    var input;
    if (f.type === "select") {
      input = '<select id="gp_' + key + '">' +
        '<option value="" disabled' + (val ? "" : " selected") + ">— bitte auswaehlen —</option>" +
        f.opts.map(function (o) { return '<option' + (o === val ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") +
        "</select>";
    } else {
      input = '<input id="gp_' + key + '" type="' + (f.type === "number" ? "number" : "text") +
        '" placeholder="' + esc(f.ph || "") + '" value="' + esc(val) + '" autocomplete="off">';
    }
    return '<div class="gp-field' + full + '"><label>' + esc(f.label) + ' <span style="color:#c0392b">*</span></label>' +
      input + '<div class="gp-err" id="gperr_' + key + '"></div></div>';
  }

  function collect() {
    STEPS[state.step].fields.forEach(function (key) {
      var el = document.getElementById("gp_" + key);
      if (el) state.cfg[key] = el.value;
    });
  }

  // Valide une liste de champs, affiche les erreurs inline, retourne true si tout est valide.
  function validateFields(keys) {
    var ok = true;
    keys.forEach(function (key) {
      var err = fieldError(key, state.cfg[key]);
      var input = document.getElementById("gp_" + key);
      var box = document.getElementById("gperr_" + key);
      if (box) box.textContent = err;
      if (input) input.classList.toggle("invalid", !!err);
      if (err) ok = false;
    });
    return ok;
  }

  // Retourne l'index de la premiere etape invalide, ou -1 si tout est valide.
  function firstInvalidStep() {
    for (var i = 0; i < 5; i++) {
      for (var j = 0; j < STEPS[i].fields.length; j++) {
        if (fieldError(STEPS[i].fields[j], state.cfg[STEPS[i].fields[j]])) return i;
      }
    }
    return -1;
  }

  function renderStep() {
    var st = STEPS[state.step];
    var html = stepperHtml() + '<h3 class="gp-stitle">' + esc(st.title) + "</h3>";
    html += '<div class="gp-grid">' + st.fields.map(fieldHtml).join("") + "</div>";
    var next = state.step === 4 ? "Review" : "Weiter";
    html += '<div class="gp-nav">' +
      '<button class="gp-btn" type="button" id="gpPrev"' + (state.step === 0 ? " disabled" : "") + '><i class="fa-solid fa-arrow-left"></i> Zurueck</button>' +
      '<button class="gp-btn p" type="button" id="gpNext">' + next + ' <i class="fa-solid fa-arrow-right"></i></button>' +
      "</div>";
    body().innerHTML = html;
    document.getElementById("gpPrev").addEventListener("click", function () {
      collect();
      if (state.step > 0) { state.step--; renderStep(); }
    });
    document.getElementById("gpNext").addEventListener("click", function () {
      collect();
      if (!validateFields(STEPS[state.step].fields)) return; // bloque tant que l'etape n'est pas valide
      if (state.step < 4) { state.step++; renderStep(); }
      else renderReview();
    });
  }

  function renderReview() {
    state.step = 5;
    var rows = Object.keys(FIELDS).map(function (k) {
      return "<tr><td>" + esc(FIELDS[k].label) + "</td><td>" + esc(state.cfg[k]) + "</td></tr>";
    }).join("");
    body().innerHTML = stepperHtml() +
      '<h3 class="gp-stitle">Review</h3>' +
      '<table class="gp-rev">' + rows + "</table>" +
      '<div class="gp-nav">' +
        '<button class="gp-btn" type="button" id="gpPrev"><i class="fa-solid fa-arrow-left"></i> Zurueck</button>' +
        '<button class="gp-btn p" type="button" id="gpCreate"><i class="fa-solid fa-rocket"></i> Erstellen</button>' +
      "</div>";
    document.getElementById("gpPrev").addEventListener("click", function () { state.step = 4; renderStep(); });
    document.getElementById("gpCreate").addEventListener("click", function () {
      var bad = firstInvalidStep();
      if (bad !== -1) { state.step = bad; renderStep(); validateFields(STEPS[bad].fields); return; }
      renderRun();
    });
  }

  function renderRun() {
    var c = state.cfg, files = buildFiles(c), lines = runLog(c, files);
    body().innerHTML =
      '<div class="gp-top"><h3><i class="fa-solid fa-gears"></i> Run of Enterprise Service Onboarding Golden Path</h3></div>' +
      '<div class="gp-log" id="gpLog"></div>' +
      '<div class="gp-nav"><span></span><button class="gp-btn p" type="button" id="gpShow" disabled><i class="fa-solid fa-folder-open"></i> Dateien anzeigen</button></div>';
    var log = document.getElementById("gpLog");
    var base = new Date();
    var i = 0;
    var iv = setInterval(function () {
      if (i >= lines.length) {
        clearInterval(iv);
        var b = document.getElementById("gpShow");
        b.disabled = false;
        b.addEventListener("click", function () { renderFiles(c, files); });
        return;
      }
      var ts = new Date(base.getTime() + i * 1000).toISOString().replace(/\.\d+Z$/, "Z");
      var txt = lines[i];
      var isBeg = /^(Beginning|Finished|Run completed)/.test(txt);
      var html = '<div class="gp-logline"><span class="gp-logn">' + (i + 1) + "</span><span>" +
        '<span class="gp-logt">' + ts + "</span> " +
        (isBeg ? '<span class="gp-logbeg">' + esc(txt) + "</span>" : esc(txt)) + "</span></div>";
      log.insertAdjacentHTML("beforeend", html);
      log.scrollTop = log.scrollHeight;
      i++;
    }, 70);
  }

  function renderFiles(c, files) {
    var all = [{ group: "Repo", path: "Struktur", content: repoTree(files, c.repositoryName) }].concat(files);
    var groups = [];
    all.forEach(function (f) { if (groups.indexOf(f.group) === -1) groups.push(f.group); });
    var list = "";
    groups.forEach(function (g) {
      list += '<div class="gp-grp">' + esc(g) + "</div>";
      all.forEach(function (f, idx) { if (f.group === g) list += '<button type="button" class="gp-file" data-idx="' + idx + '">' + esc(f.path) + "</button>"; });
    });
    body().innerHTML =
      '<div class="gp-top"><h3>' + esc(c.repositoryName) + " &middot; " + all.length + " Dateien</h3>" +
      '<div class="gp-vbtns"><button class="gp-btn" type="button" id="gpBack2"><i class="fa-solid fa-arrow-left"></i> Log</button>' +
      '<button class="gp-btn p" type="button" id="gpDlAll"><i class="fa-solid fa-download"></i> scaffold.sh</button></div></div>' +
      '<div class="gp-res"><div class="gp-files">' + list + "</div>" +
      '<div class="gp-view"><div class="gp-vbar"><span class="gp-vpath" id="gpPath"></span><span class="gp-vbtns">' +
      '<button class="gp-btn" type="button" id="gpCopy"><i class="fa-regular fa-copy"></i> Kopieren</button>' +
      '<button class="gp-btn" type="button" id="gpDl"><i class="fa-solid fa-download"></i> Datei</button>' +
      '</span></div><pre class="gp-pre" id="gpPre"></pre></div></div>';
    var cur = 0;
    function show(idx) {
      cur = idx;
      document.getElementById("gpPath").textContent = all[idx].path;
      document.getElementById("gpPre").textContent = all[idx].content;
      body().querySelectorAll(".gp-file").forEach(function (b) {
        b.classList.toggle("on", parseInt(b.getAttribute("data-idx"), 10) === idx);
      });
    }
    body().querySelectorAll(".gp-file").forEach(function (b) {
      b.addEventListener("click", function () { show(parseInt(b.getAttribute("data-idx"), 10)); });
    });
    document.getElementById("gpBack2").addEventListener("click", renderRun);
    document.getElementById("gpCopy").addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(all[cur].content);
      var b = document.getElementById("gpCopy"), t = b.innerHTML;
      b.innerHTML = '<i class="fa-solid fa-check"></i> Kopiert';
      setTimeout(function () { b.innerHTML = t; }, 1300);
    });
    document.getElementById("gpDl").addEventListener("click", function () { download(all[cur].path.replace(/\//g, "_"), all[cur].content); });
    document.getElementById("gpDlAll").addEventListener("click", function () { download("scaffold-" + c.repositoryName + ".sh", scaffoldScript(files, c)); });
    show(0);
  }

  // ── Modale ──────────────────────────────────────────────────────────────────
  function ensureModal() {
    var ov = document.getElementById("gpOverlay");
    if (ov) return ov;
    injectStyle();
    ov = document.createElement("div");
    ov.id = "gpOverlay";
    ov.className = "gp-ov";
    ov.innerHTML =
      '<div class="gp-modal" style="position:relative">' +
      '<div class="gp-head"><button class="gp-x" type="button" id="gpX">&times;</button>' +
      "<h2>Enterprise Service Onboarding Golden Path</h2>" +
      "<p>Vollstaendiger Enterprise-Golden-Path zur standardisierten Erstellung eines neuen Services mit Repository, Catalog-Metadaten, Dokumentation, Dockerfile, CI/CD-Grundlage, Kubernetes-Manifests, Security-Dateien und Readiness-Checkliste.</p></div>" +
      '<div class="gp-body" id="gpBody"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
    ov.querySelector("#gpX").addEventListener("click", closeModal);
    return ov;
  }

  function openModal() {
    ensureModal().classList.add("open");
    state = { step: 0, cfg: defaults() };
    renderStep();
  }
  function closeModal() {
    var ov = document.getElementById("gpOverlay");
    if (ov) ov.classList.remove("open");
  }

  // ── Carte dans la grille des actions ───────────────────────────────────────
  function gpCardHtml() {
    return '<div class="action-card" id="gpCard" style="--card-color:#3b2e8f;--card-icon-bg:#ece9ff" data-id="golden-path">' +
      '<div class="card-header"><div class="card-icon"><i class="fa-solid fa-rocket"></i></div>' +
      '<div class="card-meta"><div class="card-title">Enterprise Service Onboarding</div>' +
      '<div class="card-category">GOLDEN PATH</div></div></div>' +
      '<p class="card-desc">Standardisierte Erstellung eines neuen Services: Repository, Catalog-Metadaten, Docs, Dockerfile, CI/CD, Kubernetes-Manifests, Security und Readiness-Checkliste.</p>' +
      '<div class="card-tags"><span class="card-tag purple">golden-path</span><span class="card-tag blue">kubernetes</span><span class="card-tag green">github</span></div>' +
      '<div class="card-footer"><div class="card-complexity"><div class="complexity-dots"><span class="cd on"></span><span class="cd on"></span><span class="cd on"></span></div> Komplex</div>' +
      '<button class="run-btn" type="button" style="background:#3b2e8f"><i class="fa-solid fa-play"></i> Ausfuehren</button></div></div>';
  }

  function gpShouldShow() {
    var active = document.querySelector(".filter-row .filter-tab.active");
    var filter = active ? active.getAttribute("data-filter") : "all";
    if (filter && filter !== "all" && filter !== "cicd" && filter !== "kubernetes") return false;
    var s = document.getElementById("cardSearch");
    var q = s ? s.value.trim().toLowerCase() : "";
    if (q && "enterprise service onboarding golden path microservice scaffolder backstage kubernetes github ci/cd".indexOf(q) === -1) return false;
    return true;
  }

  function injectCard() {
    var grid = document.getElementById("cardsGrid");
    if (!grid) return;
    var ex = document.getElementById("gpCard");
    if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
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
      gpObs = new MutationObserver(function () { gpObs.disconnect(); injectCard(); gpObs.observe(grid, { childList: true }); });
      gpObs.observe(grid, { childList: true });
    }
    return true;
  }

  function init() {
    injectStyle();
    if (watchGrid()) return;
    var tries = 0;
    var iv = setInterval(function () { if (watchGrid() || ++tries > 40) clearInterval(iv); }, 300);
  }

  window.gpOpen = openModal;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
