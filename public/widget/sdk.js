/**
 * PlayStake Widget SDK v1.0.0
 * @license MIT
 */
(function(root) {
  "use strict";

  var WO = "https://widget.playstake.com";
  var WB = WO + "/widget";

  function W(c) {
    if (!c || !c.gameId || !c.widgetToken)
      throw new Error("PlayStake.init() requires gameId and widgetToken");
    var o = this;
    o._c = {
      gameId: c.gameId, wt: c.widgetToken, cid: c.containerId || null,
      theme: c.theme || "dark", pos: c.position || "right",
      onBet: c.onBetCreated || null, onAcc: c.onBetAccepted || null,
      onSet: c.onBetSettled || null, onErr: c.onError || null
    };
    o._if = null; o._wr = null; o._vis = false; o._rdy = false;
    o._q = []; o._id = "ps_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
    o._mh = o._onMsg.bind(o);
    window.addEventListener("message", o._mh, false);
    o._mk();
  }

  var P = W.prototype;

  P._mk = function() {
    var o = this, c = o._c;
    var url = WB + "?token=" + encodeURIComponent(c.wt) +
      "&gameId=" + encodeURIComponent(c.gameId) +
      "&theme=" + encodeURIComponent(c.theme) +
      "&instanceId=" + encodeURIComponent(o._id);

    o._wr = document.createElement("div");
    o._wr.id = "playstake-" + o._id;
    o._wr.setAttribute("role", "dialog");
    o._wr.setAttribute("aria-label", "PlayStake Widget");
    var s = o._wr.style;
    s.position = "fixed"; s.zIndex = "999999"; s.bottom = "16px";
    s.width = "380px"; s.height = "520px";
    s.maxHeight = "calc(100vh - 32px)"; s.maxWidth = "calc(100vw - 32px)";
    s.borderRadius = "12px"; s.overflow = "hidden";
    s.boxShadow = "0 8px 32px rgba(0,0,0,.3)";
    s.transition = "opacity .2s,transform .2s";
    s.opacity = "0"; s.transform = "translateY(12px)";
    s.pointerEvents = "none"; s.display = "none";

    if (c.pos === "left") s.left = "16px";
    else if (c.pos === "center") { s.left = "50%"; s.transform = "translateX(-50%) translateY(12px)"; }
    else s.right = "16px";

    o._if = document.createElement("iframe");
    o._if.src = url;
    o._if.title = "PlayStake Widget";
    o._if.setAttribute("allow", "clipboard-write");
    o._if.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    var is = o._if.style;
    is.width = is.height = "100%"; is.border = "none"; is.display = "block"; is.colorScheme = "normal";
    o._wr.appendChild(o._if);

    var ct = c.cid && document.getElementById(c.cid);
    if (ct) {
      s.position = "relative"; s.bottom = s.right = s.left = "auto";
      s.width = s.height = "100%"; ct.appendChild(o._wr);
    } else document.body.appendChild(o._wr);
  };

  P._onMsg = function(e) {
    if (e.origin !== WO) return;
    var d = e.data;
    if (!d || d.source !== "playstake-widget") return;
    if (d.instanceId && d.instanceId !== this._id) return;
    var c = this._c;
    switch (d.type) {
      case "WIDGET_READY": this._rdy = true; this._flush(); break;
      case "BET_CREATED": c.onBet && c.onBet(d.payload); break;
      case "BET_ACCEPTED": c.onAcc && c.onAcc(d.payload); break;
      case "BET_SETTLED": c.onSet && c.onSet(d.payload); break;
      case "ERROR": c.onErr && c.onErr(d.payload); break;
      case "CLOSE_WIDGET": this.close(); break;
    }
  };

  P._post = function(type, payload) {
    var m = { source: "playstake-sdk", instanceId: this._id, type: type, payload: payload || null };
    if (!this._rdy) { this._q.push(m); return; }
    this._if && this._if.contentWindow && this._if.contentWindow.postMessage(m, WO);
  };

  P._flush = function() {
    var q = this._q; this._q = [];
    for (var i = 0; i < q.length; i++)
      this._if && this._if.contentWindow && this._if.contentWindow.postMessage(q[i], WO);
  };

  P.open = function() {
    if (!this._wr) return;
    var s = this._wr.style, p = this._c.pos;
    s.display = "block"; this._vis = true;
    void this._wr.offsetHeight;
    s.opacity = "1"; s.pointerEvents = "auto";
    s.transform = p === "center" ? "translateX(-50%) translateY(0)" : "translateY(0)";
    this._post("OPEN");
  };

  P.close = function() {
    if (!this._wr) return;
    var s = this._wr.style, p = this._c.pos, w = this._wr;
    s.opacity = "0"; s.pointerEvents = "none";
    s.transform = p === "center" ? "translateX(-50%) translateY(12px)" : "translateY(12px)";
    this._vis = false;
    setTimeout(function() { w.style.display = "none"; }, 220);
    this._post("CLOSE");
  };

  P.destroy = function() {
    window.removeEventListener("message", this._mh, false);
    this._wr && this._wr.parentNode && this._wr.parentNode.removeChild(this._wr);
    this._if = this._wr = null; this._rdy = false; this._q = [];
  };

  P.createBet = function(opts) {
    if (!opts || !opts.amount) throw new Error("createBet() requires amount in cents");
    this._post("CREATE_BET", { amount: opts.amount, opponentId: opts.opponentId || null, metadata: opts.metadata || null });
    if (!this._vis) this.open();
  };

  P.isOpen = function() { return this._vis; };
  P.toggle = function() { this._vis ? this.close() : this.open(); };

  var PS = {
    init: function(c) { return new W(c); },
    _setOrigin: function(o) { WO = o; WB = o + "/widget"; }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PS;
  else root.PlayStake = PS;
})(typeof window !== "undefined" ? window : this);
