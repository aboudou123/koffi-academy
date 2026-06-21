(function () {
  "use strict";

  var MAX_SESSIONS = 4;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { window.setTimeout(fn, 0); });
    } else {
      window.setTimeout(fn, 0);
    }
  }

  function text(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function getPrompt(view) {
    var prompt = view.querySelector(".terminal-inputbar .terminal-prompt") || view.querySelector(".terminal-prompt");
    return prompt ? prompt.textContent.trim() : "dev@dev-box-flow:~$";
  }

  function parsePrompt(promptText) {
    var hostMatch = promptText.match(/@([^:\s#$]+)/);
    var pathMatch = promptText.match(/:([^#$]+)[#$]?$/);
    return {
      host: hostMatch ? hostMatch[1] : "dev-box-flow",
      path: pathMatch ? pathMatch[1] : "~"
    };
  }

  function productForHost(host) {
    if (host === "dev-box-flow") return "CAIPE 0.4.10";
    if (host === "llm-eval") return "LLM Eval Toolkit";
    if (host.indexOf("gitops") !== -1) return "GitOps Lab";
    if (host.indexOf("cilium") !== -1) return "Cilium Lab";
    if (host.indexOf("proxmox") !== -1) return "Proxmox Lab";
    if (host.indexOf("akeyless") !== -1 || host.indexOf("ssh-target") !== -1) return "SSH Certificate Lab";
    return "Koffi Academy Lab";
  }

  function print(output, value, className) {
    String(value).split("\n").forEach(function (line) {
      var row = document.createElement("div");
      if (className) row.className = className;
      row.textContent = line;
      output.appendChild(row);
    });
    output.scrollTop = output.scrollHeight;
  }

  function printBlock(output, lines, className) {
    lines.forEach(function (line) { print(output, line, className); });
  }

  function buildShell(promptText) {
    var meta = parsePrompt(promptText);
    var root = text("div", "ubuntu-terminal");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Ubuntu terminal");

    var bar = text("div", "ubuntu-terminal__bar");
    var brand = text("div", "ubuntu-terminal__brand");
    brand.setAttribute("aria-hidden", "true");
    brand.append(
      text("span", "ubuntu-terminal__brand-icon", "▣"),
      text("span", "ubuntu-terminal__brand-title", "Ubuntu Terminal")
    );

    var tabs = text("div", "ubuntu-terminal__tabs");
    tabs.setAttribute("role", "tablist");

    var add = text("button", "ubuntu-terminal__add", "+");
    add.type = "button";
    add.setAttribute("aria-label", "Nouveau terminal");

    bar.append(brand, tabs, add);

    var status = text("div", "ubuntu-terminal__status");
    var title = text("span", "ubuntu-terminal__status-title");
    title.textContent = "VM " + meta.host + " bereit \u2014 " + productForHost(meta.host);
    var tip = text("span", "ubuntu-terminal__status-tip");
    tip.textContent = "Tipp: help f\u00fcr Befehle, check f\u00fcr Fortschritt";
    status.append(title, tip);

    var body = text("div", "ubuntu-terminal__body");
    root.append(bar, status, body);

    return { root: root, tabs: tabs, add: add, body: body, meta: meta, statusTitle: title, statusTip: tip };
  }

  function closeSession(state, id) {
    if (id === 1) return;
    var index = state.sessions.findIndex(function (session) { return session.id === id; });
    if (index === -1) return;

    var session = state.sessions[index];
    var wasActive = state.activeId === id;
    session.tab.remove();
    session.pane.remove();
    state.sessions.splice(index, 1);
    state.add.disabled = false;

    if (wasActive) {
      var fallback = state.sessions[Math.max(0, index - 1)] || state.sessions[0];
      if (fallback) activateSession(state, fallback.id);
    }
  }

  function makeTab(state, session) {
    var tab = text("div", "ubuntu-terminal__tab");
    tab.setAttribute("role", "tab");
    tab.setAttribute("tabindex", "0");
    tab.setAttribute("aria-selected", "false");
    tab.dataset.sessionId = String(session.id);
    tab.addEventListener("click", function () { activateSession(state, session.id); });
    tab.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateSession(state, session.id);
      }
    });

    var label = session.id === 1
      ? state.promptText.replace(/[#$]\s*$/, "").replace(":~", ": ~")
      : "Terminal " + session.id;
    tab.appendChild(text("span", "ubuntu-terminal__tab-label", label));

    if (session.id !== 1) {
      var close = text("button", "ubuntu-terminal__tab-close", "\u00d7");
      close.type = "button";
      close.setAttribute("aria-label", "Fermer Terminal " + session.id);
      close.addEventListener("click", function (event) {
        event.stopPropagation();
        closeSession(state, session.id);
      });
      tab.appendChild(close);
    }

    session.tab = tab;
    state.tabs.appendChild(tab);
  }

  function activateSession(state, id) {
    state.sessions.forEach(function (session) {
      var active = session.id === id;
      session.pane.classList.toggle("is-active", active);
      session.tab.classList.toggle("is-active", active);
      session.tab.setAttribute("aria-selected", active ? "true" : "false");
      if (active && session.input) {
        window.setTimeout(function () { session.input.focus(); }, 0);
      }
    });
    state.activeId = id;
  }

  function isLocalRunnerCandidate() {
    var host = window.location.hostname;
    var params = new URLSearchParams(window.location.search);
    return params.get("real-lab") === "1" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function currentLabId() {
    var first = window.location.pathname.split("/").filter(Boolean)[0] || "dev-box-caipe";
    return first.replace(/[^a-zA-Z0-9._-]+/g, "-");
  }

  function appendRaw(output, value) {
    output.appendChild(document.createTextNode(String(value)));
    output.scrollTop = output.scrollHeight;
  }

  function setRunnerStatus(state, value) {
    if (state.statusTip) state.statusTip.textContent = value;
  }

  function sendRealCommand(state, session, value) {
    if (!state.real || state.real.status !== "connected" || !state.real.socket) return false;
    print(session.output, state.promptText + " " + value, "line-cmd");
    state.real.socket.send(JSON.stringify({ type: "input", data: value + "\n" }));
    return true;
  }

  function attachRealForm(state, session) {
    if (session.realFormAttached) return;
    session.realFormAttached = true;

    session.form.addEventListener("submit", function (event) {
      if (!state.real || state.real.status !== "connected") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var value = session.input.value;
      session.input.value = "";
      sendRealCommand(state, session, value);
    }, true);

    session.input.addEventListener("paste", function (event) {
      if (!state.real || state.real.status !== "connected") return;
      var textValue = (event.clipboardData || window.clipboardData).getData("text");
      if (!textValue || textValue.indexOf("\n") === -1) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      session.input.value = "";
      textValue.replace(/\r/g, "").split("\n").forEach(function (line) {
        if (line.trim()) sendRealCommand(state, session, line);
      });
    }, true);
  }

  function connectLocalRunner(state) {
    if (!window.fetch || !window.WebSocket || !isLocalRunnerCandidate()) return;

    var main = state.sessions[0];
    attachRealForm(state, main);
    state.real = { status: "checking" };
    setRunnerStatus(state, "Docker local: verification...");

    fetch("/api/labs/health", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("API Docker locale indisponible");
        return response.json();
      })
      .then(function (health) {
        if (!health.docker) throw new Error(health.error || "Docker n'est pas accessible");
        if (!health.image) {
          throw new Error("Image absente. Lancez: docker build -t " + health.imageName + " lab-runner/images/dev-box");
        }
        state.real.status = "creating";
        setRunnerStatus(state, "Docker local: creation de la VM...");
        return fetch("/api/labs/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ labId: currentLabId() })
        });
      })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (body) {
            throw new Error(body.error || "Creation de session impossible");
          });
        }
        return response.json();
      })
      .then(function (sessionInfo) {
        var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        var socket = new WebSocket(protocol + "//" + window.location.host + sessionInfo.wsUrl);
        state.real = { status: "connecting", socket: socket, session: sessionInfo };
        setRunnerStatus(state, "Docker local: connexion au shell...");

        socket.addEventListener("message", function (event) {
          var body;
          try { body = JSON.parse(event.data); } catch (error) { body = { type: "output", data: event.data }; }

          if (body.type === "ready") {
            state.real.status = "connected";
            main.output.innerHTML = "";
            setRunnerStatus(state, "Docker local connecte — vraie VM d'exercice");
            appendRaw(main.output, "Session Docker locale connectee.\n");
            appendRaw(main.output, "Tapez vos commandes ci-dessous. La session expire automatiquement.\n\n");
            main.input.focus();
            return;
          }

          if (body.type === "output") {
            appendRaw(main.output, body.data);
            return;
          }

          if (body.type === "error") {
            print(main.output, body.message || "Erreur runner Docker", "line-error");
            return;
          }

          if (body.type === "exit") {
            state.real.status = "closed";
            setRunnerStatus(state, "Docker local: shell ferme");
          }
        });

        socket.addEventListener("close", function () {
          if (state.real && state.real.status === "connected") {
            state.real.status = "closed";
            setRunnerStatus(state, "Docker local: deconnecte");
          }
        });

        window.addEventListener("beforeunload", function () {
          if (state.real && state.real.session) {
            fetch("/api/labs/sessions/" + encodeURIComponent(state.real.session.id), {
              method: "DELETE",
              keepalive: true
            }).catch(function () {});
          }
        });
      })
      .catch(function (error) {
        state.real = { status: "unavailable" };
        setRunnerStatus(state, "Mode simulateur — Docker local non connecte");
        print(main.output, "Runner Docker local indisponible: " + (error.message || error), "line-warn");
      });
  }

  function runScratchCommand(state, session, command) {
    var output = session.output;
    var cmd = command.trim();

    if (!cmd) return;
    session.history.push(cmd);

    if (cmd === "clear") {
      output.innerHTML = "";
      return;
    }

    if (cmd === "help") {
      printBlock(output, [
        "Commandes disponibles dans cette session:",
        "  help                 afficher cette aide",
        "  history              afficher l'historique local",
        "  clear                vider ce terminal",
        "  whoami               afficher l'utilisateur",
        "  pwd                  afficher le repertoire courant",
        "  date                 afficher l'heure locale",
        "  echo <texte>         afficher un texte",
        "  check                utiliser Terminal 1 pour la validation du lab"
      ], "line-muted");
      return;
    }

    if (cmd === "history") {
      if (!session.history.length) {
        print(output, "Aucune commande dans l'historique.", "line-muted");
        return;
      }
      session.history.forEach(function (item, index) {
        print(output, String(index + 1).padStart(3, " ") + "  " + item, "line-muted");
      });
      return;
    }

    if (cmd === "whoami") {
      print(output, state.promptText.split("@")[0].replace(/^\([^)]+\)\s*/, "") || "dev");
      return;
    }

    if (cmd === "pwd") {
      print(output, "/home/" + (state.promptText.split("@")[0].replace(/^\([^)]+\)\s*/, "") || "dev"));
      return;
    }

    if (cmd === "date") {
      print(output, new Date().toLocaleString());
      return;
    }

    if (cmd.indexOf("echo ") === 0) {
      print(output, cmd.slice(5));
      return;
    }

    if (cmd === "check") {
      print(output, "La verification du lab reste connectee au Terminal 1.", "line-warn");
      return;
    }

    print(output, "Session auxiliaire: utilisez Terminal 1 pour executer les commandes guidees du lab.", "line-warn");
  }

  function createScratchSession(state) {
    var id = state.nextId++;
    var pane = text("div", "ubuntu-terminal__pane");
    pane.dataset.sessionId = String(id);

    var output = text("div", "ubuntu-terminal__output");
    output.setAttribute("aria-live", "polite");

    var form = text("form", "ubuntu-terminal__inputbar");
    var prompt = text("span", "ubuntu-terminal__prompt", state.promptText);
    var input = text("input", "ubuntu-terminal__input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Terminal command");
    input.placeholder = "Tapez une commande...";

    form.append(prompt, input);
    pane.append(output, form);
    state.body.appendChild(pane);

    var session = {
      id: id,
      pane: pane,
      output: output,
      form: form,
      input: input,
      history: []
    };

    makeTab(state, session);
    state.sessions.push(session);

    print(output, "Terminal " + id + " pret. Tapez `help` pour les commandes locales.", "line-muted");
    print(output, state.promptText, "line-cmd");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value;
      print(output, state.promptText + " " + value, "line-cmd");
      input.value = "";
      runScratchCommand(state, session, value);
    });

    if (state.sessions.length >= MAX_SESSIONS) {
      state.add.disabled = true;
    }

    return session;
  }

  function enhanceTerminal(view) {
    if (view.dataset.ubuntuTerminalEnhanced === "true") return;

    var output = view.querySelector(".terminal-output");
    var form = view.querySelector(".terminal-inputbar");
    var input = form ? form.querySelector(".terminal-input") : null;
    if (!output || !form || !input) return;

    var promptText = getPrompt(view);
    var shell = buildShell(promptText);
    var mainPane = text("div", "ubuntu-terminal__pane is-active");
    mainPane.dataset.sessionId = "1";

    mainPane.append(output, form);
    shell.body.appendChild(mainPane);

    view.dataset.ubuntuTerminalEnhanced = "true";
    view.classList.add("ubuntu-terminal-enhanced");
    view.replaceChildren(shell.root);

    var state = {
      root: shell.root,
      tabs: shell.tabs,
      add: shell.add,
      body: shell.body,
      statusTip: shell.statusTip,
      promptText: promptText,
      activeId: 1,
      nextId: 2,
      sessions: [{
        id: 1,
        pane: mainPane,
        output: output,
        form: form,
        input: input,
        history: []
      }]
    };

    makeTab(state, state.sessions[0]);
    activateSession(state, 1);
    connectLocalRunner(state);

    shell.add.addEventListener("click", function () {
      if (state.sessions.length >= MAX_SESSIONS) return;
      var session = createScratchSession(state);
      activateSession(state, session.id);
    });
  }

  onReady(function () {
    document.querySelectorAll(".terminal-view").forEach(enhanceTerminal);
    document.querySelectorAll(".instructions .step.is-open, .instructions__body .step.is-open").forEach(function (step) {
      step.classList.remove("is-open");
    });
  });
})();
