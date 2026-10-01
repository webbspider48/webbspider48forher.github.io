/* =====================================================
   BIGDUGG 7 — script.js
===================================================== */

/* ---------- Change these ---------- */
const USER_NAME = "Favourite Person";
const SENDER = "Bigduggmustfall";

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const mkStore = (area) => ({
    get(k, d) { try { const v = area.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { area.setItem(k, v); } catch (e) {} },
    remove(k) { try { area.removeItem(k); } catch (e) {} }
});

let store, session;
try {
    store = mkStore(localStorage);
    session = mkStore(sessionStorage);
} catch (e) {
    const mem = {};
    store = session = {
        get: (k, d) => (k in mem ? mem[k] : d),
        set: (k, v) => { mem[k] = v; },
        remove: (k) => { delete mem[k]; }
    };
}

const isTouch = () => window.matchMedia("(pointer: coarse)").matches;
const isUnread = () => store.get("bd_mail_read", "0") !== "1";

/* ---------- Navigation ---------- */
function openLetter() { location.href = "letter.html"; }
function openAssessment() { location.href = "assessment.html"; }
function goHome() { location.href = "index.html"; }

/* ---------- System state ---------- */
const sys = {
    volume: +store.get("bd_volume", "70"),
    muted: store.get("bd_muted", "0") === "1",
    net: true
};

let audioCtx;
function beep(freq = 660, dur = 0.12) {
    if (sys.muted || sys.volume === 0 || store.get("bd_sound", "1") !== "1") return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.value = 0.15 * (sys.volume / 100);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
}

/* =====================================================
   DIALOGS
===================================================== */

function showDialog(o) {
    const icon = o.icon || "ℹ️";
    const layer = document.createElement("div");
    layer.className = "modal-layer";
    layer.innerHTML = `
        <div class="window active dialog" role="dialog">
            <div class="win-titlebar">
                <span class="win-icon">${icon}</span>
                <span class="win-title">${o.title || "Bigdugg 7"}</span>
                <div class="win-controls"><button class="wc-close" aria-label="Close">&#10005;</button></div>
            </div>
            <div class="win-body">
                <div class="dialog-main">
                    <span class="dialog-icon">${icon}</span>
                    <div class="dialog-text">${o.text || ""}</div>
                </div>
                <div class="dialog-buttons"></div>
            </div>
        </div>`;

    const close = () => layer.remove();
    $(".wc-close", layer).onclick = close;

    const box = $(".dialog-buttons", layer);
    (o.buttons || [{ label: "OK" }]).forEach((b, i) => {
        const btn = document.createElement("button");
        btn.className = "btn" + (i === 0 ? " btn-primary" : "");
        btn.textContent = b.label;
        btn.onclick = () => { close(); if (b.run) b.run(); };
        box.appendChild(btn);
    });

    document.body.appendChild(layer);
    beep(520, 0.1);
    $(".btn", layer).focus();
    return close;
}

/* =====================================================
   WINDOW MANAGER
===================================================== */

const WM = { wins: {}, z: 100 };

function decorate(el) {
    if (!el.id) el.id = "win-" + Math.random().toString(36).slice(2, 8);

    const bar = document.createElement("div");
    bar.className = "win-titlebar";
    bar.innerHTML = `
        <span class="win-icon">${el.dataset.icon || "🗔"}</span>
        <span class="win-title"></span>
        <div class="win-controls">
            <button class="wc-min" title="Minimize" aria-label="Minimize">&#8211;</button>
            <button class="wc-max" title="Maximize" aria-label="Maximize">&#9633;</button>
            <button class="wc-close" title="Close" aria-label="Close">&#10005;</button>
        </div>`;
    $(".win-title", bar).textContent = el.dataset.title || "Window";
    el.insertBefore(bar, el.firstChild);

    const btn = document.createElement("button");
    btn.className = "task-btn";
    btn.innerHTML = `<span class="task-icon">${el.dataset.icon || "🗔"}</span><span class="task-label"></span>`;
    $(".task-label", btn).textContent = el.dataset.title || "Window";
    btn.addEventListener("click", () => {
        if (el.classList.contains("minimized")) showWin(el);
        else if (el.classList.contains("active")) minimizeWin(el);
        else focusWin(el);
    });
    $("#task-items").appendChild(btn);
    WM.wins[el.id] = { el, btn };

    $(".wc-min", bar).addEventListener("click", (e) => { e.stopPropagation(); minimizeWin(el); });
    $(".wc-max", bar).addEventListener("click", (e) => { e.stopPropagation(); el.classList.toggle("maximized"); });
    $(".wc-close", bar).addEventListener("click", (e) => { e.stopPropagation(); closeWin(el); });
    bar.addEventListener("dblclick", (e) => {
        if (!e.target.closest(".win-controls")) el.classList.toggle("maximized");
    });
    el.addEventListener("pointerdown", () => focusWin(el));

    /* dragging */
    bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".win-controls")) return;
        if (el.classList.contains("maximized") || window.innerWidth <= 700) return;
        const desk = $("#desktop").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const ox = e.clientX - r.left;
        const oy = e.clientY - r.top;
        bar.setPointerCapture(e.pointerId);

        const move = (ev) => {
            const x = ev.clientX - ox - desk.left;
            const y = ev.clientY - oy - desk.top;
            el.style.left = Math.min(Math.max(x, -r.width + 100), desk.width - 100) + "px";
            el.style.top = Math.min(Math.max(y, 0), desk.height - 30) + "px";
        };
        const up = () => {
            bar.removeEventListener("pointermove", move);
            bar.removeEventListener("pointerup", up);
        };
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
    });
}

function centerWin(el) {
    const d = $("#desktop");
    const n = Object.keys(WM.wins).length % 5;
    el.style.left = Math.max(0, (d.clientWidth - el.offsetWidth) / 2 + n * 26 - 52) + "px";
    el.style.top = Math.max(8, (d.clientHeight - el.offsetHeight) / 2 + n * 26 - 52) + "px";
}

function focusWin(el) {
    el.style.zIndex = ++WM.z;
    Object.values(WM.wins).forEach((w) => {
        const on = w.el === el;
        w.el.classList.toggle("active", on);
        w.btn.classList.toggle("active", on);
    });
}

function activateTop() {
    const vis = Object.values(WM.wins)
        .map((w) => w.el)
        .filter((e) => !e.classList.contains("closed") && !e.classList.contains("minimized"));
    vis.sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0));
    if (vis.length) focusWin(vis[vis.length - 1]);
}

function minimizeWin(el) {
    const w = WM.wins[el.id];
    el.classList.add("minimized");
    el.classList.remove("active");
    if (w) w.btn.classList.remove("active");
    activateTop();
}

function showWin(el) {
    const w = WM.wins[el.id];
    el.classList.remove("minimized", "closed");
    if (w) w.btn.classList.remove("hidden");
    focusWin(el);
}

function closeWin(el) {
    const w = WM.wins[el.id];
    if (!w) return;
    if (el.dataset.static !== undefined) {
        el.classList.add("closed");
        el.classList.remove("active");
        w.btn.classList.add("hidden");
    } else {
        w.btn.remove();
        el.remove();
        delete WM.wins[el.id];
    }
    activateTop();
}

function setWinTitle(el, title, icon) {
    el.dataset.title = title;
    if (icon) el.dataset.icon = icon;
    $(".win-title", el).textContent = title;
    $(".win-icon", el).textContent = el.dataset.icon || "🗔";
    const w = WM.wins[el.id];
    if (w) {
        $(".task-label", w.btn).textContent = title;
        $(".task-icon", w.btn).textContent = el.dataset.icon || "🗔";
    }
}

function reuse(id) {
    const w = WM.wins[id];
    if (!w) return null;
    showWin(w.el);
    return w.el;
}

function createWindow(o) {
    const ex = reuse(o.id);
    if (ex) return ex;

    const el = document.createElement("section");
    el.className = "window";
    el.id = o.id;
    el.dataset.title = o.title;
    el.dataset.icon = o.icon;
    el.style.width = o.width || "520px";
    if (o.height) el.style.height = o.height;
    el.innerHTML = `<div class="win-body app ${o.cls || ""}">${o.body}</div>`;

    $("#desktop").appendChild(el);
    decorate(el);
    centerWin(el);
    focusWin(el);
    return el;
}

/* =====================================================
   APPS
===================================================== */

/* ---------- Mail ---------- */
function getSent() {
    try { return JSON.parse(store.get("bd_sent", "[]")); } catch (e) { return []; }
}

function openMail() {
    if (reuse("app-mail")) return;

    const el = createWindow({
        id: "app-mail", title: "Mail", icon: "✉️", width: "640px", height: "380px",
        body: `
            <div class="toolbar">
                <button class="btn" data-act="new">✉ New</button>
                <button class="btn" data-act="reply">↩ Reply</button>
                <button class="btn" data-act="sync">⟳ Send/Receive</button>
            </div>
            <div class="mail-cols">
                <ul class="mail-folders">
                    <li data-f="inbox" class="sel">📥 Inbox</li>
                    <li data-f="sent">📤 Sent Items</li>
                    <li data-f="deleted">🗑️ Deleted Items</li>
                </ul>
                <div class="mail-list"></div>
            </div>
            <div class="statusbar"></div>`
    });

    let folder = "inbox";

    const render = () => {
        const list = $(".mail-list", el);
        let rows = [];

        if (folder === "inbox") {
            rows = [{ from: SENDER + " ❤️", subject: "It's been a while...", date: "Today", letter: true, unread: isUnread() }];
        } else if (folder === "sent") {
            rows = getSent().slice().reverse().map((m) => ({
                from: "To: " + m.to, subject: m.subject || "(no subject)", date: m.date, body: m.body
            }));
        } else {
            rows = [
                { from: "Excuses", subject: "Being too busy", date: "Ages ago", body: "Deleted. Some things should stay deleted." },
                { from: "Procrastination", subject: "I'll do it tomorrow", date: "Ages ago", body: "Deleted. (Tomorrow never came.)" }
            ];
        }

        list.innerHTML = "";
        if (!rows.length) list.innerHTML = '<p class="empty">There are no items in this folder.</p>';

        rows.forEach((r) => {
            const b = document.createElement("button");
            b.className = "mail-row" + (r.unread ? " unread" : "");
            b.innerHTML = `<span>${esc(r.from)}</span><span>${esc(r.subject)}</span><small>${esc(r.date)}</small>`;
            b.onclick = () => {
                if (r.letter) return openLetter();
                showDialog({
                    title: r.subject, icon: "✉️",
                    text: "<b>" + esc(r.from) + "</b><br><br>" + esc(r.body || "").replace(/\n/g, "<br>")
                });
            };
            list.appendChild(b);
        });

        const unread = folder === "inbox" && isUnread() ? 1 : 0;
        $(".statusbar", el).textContent = rows.length + " message" + (rows.length === 1 ? "" : "s") + ", " + unread + " unread";
    };

    el._render = render;

    $$(".mail-folders li", el).forEach((li) => {
        li.onclick = () => {
            $$(".mail-folders li", el).forEach((x) => x.classList.remove("sel"));
            li.classList.add("sel");
            folder = li.dataset.f;
            render();
        };
    });

    $('[data-act="new"]', el).onclick = () => openCompose(false);
    $('[data-act="reply"]', el).onclick = () => openCompose(true);
    $('[data-act="sync"]', el).onclick = () =>
        showDialog({ title: "Send/Receive", icon: "📬", text: "No new messages.<br>You're all caught up. ❤️" });

    render();
}

function openCompose(reply) {
    if (reuse("app-compose")) return;
    const subj = reply ? "RE: It's been a while..." : "";

    const el = createWindow({
        id: "app-compose", title: reply ? subj : "New Message", icon: "✉️", width: "520px", height: "380px",
        body: `
            <div class="compose">
                <label>To: <input id="cm-to" value="${esc(SENDER)}"></label>
                <label>Subject: <input id="cm-sub" value="${esc(subj)}"></label>
                <textarea id="cm-body" placeholder="Write something sweet..."></textarea>
                <div class="compose-actions">
                    <button class="btn btn-primary" id="cm-send">Send</button>
                    <button class="btn" id="cm-cancel">Cancel</button>
                </div>
            </div>`
    });

    $("#cm-cancel", el).onclick = () => closeWin(el);
    $("#cm-send", el).onclick = () => {
        const body = $("#cm-body", el).value.trim();
        if (!body) {
            showDialog({ title: "Mail", icon: "⚠️", text: "Please write something first. 🙂" });
            return;
        }
        const sent = getSent();
        sent.push({ to: $("#cm-to", el).value, subject: $("#cm-sub", el).value, body, date: new Date().toLocaleString() });
        store.set("bd_sent", JSON.stringify(sent));
        closeWin(el);
        if (WM.wins["app-mail"] && WM.wins["app-mail"].el._render) WM.wins["app-mail"].el._render();
        showDialog({ title: "Message sent", icon: "💌", text: "Your message was sent. ❤️" });
    };
}

/* ---------- Notepad ---------- */
function openNotepad() {
    if (reuse("app-notepad")) return;
    const el = createWindow({
        id: "app-notepad", title: "Untitled - Notepad", icon: "📝", width: "460px", height: "340px",
        body: `
            <div class="toolbar">
                <button class="btn" data-act="new">New</button>
                <button class="btn" data-act="save">Save</button>
                <button class="btn" data-act="date">Time/Date</button>
            </div>
            <textarea class="np-text" spellcheck="false"></textarea>`
    });
    const ta = $(".np-text", el);
    ta.value = store.get("bd_note", "Type something sweet here...");

    $('[data-act="new"]', el).onclick = () => { ta.value = ""; ta.focus(); };
    $('[data-act="save"]', el).onclick = () => {
        store.set("bd_note", ta.value);
        showDialog({ title: "Notepad", icon: "💾", text: "Your note was saved on this device." });
    };
    $('[data-act="date"]', el).onclick = () => {
        ta.value += (ta.value ? "\n" : "") + new Date().toLocaleString();
        ta.focus();
    };
}

/* ---------- Web Browser ---------- */
function openBrowser() {
    if (reuse("app-browser")) return;
    const el = createWindow({
        id: "app-browser", title: "Web Browser", icon: "🌐", width: "640px", height: "440px",
        body: `
            <div class="br-bar">
                <button class="nav" id="br-back" disabled>◀</button>
                <button class="nav" id="br-fwd" disabled>▶</button>
                <button class="nav" id="br-refresh">⟳</button>
                <input class="br-url" id="br-url" value="bigdugg://home" spellcheck="false">
                <button class="btn" id="br-go">Go</button>
            </div>
            <div class="br-view" id="br-view"></div>`
    });

    const view = $("#br-view", el);
    const urlBox = $("#br-url", el);
    let hist = [], idx = -1;

    const page = (url) => {
        const u = url.trim();
        const low = u.toLowerCase();
        if (!sys.net) {
            return `<h2>📵 You're offline</h2><p>You are not connected to a network.</p><br><button class="btn" data-act="connect">Connect</button>`;
        }
        if (!low || low === "bigdugg://home") {
            return `<div class="br-home">
                <div class="br-logo">Bigdugg<span>Search</span></div>
                <div class="br-search"><input id="br-q" placeholder="Search the web"><button class="btn" data-act="search">Search</button></div>
                <p><a data-go="bigdugg://love">Why am I loved?</a> · <a data-go="bigdugg://weather">Weather in my heart</a> · <a data-go="bigdugg://news">Latest news</a></p>
            </div>`;
        }
        if (low === "bigdugg://love")    return `<h2>You are loved. ❤️</h2><p>1 result found. Confidence: 100%.</p><br><a data-go="bigdugg://home">← Back to search</a>`;
        if (low === "bigdugg://weather") return `<h2>☀️ Weather in my heart</h2><p>Sunny, with a 100% chance of ❤️.</p><br><a data-go="bigdugg://home">← Back to search</a>`;
        if (low === "bigdugg://news")    return `<h2>📰 BREAKING NEWS</h2><p>Man finally sends love letter. Experts say "about time."</p><br><a data-go="bigdugg://home">← Back to search</a>`;
        return `<h2>Search results for "${esc(u)}"</h2>
            <div class="br-result"><a data-go="bigdugg://love">${esc(u)} — all you need to know</a><small>bigdugg://love</small>You are loved.</div>
            <div class="br-result"><a data-go="bigdugg://weather">${esc(u)} forecast</a><small>bigdugg://weather</small>Sunny, with a chance of ❤️.</div>
            <div class="br-result"><a data-go="bigdugg://news">${esc(u)} in the news</a><small>bigdugg://news</small>Man finally sends love letter.</div>
            <a data-go="bigdugg://home">← Back to search</a>`;
    };

    const draw = () => {
        const cur = hist[idx] || "bigdugg://home";
        urlBox.value = cur;
        view.innerHTML = page(cur);
        $("#br-back", el).disabled = idx <= 0;
        $("#br-fwd", el).disabled = idx >= hist.length - 1;
        setWinTitle(el, cur === "bigdugg://home" ? "Web Browser" : "Web Browser - " + cur, "🌐");
    };
    const go = (u) => {
        hist = hist.slice(0, idx + 1);
        hist.push(u || "bigdugg://home");
        idx = hist.length - 1;
        draw();
    };

    view.addEventListener("click", (e) => {
        const a = e.target.closest("[data-go]");
        if (a) return go(a.dataset.go);
        const act = e.target.closest("[data-act]");
        if (!act) return;
        if (act.dataset.act === "search") {
            const q = $("#br-q", el).value.trim();
            if (q) go(q);
        }
        if (act.dataset.act === "connect") { sys.net = true; updateTray(); draw(); }
    });
    view.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "br-q" && e.target.value.trim()) go(e.target.value.trim());
    });

    $("#br-go", el).onclick = () => go(urlBox.value);
    urlBox.addEventListener("keydown", (e) => { if (e.key === "Enter") go(urlBox.value); });
    $("#br-refresh", el).onclick = draw;
    $("#br-back", el).onclick = () => { if (idx > 0) { idx--; draw(); } };
    $("#br-fwd", el).onclick = () => { if (idx < hist.length - 1) { idx++; draw(); } };

    go("bigdugg://home");
}

/* ---------- Folders ---------- */
function openFolder(o) {
    if (reuse(o.id)) return;
    const el = createWindow({
        id: o.id, title: o.title, icon: o.icon, width: "520px", height: "360px",
        body: `
            <div class="toolbar">
                ${(o.actions || []).map((a) => `<button class="btn" data-act="${a.id}">${a.label}</button>`).join("")}
                <span class="addr">${o.icon} ${esc(o.title)}</span>
            </div>
            <div class="folder-grid"></div>
            <div class="statusbar"></div>`
    });

    const draw = () => {
        const grid = $(".folder-grid", el);
        grid.innerHTML = "";
        o.items.forEach((it) => {
            const b = document.createElement("button");
            b.className = "f-item";
            b.innerHTML = `<span class="f-ico">${it.icon}</span><span class="f-name">${esc(it.label)}</span>`;
            b.onclick = () => {
                $$(".f-item", el).forEach((x) => x.classList.remove("sel"));
                b.classList.add("sel");
                if (isTouch()) it.run();
            };
            b.ondblclick = () => it.run();
            grid.appendChild(b);
        });
        if (!o.items.length) grid.innerHTML = '<p class="empty">This folder is empty.</p>';
        $(".statusbar", el).textContent = o.items.length + " item" + (o.items.length === 1 ? "" : "s");
    };

    (o.actions || []).forEach((a) => { $(`[data-act="${a.id}"]`, el).onclick = () => a.run(draw); });
    draw();
}

const note = (title, icon, text) => () => showDialog({ title, icon, text });

function openDocuments() {
    openFolder({
        id: "app-docs", title: "Documents", icon: "📁",
        items: [
            { icon: "💌", label: "love-letter.txt", run: openLetter },
            { icon: "🛡️", label: "assessment.exe", run: openAssessment },
            { icon: "📄", label: "Read me.txt", run: note("Read me.txt", "📄", "Open <b>love-letter.txt</b> first.<br>Then run <b>assessment.exe</b>. ❤️") },
            { icon: "🗂️", label: "Memories", run: openMemories }
        ]
    });
}

function openMemories() {
    openFolder({
        id: "app-memories", title: "Memories (D:)", icon: "💾",
        items: [
            { icon: "😄", label: "Inside jokes.txt", run: note("Inside jokes.txt", "😄", "You had to be there. 😄") },
            { icon: "🎵", label: "Good times.mp3", run: note("Good times.mp3", "🎵", "♪ Now playing: the soundtrack of good times ♪") },
            { icon: "📅", label: "Plans.docx", run: note("Plans.docx", "📅", "Many more adventures to come. ❤️") }
        ]
    });
}

const BIN = {
    items: [
        { icon: "📄", label: "Excuses.doc", run: note("Excuses.doc", "📄", "Deleted for a reason.") },
        { icon: "🗜️", label: "Procrastination.zip", run: note("Procrastination.zip", "🗜️", "Extraction postponed until tomorrow.") },
        { icon: "📄", label: "Being_busy.txt", run: note("Being_busy.txt", "📄", "Still true sometimes. But not an excuse.") }
    ]
};

function openBin() {
    openFolder({
        id: "app-bin", title: "Recycle Bin", icon: "🗑️", items: BIN.items,
        actions: [
            {
                id: "empty", label: "Empty the Recycle Bin",
                run: (draw) => showDialog({
                    title: "Delete Multiple Items", icon: "⚠️",
                    text: "Are you sure you want to permanently delete these items?",
                    buttons: [
                        { label: "Yes", run: () => { BIN.items.length = 0; draw(); } },
                        { label: "No" }
                    ]
                })
            },
            {
                id: "restore", label: "Restore all items",
                run: () => showDialog({ title: "Restore", icon: "↩️", text: "Nothing was restored.<br>Some things should stay deleted. 😌" })
            }
        ]
    });
}

function openComputer() {
    if (reuse("app-computer")) return;
    const el = createWindow({
        id: "app-computer", title: "Computer", icon: "🖥️", width: "540px", height: "360px",
        body: `
            <div class="toolbar"><span class="addr">🖥️ Computer</span></div>
            <div class="drive-list"></div>
            <div class="statusbar">3 items</div>`
    });

    const drives = [
        { icon: "💽", name: "Local Disk (C:)", pct: 99, info: "1 GB free of 100 GB", run: openDocuments },
        { icon: "💾", name: "Memories (D:)", pct: 100, info: "0 bytes free", run: openMemories },
        { icon: "📀", name: "DVD RW Drive (E:)", pct: 0, info: "Love disc not inserted",
          run: note("Computer", "📀", "Please insert a disc into drive E:.<br><small>(Hint: it's the one that says ❤️)</small>") }
    ];

    const list = $(".drive-list", el);
    drives.forEach((d) => {
        const b = document.createElement("button");
        b.className = "drive";
        b.innerHTML = `
            <span class="drive-ico">${d.icon}</span>
            <span class="drive-info"><b>${esc(d.name)}</b>
                <div class="progress"><div style="width:${d.pct}%"></div></div>
                <small>${esc(d.info)}</small>
            </span>`;
        b.onclick = () => { if (isTouch()) d.run(); };
        b.ondblclick = d.run;
        list.appendChild(b);
    });
}

/* ---------- Control Panel ---------- */
function applyTheme() {
    document.body.classList.remove("wp-harmony", "wp-sakura", "wp-night");
    document.body.classList.add("wp-" + store.get("bd_wp", "harmony"));
    document.body.classList.toggle("noglass", store.get("bd_glass", "1") !== "1");
}

function openControl() {
    if (reuse("app-control")) return;
    const el = createWindow({
        id: "app-control", title: "Personalization", icon: "⚙️", width: "520px", height: "380px",
        body: `
            <div class="cp">
                <h3>Change the visuals and sounds on your computer</h3>
                <div class="wp-list">
                    <button class="wp-thumb" data-wp="harmony">Harmony</button>
                    <button class="wp-thumb" data-wp="sakura">Sakura</button>
                    <button class="wp-thumb" data-wp="night">Night</button>
                </div>
                <label class="chk"><input type="checkbox" id="cp-glass"> Enable Aero glass transparency</label>
                <label class="chk"><input type="checkbox" id="cp-sound"> Play system sounds</label>
                <div class="cp-actions"><button class="btn" id="cp-reset">Restore defaults</button></div>
            </div>`
    });

    const sync = () => {
        $$(".wp-thumb", el).forEach((b) => b.classList.toggle("sel", b.dataset.wp === store.get("bd_wp", "harmony")));
        $("#cp-glass", el).checked = store.get("bd_glass", "1") === "1";
        $("#cp-sound", el).checked = store.get("bd_sound", "1") === "1";
    };

    $$(".wp-thumb", el).forEach((b) => {
        b.onclick = () => { store.set("bd_wp", b.dataset.wp); applyTheme(); sync(); beep(700); };
    });
    $("#cp-glass", el).onchange = (e) => { store.set("bd_glass", e.target.checked ? "1" : "0"); applyTheme(); };
    $("#cp-sound", el).onchange = (e) => { store.set("bd_sound", e.target.checked ? "1" : "0"); beep(700); };
    $("#cp-reset", el).onclick = () => {
        store.set("bd_wp", "harmony"); store.set("bd_glass", "1"); store.set("bd_sound", "1");
        applyTheme(); sync();
    };
    sync();
}

/* ---------- Command Prompt ---------- */
function openCmd(autorun) {
    const ex = reuse("app-cmd");
    if (ex) { if (autorun) ex._run(autorun); return; }

    const el = createWindow({
        id: "app-cmd", title: "Command Prompt", icon: "⬛", width: "600px", height: "360px", cls: "cmd",
        body: `
            <div class="cmd-out"></div>
            <div class="cmd-line"><span>C:\\Users\\You&gt;</span><input class="cmd-in" autocomplete="off" spellcheck="false"></div>`
    });

    const out = $(".cmd-out", el);
    const input = $(".cmd-in", el);

    const print = (t) => {
        const d = document.createElement("div");
        d.textContent = t;
        out.appendChild(d);
        out.scrollTop = out.scrollHeight;
    };
    const lines = (arr, gap) => arr.forEach((t, i) => setTimeout(() => print(t), i * gap));

    const run = (raw) => {
        const cmd = raw.trim();
        const low = cmd.toLowerCase();
        print("C:\\Users\\You>" + cmd);
        if (!cmd) return;

        if (low === "help") {
            lines(["Commands: help, cls, date, time, whoami, ver, love, dir, ipconfig,",
                   "          ping her, open letter, open assessment, exit",
                   "Try: sudo apt install happiness"], 0);
        } else if (low === "cls") { out.innerHTML = ""; }
        else if (low === "date") print(new Date().toLocaleDateString());
        else if (low === "time") print(new Date().toLocaleTimeString());
        else if (low === "whoami") print("bigdugg7\\loved-one");
        else if (low === "ver") print("Bigdugg OS [Version 7.0.1.4ever]");
        else if (low === "love") print("❤️  You are loved.  ❤️");
        else if (low === "dir") lines([" Directory of C:\\Users\\You\\Documents", "", "01/10/2026  love-letter.txt", "01/10/2026  assessment.exe", "               2 File(s)"], 0);
        else if (low === "ipconfig") lines(["Bigdugg IP Configuration", "   Connection : Her Heart ❤️", "   Status     : " + (sys.net ? "Connected" : "Disconnected")], 0);
        else if (low.startsWith("ping")) {
            lines(["Pinging Her Heart [❤️] with 32 bytes of data:",
                   "Reply from ❤️: bytes=32 time<1ms TTL=128",
                   "Reply from ❤️: bytes=32 time<1ms TTL=128",
                   "Reply from ❤️: bytes=32 time<1ms TTL=128",
                   "Packets: Sent = 3, Received = 3, Lost = 0 (0% loss)"], 350);
        }
        else if (low === "open letter") { print("Opening love-letter.txt..."); setTimeout(openLetter, 700); }
        else if (low === "open assessment") { print("Starting assessment.exe..."); setTimeout(openAssessment, 700); }
        else if (low === "exit") closeWin(el);
        else if (low === "sudo apt install happiness" || low === "apt install happiness") {
            lines(["Reading package lists... Done",
                   "Building dependency tree... Done",
                   "The following NEW packages will be installed:",
                   "  happiness (∞)",
                   "Unpacking happiness ...",
                   "Setting up happiness ...",
                   "✔ Happiness installed successfully. ❤️"], 450);
        }
        else print("'" + cmd + "' is not recognized as an internal or external command.\nType help to see what works.");
    };

    el._run = run;
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { run(input.value); input.value = ""; }
    });
    $(".win-body", el).addEventListener("click", () => input.focus());

    print("Bigdugg OS [Version 7.0.1.4ever]");
    print("Type help for a list of commands.\n");
    if (autorun) run(autorun); else input.focus();
}

/* ---------- Run ---------- */
function openRun() {
    if (reuse("app-run")) return;
    const el = createWindow({
        id: "app-run", title: "Run", icon: "▶️", width: "400px",
        body: `
            <div class="run-body">
                <p>Type the name of a program, folder or document, and Bigdugg 7 will open it for you.</p>
                <div class="run-row"><label for="run-in">Open:</label><input id="run-in" autocomplete="off" placeholder="letter, mail, notepad, cmd..."></div>
                <div class="compose-actions">
                    <button class="btn btn-primary" id="run-ok">OK</button>
                    <button class="btn" id="run-cancel">Cancel</button>
                </div>
            </div>`
    });

    const input = $("#run-in", el);
    const map = {
        letter: openLetter, assessment: openAssessment, mail: openMail, notepad: openNotepad,
        cmd: () => openCmd(), browser: openBrowser, control: openControl, computer: openComputer,
        documents: openDocuments, bin: openBin, recycle: openBin
    };

    const go = () => {
        const v = input.value.trim().toLowerCase().replace(/\.(exe|txt)$/, "");
        if (!v) return;
        if (map[v]) { closeWin(el); map[v](); }
        else showDialog({ title: "Run", icon: "⚠️", text: "Bigdugg 7 cannot find '" + esc(input.value) + "'. Check the name and try again." });
    };
    $("#run-ok", el).onclick = go;
    $("#run-cancel", el).onclick = () => closeWin(el);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    input.focus();
}

const APPS = {
    mail: openMail, notepad: openNotepad, browser: openBrowser, cmd: () => openCmd(),
    computer: openComputer, documents: openDocuments, bin: openBin, control: openControl, run: openRun
};
function openApp(name) { if (APPS[name]) APPS[name](); }

/* =====================================================
   DESKTOP ICONS
===================================================== */

const ICONS = [
    { app: "computer", icon: "🖥️", label: "Computer" },
    { app: "documents", icon: "📁", label: "Documents" },
    { app: "mail", icon: "✉️", label: "Mail" },
    { app: "browser", icon: "🌐", label: "Web Browser" },
    { app: "notepad", icon: "📝", label: "Notepad" },
    { app: "bin", icon: "🗑️", label: "Recycle Bin" },
    { app: "control", icon: "⚙️", label: "Control Panel" }
];

function buildIcons() {
    const wrap = document.createElement("div");
    wrap.className = "icons";
    ICONS.forEach((ic) => {
        const b = document.createElement("button");
        b.className = "d-icon";
        b.innerHTML = `<span class="d-glyph">${ic.icon}${ic.app === "mail" ? '<span class="d-badge hidden" id="mail-badge">1</span>' : ""}</span><span class="d-label">${ic.label}</span>`;
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            $$(".d-icon").forEach((x) => x.classList.remove("sel"));
            b.classList.add("sel");
            if (isTouch()) openApp(ic.app);
        });
        b.addEventListener("dblclick", () => openApp(ic.app));
        b.addEventListener("keydown", (e) => { if (e.key === "Enter") openApp(ic.app); });
        wrap.appendChild(b);
    });
    $("#desktop").appendChild(wrap);
    $("#desktop").addEventListener("click", () => $$(".d-icon.sel").forEach((x) => x.classList.remove("sel")));
}

/* =====================================================
   TASKBAR, TRAY, BALLOON
===================================================== */

function updateTray() {
    const v = $("#tray-vol");
    if (!v) return;
    v.textContent = sys.muted || sys.volume === 0 ? "🔇" : sys.volume < 40 ? "🔈" : sys.volume < 75 ? "🔉" : "🔊";
    $("#tray-net").textContent = sys.net ? "📶" : "🚫";
}

function refreshMailState() {
    const unread = isUnread();
    const badge = $("#mail-badge");
    if (badge) badge.classList.toggle("hidden", !unread);
    const dot = $("#flag-dot");
    if (dot) dot.classList.toggle("hidden", !unread);
    const sub = $("#gadget-sub");
    if (sub) sub.innerHTML = unread ? "You have <b>1</b> new message" : "No new messages";
    if (WM.wins["app-mail"] && WM.wins["app-mail"].el._render) WM.wins["app-mail"].el._render();
}

function tickClock() {
    const d = new Date();
    const t = $("#clock-time");
    if (!t) return;
    t.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    $("#clock-date").textContent = d.toLocaleDateString();
}

function closePop() { $("#tray-popup").classList.add("hidden"); }

function renderCalendar(pop, y, m) {
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    let cells = "";
    for (let i = 0; i < first; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
        const today = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
        cells += `<span class="cal-d${today ? " today" : ""}">${d}</span>`;
    }
    pop.innerHTML = `
        <div class="cal-head"><button data-n="-1">◀</button><b>${names[m]} ${y}</b><button data-n="1">▶</button></div>
        <div class="cal-week"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-foot">${now.toDateString()}</div>`;
    $$("[data-n]", pop).forEach((b) => {
        b.onclick = () => {
            let nm = m + +b.dataset.n, ny = y;
            if (nm < 0) { nm = 11; ny--; }
            if (nm > 11) { nm = 0; ny++; }
            renderCalendar(pop, ny, nm);
        };
    });
    $$(".cal-d", pop).forEach((c) => {
        c.onclick = () => { $$(".cal-d", pop).forEach((x) => x.classList.remove("picked")); c.classList.add("picked"); };
    });
}

const POP = {
    flag(pop) {
        pop.innerHTML = "<h4>Action Center</h4>" + (isUnread()
            ? `<p>📬 1 new message from ${esc(SENDER)}</p><button class="btn btn-primary" id="pp-open">Open message</button>`
            : "<p>✅ No new notifications.<br>Everything is running smoothly.</p>");
        const b = $("#pp-open", pop);
        if (b) b.onclick = () => { closePop(); openLetter(); };
    },
    net(pop) {
        pop.innerHTML = `<h4>Currently connected to:</h4>
            <p><b>Her Heart ❤️</b><br><small>${sys.net ? "Internet access" : "No connection"}</small></p>
            <button class="btn" id="pp-net">${sys.net ? "Disconnect" : "Connect"}</button>`;
        $("#pp-net", pop).onclick = () => { sys.net = !sys.net; updateTray(); POP.net(pop); beep(sys.net ? 880 : 300); };
    },
    vol(pop) {
        pop.innerHTML = `<h4>Volume</h4>
            <div class="vol-row"><input type="range" id="pp-vol" min="0" max="100" value="${sys.volume}"><span id="pp-volval">${sys.volume}</span></div>
            <label class="chk"><input type="checkbox" id="pp-mute" ${sys.muted ? "checked" : ""}> Mute</label>`;
        const r = $("#pp-vol", pop), m = $("#pp-mute", pop);
        r.oninput = () => {
            sys.volume = +r.value;
            $("#pp-volval", pop).textContent = r.value;
            store.set("bd_volume", r.value);
            if (sys.volume > 0 && sys.muted) { sys.muted = false; m.checked = false; store.set("bd_muted", "0"); }
            updateTray();
        };
        r.onchange = () => beep(740, 0.15);
        m.onchange = () => { sys.muted = m.checked; store.set("bd_muted", sys.muted ? "1" : "0"); updateTray(); if (!sys.muted) beep(740, 0.15); };
    },
    bat(pop) {
        pop.innerHTML = `<h4>Battery</h4>
            <p><b>100%</b> available (plugged in, charging)</p>
            <div class="progress"><div style="width:100%"></div></div>
            <p><small>Fully charged with love ❤️</small></p>
            <button class="btn" id="pp-cp">More power options</button>`;
        $("#pp-cp", pop).onclick = () => { closePop(); openApp("control"); };
    },
    clock(pop) { const n = new Date(); renderCalendar(pop, n.getFullYear(), n.getMonth()); }
};

function togglePop(kind) {
    const pop = $("#tray-popup");
    closeStart();
    if (!pop.classList.contains("hidden") && pop.dataset.kind === kind) { closePop(); return; }
    pop.dataset.kind = kind;
    POP[kind](pop);
    pop.classList.remove("hidden");
}

function showBalloon(title, html, onClick) {
    const b = $("#balloon");
    b.innerHTML = `<button class="balloon-x" aria-label="Close">×</button><div class="balloon-title">🔔 ${title}</div><div>${html}</div>`;
    b.onclick = (e) => {
        b.classList.add("hidden");
        if (!e.target.closest(".balloon-x") && onClick) onClick();
    };
    b.classList.remove("hidden");
    beep(880, 0.15);
}

/* ---------- Power ---------- */
function power(kind) {
    closeStart();
    const layer = document.createElement("div");
    layer.className = "power-layer";
    document.body.appendChild(layer);

    if (kind === "sleep") {
        layer.classList.add("sleep");
        layer.textContent = "💤 Sleeping... click anywhere to wake up";
        layer.onclick = () => layer.remove();
        return;
    }

    const labels = { shutdown: "Shutting down...", restart: "Restarting...", logoff: "Logging off..." };
    layer.innerHTML = `<div class="spinner"></div><div>${labels[kind]}</div>`;

    setTimeout(() => {
        if (kind === "shutdown") {
            layer.innerHTML = `<div>It's now safe to close this tab. ❤️</div><button class="btn" id="power-on">Power on</button>`;
            $("#power-on", layer).onclick = () => { session.remove("bd_login"); goHome(); };
        } else {
            session.remove("bd_login");
            goHome();
        }
    }, 1700);
}

/* ---------- Start menu ---------- */
const PROGRAMS = [
    { icon: "✉️", label: "Mail", run: () => openApp("mail") },
    { icon: "📝", label: "Notepad", run: () => openApp("notepad") },
    { icon: "🌐", label: "Web Browser", run: () => openApp("browser") },
    { icon: "⬛", label: "Command Prompt", run: () => openApp("cmd") },
    { icon: "🖥️", label: "Computer", run: () => openApp("computer") },
    { icon: "📁", label: "Documents", run: () => openApp("documents") },
    { icon: "🗑️", label: "Recycle Bin", run: () => openApp("bin") },
    { icon: "⚙️", label: "Control Panel", run: () => openApp("control") },
    { icon: "▶️", label: "Run...", run: () => openApp("run") },
    { icon: "💌", label: "love-letter.txt", run: openLetter },
    { icon: "🛡️", label: "assessment.exe", run: openAssessment }
];

function closeStart() {
    const m = $("#start-menu");
    if (m) m.classList.add("hidden");
    const b = $("#start-btn");
    if (b) b.classList.remove("open");
}

function buildStart() {
    const m = document.createElement("div");
    m.id = "start-menu";
    m.className = "start-menu hidden";
    m.innerHTML = `
        <div class="sm-left">
            <ul class="sm-list" id="sm-list"></ul>
            <button class="sm-all" id="sm-all">▶ All Programs</button>
            <div class="sm-search"><input id="sm-search" placeholder="Search programs and files" autocomplete="off"></div>
        </div>
        <div class="sm-right">
            <div class="sm-user"><div class="sm-avatar">🌸</div><span id="sm-name"></span></div>
            <ul class="sm-places" id="sm-places"></ul>
            <div class="sm-power">
                <button class="sm-shutdown" id="sm-shutdown">Shut down</button>
                <button class="sm-arrow" id="sm-arrow" aria-label="More options">▶</button>
                <ul class="sm-powermenu hidden" id="sm-powermenu">
                    <li data-p="logoff">Log off</li>
                    <li data-p="restart">Restart</li>
                    <li data-p="sleep">Sleep</li>
                </ul>
            </div>
        </div>`;
    document.body.appendChild(m);

    $("#sm-name").textContent = USER_NAME;

    const list = $("#sm-list");
    let showAll = false;

    const draw = (items) => {
        list.innerHTML = "";
        if (!items.length) list.innerHTML = '<p class="empty">No matches found.</p>';
        items.forEach((it) => {
            const li = document.createElement("li");
            li.innerHTML = `<button><span class="sm-ico">${it.icon}</span><span>${esc(it.label)}</span></button>`;
            $("button", li).onclick = () => { closeStart(); it.run(); };
            list.appendChild(li);
        });
    };
    const pinned = () => PROGRAMS.slice(0, 4);

    draw(pinned());

    $("#sm-all").onclick = () => {
        showAll = !showAll;
        $("#sm-search").value = "";
        draw(showAll ? PROGRAMS : pinned());
        $("#sm-all").textContent = showAll ? "◀ Back" : "▶ All Programs";
    };
    $("#sm-search").oninput = (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) { draw(showAll ? PROGRAMS : pinned()); return; }
        draw(PROGRAMS.filter((p) => p.label.toLowerCase().includes(q)));
    };

    const places = [
        { icon: "📁", label: "Documents", run: () => openApp("documents") },
        { icon: "🖥️", label: "Computer", run: () => openApp("computer") },
        { icon: "🗑️", label: "Recycle Bin", run: () => openApp("bin") },
        { icon: "⚙️", label: "Control Panel", run: () => openApp("control") },
        { icon: "▶️", label: "Run...", run: () => openApp("run") }
    ];
    const pl = $("#sm-places");
    places.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<button><span class="sm-ico">${p.icon}</span><span>${p.label}</span></button>`;
        $("button", li).onclick = () => { closeStart(); p.run(); };
        pl.appendChild(li);
    });

    $("#sm-shutdown").onclick = () => power("shutdown");
    $("#sm-arrow").onclick = () => $("#sm-powermenu").classList.toggle("hidden");
    $$("#sm-powermenu li").forEach((li) => { li.onclick = () => power(li.dataset.p); });
}

/* ---------- Taskbar ---------- */
function buildTaskbar() {
    const tb = document.createElement("div");
    tb.id = "taskbar";
    tb.className = "taskbar";
    tb.innerHTML = `
        <button class="start-btn" id="start-btn" aria-label="Start" title="Start"><span class="orb"><i></i><i></i><i></i><i></i></span></button>
        <div id="task-items"></div>
        <div class="tray">
            <button class="tray-btn" id="tray-flag" title="Action Center">⚑<span class="tray-dot hidden" id="flag-dot"></span></button>
            <button class="tray-btn" id="tray-net" title="Network">📶</button>
            <button class="tray-btn" id="tray-vol" title="Volume">🔊</button>
            <button class="tray-btn" id="tray-bat" title="Battery">🔋</button>
            <button class="clock" id="tray-clock" title="Date and time"><span id="clock-time"></span><span id="clock-date"></span></button>
        </div>
        <button class="show-desktop" id="show-desktop" title="Show desktop" aria-label="Show desktop"></button>`;
    document.body.appendChild(tb);

    const pop = document.createElement("div");
    pop.id = "tray-popup";
    pop.className = "tray-popup hidden";
    document.body.appendChild(pop);

    const bal = document.createElement("div");
    bal.id = "balloon";
    bal.className = "balloon hidden";
    document.body.appendChild(bal);

    $("#start-btn").onclick = () => {
        closePop();
        const m = $("#start-menu");
        const open = m.classList.contains("hidden");
        m.classList.toggle("hidden", !open);
        $("#start-btn").classList.toggle("open", open);
        $("#sm-powermenu").classList.add("hidden");
        if (open) $("#sm-search").focus();
    };

    $("#tray-flag").onclick = () => togglePop("flag");
    $("#tray-net").onclick = () => togglePop("net");
    $("#tray-vol").onclick = () => togglePop("vol");
    $("#tray-bat").onclick = () => togglePop("bat");
    $("#tray-clock").onclick = () => togglePop("clock");

    $("#show-desktop").onclick = () => {
        Object.values(WM.wins).forEach((w) => {
            if (!w.el.classList.contains("closed")) minimizeWin(w.el);
        });
    };

    document.addEventListener("pointerdown", (e) => {
        const m = $("#start-menu");
        if (!m.classList.contains("hidden") && !m.contains(e.target) && !e.target.closest("#start-btn")) closeStart();
        if (!pop.classList.contains("hidden") && !pop.contains(e.target) && !e.target.closest(".tray")) closePop();
    });

    tickClock();
    setInterval(tickClock, 10000);
    updateTray();
}

/* =====================================================
   PAGES
===================================================== */

function onDesktopReady() {
    refreshMailState();
    if (isUnread()) {
        setTimeout(() => {
            showBalloon(
                "SYSTEM NOTICE",
                "1 important message requires your attention.<br><b>RISK LEVEL: HIGH ❤️</b><br>Reason: It's been a while since you received one of these.<br><span class='balloon-go'>REVIEW MESSAGE</span>",
                openLetter
            );
        }, 1500);
    }
}

function initHome() {
    $("#login-name").textContent = USER_NAME;
    $("#gadget-open").onclick = () => openApp("mail");

    const boot = $("#boot-screen");
    const login = $("#login-screen");
    const welcome = $("#welcome-screen");

    const finish = () => { document.body.classList.remove("booting"); onDesktopReady(); };

    if (session.get("bd_login") === "1") {
        boot.classList.add("hidden");
        finish();
        return;
    }

    /* boot */
    const progress = $("#boot-progress");
    const status = $("#boot-status");
    const messages = ["Initialising...", "Loading desktop...", "Checking messages...", "Preparing something special...", "Almost ready..."];
    let amount = 0;

    const loader = setInterval(() => {
        amount += 3;
        progress.style.width = Math.min(amount, 100) + "%";
        const m = messages[Math.floor(amount / 20)];
        if (m) status.textContent = m;
        if (amount >= 100) {
            clearInterval(loader);
            setTimeout(() => { boot.classList.add("hidden"); login.classList.remove("hidden"); $("#login-pass").focus(); }, 300);
        }
    }, 45);

    /* login */
    const doLogin = () => {
        login.classList.add("hidden");
        welcome.classList.remove("hidden");
        beep(660, 0.2);
        setTimeout(() => {
            welcome.classList.add("hidden");
            session.set("bd_login", "1");
            finish();
        }, 1600);
    };
    $("#login-go").onclick = doLogin;
    $("#login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    $("#login-ease").onclick = () => showDialog({ title: "Ease of Access", icon: "♿", text: "Everything here is already easy.<br>Just press the arrow. ❤️" });
    $("#login-shutdown").onclick = () => power("shutdown");
}

function initLetter() {
    store.set("bd_mail_read", "1");
    refreshMailState();

    $("#btn-reply").onclick = () => openCompose(true);
    $("#btn-print").onclick = () => window.print();
    $("#btn-delete").onclick = () => showDialog({
        title: "Delete message", icon: "⚠️",
        text: "Are you sure you want to delete this message?",
        buttons: [
            { label: "No" },
            { label: "Yes", run: () => showDialog({ title: "Nice try", icon: "💌", text: "This message can't be deleted.<br>It's too important. ❤️" }) }
        ]
    });
    $("#btn-continue").onclick = openAssessment;
}

function showFinalMessage() {
    $("#assessment-result").classList.add("hidden");
    $("#final-message").classList.remove("hidden");
    setWinTitle($("#assess-window"), "System Status", "🪟");
    beep(988, 0.25);
}

function initAssessment() {
    const win = $("#assess-window");
    const progress = $("#analysis-progress");
    const text = $("#analysis-text");
    const messages = [
        "Checking message status...",
        "Reviewing emotional exposure...",
        "Assessing communication risk...",
        "Identifying mitigation strategy...",
        "Finalising assessment..."
    ];
    let amount = 0;

    const timer = setInterval(() => {
        amount += 5;
        progress.style.width = amount + "%";
        const m = messages[Math.floor(amount / 20)];
        if (m) text.textContent = m;
        if (amount >= 100) {
            clearInterval(timer);
            text.textContent = "Assessment complete.";
            setTimeout(() => {
                $("#analysis-screen").classList.add("hidden");
                $("#assessment-result").classList.remove("hidden");
                setWinTitle(win, "Risk Assessment Report", "🛡️");
                beep(880, 0.2);
            }, 700);
        }
    }, 100);

    $("#btn-cancel").onclick = () => showDialog({
        title: "Risk Assessment", icon: "🛡️",
        text: "This assessment can't be cancelled.<br>It's for your own good. ❤️"
    });
    $("#btn-final").onclick = showFinalMessage;
    $("#btn-reread").onclick = openLetter;
    $("#btn-cmd").onclick = () => openCmd();
    $("#btn-replay").onclick = () => power("restart");
    $("#egg").onclick = () => openCmd("sudo apt install happiness");
}

/* =====================================================
   START EVERYTHING
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    buildTaskbar();
    buildStart();
    buildIcons();

    $$("[data-static]").forEach((el) => {
        decorate(el);
        centerWin(el);
        focusWin(el);
    });

    const page = document.body.dataset.page;
    if (page === "home") initHome();
    else if (page === "letter") initLetter();
    else if (page === "assessment") initAssessment();
});
