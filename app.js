(function () {
  "use strict";

  var state;
  var agentKey = null, agentShown = 0;
  function freshState() {
    return {
      role: "sales",
      view: "list",
      nav: "all",
      channelId: null,
      product: null,
      editing: null,
      reason: 0,
      clock: 9 * 60,
      channels: seedChannels(),
      chat: [],
      agentOpen: false,
    };
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function role() { return ROLES[state.role]; }
  function me() { return role().person; }
  function mine(ch) { return ch.sales === me() || ch.ops === me(); }
  function visible(ch) { return role().sees === "all" || mine(ch); }
  function chan(id) { return state.channels.filter(function (c) { return c.id === id; })[0]; }
  function enabled(ch) { return PRODUCTS.filter(function (p) { return ch.products[p.key]; }); }
  function missing(ch, p) {
    var list = p ? [p] : enabled(ch);
    var n = 0;
    list.forEach(function (prod) {
      prod.fields.forEach(function (f) { if (!ch.products[prod.key][f.key]) n++; });
    });
    return n;
  }
  function editable(ch) { return ch.status === "draft" || ch.status === "returned"; }
  function canEdit(ch, field) {
    if (!editable(ch) || !visible(ch)) return false;
    if (role().edit === "all") return mine(ch);
    if (role().edit === "method") return !!field.method;
    return false;
  }
  function canSubmit(ch) { return role().submit && mine(ch) && editable(ch); }
  function now() {
    state.clock += 7;
    var h = Math.floor(state.clock / 60) % 24, m = state.clock % 60;
    return "11-12 " + (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function log(ch, who, text) { ch.log.push([now(), who, text]); }
  function statusText(ch) {
    if (ch.status === "draft") return "录入中";
    if (ch.status === "live") return "已上线";
    var s = STAGES[ch.stage].name;
    return ch.status === "review" ? "审批中 · " + s : "已退回 · " + s;
  }
  function todo(ch) {
    if (!visible(ch)) return false;
    if (state.role === "lead") return ch.status === "review" && STAGES[ch.stage].who === "lead";
    if (state.role === "product") {
      return editable(ch) && enabled(ch).some(function (p) {
        return p.fields.some(function (f) { return f.method && !ch.products[p.key][f.key]; });
      });
    }
    return mine(ch) && editable(ch);
  }

  // ---------- views ----------
  function pill(ch) {
    return '<span class="pill s-' + ch.status + '">' + statusText(ch) + "</span>";
  }

  function listView() {
    var rows = state.channels.filter(function (ch) {
      if (state.nav === "todo") return todo(ch);
      return true;
    });
    var seen = state.channels.filter(visible).length;
    var head = state.nav === "todo" ? "待我处理" : "渠道列表";
    var sub = state.nav === "todo"
      ? rows.length + " 条渠道等你处理"
      : "共 " + state.channels.length + " 条渠道，你能看到 " + seen + " 条";
    var body = rows.map(function (ch) {
      if (!visible(ch)) {
        return '<tr class="locked"><td><b>渠道 —</b></td><td colspan="5">未分配给你，不可见</td><td><span class="lock">锁</span></td></tr>';
      }
      var miss = missing(ch);
      return '<tr data-act="open" data-id="' + ch.id + '">' +
        "<td><b>" + ch.name + "</b><small>" + ch.region + "</small></td>" +
        "<td>" + ch.sales + "</td><td>" + ch.ops + "</td>" +
        "<td>" + enabled(ch).map(function (p) { return '<span class="chip">' + p.name + "</span>"; }).join("") + "</td>" +
        "<td>" + pill(ch) + "</td>" +
        "<td>" + (miss ? '<span class="warn">' + miss + " 个待补充</span>" : '<span class="ok">齐全</span>') + "</td>" +
        '<td class="go">打开</td></tr>';
    }).join("");
    if (!rows.length) body = '<tr class="empty"><td colspan="7">现在没有需要你处理的渠道</td></tr>';
    return '<section class="page"><div class="page-head"><div><h1>' + head + "</h1><p>" + sub + "</p></div></div>" +
      '<div class="card table-card"><table class="tbl"><thead><tr><th>渠道</th><th>商务</th><th>运营</th><th>产品线</th><th>状态</th><th>字段</th><th></th></tr></thead><tbody>' +
      body + "</tbody></table></div></section>";
  }

  function logView() {
    var all = [];
    state.channels.filter(visible).forEach(function (ch) {
      ch.log.forEach(function (l) { all.push([l[0], l[1], ch.name + "：" + l[2]]); });
    });
    all.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; });
    return '<section class="page"><div class="page-head"><div><h1>操作记录</h1><p>你能看到的渠道上，每一次提交、修改、通过和退回</p></div></div>' +
      '<div class="card"><ol class="log big">' + all.map(logItem).join("") + "</ol></div></section>";
  }

  function logItem(l) {
    return "<li><time>" + l[0] + "</time><b>" + esc(l[1]) + "</b><span>" + esc(l[2]) + "</span></li>";
  }

  function detailView() {
    var ch = chan(state.channelId);
    var prods = enabled(ch);
    if (!state.product || !ch.products[state.product]) state.product = prods[0].key;
    var cur = PRODUCTS.filter(function (p) { return p.key === state.product; })[0];

    var tabs = PRODUCTS.map(function (p) {
      if (!ch.products[p.key]) return '<button class="tab off" disabled>' + p.name + "<i>未开通</i></button>";
      var m = missing(ch, p);
      return '<button class="tab' + (p.key === state.product ? " on" : "") + '" data-act="tab" data-p="' + p.key + '">' + p.name +
        (m ? '<i class="warn">' + m + " 待补充</i>" : '<i class="ok">齐全</i>') + "</button>";
    }).join("");

    var fields = cur.fields.map(function (f) {
      var val = ch.products[cur.key][f.key];
      var can = canEdit(ch, f);
      var isEditing = state.editing && state.editing.p === cur.key && state.editing.f === f.key;
      var valHtml;
      if (isEditing) {
        valHtml = '<form class="edit" data-act="save"><input name="v" value="' + esc(val) + '" placeholder="填写' + f.name + '" autocomplete="off"><button class="btn sm gold">保存</button><button type="button" class="btn sm" data-act="cancel">取消</button></form>';
      } else {
        valHtml = val ? '<span class="val">' + esc(val) + "</span>" : '<span class="val miss">待补充</span>';
      }
      var right = isEditing ? "" : can
        ? '<button class="btn sm ghost" data-act="edit" data-f="' + f.key + '">编辑</button>'
        : '<span class="lock" title="' + esc(lockReason(ch, f)) + '">锁</span>';
      return '<div class="field' + (can ? " can" : "") + '"><span class="fname">' + f.name + (f.method ? '<em>产品可改</em>' : "") + "</span>" + valHtml + right + "</div>";
    }).join("");

    var total = missing(ch);
    var submitBar;
    if (ch.status === "live") submitBar = '<p class="hint">已上线，业务字段冻结。之后只有负责人能调整渠道负责人。</p>';
    else if (ch.status === "review") submitBar = '<p class="hint">审批中，字段暂时锁定。被退回后才能修改。</p>';
    else {
      var why = !role().submit ? role().name + "不能提交审批"
        : !mine(ch) ? "只有这条渠道的负责商务或运营能提交"
        : total ? "还有 " + total + " 个字段待补充，补齐才能提交"
        : ch.status === "returned" ? "已补充，可以重新提交，会回到" + STAGES[ch.stage].name + "审核继续" : "资料齐全，可以提交审批";
      var ok = canSubmit(ch) && !total;
      submitBar = '<div class="submit"><span class="' + (ok ? "ok" : "hint") + '">' + why + "</span>" +
        '<button class="btn gold" data-act="submit"' + (ok ? "" : " disabled") + ">" + (ch.status === "returned" ? "重新提交" : "提交审批") + "</button></div>";
    }

    var timeline = STAGES.map(function (s, i) {
      var cls = ch.status === "live" || i < ch.stage ? "done"
        : i === ch.stage && ch.status === "review" ? "now"
        : i === ch.stage && ch.status === "returned" ? "back" : "";
      var who = s.who === "lead" ? "负责人" : s.who;
      return '<li class="' + cls + '"><span class="dot">' + (cls === "done" ? "✓" : i + 1) + "</span><b>" + s.name + "</b><small>" + who + "</small></li>";
    }).join("");

    var action = "";
    if (ch.status === "review") {
      var st = STAGES[ch.stage];
      var reasons = RETURN_REASONS.map(function (r, i) { return '<option value="' + i + '"' + (i === state.reason ? " selected" : "") + ">" + r + "</option>"; }).join("");
      var controls = '<div class="decide"><select data-act="reason">' + reasons + '</select><div class="btns"><button class="btn" data-act="reject">退回</button><button class="btn gold" data-act="approve">通过</button></div></div>';
      if (st.who === "lead") {
        action = state.role === "lead"
          ? '<div class="act-box"><p>轮到你审批：<b>' + st.name + "</b>" + (st.key === "pricing" ? "　报价 " + ch.quote.pct + "% + " + ch.quote.fixed.toFixed(2) + " 美元" : "") + "</p>" + controls + "</div>"
          : '<div class="act-box muted"><p>等待负责人审批' + st.name + '。切换到「负责人」可以操作。</p></div>';
      } else {
        action = '<div class="act-box demo"><p><span class="tag">演示</span>模拟' + st.who + "审批" + st.name + "</p>" + controls + "</div>";
      }
    } else if (ch.status === "returned") {
      action = '<div class="act-box back"><p>' + STAGES[ch.stage].name + "审核退回：" + esc(ch.returnReason) + "</p></div>";
    } else if (ch.status === "live") {
      action = '<div class="act-box done"><p>全部审批通过，渠道已上线。</p></div>';
    }

    var owner = state.role === "lead"
      ? '<select class="assign" data-act="assign">' + SALES_PEOPLE.map(function (p) { return "<option" + (p === ch.sales ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select>"
      : "<b>" + ch.sales + "</b>";

    return '<section class="page"><button class="back-link" data-act="list">← 渠道列表</button>' +
      '<div class="page-head"><div><h1>' + ch.name + " " + pill(ch) + "</h1><p>" + ch.region + " · 商务 " + owner + " · 运营 <b>" + ch.ops + "</b></p></div></div>" +
      '<div class="detail"><div class="card"><div class="card-h"><h2>产品能力</h2><span>' + prods.length + " 条产品线已开通</span></div>" +
      '<div class="tabs">' + tabs + '</div><div class="fields">' + fields + "</div>" + submitBar + "</div>" +
      '<div class="card"><div class="card-h"><h2>审批进度</h2><span>' + STAGES.length + " 道审批</span></div>" +
      '<ol class="timeline">' + timeline + "</ol>" + action +
      '<div class="card-h sub"><h2>操作记录</h2></div><ol class="log">' + ch.log.slice().reverse().map(logItem).join("") + "</ol></div></div></section>";
  }

  function lockReason(ch, f) {
    if (ch.status === "live") return "已上线，字段冻结";
    if (ch.status === "review") return "审批中，字段锁定";
    if (role().edit === "none") return role().name + "不改字段";
    if (role().edit === "method") return "产品只能改支付方式";
    return "不是你负责的渠道";
  }

  // ---------- FI Agent ----------
  function suggestions() {
    var vis = state.channels.filter(visible);
    var a = vis[0], live = vis.filter(function (c) { return c.products.payin; })[0] || a;
    var out = [a.name + " 支持哪些收款币种？", "哪些渠道支持虚拟卡？", live.name + " 的通道费率是多少？", "单笔 100 美元，" + live.name + " 每笔赚多少？"];
    var hidden = state.channels.filter(function (c) { return !visible(c); })[0];
    if (hidden) out.push(hidden.name + " 的费率是多少？");
    return out;
  }

  function parseFee(s) {
    var m = /([\d.]+)%\s*\+\s*([\d.]+)/.exec(s || "");
    return m ? { pct: parseFloat(m[1]), fixed: parseFloat(m[2]) } : null;
  }
  function money(n) { return n.toFixed(2); }

  function answer(q) {
    var text = q.replace(/\s+/g, "");
    var idm = /渠道([A-Za-z])/.exec(text);
    var ch = idm ? chan(idm[1].toUpperCase()) : null;
    var hiddenCount = state.channels.filter(function (c) { return !visible(c); }).length;

    if (idm && !ch) return "没有渠道 " + esc(idm[1].toUpperCase()) + "。现在系统里是渠道 A 到 E。";
    if (ch && !visible(ch)) {
      return ch.name + " 不在你的权限范围内。" + role().name + "只能看自己负责的渠道，所以我也不能告诉你它的信息。";
    }

    if (ch && /利润|赚|毛利|收益/.test(text)) {
      var cost = parseFee(ch.products.payin && ch.products.payin.fee);
      if (!ch.products.payin) return ch.name + " 没有开通 Payin，算不了收款利润。";
      if (!cost) return ch.name + " 的通道费率还没录入，补齐后才能算。";
      var am = /(\d+(?:\.\d+)?)(万)?/.exec(text.replace(/渠道[A-Za-z]/, ""));
      var amount = am ? parseFloat(am[1]) * (am[2] ? 10000 : 1) : 100;
      var rev = amount * ch.quote.pct / 100 + ch.quote.fixed;
      var c = amount * cost.pct / 100 + cost.fixed;
      return "按单笔 " + amount + " 美元算：<br>报价 " + ch.quote.pct + "% + " + money(ch.quote.fixed) + " 美元，收入 <b>" + money(rev) + "</b> 美元；" +
        "<br>通道成本 " + cost.pct + "% + " + money(cost.fixed) + " 美元，成本 <b>" + money(c) + "</b> 美元；" +
        "<br>每笔赚 <b>" + money(rev - c) + "</b> 美元，毛利率 " + (rev > 0 ? Math.round((rev - c) / rev * 100) : 0) + "%。";
    }

    if (ch && /费率|手续费|成本|报价/.test(text)) {
      if (!ch.products.payin) return ch.name + " 没有开通 Payin，没有收款费率。";
      var fee = ch.products.payin.fee;
      return ch.name + " 的通道费率是 <b>" + esc(fee || "待补充") + "</b>，对商户的报价是 " + ch.quote.pct + "% + " + money(ch.quote.fixed) + " 美元。";
    }

    if (ch) {
      var hit = null;
      PRODUCTS.forEach(function (p) {
        p.fields.forEach(function (f) {
          var short = f.name.replace(/ 验证/, "");
          if (!hit && (text.indexOf(f.name.replace(/\s/g, "")) > -1 || (short.length > 2 && text.indexOf(short.slice(0, 2)) > -1 && text.indexOf(short.slice(-2)) > -1))) hit = [p, f];
        });
      });
      if (!hit && /币种/.test(text)) {
        var cur = enabled(ch).map(function (p) {
          var f = p.fields.filter(function (x) { return /币种/.test(x.name); })[0];
          return f ? p.name + "：" + (ch.products[p.key][f.key] || "待补充") : null;
        }).filter(Boolean);
        return ch.name + " 的币种：<br>" + cur.join("<br>");
      }
      if (hit) {
        if (!ch.products[hit[0].key]) return ch.name + " 没有开通" + hit[0].name + "。";
        var v = ch.products[hit[0].key][hit[1].key];
        return ch.name + " 的" + hit[1].name + "：<b>" + esc(v || "待补充") + "</b>" + (v ? "" : "，还没录入。");
      }
      return ch.name + "：" + statusText(ch) + "，开通了 " + enabled(ch).map(function (p) { return p.name; }).join("、") +
        "，" + (missing(ch) ? missing(ch) + " 个字段待补充。" : "字段齐全。");
    }

    // capability search across the channels this role can see
    var tokens = {};
    state.channels.forEach(function (c) {
      enabled(c).forEach(function (p) {
        p.fields.forEach(function (f) {
          String(c.products[p.key][f.key] || "").split(/[、，,\s]+/).forEach(function (t) { if (t.length > 1) tokens[t] = 1; });
        });
      });
    });
    if (/3DS/i.test(text)) tokens["已开启"] = 1;
    var key = Object.keys(tokens).sort(function (a, b) { return b.length - a.length; }).filter(function (t) {
      return text.toLowerCase().indexOf(t.toLowerCase().replace(/\s/g, "")) > -1;
    })[0];
    if (/3DS/i.test(text)) key = "已开启";
    if (key) {
      var found = state.channels.filter(visible).filter(function (c) {
        return enabled(c).some(function (p) {
          return p.fields.some(function (f) {
            var v = c.products[p.key][f.key] || "";
            return key === "已开启" ? f.key === "threeDS" && v === "已开启" : v.indexOf(key) > -1;
          });
        });
      });
      var label = key === "已开启" ? "3DS 验证" : key;
      var tail = hiddenCount ? "<br><span class=\"dim\">另有 " + hiddenCount + " 条渠道你没有权限查看，没算在内。</span>" : "";
      return found.length
        ? "支持" + esc(label) + "的渠道：<b>" + found.map(function (c) { return c.name; }).join("、") + "</b>。" + tail
        : "你能看到的渠道里，没有支持" + esc(label) + "的。" + tail;
    }

    return "演示版只回答三类问题：渠道支持什么能力、费率是多少、报价能赚多少。可以试试下面的问题。";
  }

  function agentView() {
    var msgs = state.chat.map(function (m, i) {
      return '<div class="msg ' + m.from + (i >= agentShown ? " new" : "") + '">' + m.html + "</div>";
    }).join("");
    return '<div class="agent-h"><div><b>FI Agent</b><small>渠道能力 · 费率 · 报价利润</small></div><button class="icon" data-act="agent" aria-label="收起">×</button></div>' +
      '<div class="msgs" id="msgs"><div class="msg bot">你好，我是 FI Agent。你现在是<b>' + role().name + "</b>，我只回答你看得到的渠道。</div>" + msgs + "</div>" +
      '<div class="sugs">' + suggestions().map(function (s) { return '<button class="sug" data-act="ask" data-q="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div>" +
      '<form class="ask" data-act="send"><input name="q" placeholder="问问渠道、费率或利润" autocomplete="off"><button class="btn gold sm">发送</button></form>' +
      '<p class="agent-note">演示版：基于原型数据的规则问答，未接入大模型</p>';
  }

  function ask(q) {
    q = q.trim();
    if (!q) return;
    state.chat.push({ from: "user", html: esc(q) });
    state.chat.push({ from: "bot", html: answer(q) });
    render();
  }

  // ---------- shell ----------
  function render() {
    document.getElementById("roles").innerHTML = Object.keys(ROLES).map(function (k) {
      return '<button class="' + (k === state.role ? "on" : "") + '" data-act="role" data-r="' + k + '">' + ROLES[k].name + "</button>";
    }).join("");
    document.getElementById("me").innerHTML = "<b>" + me() + "</b><span>" + role().name + "</span><p>" + role().note + "</p>";
    var todoN = state.channels.filter(todo).length;
    document.getElementById("nav").innerHTML =
      '<button class="' + (state.nav === "all" && state.view === "list" ? "on" : "") + '" data-act="nav" data-n="all">渠道列表</button>' +
      '<button class="' + (state.nav === "todo" ? "on" : "") + '" data-act="nav" data-n="todo">待我处理' + (todoN ? "<i>" + todoN + "</i>" : "") + "</button>" +
      '<button class="' + (state.nav === "log" ? "on" : "") + '" data-act="nav" data-n="log">操作记录</button>';
    var main = document.getElementById("main");
    main.innerHTML = state.view === "detail" ? detailView() : state.nav === "log" ? logView() : listView();
    // Redraw the agent only when its content changes, so typing and scroll survive other clicks
    var agent = document.getElementById("agent");
    var key = state.role + "|" + state.chat.length;
    if (key !== agentKey) {
      agent.innerHTML = agentView();
      agentKey = key;
      agentShown = state.chat.length;
      var box = document.getElementById("msgs");
      if (box) box.scrollTop = box.scrollHeight;
    }
    document.body.classList.toggle("agent-open", state.agentOpen);
    var input = main.querySelector(".edit input");
    if (input) { input.focus(); input.select(); }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || el.tagName === "FORM" || el.tagName === "SELECT") return;
    var act = el.getAttribute("data-act");
    var ch = state.channelId ? chan(state.channelId) : null;
    if (act === "role") {
      state.role = el.getAttribute("data-r");
      state.editing = null;
      if (ch && !visible(ch)) { state.view = "list"; state.channelId = null; }
      state.chat.push({ from: "bot", html: "已切换为<b>" + role().name + "</b>：" + role().note + "。" });
    } else if (act === "nav") {
      state.nav = el.getAttribute("data-n"); state.view = "list"; state.channelId = null; state.editing = null;
    } else if (act === "open") {
      state.channelId = el.getAttribute("data-id"); state.view = "detail"; state.product = null; state.editing = null;
    } else if (act === "list") {
      state.view = "list"; state.channelId = null; state.editing = null; if (state.nav === "log") state.nav = "all";
    } else if (act === "tab") {
      state.product = el.getAttribute("data-p"); state.editing = null;
    } else if (act === "edit") {
      state.editing = { p: state.product, f: el.getAttribute("data-f") };
    } else if (act === "cancel") {
      state.editing = null;
    } else if (act === "submit" && ch && canSubmit(ch) && !missing(ch)) {
      if (ch.status === "returned") {
        log(ch, me(), "补充后重新提交，回到" + STAGES[ch.stage].name + "审核");
        ch.returnReason = null;
      } else {
        ch.stage = 0;
        log(ch, me(), "提交审批");
      }
      ch.status = "review";
    } else if ((act === "approve" || act === "reject") && ch && ch.status === "review") {
      var st = STAGES[ch.stage];
      var who = st.who === "lead" ? ROLES.lead.person : st.who;
      if (st.who === "lead" && state.role !== "lead") return;
      if (act === "approve") {
        if (ch.stage === STAGES.length - 1) {
          ch.status = "live"; ch.stage = STAGES.length;
          log(ch, who, "终审通过，渠道上线，业务字段冻结");
        } else {
          log(ch, who, st.name + "审核通过");
          ch.stage++;
        }
      } else {
        ch.status = "returned";
        ch.returnReason = RETURN_REASONS[state.reason];
        log(ch, who, st.name + "审核退回：" + ch.returnReason);
      }
    } else if (act === "agent") {
      state.agentOpen = !state.agentOpen;
    } else if (act === "ask") {
      ask(el.getAttribute("data-q")); return;
    } else if (act === "reset") {
      var open = state.agentOpen;
      state = freshState(); state.agentOpen = open; agentKey = null; agentShown = 0;
    } else {
      return;
    }
    render();
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    var act = el.getAttribute("data-act");
    var ch = state.channelId ? chan(state.channelId) : null;
    if (act === "reason") { state.reason = +el.value; return; }
    if (act === "assign" && ch && state.role === "lead") {
      ch.sales = el.value;
      log(ch, me(), "把商务负责人改为 " + el.value);
      render();
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target;
    var act = form.getAttribute("data-act");
    e.preventDefault();
    if (act === "send") { ask(form.q.value); return; }
    if (act === "save" && state.editing) {
      var ch = chan(state.channelId);
      var prod = PRODUCTS.filter(function (p) { return p.key === state.editing.p; })[0];
      var field = prod.fields.filter(function (f) { return f.key === state.editing.f; })[0];
      if (!canEdit(ch, field)) return;
      var v = form.v.value.trim();
      var old = ch.products[prod.key][field.key];
      if (v !== old) {
        ch.products[prod.key][field.key] = v;
        log(ch, me(), (old ? "修改 " : "补充 ") + prod.name + " · " + field.name);
      }
      state.editing = null;
      render();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.editing) { state.editing = null; render(); }
  });

  state = freshState();
  render();
})();
