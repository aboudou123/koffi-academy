/* ============================================================================
   Koffi Academy — Lab VM
   A small but real in-browser shell backed by an in-memory virtual filesystem.

   It exists so the public labs (served statically on one.com, with no backend)
   behave like a genuine Ubuntu shell: mkdir / cd / ls / cat / touch / rm /
   echo / here-documents / chmod / tree all really mutate a filesystem instead
   of being scripted no-ops.

   A lab page creates one VM, seeds its filesystem, registers a few lab-specific
   commands (source / python / check ...) and wires the terminal form to it.
   The Docker-backed "real lab" path in terminal-manager.js is unaffected.

   Public API:
     var vm = LabVM.create({
       user, host, home,            // identity + starting directory
       print: fn(text, className),  // write a line to the terminal
       clear: fn(),                 // wipe the terminal output
       prompt: fn(vm),              // optional: build the base prompt string
       commands: { name: fn(ctx) }, // optional: lab-specific commands
       onChange: fn(vm)             // called after any filesystem mutation
     });
     vm.submit(line)   // run one typed line (heredoc-aware)
     vm.paste(text)    // run a pasted multi-line block (heredoc-aware)
     vm.promptText()   // current prompt (accounts for here-doc + cwd)
     vm.fs.read / write / exists / isDir / mkdirp / rm / ls / resolve
   ============================================================================ */
(function () {
  "use strict";

  function now() { return Date.now(); }

  /* ---------------------------------------------------------------- editor helpers */
  function mk(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function countLines(v) {
    if (v === "") return 0;
    var n = v.split("\n").length;
    if (v.charAt(v.length - 1) === "\n") n--;
    return n;
  }

  function posToLineCol(v, pos) {
    var before = v.slice(0, pos);
    return { line: before.split("\n").length, col: pos - before.lastIndexOf("\n") };
  }

  function lineColToPos(v, line, col) {
    var lines = v.split("\n");
    line = Math.max(1, Math.min(line, lines.length));
    var pos = 0;
    for (var i = 0; i < line - 1; i++) pos += lines[i].length + 1;
    var maxc = (lines[line - 1] || "").length + 1;
    col = Math.max(1, Math.min(col || 1, maxc));
    return pos + col - 1;
  }

  /* Locate the terminal container to overlay the editor on. When a command is
     submitted the terminal input still has focus, so its ancestor pane is the
     right target; fall back to the active pane / first terminal view. */
  function findEditorHost() {
    var active = document.activeElement;
    var host = active && active.closest ? active.closest(".ubuntu-terminal__pane, .terminal-view") : null;
    if (!host) host = document.querySelector(".ubuntu-terminal__pane.is-active") || document.querySelector(".terminal-view");
    return host;
  }

  var NANO_BAR = [
    ["^G", "Help"], ["^O", "Write Out"], ["^W", "Where Is"], ["^K", "Cut"],
    ["^C", "Location"], ["^X", "Exit"], ["^R", "Read File"], ["^\\", "Replace"],
    ["^U", "Paste"], ["^J", "Justify"], ["^/", "Go To Line"], ["^T", "Execute"],
    ["M-U", "Undo"], ["M-E", "Redo"], ["M-6", "Copy"], ["^A/^E", "Line Start/End"]
  ];

  var NANO_HELP = [
    "GNU nano — Kurzhilfe / aide-mémoire",
    "",
    "  ^O  Datei speichern (Write Out) — fragt den Dateinamen, Enter bestätigt",
    "  ^X  Editor verlassen (Exit) — fragt bei ungespeicherten Änderungen nach",
    "  ^W  Suchen (Where Is) — springt zum nächsten Treffer",
    "  ^\\  Suchen und Ersetzen (Replace) — ersetzt alle Vorkommen",
    "  ^K  Aktuelle Zeile / Auswahl ausschneiden (Cut)",
    "  ^U  Ausgeschnittenen Text einfügen (Paste)",
    "  M-6 Auswahl kopieren (Copy)     M-U Rückgängig     M-E Wiederholen",
    "  ^C  Cursorposition anzeigen (Location)",
    "  ^/  Zu Zeile springen (Go To Line)",
    "  ^R  Andere Datei an Cursor einfügen (Read File)",
    "  ^J  Absatz umbrechen (Justify)",
    "  ^A / ^E  Zeilenanfang / Zeilenende",
    "  Pfeiltasten, Pos1/Ende, Bild auf/ab, Tab, Backspace: wie gewohnt",
    "",
    "  Diese Hilfe schließen: ^X oder Esc"
  ].join("\n");

  function ensureNanoStyle() {
    if (document.getElementById("labvm-nano-style")) return;
    var css = ""
      + ".labvm-nano{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;background:#0d0f12;color:#e8edf2;font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;line-height:1.5}"
      + ".labvm-nano__title{display:flex;align-items:center;gap:16px;background:#e8edf2;color:#0d0f12;padding:4px 12px;font-weight:600;flex:0 0 auto}"
      + ".labvm-nano__title .t-file{flex:1;text-align:center;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".labvm-nano__title .t-mod{min-width:72px;text-align:right}"
      + ".labvm-nano__area{flex:1 1 auto;min-height:0;width:100%;box-sizing:border-box;border:0;outline:0;resize:none;background:transparent;color:inherit;font:inherit;line-height:1.5;padding:8px 12px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;tab-size:2}"
      + ".labvm-nano__msg{flex:0 0 auto;min-height:20px;text-align:center;padding:2px 12px;color:#0d0f12}"
      + ".labvm-nano__msg.show{background:#e8edf2}"
      + ".labvm-nano__prompt{display:none;align-items:center;gap:8px;padding:3px 12px;background:#e8edf2;color:#0d0f12;flex:0 0 auto}"
      + ".labvm-nano__prompt.show{display:flex}"
      + ".labvm-nano__prompt label{white-space:nowrap;font-weight:600}"
      + ".labvm-nano__prompt input{flex:1;min-width:0;border:0;outline:0;background:#fff;color:#0d0f12;font:inherit;padding:2px 6px}"
      + ".labvm-nano__bar{display:grid;grid-template-columns:repeat(2,1fr);gap:0 20px;padding:4px 12px 8px;flex:0 0 auto}"
      + "@media(min-width:720px){.labvm-nano__bar{grid-template-columns:repeat(4,1fr)}}"
      + ".labvm-nano__bar .k{display:flex;gap:8px;padding:1px 0;align-items:center}"
      + ".labvm-nano__bar .k b{background:#e8edf2;color:#0d0f12;padding:0 4px;font-weight:600;white-space:nowrap}"
      + ".labvm-nano__bar .k span{color:#e8edf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + ".labvm-nano__help{position:absolute;inset:0;z-index:70;background:#0d0f12;color:#e8edf2;padding:16px 20px;overflow:auto;white-space:pre-wrap;font:inherit;line-height:1.6}";
    var style = document.createElement("style");
    style.id = "labvm-nano-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------------------- apt catalog */
  /* Packages that, once installed with `apt install`, unlock a real command. */
  var GATED_PKG = {
    cowsay: "cowsay", figlet: "figlet", fortune: "fortune", "fortune-mod": "fortune",
    sl: "sl", neofetch: "neofetch", jq: "jq", htop: "htop", bat: "bat", batcat: "bat",
    lolcat: "lolcat", toilet: "figlet"
  };
  /* Packages that install successfully but add no new command (already present or a lib). */
  var KNOWN_PKG = {
    curl: 1, wget: 1, git: 1, vim: 1, nano: 1, tree: 1, "build-essential": 1, gcc: 1, make: 1,
    "net-tools": 1, dnsutils: 1, iputils: "iputils-ping", "iputils-ping": 1, unzip: 1, zip: 1,
    tmux: 1, screen: 1, nmap: 1, "python3": 1, "python3-pip": 1, "python-is-python3": 1,
    nodejs: 1, npm: 1, "docker.io": 1, "docker-ce": 1, kubectl: 1, jq: 1, ripgrep: 1, fd: 1,
    ncdu: 1, rsync: 1, openssh_client: 1, "openssh-client": 1, ca_certificates: 1,
    "ca-certificates": 1, gnupg: 1, software_properties_common: 1, ansible: 1, terraform: 1,
    postgresql_client: 1, "postgresql-client": 1, "mysql-client": 1, redis_tools: 1
  };
  var FORTUNES = [
    "Der beste Weg, die Zukunft vorherzusagen, ist, sie zu gestalten.",
    "Es gibt nur zwei schwierige Probleme in der Informatik: Cache-Invalidierung und Namensgebung.",
    "Ein Experte ist jemand, der alle Fehler kennt, die man auf einem sehr engen Gebiet machen kann.",
    "Zuerst loesen wir das Problem. Dann schreiben wir den Code.",
    "Wer aufhoert zu lernen, ist alt, ob mit zwanzig oder mit achtzig.",
    "Programmieren ist der Prozess, ein zwei Personen umfassendes Problem mit vier Personen ueber sechs Monate zu loesen."
  ];

  /* ---------------------------------------------------------------- filesystem */
  function createFS(home) {
    var root = { type: "dir", children: {}, mtime: now() };

    function splitAbs(abs) {
      var parts = abs.split("/");
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var seg = parts[i];
        if (seg === "" || seg === ".") continue;
        if (seg === "..") { out.pop(); continue; }
        out.push(seg);
      }
      return out;
    }

    function resolve(path, cwd) {
      var raw = String(path == null ? "" : path).trim();
      var base;
      if (raw === "" ) { base = cwd; raw = ""; }
      if (raw.charAt(0) === "/") base = "";
      else if (raw === "~" || raw.indexOf("~/") === 0) { base = ""; raw = home + raw.slice(1); }
      else base = cwd;
      var combined = (base === "" ? "" : base) + "/" + raw;
      var parts = splitAbs(combined);
      return "/" + parts.join("/");
    }

    function nodeAt(abs) {
      if (abs === "/") return root;
      var parts = splitAbs(abs);
      var node = root;
      for (var i = 0; i < parts.length; i++) {
        if (!node || node.type !== "dir") return null;
        node = node.children[parts[i]];
        if (!node) return null;
      }
      return node || null;
    }

    function dirname(abs) {
      var parts = splitAbs(abs);
      parts.pop();
      return "/" + parts.join("/");
    }
    function basename(abs) {
      var parts = splitAbs(abs);
      return parts.length ? parts[parts.length - 1] : "";
    }

    function mkdirp(abs) {
      var parts = splitAbs(abs);
      var node = root;
      for (var i = 0; i < parts.length; i++) {
        if (node.type !== "dir") return false;
        var name = parts[i];
        if (!node.children[name]) node.children[name] = { type: "dir", children: {}, mtime: now() };
        node = node.children[name];
      }
      return node.type === "dir";
    }

    function writeFile(abs, content, opts) {
      opts = opts || {};
      var parentPath = dirname(abs);
      var parent = nodeAt(parentPath);
      if (!parent) {
        if (opts.makeParents) { mkdirp(parentPath); parent = nodeAt(parentPath); }
        else return { error: "no-parent", path: parentPath };
      }
      if (parent.type !== "dir") return { error: "not-a-dir", path: parentPath };
      var name = basename(abs);
      var existing = parent.children[name];
      if (existing && existing.type === "dir") return { error: "is-a-dir", path: abs };
      var body = String(content == null ? "" : content);
      if (opts.append && existing && existing.type === "file") body = existing.content + body;
      parent.children[name] = {
        type: "file",
        content: body,
        exec: existing ? existing.exec : false,
        mtime: now()
      };
      return { ok: true };
    }

    function touch(abs) {
      var node = nodeAt(abs);
      if (node) { node.mtime = now(); return { ok: true }; }
      return writeFile(abs, "", {});
    }

    function remove(abs, opts) {
      opts = opts || {};
      if (abs === "/" || abs === home) return { error: "refuse", path: abs };
      var node = nodeAt(abs);
      if (!node) return { error: "missing", path: abs };
      if (node.type === "dir") {
        var hasChildren = Object.keys(node.children).length > 0;
        if (hasChildren && !opts.recursive) return { error: "is-a-dir", path: abs };
      }
      var parent = nodeAt(dirname(abs));
      if (!parent) return { error: "missing", path: abs };
      delete parent.children[basename(abs)];
      return { ok: true };
    }

    function list(abs) {
      var node = nodeAt(abs);
      if (!node) return { error: "missing" };
      if (node.type === "file") return { entries: [{ name: basename(abs), node: node }], single: true };
      var names = Object.keys(node.children).sort();
      return {
        entries: names.map(function (n) { return { name: n, node: node.children[n] }; })
      };
    }

    return {
      home: home,
      root: root,
      resolve: resolve,
      nodeAt: nodeAt,
      dirname: dirname,
      basename: basename,
      mkdirp: mkdirp,
      writeFile: writeFile,
      touch: touch,
      remove: remove,
      list: list,
      exists: function (abs) { return nodeAt(abs) !== null; },
      isDir: function (abs) { var n = nodeAt(abs); return !!n && n.type === "dir"; },
      isFile: function (abs) { var n = nodeAt(abs); return !!n && n.type === "file"; },
      read: function (abs) { var n = nodeAt(abs); return n && n.type === "file" ? n.content : null; }
    };
  }

  /* ---------------------------------------------------------------- tokenizer */
  function tokenize(line) {
    var tokens = [];
    var cur = "";
    var quote = null;
    var had = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (quote) {
        if (ch === quote) { quote = null; }
        else cur += ch;
        had = true;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; had = true; continue; }
      if (ch === " " || ch === "\t") {
        if (had) { tokens.push(cur); cur = ""; had = false; }
        continue;
      }
      cur += ch; had = true;
    }
    if (had) tokens.push(cur);
    return tokens;
  }

  /* Extract a `>file` / `>>file` redirection from a token list. Stderr
     redirections (2>, 2>>, &>, 2>&1) are recognised and dropped so they do not
     get misparsed as arguments. */
  function extractRedirect(tokens) {
    var out = { tokens: [], redirect: null };
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk === "2>&1" || tk === "1>&2" || tk === ">&2") { continue; }
      if (tk === "2>" || tk === "2>>" || tk === "&>" || tk === "&>>") { i++; continue; }
      if (/^2>>?/.test(tk)) { continue; }
      if (tk === ">" || tk === ">>" || tk === "1>" || tk === "1>>") {
        out.redirect = { append: tk === ">>" || tk === "1>>", target: tokens[i + 1] || "" };
        i++;
        continue;
      }
      if (tk.charAt(0) === ">") {
        var app = tk.charAt(1) === ">";
        out.redirect = { append: app, target: tk.slice(app ? 2 : 1) };
        continue;
      }
      if (tk.charAt(0) === "1" && tk.charAt(1) === ">") {
        var app1 = tk.charAt(2) === ">";
        out.redirect = { append: app1, target: tk.slice(app1 ? 3 : 2) };
        continue;
      }
      out.tokens.push(tk);
    }
    return out;
  }

  /* ---------------------------------------------------------------- the VM */
  function create(config) {
    config = config || {};
    var user = config.user || "koffi";
    var host = config.host || "lab";
    var home = config.home || ("/home/" + user);
    var fs = createFS(home);
    fs.mkdirp(home);

    var vm = {
      user: user,
      host: host,
      home: home,
      fs: fs,
      cwd: home,
      env: { venv: false, installed: {} },
      heredoc: null
    };

    var sink = null; // when set (an array), command stdout is captured into it
    var stageError = false; // set by emit() when a command prints an error (for && / ||)
    function emit(text, cls) {
      if (cls === "line-error") stageError = true;
      if (sink) { sink.push(text == null ? "" : String(text)); return; }
      if (config.print) config.print(text, cls);
    }
    function changed() { if (config.onChange) config.onChange(vm); }

    function displayCwd() {
      if (vm.cwd === home) return "~";
      if (vm.cwd.indexOf(home + "/") === 0) return "~" + vm.cwd.slice(home.length);
      return vm.cwd;
    }
    vm.displayCwd = displayCwd;

    function basePrompt() {
      if (config.prompt) return config.prompt(vm);
      return (vm.env.venv ? "(venv) " : "") + user + "@" + host + ":" + displayCwd() + "$";
    }
    vm.promptText = function () { return vm.heredoc ? ">" : basePrompt(); };

    /* ---- built-in commands. Each returns nothing; prints via emit. ---- */
    var builtins = {};

    builtins.pwd = function () { emit(vm.cwd); };
    builtins.whoami = function () { emit(user); };
    builtins.date = function () { emit(new Date().toString()); };
    builtins.uname = function (ctx) { emit(ctx.args.indexOf("-a") !== -1 ? "Linux " + host + " 6.8.0 x86_64 GNU/Linux" : "Linux"); };
    builtins.clear = function () { if (config.clear) config.clear(); };

    builtins.cd = function (ctx) {
      var target = ctx.args[0];
      var abs = (!target || target === "~") ? home : fs.resolve(target, vm.cwd);
      if (!fs.exists(abs)) { emit("cd: " + target + ": No such file or directory", "line-error"); return; }
      if (!fs.isDir(abs)) { emit("cd: " + target + ": Not a directory", "line-error"); return; }
      vm.cwd = abs;
    };

    builtins.mkdir = function (ctx) {
      var p = ctx.flags.indexOf("p") !== -1;
      if (!ctx.operands.length) { emit("mkdir: missing operand", "line-error"); return; }
      ctx.operands.forEach(function (operand) {
        var abs = fs.resolve(operand, vm.cwd);
        if (fs.exists(abs)) { if (!p) emit("mkdir: cannot create directory '" + operand + "': File exists", "line-error"); return; }
        if (p) { fs.mkdirp(abs); }
        else {
          var parent = fs.nodeAt(fs.dirname(abs));
          if (!parent || parent.type !== "dir") { emit("mkdir: cannot create directory '" + operand + "': No such file or directory", "line-error"); return; }
          fs.mkdirp(abs);
        }
      });
      changed();
    };

    builtins.rmdir = function (ctx) {
      ctx.operands.forEach(function (operand) {
        var abs = fs.resolve(operand, vm.cwd);
        var r = fs.remove(abs, { recursive: false });
        if (r.error === "is-a-dir") emit("rmdir: failed to remove '" + operand + "': Directory not empty", "line-error");
        else if (r.error) emit("rmdir: failed to remove '" + operand + "': No such file or directory", "line-error");
      });
      changed();
    };

    builtins.rm = function (ctx) {
      var rec = ctx.flags.indexOf("r") !== -1 || ctx.flags.indexOf("R") !== -1;
      var force = ctx.flags.indexOf("f") !== -1;
      if (!ctx.operands.length && !force) { emit("rm: missing operand", "line-error"); return; }
      ctx.operands.forEach(function (operand) {
        var abs = fs.resolve(operand, vm.cwd);
        var r = fs.remove(abs, { recursive: rec });
        if (r.error === "missing") { if (!force) emit("rm: cannot remove '" + operand + "': No such file or directory", "line-error"); }
        else if (r.error === "is-a-dir") emit("rm: cannot remove '" + operand + "': Is a directory", "line-error");
        else if (r.error === "refuse") emit("rm: refusing to remove '" + operand + "'", "line-error");
      });
      changed();
    };

    builtins.touch = function (ctx) {
      if (!ctx.operands.length) { emit("touch: missing file operand", "line-error"); return; }
      ctx.operands.forEach(function (operand) { fs.touch(fs.resolve(operand, vm.cwd)); });
      changed();
    };

    builtins.chmod = function (ctx) {
      if (ctx.operands.length < 2) { emit("chmod: missing operand", "line-error"); return; }
      var mode = ctx.operands[0];
      var execBit = /x/.test(mode) || /[1357]/.test(mode);
      ctx.operands.slice(1).forEach(function (operand) {
        var abs = fs.resolve(operand, vm.cwd);
        var node = fs.nodeAt(abs);
        if (!node) { emit("chmod: cannot access '" + operand + "': No such file or directory", "line-error"); return; }
        node.exec = execBit;
      });
      changed();
    };

    function lsFormatLong(entry) {
      var n = entry.node;
      var dir = n.type === "dir";
      var perm = dir ? "drwxr-xr-x" : (n.exec ? "-rwxr-xr-x" : "-rw-r--r--");
      var size = dir ? 4096 : (n.content ? n.content.length : 0);
      var name = entry.name + (dir ? "/" : "");
      return perm + " 1 " + user + " " + user + " " + String(size) + " " + name;
    }

    builtins.ls = function (ctx) {
      var long = ctx.flags.indexOf("l") !== -1;
      var all = ctx.flags.indexOf("a") !== -1;
      var targets = ctx.operands.length ? ctx.operands : ["."];
      targets.forEach(function (operand, idx) {
        var abs = fs.resolve(operand, vm.cwd);
        var r = fs.list(abs);
        if (r.error) { emit("ls: cannot access '" + operand + "': No such file or directory", "line-error"); return; }
        if (targets.length > 1 && !r.single) emit(operand + ":");
        var entries = r.entries.slice();
        if (all && !r.single) {
          entries = [{ name: ".", node: { type: "dir", children: {} } }, { name: "..", node: { type: "dir", children: {} } }].concat(entries);
        }
        if (long) {
          if (!r.single) emit("total " + entries.length);
          entries.forEach(function (e) { emit(lsFormatLong(e)); });
        } else {
          var names = entries.map(function (e) { return e.name + (e.node.type === "dir" ? "/" : ""); });
          if (names.length) emit(names.join("   "));
        }
        if (targets.length > 1 && idx < targets.length - 1) emit("");
      });
    };

    /* Split a text blob into lines (drops a single trailing newline). */
    function splitLines(text) {
      if (text == null) return [];
      var t = String(text);
      if (t === "") return [];
      return t.replace(/\n$/, "").split("\n");
    }
    /* Read a command's input: from file operands if given, else from stdin. */
    function readInput(ctx, files) {
      if (files && files.length) {
        var acc = [];
        files.forEach(function (f) {
          if (f === "-") { if (ctx.stdin != null) acc.push(String(ctx.stdin).replace(/\n$/, "")); return; }
          var c = fs.read(fs.resolve(f, vm.cwd));
          if (c == null) emit(ctx.head + ": " + f + ": No such file or directory", "line-error");
          else acc.push(c.replace(/\n$/, ""));
        });
        return acc.join("\n");
      }
      return ctx.stdin != null ? String(ctx.stdin).replace(/\n$/, "") : "";
    }
    /* Recurse a directory, calling cb(path, content) for every file. */
    function walkFiles(absDir, cb) {
      var node = fs.nodeAt(absDir);
      if (!node) return;
      (function rec(n, path) {
        if (n.type === "file") { cb(path, n.content); return; }
        Object.keys(n.children).sort().forEach(function (name) { rec(n.children[name], path + "/" + name); });
      })(node, absDir);
    }

    builtins.cat = function (ctx) {
      var files = ctx.operands.slice();
      var number = ctx.flags.indexOf("n") !== -1;
      var text;
      if (files.length) {
        var parts = [], any = false;
        files.forEach(function (operand) {
          if (operand === "-") { if (ctx.stdin != null) { parts.push(String(ctx.stdin).replace(/\n$/, "")); any = true; } return; }
          var node = fs.nodeAt(fs.resolve(operand, vm.cwd));
          if (!node) { emit("cat: " + operand + ": No such file or directory", "line-error"); return; }
          if (node.type === "dir") { emit("cat: " + operand + ": Is a directory", "line-error"); return; }
          parts.push(node.content.replace(/\n$/, "")); any = true;
        });
        if (!any) return;
        text = parts.join("\n");
      } else {
        if (ctx.stdin == null) { emit("cat: missing file operand", "line-error"); return; }
        text = String(ctx.stdin).replace(/\n$/, "");
      }
      if (number) { splitLines(text).forEach(function (l, i) { emit(String(i + 1).padStart(6, " ") + "\t" + l); }); }
      else splitLines(text).forEach(function (l) { emit(l); });
    };

    builtins.echo = function (ctx) {
      var args = ctx.args.slice(), noNL = false, interp = false;
      while (args.length && /^-(n|e|ne|en)$/.test(args[0])) {
        if (args[0].indexOf("n") >= 0) noNL = true;
        if (args[0].indexOf("e") >= 0) interp = true;
        args.shift();
      }
      var s = args.join(" ");
      if (interp) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
      splitLines(s + "\n").forEach(function (l) { emit(l); });
    };

    builtins.head = function (ctx) { headTail(ctx, true); };
    builtins.tail = function (ctx) { headTail(ctx, false); };
    function headTail(ctx, head) {
      var n = 10, ops = ctx.operands.slice();
      var ni = ctx.args.indexOf("-n");
      if (ni !== -1 && ctx.args[ni + 1]) { n = parseInt(ctx.args[ni + 1], 10) || 10; ops = ops.filter(function (o) { return o !== String(n); }); }
      ctx.args.forEach(function (a) { var m = a.match(/^-(\d+)$/); if (m) n = parseInt(m[1], 10); });
      var text;
      if (ops.length) {
        var content = fs.read(fs.resolve(ops[0], vm.cwd));
        if (content == null) { emit((head ? "head" : "tail") + ": cannot open '" + ops[0] + "' for reading: No such file or directory", "line-error"); return; }
        text = content;
      } else text = ctx.stdin != null ? String(ctx.stdin) : "";
      var lines = splitLines(text);
      var slice = head ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
      slice.forEach(function (l) { emit(l); });
    }

    builtins.wc = function (ctx) {
      var files = ctx.operands.slice();
      var showL = ctx.flags.indexOf("l") !== -1, showW = ctx.flags.indexOf("w") !== -1, showC = ctx.flags.indexOf("c") !== -1;
      if (!showL && !showW && !showC) { showL = showW = showC = true; }
      function counts(text) {
        var t = String(text);
        return { lines: splitLines(t).length, words: t.trim() === "" ? 0 : t.trim().split(/\s+/).length, chars: t.length };
      }
      function fmt(c, name) {
        var out = [];
        if (showL) out.push(String(c.lines).padStart(showL && showW ? 7 : 0, " "));
        if (showW) out.push(String(c.words).padStart(7, " "));
        if (showC) out.push(String(c.chars).padStart(7, " "));
        return out.join(" ") + (name ? " " + name : "");
      }
      if (files.length) {
        var tot = { lines: 0, words: 0, chars: 0 };
        files.forEach(function (f) {
          var c = fs.read(fs.resolve(f, vm.cwd));
          if (c == null) { emit("wc: " + f + ": No such file or directory", "line-error"); return; }
          var cc = counts(c); tot.lines += cc.lines; tot.words += cc.words; tot.chars += cc.chars;
          emit(fmt(cc, f));
        });
        if (files.length > 1) emit(fmt(tot, "total"));
      } else emit(fmt(counts(ctx.stdin != null ? ctx.stdin : ""), "").trim());
    };

    builtins.tree = function (ctx) {
      var start = ctx.operands[0] ? fs.resolve(ctx.operands[0], vm.cwd) : vm.cwd;
      var node = fs.nodeAt(start);
      if (!node) { emit("tree: " + (ctx.operands[0] || start) + ": No such file or directory", "line-error"); return; }
      emit(ctx.operands[0] || ".");
      var counts = { dirs: 0, files: 0 };
      (function walk(n, prefix) {
        if (n.type !== "dir") return;
        var names = Object.keys(n.children).sort();
        names.forEach(function (name, i) {
          var child = n.children[name];
          var last = i === names.length - 1;
          emit(prefix + (last ? "└── " : "├── ") + name + (child.type === "dir" ? "/" : ""));
          if (child.type === "dir") { counts.dirs++; walk(child, prefix + (last ? "    " : "│   ")); }
          else counts.files++;
        });
      })(node, "");
      emit("");
      emit(counts.dirs + " directories, " + counts.files + " files");
    };

    builtins.mv = function (ctx) { copyMove(ctx, true); };
    builtins.cp = function (ctx) { copyMove(ctx, false); };
    function copyMove(ctx, move) {
      if (ctx.operands.length < 2) { emit((move ? "mv" : "cp") + ": missing destination file operand", "line-error"); return; }
      var srcAbs = fs.resolve(ctx.operands[0], vm.cwd);
      var src = fs.nodeAt(srcAbs);
      if (!src) { emit((move ? "mv" : "cp") + ": cannot stat '" + ctx.operands[0] + "': No such file or directory", "line-error"); return; }
      var dstAbs = fs.resolve(ctx.operands[1], vm.cwd);
      if (fs.isDir(dstAbs)) dstAbs = (dstAbs === "/" ? "" : dstAbs) + "/" + fs.basename(srcAbs);
      if (src.type === "dir" && !move && ctx.flags.indexOf("r") === -1 && ctx.flags.indexOf("R") === -1) {
        emit("cp: -r not specified; omitting directory '" + ctx.operands[0] + "'", "line-error"); return;
      }
      cloneInto(srcAbs, dstAbs);
      if (move) fs.remove(srcAbs, { recursive: true });
      changed();
    }
    function cloneInto(srcAbs, dstAbs) {
      var src = fs.nodeAt(srcAbs);
      if (!src) return;
      if (src.type === "file") { fs.writeFile(dstAbs, src.content, { makeParents: true }); var d = fs.nodeAt(dstAbs); if (d) d.exec = src.exec; return; }
      fs.mkdirp(dstAbs);
      Object.keys(src.children).forEach(function (name) { cloneInto(srcAbs + "/" + name, dstAbs + "/" + name); });
    }

    builtins.help = function () {
      emit("Verfügbare Befehle / commandes / commands:", "line-muted");
      emit("  pwd  cd  ls [-la]  mkdir [-p]  rmdir  rm [-rf]  touch  cat", "line-muted");
      emit("  echo [> file]  cat > file << EOF … EOF  chmod  mv  cp  tree  wc  head  tail", "line-muted");
      emit("  grep  find  sort  uniq  sed  awk  cut  tr  tee  xargs   (mit Pipes: cmd | cmd)", "line-muted");
      emit("  Verkettung: cmd1 && cmd2 ; cmd3 || cmd4   Umleitung: > >> 2>/dev/null", "line-muted");
      emit("  sudo <cmd>   apt update / apt install <paket> / apt list", "line-muted");
      emit("  clear  whoami  date  uname  help", "line-muted");
      emit("  nano / vi / vim <fichier>   Editor: bearbeiten + speichern (^O), verlassen (^X)", "line-muted");
      if (config.commands) {
        var extra = Object.keys(config.commands);
        if (extra.length) emit("  " + extra.join("  "), "line-muted");
      }
    };

    /* ---- nano-style full-screen editor (nano / vi / vim / edit) ---- */
    function openNano(ctx) {
      ensureNanoStyle();
      var host = findEditorHost();
      if (!host) { emit("nano: kann das Terminal nicht finden", "line-error"); return; }

      var curName = (ctx.operands && ctx.operands[0]) || "";
      var abs = curName ? fs.resolve(curName, vm.cwd) : null;
      if (abs && fs.isDir(abs)) { emit("nano: " + curName + ": Is a directory", "line-error"); return; }
      var existed = !!(abs && fs.isFile(abs));
      var content = existed ? (fs.read(abs) || "") : "";

      var termInput = host.querySelector(".terminal-input, .ubuntu-terminal__input");
      var prevPos = host.style.position;
      if (window.getComputedStyle(host).position === "static") host.style.position = "relative";

      var modified = false, cutbuffer = "", lastSearch = "", mode = "normal", promptConfirm = null, helpEl = null;

      var root = mk("div", "labvm-nano");
      var title = mk("div", "labvm-nano__title");
      var tfile = mk("span", "t-file", curName || "New Buffer");
      var tmod = mk("span", "t-mod", "");
      title.append(mk("span", "t-ver", "GNU nano 7.2"), tfile, tmod);

      var ta = mk("textarea", "labvm-nano__area");
      ta.value = content;
      ta.setAttribute("spellcheck", "false");
      ta.setAttribute("autocomplete", "off");

      var msg = mk("div", "labvm-nano__msg", "");
      var pwrap = mk("div", "labvm-nano__prompt");
      var plabel = mk("label");
      var pinput = mk("input");
      pinput.type = "text";
      pinput.autocomplete = "off";
      pwrap.append(plabel, pinput);

      var bar = mk("div", "labvm-nano__bar");
      NANO_BAR.forEach(function (it) {
        var k = mk("div", "k");
        k.append(mk("b", null, it[0]), mk("span", null, it[1]));
        bar.appendChild(k);
      });

      root.append(title, ta, msg, pwrap, bar);
      host.appendChild(root);

      function setMsg(t) { msg.textContent = t || ""; msg.classList.toggle("show", !!t); }
      function refreshTitle() { tmod.textContent = modified ? "Modified" : ""; tfile.textContent = curName || "New Buffer"; }
      function markDirty() { if (!modified) { modified = true; refreshTitle(); } }

      function ensureCaretVisible() {
        var lc = posToLineCol(ta.value, ta.selectionStart);
        var lineH = parseFloat(window.getComputedStyle(ta).lineHeight) || 18;
        var y = (lc.line - 1) * lineH;
        if (y < ta.scrollTop) ta.scrollTop = y;
        else if (y > ta.scrollTop + ta.clientHeight - lineH) ta.scrollTop = y - ta.clientHeight + lineH * 2;
      }

      function insertAtCursor(t) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        ta.value = v.slice(0, s) + t + v.slice(e);
        ta.selectionStart = ta.selectionEnd = s + t.length;
        markDirty();
        ensureCaretVisible();
      }

      function openPrompt(label, initial, onConfirm) {
        mode = "prompt";
        plabel.textContent = label;
        pinput.value = initial || "";
        pwrap.classList.add("show");
        promptConfirm = onConfirm;
        window.setTimeout(function () { pinput.focus(); pinput.select(); }, 0);
      }
      function closePrompt() { pwrap.classList.remove("show"); mode = "normal"; promptConfirm = null; }

      function destroy() {
        root.remove();
        if (prevPos) host.style.position = prevPos; else host.style.removeProperty("position");
        if (termInput) { try { termInput.focus(); } catch (_) {} }
      }

      function writeOut(after) {
        openPrompt("File Name to Write: ", curName, function (name) {
          name = (name || "").trim();
          if (!name) { setMsg("[ Cancelled ]"); ta.focus(); return; }
          var a = fs.resolve(name, vm.cwd);
          if (fs.isDir(a)) { setMsg("[ " + name + " is a directory ]"); ta.focus(); return; }
          var r = fs.writeFile(a, ta.value, { makeParents: true });
          if (r && r.error) { setMsg("[ Error writing " + name + " ]"); ta.focus(); return; }
          curName = name;
          modified = false;
          refreshTitle();
          changed();
          setMsg("[ Wrote " + countLines(ta.value) + " lines ]");
          ta.focus();
          if (after) after();
        });
      }

      function doExit() {
        if (!modified) { destroy(); return; }
        mode = "exit";
        setMsg("Save modified buffer?   Y Yes   N No   ^C Cancel");
      }

      function cutLine() {
        var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
        if (s !== e) {
          cutbuffer = v.slice(s, e);
          ta.value = v.slice(0, s) + v.slice(e);
          ta.selectionStart = ta.selectionEnd = s;
        } else {
          var ls = v.lastIndexOf("\n", s - 1) + 1;
          var le = v.indexOf("\n", s);
          if (le === -1) le = v.length;
          var end = le < v.length ? le + 1 : le;
          cutbuffer = v.slice(ls, end);
          ta.value = v.slice(0, ls) + v.slice(end);
          ta.selectionStart = ta.selectionEnd = ls;
        }
        markDirty();
        setMsg("");
      }
      function pasteBuf() { if (!cutbuffer) { setMsg("[ Cut buffer is empty ]"); return; } insertAtCursor(cutbuffer); }
      function copySel() {
        var s = ta.selectionStart, e = ta.selectionEnd;
        if (s === e) { setMsg("[ Nothing is selected ]"); return; }
        cutbuffer = ta.value.slice(s, e);
        setMsg("[ Copied selection ]");
      }

      function doSearch(term) {
        var v = ta.value, from = ta.selectionEnd;
        var idx = v.indexOf(term, from);
        if (idx === -1) idx = v.indexOf(term, 0);
        if (idx === -1) { setMsg('[ "' + term + '" not found ]'); return; }
        ta.focus();
        ta.selectionStart = idx;
        ta.selectionEnd = idx + term.length;
        ensureCaretVisible();
      }
      function openSearch() {
        openPrompt("Search: ", lastSearch, function (term) {
          term = term || lastSearch;
          if (!term) return;
          lastSearch = term;
          doSearch(term);
        });
      }
      function openReplace() {
        openPrompt("Search (to replace): ", lastSearch, function (term) {
          term = term || lastSearch;
          if (!term) return;
          lastSearch = term;
          openPrompt("Replace with: ", "", function (rep) {
            var v = ta.value, count = v.split(term).length - 1;
            if (!count) { setMsg('[ "' + term + '" not found ]'); return; }
            ta.value = v.split(term).join(rep);
            markDirty();
            setMsg("[ Replaced " + count + " occurrence" + (count > 1 ? "s" : "") + " ]");
          });
        });
      }
      function openGoto() {
        openPrompt("Enter line number: ", "", function (val) {
          var line = parseInt((val || "").trim(), 10);
          if (isNaN(line)) return;
          ta.focus();
          ta.selectionStart = ta.selectionEnd = lineColToPos(ta.value, line, 1);
          ensureCaretVisible();
        });
      }
      function openReadFile() {
        openPrompt("File to insert: ", "", function (name) {
          name = (name || "").trim();
          if (!name) return;
          var a = fs.resolve(name, vm.cwd);
          if (!fs.isFile(a)) { setMsg("[ " + name + ": not found ]"); return; }
          insertAtCursor(fs.read(a) || "");
          setMsg("[ Inserted " + name + " ]");
        });
      }
      function justify() {
        var v = ta.value, s = ta.selectionStart;
        var ps = v.lastIndexOf("\n\n", s - 1); ps = ps === -1 ? 0 : ps + 2;
        var pe = v.indexOf("\n\n", s); if (pe === -1) pe = v.length;
        var para = v.slice(ps, pe).replace(/\s+/g, " ").trim();
        if (!para) return;
        var out = "", lineLen = 0;
        para.split(" ").forEach(function (w) {
          if (lineLen + w.length + 1 > 72 && lineLen > 0) { out += "\n"; lineLen = 0; }
          if (lineLen > 0) { out += " "; lineLen++; }
          out += w; lineLen += w.length;
        });
        ta.value = v.slice(0, ps) + out + v.slice(pe);
        markDirty();
        setMsg("[ Justified paragraph ]");
      }
      function showLocation() {
        var v = ta.value, pos = ta.selectionStart, lc = posToLineCol(v, pos);
        setMsg("[ line " + lc.line + "/" + countLines(v) + ", col " + lc.col + ", char " + pos + "/" + v.length + " ]");
      }
      function toLineStart() { var v = ta.value, s = ta.selectionStart; ta.selectionStart = ta.selectionEnd = v.lastIndexOf("\n", s - 1) + 1; }
      function toLineEnd() { var v = ta.value, s = ta.selectionStart, le = v.indexOf("\n", s); if (le === -1) le = v.length; ta.selectionStart = ta.selectionEnd = le; }
      function doUndo() { ta.focus(); try { document.execCommand("undo"); } catch (_) {} }
      function doRedo() { ta.focus(); try { document.execCommand("redo"); } catch (_) {} }

      function openHelp() {
        mode = "help";
        helpEl = mk("div", "labvm-nano__help", NANO_HELP);
        helpEl.tabIndex = 0;
        root.appendChild(helpEl);
        helpEl.focus();
      }
      function closeHelp() { if (helpEl) { helpEl.remove(); helpEl = null; } mode = "normal"; ta.focus(); }

      function handleShortcut(e) {
        var key = e.key;
        var low = key.length === 1 ? key.toLowerCase() : key;
        if (e.altKey && !e.ctrlKey) {
          if (low === "u") { e.preventDefault(); doUndo(); }
          else if (low === "e") { e.preventDefault(); doRedo(); }
          else if (low === "6") { e.preventDefault(); copySel(); }
          else if (key === "\\") { e.preventDefault(); openReplace(); }
          return;
        }
        if (e.ctrlKey && !e.altKey) {
          switch (low) {
            case "o": e.preventDefault(); writeOut(); break;
            case "x": e.preventDefault(); doExit(); break;
            case "w": e.preventDefault(); openSearch(); break;
            case "\\": e.preventDefault(); openReplace(); break;
            case "k": e.preventDefault(); cutLine(); break;
            case "u": e.preventDefault(); pasteBuf(); break;
            case "c": e.preventDefault(); showLocation(); break;
            case "g": e.preventDefault(); openHelp(); break;
            case "r": e.preventDefault(); openReadFile(); break;
            case "j": e.preventDefault(); justify(); break;
            case "t": e.preventDefault(); setMsg("[ ^T Execute steht in diesem Lab nicht zur Verfuegung ]"); break;
            case "a": e.preventDefault(); toLineStart(); break;
            case "e": e.preventDefault(); toLineEnd(); break;
            case "y": e.preventDefault(); ta.scrollTop -= ta.clientHeight; break;
            case "v": e.preventDefault(); ta.scrollTop += ta.clientHeight; break;
            case "_": case "/": e.preventDefault(); openGoto(); break;
            default: break;
          }
          return;
        }
        if (key === "Tab") { e.preventDefault(); insertAtCursor("  "); return; }
        if (key.length === 1 || key === "Enter" || key === "Backspace" || key === "Delete") setMsg("");
      }

      pinput.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          var v = pinput.value, cb = promptConfirm;
          closePrompt();
          ta.focus();
          if (cb) cb(v);
        } else if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "c")) {
          e.preventDefault();
          closePrompt();
          setMsg("[ Cancelled ]");
          ta.focus();
        }
      });

      root.addEventListener("keydown", function (e) {
        if (mode === "prompt") return;
        e.stopPropagation();
        if (mode === "exit") {
          var k = e.key.toLowerCase();
          if (k === "y") { e.preventDefault(); mode = "normal"; writeOut(function () { destroy(); }); }
          else if (k === "n") { e.preventDefault(); destroy(); }
          else if (k === "escape" || (e.ctrlKey && k === "c")) { e.preventDefault(); mode = "normal"; setMsg("[ Cancelled ]"); ta.focus(); }
          else e.preventDefault();
          return;
        }
        if (mode === "help") {
          if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "x")) { e.preventDefault(); closeHelp(); }
          else e.preventDefault();
          return;
        }
        handleShortcut(e);
      }, true);

      ta.addEventListener("input", markDirty);

      refreshTitle();
      setMsg(existed ? "[ Read " + countLines(content) + " lines ]" : "[ New File ]");
      window.setTimeout(function () { ta.focus(); }, 0);
    }

    builtins.nano = builtins.vi = builtins.vim = builtins.edit = function (ctx) { openNano(ctx); };

    /* ============================ text processing tools ============================ */

    builtins.grep = function (ctx) {
      var args = ctx.args.slice();
      var opt = { i: false, v: false, n: false, c: false, E: false, r: false, w: false, o: false, l: false, q: false };
      var operands = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "--color" || a.indexOf("--color=") === 0 || a === "--") continue;
        if (a === "-e") { operands.push(args[++i]); continue; }
        if (a.charAt(0) === "-" && a.length > 1) {
          for (var j = 1; j < a.length; j++) { var f = a.charAt(j); if (f === "R") opt.r = true; else if (opt.hasOwnProperty(f)) opt[f] = true; }
        } else operands.push(a);
      }
      if (!operands.length) { emit("Usage: grep [OPTION]... PATTERN [FILE]...", "line-error"); return; }
      var pattern = operands.shift();
      var files = operands;
      var re;
      try { var body = opt.w ? ("\\b(?:" + pattern + ")\\b") : pattern; re = new RegExp(body, opt.i ? "i" : ""); }
      catch (e) { var esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); re = new RegExp(opt.w ? ("\\b" + esc + "\\b") : esc, opt.i ? "i" : ""); }
      var multi = files.length > 1 || opt.r;
      function scan(text, label) {
        var found = 0;
        splitLines(text).forEach(function (l, idx) {
          var m = re.test(l); if (opt.v) m = !m;
          if (!m) return;
          found++;
          if (opt.q || opt.l || opt.c) return;
          var out = "";
          if (multi) out += label + ":";
          if (opt.n) out += (idx + 1) + ":";
          if (opt.o) { var mm = l.match(re); out += mm ? mm[0] : ""; } else out += l;
          emit(out);
        });
        return found;
      }
      if (files.length) {
        files.forEach(function (f) {
          var abs = fs.resolve(f, vm.cwd);
          if (opt.r && fs.isDir(abs)) {
            (function rec(node, disp) {
              if (node.type === "file") { var c = scan(node.content, disp); if (opt.c) emit(disp + ":" + c); else if (opt.l && c) emit(disp); return; }
              Object.keys(node.children).sort().forEach(function (name) { rec(node.children[name], disp === "/" ? "/" + name : disp + "/" + name); });
            })(fs.nodeAt(abs), f.replace(/\/$/, ""));
            return;
          }
          var content = fs.read(abs);
          if (content == null) { emit("grep: " + f + ": No such file or directory", "line-error"); return; }
          var c = scan(content, f);
          if (opt.c) emit((multi ? f + ":" : "") + c); else if (opt.l && c) emit(f);
        });
      } else {
        var c2 = scan(ctx.stdin != null ? ctx.stdin : "", "");
        if (opt.c) emit(String(c2));
      }
    };

    builtins.find = function (ctx) {
      var args = ctx.args.slice();
      var starts = [], nameGlob = null, iname = null, typeF = null, maxdepth = Infinity;
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-name") nameGlob = args[++i];
        else if (a === "-iname") iname = args[++i];
        else if (a === "-type") typeF = args[++i];
        else if (a === "-maxdepth") maxdepth = parseInt(args[++i], 10);
        else if (a.charAt(0) !== "-") starts.push(a);
      }
      if (!starts.length) starts = ["."];
      function globRe(g, ci) { return new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", ci ? "i" : ""); }
      var nameRe = nameGlob ? globRe(nameGlob, false) : (iname ? globRe(iname, true) : null);
      starts.forEach(function (sp) {
        var node = fs.nodeAt(fs.resolve(sp, vm.cwd));
        if (!node) { emit("find: '" + sp + "': No such file or directory", "line-error"); return; }
        (function rec(n, disp, depth) {
          var isDir = n.type === "dir";
          var base = disp.split("/").pop();
          var ok = true;
          if (nameRe && !nameRe.test(base)) ok = false;
          if (typeF === "f" && isDir) ok = false;
          if (typeF === "d" && !isDir) ok = false;
          if (ok) emit(disp);
          if (isDir && depth < maxdepth) Object.keys(n.children).sort().forEach(function (name) { rec(n.children[name], disp === "/" ? "/" + name : disp + "/" + name, depth + 1); });
        })(node, sp, 0);
      });
    };

    builtins.sort = function (ctx) {
      var files = ctx.operands.slice();
      var rev = ctx.flags.indexOf("r") !== -1, num = ctx.flags.indexOf("n") !== -1, uniq = ctx.flags.indexOf("u") !== -1, fold = ctx.flags.indexOf("f") !== -1;
      var lines = splitLines(readInput(ctx, files));
      lines.sort(function (a, b) {
        var x = fold ? a.toLowerCase() : a, y = fold ? b.toLowerCase() : b;
        if (num) return (parseFloat(x) || 0) - (parseFloat(y) || 0);
        return x < y ? -1 : x > y ? 1 : 0;
      });
      if (rev) lines.reverse();
      if (uniq) { var seen = null; lines = lines.filter(function (l) { var k = fold ? l.toLowerCase() : l; if (k === seen) return false; seen = k; return true; }); }
      lines.forEach(function (l) { emit(l); });
    };

    builtins.uniq = function (ctx) {
      var files = ctx.operands.slice();
      var count = ctx.flags.indexOf("c") !== -1, dup = ctx.flags.indexOf("d") !== -1, uni = ctx.flags.indexOf("u") !== -1, ci = ctx.flags.indexOf("i") !== -1;
      var lines = splitLines(readInput(ctx, files));
      var i = 0;
      while (i < lines.length) {
        var j = i + 1;
        while (j < lines.length && (ci ? lines[j].toLowerCase() === lines[i].toLowerCase() : lines[j] === lines[i])) j++;
        var n = j - i;
        if ((dup && n > 1) || (uni && n === 1) || (!dup && !uni)) emit(count ? (String(n).padStart(7, " ") + " " + lines[i]) : lines[i]);
        i = j;
      }
    };

    builtins.sed = function (ctx) {
      var args = ctx.args.slice(), scripts = [], files = [], quiet = false;
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-n") quiet = true;
        else if (a === "-e") scripts.push(args[++i]);
        else if (a === "-r" || a === "-E" || a === "--regexp-extended") { /* JS regex is ERE-ish */ }
        else if (a.charAt(0) === "-" && a !== "-") { /* ignore */ }
        else if (!scripts.length) scripts.push(a);
        else files.push(a);
      }
      var progs = scripts.map(parseSed);
      var out = [];
      splitLines(readInput(ctx, files)).forEach(function (line, idx) {
        var cur = line, deleted = false, extra = [];
        progs.forEach(function (p) {
          if (deleted) return;
          var hit = !p.addr || sedAddr(p.addr, cur, idx);
          if (p.type === "s") { if (hit) cur = cur.replace(p.re, p.rep); }
          else if (p.type === "d") { if (hit) deleted = true; }
          else if (p.type === "p") { if (hit) extra.push(cur); }
        });
        if (quiet) extra.forEach(function (t) { out.push(t); });
        else { if (!deleted) out.push(cur); extra.forEach(function (t) { out.push(t); }); }
      });
      out.forEach(function (l) { emit(l); });
    };
    function sedAddr(addr, line, idx) { if (addr.line != null) return (idx + 1) === addr.line; if (addr.re) return addr.re.test(line); return true; }
    function parseSed(s) {
      s = s.trim();
      var addr = null, m;
      if (m = s.match(/^(\d+)/)) { addr = { line: parseInt(m[1], 10) }; s = s.slice(m[0].length); }
      else if (m = s.match(/^\/((?:\\.|[^\/])*)\//)) { addr = { re: new RegExp(m[1]) }; s = s.slice(m[0].length); }
      s = s.trim();
      if (s.charAt(0) === "s" && s.length > 1) {
        var delim = s.charAt(1), rest = s.slice(2), parts = [], cur = "";
        for (var i = 0; i < rest.length; i++) { var c = rest.charAt(i); if (c === "\\" && i + 1 < rest.length) { cur += c + rest.charAt(i + 1); i++; continue; } if (c === delim) { parts.push(cur); cur = ""; continue; } cur += c; }
        parts.push(cur);
        var flags = parts[2] || "", reFlags = (flags.indexOf("g") >= 0 ? "g" : "") + (flags.indexOf("i") >= 0 ? "i" : "");
        var rep = (parts[1] || "").replace(/\$/g, "$$$$").replace(/\\(\d)/g, "$$$1").replace(/&/g, "$$&");
        var re; try { re = new RegExp(parts[0], reFlags); } catch (e) { re = new RegExp(parts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), reFlags); }
        return { type: "s", addr: addr, re: re, rep: rep };
      }
      if (s.charAt(0) === "d") return { type: "d", addr: addr };
      if (s.charAt(0) === "p") return { type: "p", addr: addr };
      return { type: "noop", addr: addr };
    }

    builtins.awk = function (ctx) {
      var args = ctx.args.slice(), FS = null, prog = null, files = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-F") FS = args[++i];
        else if (a.indexOf("-F") === 0) FS = a.slice(2);
        else if (prog == null && a.charAt(0) !== "-") prog = a;
        else if (a.charAt(0) !== "-") files.push(a);
      }
      if (prog == null) { emit("usage: awk [-F fs] 'program' [file ...]", "line-error"); return; }
      if (FS) FS = FS.replace(/^["']|["']$/g, "");
      var rule = parseAwk(prog);
      var sep = FS ? (FS.length === 1 ? FS : new RegExp(FS)) : /\s+/;
      var NR = 0;
      splitLines(readInput(ctx, files)).forEach(function (line) {
        NR++;
        var fields = FS ? line.split(sep) : line.trim().split(sep);
        if (!FS && fields.length === 1 && fields[0] === "") fields = [];
        var env = { NR: NR, NF: fields.length };
        function field(n) { return n === 0 ? line : (fields[n - 1] != null ? fields[n - 1] : ""); }
        if (awkMatch(rule.pattern, line, env, field)) awkAction(rule.action, line, env, field);
      });
    };
    function parseAwk(prog) {
      prog = prog.trim().replace(/^'|'$/g, "");
      var idx = prog.indexOf("{");
      if (idx === -1) return { pattern: prog.trim(), action: null };
      var end = prog.lastIndexOf("}");
      return { pattern: prog.slice(0, idx).trim(), action: prog.slice(idx + 1, end).trim() };
    }
    function awkMatch(pattern, line, env, field) {
      if (!pattern) return true;
      var m;
      if (m = pattern.match(/^\/(.*)\/$/)) { try { return new RegExp(m[1]).test(line); } catch (e) { return false; } }
      var cond = pattern.replace(/\bNR\b/g, env.NR).replace(/\bNF\b/g, env.NF).replace(/\$(\d+)/g, function (_, n) { return JSON.stringify(field(parseInt(n, 10))); });
      try { return !!Function('"use strict";return (' + cond + ')')(); } catch (e) { return false; }
    }
    function awkAction(action, line, env, field) {
      if (!action) { emit(line); return; }
      action.split(";").forEach(function (stmt) {
        stmt = stmt.trim(); if (!stmt) return;
        var mm = stmt.match(/^print\b(.*)$/);
        if (!mm) return;
        var arg = mm[1].trim();
        if (arg === "" || arg === "$0") { emit(line); return; }
        emit(arg.split(",").map(function (p) { return awkEval(p.trim(), env, field); }).join(" "));
      });
    }
    function awkEval(expr, env, field) {
      expr = expr.trim(); var m;
      if (m = expr.match(/^\$(\d+)$/)) return field(parseInt(m[1], 10));
      if (expr === "NR") return String(env.NR);
      if (expr === "NF") return String(env.NF);
      if (m = expr.match(/^"(.*)"$/)) return m[1];
      return expr;
    }

    builtins.cut = function (ctx) {
      var args = ctx.args.slice(), delim = "\t", fields = null, chars = null, files = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-d") delim = args[++i];
        else if (a.indexOf("-d") === 0) delim = a.slice(2);
        else if (a === "-f") fields = args[++i];
        else if (a.indexOf("-f") === 0) fields = a.slice(2);
        else if (a === "-c") chars = args[++i];
        else if (a.indexOf("-c") === 0) chars = a.slice(2);
        else if (a.charAt(0) !== "-") files.push(a);
      }
      delim = delim.replace(/^["']|["']$/g, ""); if (delim === "\\t") delim = "\t";
      function idxList(spec, max) {
        var out = [];
        spec.split(",").forEach(function (part) {
          var mm = part.match(/^(\d+)?-(\d+)?$/);
          if (mm) { var s = mm[1] ? parseInt(mm[1], 10) : 1, e = mm[2] ? parseInt(mm[2], 10) : max; for (var k = s; k <= e; k++) out.push(k); }
          else out.push(parseInt(part, 10));
        });
        return out;
      }
      splitLines(readInput(ctx, files)).forEach(function (line) {
        if (chars) emit(idxList(chars, line.length).map(function (k) { return line.charAt(k - 1); }).join(""));
        else if (fields) { var parts = line.split(delim); emit(idxList(fields, parts.length).map(function (k) { return parts[k - 1] != null ? parts[k - 1] : ""; }).join(delim)); }
        else emit(line);
      });
    };

    builtins.tr = function (ctx) {
      var sets = ctx.operands.slice();
      var del = ctx.flags.indexOf("d") !== -1, squeeze = ctx.flags.indexOf("s") !== -1;
      var set1 = sets[0] != null ? trExpand(sets[0]) : "", set2 = sets[1] != null ? trExpand(sets[1]) : "";
      var text = ctx.stdin != null ? String(ctx.stdin).replace(/\n$/, "") : "";
      var out;
      if (del) out = text.replace(new RegExp("[" + trEsc(set1) + "]", "g"), "");
      else { var map = {}; for (var i = 0; i < set1.length; i++) map[set1[i]] = set2[i] != null ? set2[i] : (set2[set2.length - 1] || set1[i]); out = text.replace(/[\s\S]/g, function (c) { return map[c] != null ? map[c] : c; }); }
      if (squeeze) out = out.replace(/([\s\S])\1+/g, "$1");
      splitLines(out + "\n").forEach(function (l) { emit(l); });
    };
    function trExpand(s) {
      s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      var out = "";
      for (var i = 0; i < s.length; i++) { if (s[i + 1] === "-" && s[i + 2]) { for (var c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c); i += 2; } else out += s[i]; }
      return out;
    }
    function trEsc(s) { return s.replace(/[\^\]\\-]/g, "\\$&"); }

    builtins.tee = function (ctx) {
      var append = ctx.flags.indexOf("a") !== -1;
      var files = ctx.operands.slice();
      var text = ctx.stdin != null ? String(ctx.stdin) : "";
      if (files.length) { files.forEach(function (f) { fs.writeFile(fs.resolve(f, vm.cwd), text.replace(/\n?$/, "\n"), { makeParents: true, append: append }); }); changed(); }
      splitLines(text).forEach(function (l) { emit(l); });
    };

    builtins.xargs = function (ctx) {
      var args = ctx.args.slice(), repl = null, nPer = 0, cmd = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === "-I") repl = args[++i];
        else if (a === "-n") nPer = parseInt(args[++i], 10) || 0;
        else { cmd = args.slice(i); break; }
      }
      if (!cmd.length) cmd = ["echo"];
      var tokens = (ctx.stdin != null ? String(ctx.stdin) : "").split(/\s+/).filter(Boolean);
      function run(items) {
        var line = repl
          ? cmd.map(function (t) { return t.split(repl).join(items.join(" ")); }).join(" ")
          : cmd.join(" ") + " " + items.join(" ");
        var res = execStage(line, null, true);
        splitLines(res).forEach(function (l) { emit(l); });
      }
      if (repl) tokens.forEach(function (t) { run([t]); });
      else if (nPer > 0) { for (var k = 0; k < tokens.length; k += nPer) run(tokens.slice(k, k + nPer)); }
      else if (tokens.length) run(tokens);
    };

    /* ============================ package management ============================ */
    function aptRun(ctx) {
      var sub = ctx.operands[0];
      var pkgs = ctx.operands.slice(1).filter(function (p) { return p.charAt(0) !== "-"; });
      if (sub === "update") { emit("Holen:1 http://archive.ubuntu.com/ubuntu jammy InRelease"); emit("Paketlisten werden gelesen... Fertig"); return; }
      if (sub === "upgrade" || sub === "full-upgrade" || sub === "dist-upgrade") { emit("Paketlisten werden gelesen... Fertig"); emit("Abhaengigkeitsbaum wird aufgebaut... Fertig"); emit("0 aktualisiert, 0 neu installiert, 0 zu entfernen und 0 nicht aktualisiert."); return; }
      if (sub === "install" || sub === "reinstall") {
        if (!pkgs.length) { emit("E: Es muss mindestens ein Paket angegeben werden", "line-error"); return; }
        emit("Paketlisten werden gelesen... Fertig");
        emit("Abhaengigkeitsbaum wird aufgebaut... Fertig");
        emit("Statusinformationen werden eingelesen... Fertig");
        var ok = [], unknown = [];
        pkgs.forEach(function (p) { if (GATED_PKG[p] || KNOWN_PKG[p]) ok.push(p); else unknown.push(p); });
        unknown.forEach(function (u) { emit("E: Paket " + u + " kann nicht gefunden werden.", "line-error"); });
        if (!ok.length) return;
        emit("Die folgenden NEUEN Pakete werden installiert:");
        emit("  " + ok.join(" "));
        emit("0 aktualisiert, " + ok.length + " neu installiert, 0 zu entfernen und 0 nicht aktualisiert.");
        ok.forEach(function (p) {
          emit("Hole " + p + " ...");
          emit("Richte " + p + " ein ...");
          vm.env.installed[p] = true;
          if (GATED_PKG[p]) vm.env.installed[GATED_PKG[p]] = true;
        });
        return;
      }
      if (sub === "remove" || sub === "purge" || sub === "autoremove") {
        pkgs.forEach(function (p) { delete vm.env.installed[p]; if (GATED_PKG[p]) delete vm.env.installed[GATED_PKG[p]]; emit("Entferne " + p + " ..."); });
        return;
      }
      if (sub === "list") {
        emit("Auflistung... Fertig");
        Object.keys(vm.env.installed).forEach(function (k) { emit(k + "/jammy,now installiert"); });
        return;
      }
      if (sub === "search") { emit("Sortierung... Fertig"); emit("Volltextsuche... Fertig"); return; }
      emit("apt " + (sub || "") + ": unbekannter Befehl", "line-warn");
    }
    builtins.apt = aptRun;
    builtins["apt-get"] = aptRun;

    /* ============================ installable tools (gated) ============================ */
    builtins.cowsay = function (ctx) {
      var t = ctx.argline || "moo";
      emit(" " + "_".repeat(t.length + 2));
      emit("< " + t + " >");
      emit(" " + "-".repeat(t.length + 2));
      emit("        \\   ^__^");
      emit("         \\  (oo)\\_______");
      emit("            (__)\\       )\\/\\");
      emit("                ||----w |");
      emit("                ||     ||");
    };
    builtins.figlet = function (ctx) { emit((ctx.argline || "").toUpperCase().split("").join(" ")); };
    builtins.fortune = function () { emit(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); };
    builtins.sl = function () {
      emit("      ====        ________                ___________");
      emit("  _D _|  |_______/        \\__I_I_____===__|_________|");
      emit("   |(_)---  |   H\\________/ |   |        =|___ ___|");
      emit("   /     |  |   H  |  |     |   |         ||_| |_||");
      emit("  |      |  |   H  |__--------------------| [___] |");
      emit("  | ________|___H__/__|_____/[][]~\\_______|       |");
      emit("  |/ |   |-----------I_____I [][] []  D   |=======|__");
    };
    builtins.neofetch = function () {
      emit(vm.user + "@" + vm.host);
      emit("-----------------");
      emit("OS: Ubuntu 22.04.3 LTS x86_64 (Koffi Academy Lab)");
      emit("Kernel: 6.8.0-koffi");
      emit("Shell: bash 5.1.16");
      emit("CPU: Virtual vCPU (4) @ 2.40GHz");
      emit("Memory: 512MiB / 2048MiB");
    };
    builtins.htop = function () {
      emit("  PID USER      PRI  NI  VIRT   RES   CPU%  MEM%   TIME+  Command");
      emit("    1 root       20   0  168M   12M   0.0   0.6   0:01.23 systemd");
      emit("  120 " + vm.user + "      20   0   24M  4.2M   0.3   0.2   0:00.10 bash");
      emit("(htop ist interaktiv; hier nur ein Snapshot. Beenden mit q)", "line-muted");
    };
    builtins.bat = function (ctx) {
      var f = ctx.operands[0];
      var content = f ? fs.read(fs.resolve(f, vm.cwd)) : (ctx.stdin != null ? String(ctx.stdin) : null);
      if (content == null) { emit("bat: " + (f || "-") + ": No such file or directory", "line-error"); return; }
      emit("───────┬" + "─".repeat(40));
      if (f) emit("       │ File: " + f);
      emit("───────┼" + "─".repeat(40));
      splitLines(content).forEach(function (l, i) { emit(String(i + 1).padStart(6, " ") + " │ " + l); });
      emit("───────┴" + "─".repeat(40));
    };
    builtins.lolcat = function (ctx) { splitLines(ctx.stdin != null ? ctx.stdin : (ctx.argline || "")).forEach(function (l) { emit(l); }); };
    builtins.jq = function (ctx) {
      var filter = (ctx.operands[0] || ".").replace(/^'|'$/g, "");
      var fileOps = ctx.operands.slice(1);
      var text = fileOps.length ? readInput(ctx, fileOps) : (ctx.stdin != null ? String(ctx.stdin) : "");
      var data; try { data = JSON.parse(text); } catch (e) { emit("jq: error (at <stdin>): Invalid JSON text", "line-error"); return; }
      function out(v) { emit(JSON.stringify(v, null, 2)); }
      if (filter === ".") { out(data); return; }
      if (filter === ".[]" || filter === "[]") { if (Array.isArray(data)) data.forEach(out); else if (data && typeof data === "object") Object.keys(data).forEach(function (k) { out(data[k]); }); return; }
      var cur = data, iterated = false;
      filter.replace(/^\./, "").split(".").forEach(function (seg) {
        if (iterated) return;
        var mm = seg.match(/^([^\[]*)(\[\])?$/); var key = mm[1], iter = !!mm[2];
        if (key) cur = cur != null ? cur[key] : undefined;
        if (iter && Array.isArray(cur)) { cur.forEach(out); iterated = true; }
      });
      if (!iterated) out(cur);
    };
    /* Commands that require `apt install <pkg>` before they work. */
    var GATED = { cowsay: 1, figlet: 1, fortune: 1, sl: 1, neofetch: 1, htop: 1, bat: 1, lolcat: 1, jq: 1 };
    function gatedPkgFor(cmd) { for (var p in GATED_PKG) if (GATED_PKG[p] === cmd) return p; return cmd; }

    /* ---- split a line on top-level operators, honouring quotes ---- */
    function splitTop(line, seps) {
      var parts = [], ops = [], cur = "", quote = null;
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        var matched = null;
        for (var s = 0; s < seps.length; s++) { if (line.substr(i, seps[s].length) === seps[s]) { matched = seps[s]; break; } }
        if (matched) { parts.push(cur); ops.push(matched); cur = ""; i += matched.length - 1; continue; }
        cur += ch;
      }
      parts.push(cur);
      return { parts: parts, ops: ops };
    }

    /* ---- run one command stage; returns its captured stdout (or "" if printed/redirected) ---- */
    function execStage(raw, stdin, capture) {
      var trimmed = raw.replace(/\s+$/, "");
      if (trimmed.trim() === "") return "";
      var allTokens = tokenize(trimmed);
      // strip a leading `sudo` and its options — commands run as root here anyway.
      while (allTokens.length && allTokens[0] === "sudo") {
        allTokens.shift();
        while (allTokens.length && allTokens[0].charAt(0) === "-") { var o = allTokens.shift(); if (o === "-u" || o === "--user") allTokens.shift(); }
      }
      if (!allTokens.length) return "";

      var red = extractRedirect(allTokens);
      var tokens = red.tokens;
      var head = tokens[0];
      if (!head) return "";
      var args = tokens.slice(1);

      var ctx = {
        head: head,
        args: args,
        argline: args.join(" "),
        flags: collectFlags(args),
        operands: args.filter(function (a) { return a.charAt(0) !== "-"; }),
        raw: trimmed,
        redirect: red.redirect,
        stdin: stdin,
        emit: emit
      };

      var toFile = red.redirect && red.redirect.target && red.redirect.target !== "/dev/null" && red.redirect.target !== "dev/null";
      var toNull = red.redirect && (red.redirect.target === "/dev/null" || red.redirect.target === "dev/null");
      var captured = [];
      var prevSink = sink;
      if (capture || toFile || toNull) sink = captured;
      runCommand(head, ctx);
      sink = prevSink;

      var outText = captured.join("\n") + (captured.length ? "\n" : "");
      if (red.redirect) {
        if (toNull) return "";
        if (!red.redirect.target) { emit("bash: syntax error near unexpected token `newline'", "line-error"); return ""; }
        var abs = fs.resolve(red.redirect.target, vm.cwd);
        var r = fs.writeFile(abs, outText, { append: red.redirect.append, makeParents: true });
        if (r && r.error) emit("bash: " + red.redirect.target + ": No such file or directory", "line-error");
        else changed();
        return "";
      }
      return capture ? outText : "";
    }

    /* ---- run a pipeline (segments joined by `|`) ---- */
    function runPipeline(segment) {
      var segs = splitTop(segment, ["|"]).parts;
      if (segs.length === 1) { execStage(segs[0], null, false); return; }
      var stdin = null;
      for (var i = 0; i < segs.length; i++) {
        var isLast = i === segs.length - 1;
        stdin = execStage(segs[i], stdin, !isLast);
      }
    }

    /* ---- run a full command line (handles ; && ||) ---- */
    function runCommandLine(line) {
      var top = splitTop(line, ["&&", "||", ";"]);
      var prevOk = true;
      for (var i = 0; i < top.parts.length; i++) {
        var op = i === 0 ? "start" : top.ops[i - 1];
        var seg = top.parts[i];
        if (seg.trim() === "") continue;
        var should = op === "start" || op === ";" || (op === "&&" && prevOk) || (op === "||" && !prevOk);
        if (!should) continue;
        stageError = false;
        runPipeline(seg);
        prevOk = !stageError;
      }
    }

    // In "fallback" mode the VM owns only real filesystem commands and hands
    // everything else (the lab's simulated CLI: kubectl, akeyless, git, check…)
    // to config.fallback so each lab keeps its own scripted behaviour.
    var OWNED_FS = {
      cd:1, pwd:1, mkdir:1, rmdir:1, touch:1, rm:1, mv:1, cp:1, chmod:1, tree:1, head:1, tail:1, wc:1,
      nano:1, vi:1, vim:1, edit:1,
      grep:1, find:1, sort:1, uniq:1, sed:1, awk:1, cut:1, tr:1, xargs:1, tee:1, apt:1, "apt-get":1
    };
    function vfsHasTarget(ctx) {
      var op = ctx.operands[0];
      if (op === undefined) return true; // bare `ls`/`cat` → use the VFS
      return fs.exists(fs.resolve(op, vm.cwd));
    }

    function runCommand(head, ctx) {
      var custom = config.commands && config.commands[head];
      if (custom) { custom(ctx, vm); return; }

      // Installable tools: available only after `apt install`. Works in every lab.
      if (GATED[head]) {
        if (vm.env.installed[head]) { builtins[head](ctx); return; }
        emit(head + ": Kommando nicht gefunden", "line-error");
        emit("Tipp: mit \"sudo apt install " + gatedPkgFor(head) + "\" installieren", "line-muted");
        return;
      }

      if (config.fallback) {
        if (OWNED_FS[head]) { builtins[head](ctx); return; }
        if (head === "clear") { builtins.clear(ctx); return; }
        // ls / cat: serve real files the learner created, else let the lab speak.
        if ((head === "ls" || head === "cat") && vfsHasTarget(ctx)) { builtins[head](ctx); return; }
        // echo: owned when redirected or part of a pipeline; a bare echo goes to the lab.
        if (head === "echo" && (ctx.redirect || sink || ctx.stdin != null)) { builtins.echo(ctx); return; }
        config.fallback(ctx.raw, ctx);
        return;
      }

      if (builtins[head]) { builtins[head](ctx); return; }
      emit(head + ": command not found", "line-error");
    }

    function collectFlags(args) {
      var flags = [];
      args.forEach(function (a) {
        if (a.charAt(0) === "-" && a.length > 1 && a.charAt(1) !== "-") {
          for (var i = 1; i < a.length; i++) flags.push(a.charAt(i));
        }
      });
      return flags;
    }

    /* ---- here-document detection ---- */
    function heredocStart(line) {
      var m = line.match(/<<\s*-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
      if (!m) return null;
      var before = line.slice(0, m.index).replace(/\s+$/, "");
      return { delim: m[2], command: before };
    }

    /* ---- process a single input line (heredoc-aware) ---- */
    function processLine(line) {
      if (vm.heredoc) {
        if (line.replace(/\s+$/, "") === vm.heredoc.delim || line === vm.heredoc.delim) {
          var hd = vm.heredoc;
          vm.heredoc = null;
          finishHeredoc(hd);
          return;
        }
        vm.heredoc.body.push(line);
        return;
      }
      var hs = heredocStart(line);
      if (hs) { vm.heredoc = { delim: hs.delim, command: hs.command, body: [] }; return; }
      runCommandLine(line);
    }

    /* When a here-document closes, re-run its opening command with the captured
       body as stdin redirected into the target file (cat > file / cat >> file). */
    function finishHeredoc(hd) {
      var body = hd.body.join("\n");
      if (body.length) body += "\n";
      var tokens = tokenize(hd.command);
      var red = extractRedirect(tokens);
      var head = red.tokens[0];
      if (head === "cat" && red.redirect && red.redirect.target) {
        var abs = fs.resolve(red.redirect.target, vm.cwd);
        var r = fs.writeFile(abs, body, { append: red.redirect.append });
        if (r.error === "no-parent" || r.error === "not-a-dir") emit("bash: " + red.redirect.target + ": No such file or directory", "line-error");
        else if (r.error === "is-a-dir") emit("bash: " + red.redirect.target + ": Is a directory", "line-error");
        else changed();
        return;
      }
      // Generic: feed the body to the command via a custom hook if provided.
      if (config.commands && config.commands[head]) {
        config.commands[head]({ head: head, args: red.tokens.slice(1), operands: red.tokens.slice(1), flags: [], stdin: body, redirect: red.redirect, emit: emit }, vm);
        return;
      }
      // `tee file` also writes the body.
      if (head === "tee" && red.tokens[1]) {
        var teeAbs = fs.resolve(red.tokens[1], vm.cwd);
        fs.writeFile(teeAbs, body, { makeParents: true, append: red.redirect && red.redirect.append });
        emit(body.replace(/\n$/, ""));
        changed();
        return;
      }
      if (config.fallback) { config.fallback(hd.command); return; }
      emit(hd.command + ": here-document not supported here", "line-warn");
    }

    /* ---- public entry points ---- */
    function echoLine(line) {
      emit(vm.promptText() + " " + line, "line-cmd");
    }

    vm.submit = function (line) {
      echoLine(line);
      processLine(line);
    };

    vm.paste = function (text) {
      var lines = String(text).replace(/\r/g, "").split("\n");
      // Drop a single trailing empty line produced by a final newline.
      if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
      lines.forEach(function (line) {
        echoLine(line);
        processLine(line);
      });
    };

    vm.run = function (line) { processLine(line); };

    return vm;
  }

  window.LabVM = { create: create };
})();
