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

  /* Extract a `>file` / `>>file` redirection from a token list. */
  function extractRedirect(tokens) {
    var out = { tokens: [], redirect: null };
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk === ">" || tk === ">>") {
        out.redirect = { append: tk === ">>", target: tokens[i + 1] || "" };
        i++;
        continue;
      }
      if (tk.charAt(0) === ">" ) {
        var app = tk.charAt(1) === ">";
        out.redirect = { append: app, target: tk.slice(app ? 2 : 1) };
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
      env: { venv: false },
      heredoc: null
    };

    var sink = null; // when set (an array), command stdout is captured into it
    function emit(text, cls) {
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

    builtins.cat = function (ctx) {
      if (!ctx.operands.length) { emit("cat: missing file operand", "line-error"); return; }
      ctx.operands.forEach(function (operand) {
        var abs = fs.resolve(operand, vm.cwd);
        var node = fs.nodeAt(abs);
        if (!node) { emit("cat: " + operand + ": No such file or directory", "line-error"); return; }
        if (node.type === "dir") { emit("cat: " + operand + ": Is a directory", "line-error"); return; }
        var body = node.content.replace(/\n$/, "");
        if (body !== "" || node.content !== "") emit(body);
      });
    };

    builtins.echo = function (ctx) { emit(ctx.argline); };

    builtins.head = function (ctx) { headTail(ctx, true); };
    builtins.tail = function (ctx) { headTail(ctx, false); };
    function headTail(ctx, head) {
      var n = 10, ops = ctx.operands.slice();
      var ni = ctx.args.indexOf("-n");
      if (ni !== -1 && ctx.args[ni + 1]) { n = parseInt(ctx.args[ni + 1], 10) || 10; ops = ops.filter(function (o) { return o !== String(n); }); }
      var file = ops[0];
      if (!file) return;
      var content = fs.read(fs.resolve(file, vm.cwd));
      if (content == null) { emit((head ? "head" : "tail") + ": cannot open '" + file + "' for reading: No such file or directory", "line-error"); return; }
      var lines = content.replace(/\n$/, "").split("\n");
      var slice = head ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
      slice.forEach(function (l) { emit(l); });
    }

    builtins.wc = function (ctx) {
      var file = ctx.operands[0];
      if (!file) return;
      var content = fs.read(fs.resolve(file, vm.cwd));
      if (content == null) { emit("wc: " + file + ": No such file or directory", "line-error"); return; }
      var lines = content.replace(/\n$/, "").split("\n");
      emit((ctx.flags.indexOf("l") !== -1 ? lines.length : lines.length) + " " + file);
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
      emit("  clear  whoami  date  help", "line-muted");
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

    /* ---- dispatch one already-parsed command line (no heredoc handling) ---- */
    function dispatch(line) {
      var trimmed = line.replace(/\s+$/, "");
      if (trimmed.trim() === "") return;
      var allTokens = tokenize(trimmed);
      if (!allTokens.length) return;

      var red = extractRedirect(allTokens);
      var tokens = red.tokens;
      var head = tokens[0];
      var args = tokens.slice(1);

      var ctx = {
        head: head,
        args: args,
        argline: red.tokens.slice(1).join(" "),
        flags: collectFlags(args),
        operands: args.filter(function (a) { return a.charAt(0) !== "-"; }),
        raw: trimmed,
        redirect: red.redirect,
        emit: emit
      };

      // Output redirection: capture this command's stdout into a file.
      if (red.redirect) {
        if (!red.redirect.target) { emit("bash: syntax error near unexpected token `newline'", "line-error"); return; }
        var captured = [];
        sink = captured;
        runCommand(head, ctx);
        sink = null;
        var abs = fs.resolve(red.redirect.target, vm.cwd);
        var r = fs.writeFile(abs, captured.join("\n") + (captured.length ? "\n" : ""), { append: red.redirect.append });
        if (r.error) emit("bash: " + red.redirect.target + ": No such file or directory", "line-error");
        else changed();
        return;
      }
      runCommand(head, ctx);
    }

    // In "fallback" mode the VM owns only real filesystem commands and hands
    // everything else (the lab's simulated CLI: kubectl, akeyless, git, check…)
    // to config.fallback so each lab keeps its own scripted behaviour.
    var OWNED_FS = { cd:1, pwd:1, mkdir:1, rmdir:1, touch:1, rm:1, mv:1, cp:1, chmod:1, tree:1, head:1, tail:1, wc:1, nano:1, vi:1, vim:1, edit:1 };
    function vfsHasTarget(ctx) {
      var op = ctx.operands[0];
      if (op === undefined) return true; // bare `ls`/`cat` → use the VFS
      return fs.exists(fs.resolve(op, vm.cwd));
    }

    function runCommand(head, ctx) {
      var custom = config.commands && config.commands[head];
      if (custom) { custom(ctx, vm); return; }

      if (config.fallback) {
        if (OWNED_FS[head]) { builtins[head](ctx); return; }
        if (head === "clear") { builtins.clear(ctx); return; }
        // ls / cat: serve real files the learner created, else let the lab speak.
        if ((head === "ls" || head === "cat") && vfsHasTarget(ctx)) { builtins[head](ctx); return; }
        // echo with redirection writes to the VFS; plain echo goes to the lab.
        if (head === "echo" && ctx.redirect) { builtins.echo(ctx); return; }
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
      dispatch(line);
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
