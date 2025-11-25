var _ya = [
  'Y2FsbA==',
  'dEpMQ3g=',
  'ZXFEWm8=',
  'dGVzdA==',
  'Z2V0TGF0ZXN0RWxlbWVudA==',
  'Y0xLR0s=',
  'XCtcKyAqKD86W2EtekEtWl8kXVswLTlhLXpBLVpfJF0qKQ==',
  'bGVuZ3Ro',
  'dk9XZGw=',
  'ZXhwb3J0cw==',
  'T2xFWVg=',
  'Y291bnRlcg==',
  'bEJacXI=',
  'YWRk',
  'blFTZU0=',
  'YWxSQUo=',
  'ZWRaSE4=',
  'ZnVuY3Rpb24gKlwoICpcKQ==',
  'YXBwbHk=',
  'WWxodmQ=',
  'SnJWcFA=',
  'QXpETUc=',
  'c3RhdGVPYmplY3Q=',
  'c3BsaWNl',
  'RHRmakI=',
  'aW5pdA==',
  'XihbXiBdKyggK1teIF0rKSspK1teIF19',
  'Sk5FbFo=',
  'cHVzaA==',
  'cmV0dXJuIC8iICsgdGhpcyArICIv',
  'YmZxcVE=',
  'ZGVsZXRl',
  'aGFzUXVldWU=',
  'RE1Eb1E=',
  'Y2hhaW4=',
  'ZGVidQ==',
  'ZVBQblQ=',
  'Z2dlcg==',
  'Y29uc3RydWN0b3I=',
  'dW1oTVI=',
  'YWN0aW9u',
  'd2hpbGUgKHRydWUpIHt9',
  'TmFkWGQ=',
  'Z2V0UXVldWU=',
  'UWhlZW8=',
  'Y2FwdGNoYVF1ZXVl',
  'bHBmSGU=',
  'c3RyaW5n',
  'Y29tcGlsZQ==',
  'aW5wdXQ='
];
var _yb = function (a, b) {
  a = a - 0;
  var c = _ya[a];
  if (_yb.ZICOwj === undefined) {
    (function () {
      var e = function () {
        var h;
        try {
          h = Function('return (function() {}.constructor("return this")( ));')();
        } catch (i) {
          h = window;
        }
        return h;
      };
      var f = e();
      var g = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      if (!f.atob) {
        f.atob = function (h) {
          var i = String(h).replace(/=+$/, '');
          var j = '';
          for (var k = 0, l, m, n = 0; m = i.charAt(n++); ~m && (l = k % 4 ? l * 64 + m : m, k++ % 4) ? j += String.fromCharCode(255 & l >> (-2 * k & 6)) : 0) {
            m = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.indexOf(m);
          }
          return j;
        };
      }
    }());
    _yb.iYlyGP = function (e) {
      var f = atob(e);
      var g = [];
      for (var h = 0, j = f.length; h < j; h++) {
        g += '%' + ('00' + f.charCodeAt(h).toString(16)).slice(-2);
      }
      return decodeURIComponent(g);
    };
    _yb.SUNniA = {};
    _yb.ZICOwj = true;
  }
  var d = _yb.SUNniA[a];
  if (_yb.SUNniA[a] === undefined) {
    var e = function (f) {
      this.WiEbYW = f;
      this.zUfMuq = [
        1,
        0,
        0
      ];
      this.miGuCC = 'function () {return "bypassed!"}';
      this.vAnxFE = '\\w+ *\\(\\) *{\\w+ *';
      this.UKswlE = '[\'|"].+[\'|"];? *}';
    };
    e.prototype.pBEQGN = function () {
      var f = new RegExp(this.vAnxFE + this.UKswlE);
      var g = f.test(this.miGuCC.toString()) ? --this.zUfMuq[1] : --this.zUfMuq[0];
      return this.zezjpi(g);
    };
    e.prototype.zezjpi = function (f) {
      if (!Boolean(~f)) {
        return f;
      }
      return this.dqknWq(this.WiEbYW);
    };
    e.prototype.dqknWq = function (f) {
      for (var g = 0, h = this.zUfMuq.length; g < h; g++) {
        this.zUfMuq.push(Math.round(Math.random()));
        h = this.zUfMuq.length;
      }
      return f(this.zUfMuq[0]);
    };
    new e(_yb).pBEQGN();
    c = _yb.iYlyGP(c);
    _yb.SUNniA[a] = c;
  } else {
    c = _yb.SUNniA[a];
  }
  return c;
};
var _yg = (function () {
  var a = true;
  return function (b, c) {
    var d = a ? function () {
      if (c) {
        var e = c.apply(b, arguments);
        c = null;
        return e;
      }
    } : function () {
    };
    a = false;
    return d;
  };
}());
var _yh = _yg(this, function () {
  var a = function () {
    var b = /^([^ ]+( +[^ ]+)+)+[^ ]}/;
    return !/^([^ ]+( +[^ ]+)+)+[^ ]}/.test(_yh);
  };
  return a();
});
_yh();
var _yi = (function () {
  var a = true;
  return function (b, c) {
    var d = a ? function () {
      if (c) {
        var f = c.apply(b, arguments);
        c = null;
        return f;
      }
    } : function () {
    };
    a = false;
    return d;
  };
}());
(function () {
  _yi(this, function () {
    var a = new RegExp('function *\\( *\\)');
    var b = new RegExp('\\+\\+ *(?:[a-zA-Z_$][0-9a-zA-Z_$]*)', 'i');
    var c = _yk('init');
    if (!a.test(c + 'chain') || !b.test(c + 'input')) {
      c('0');
    } else {
      _yk();
    }
  })();
}());
class _yj {
  constructor() {
    this.captchaQueue = [];
  }
  hasQueue() {
    return this.captchaQueue.length > 0;
  }
  add(a) {
    this.captchaQueue.push(a);
  }
  delete() {
    this.captchaQueue.splice(0, 1);
  }
  getLatestElement() {
    return this.captchaQueue[0];
  }
  getQueue() {
    return this.captchaQueue;
  }
}
module.exports = _yj;
function _yk(a) {
  function b(c) {
    if (typeof c === 'string') {
      return function () {
        while (true) {
        }
      }.apply('counter');
    } else {
      if (('' + c / c).length !== 1 || c % 20 === 0) {
        (function () {
          debugge_;
        }.call('action'));
      } else {
        (function () {
          debugge_;
        }.apply('stateObject'));
      }
    }
    b(++c);
  }
  try {
    if (a) {
      return b;
    } else {
      b(0);
    }
  } catch (e) {
  }
}