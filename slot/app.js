const PRIZES = [
  {
    id: "crown", rank: "一獎", label: "皇冠禮", wheelLabel: "霸主餐",
    result: "恭喜抽中一獎  皇冠禮",
    reward: "平日每天可兌換一個 110 元便當共 5 個（限內用並留下每日用餐評論）",
    note: "最高獎項",
    asset: "./assets/prizes/crown.png", weight: 3, wheelScale: 1.05
  },
  {
    id: "vip-card", rank: "二獎", label: "VIP 卡", wheelLabel: "招待券",
    result: "恭喜抽中二獎  VIP 卡",
    reward: "平日每天可兌換一個 110 元便當共 3 個（限內用並留下每日用餐評論）",
    note: "會員資格",
    asset: "./assets/prizes/vip-card.png", weight: 5, wheelScale: 1.05
  },
  {
    id: "bento", rank: "三獎", label: "豪華便當", wheelLabel: "雙主餐",
    result: "恭喜抽中三獎  豪華便當",
    reward: "本次用餐升級雙主餐 + 加碼炭烤肋排",
    note: "人氣主餐",
    asset: "./assets/prizes/bento.png", weight: 50, wheelScale: 1.12
  },
  {
    id: "coupon", rank: "四獎", label: "折價券", wheelLabel: "折15元",
    result: "恭喜抽中四獎  折價券",
    reward: "15 元折價券，下次來店現場折抵",
    note: "下次折抵",
    asset: "./assets/prizes/coupon.png", weight: 100, wheelScale: 0.92
  },
  {
    id: "pork-belly", rank: "五獎", label: "五花肉", wheelLabel: "壽星加肉",
    result: "恭喜抽中五獎  加菜五花肉",
    reward: "當月壽星可享加贈五花烤肉片一份（限當月使用）",
    note: "加菜獎",
    asset: "./assets/prizes/pork-belly.png", weight: 100, wheelScale: 1.0
  },
  {
    id: "ember-grill", rank: "未中獎", label: "熄火炭爐", wheelLabel: "殘念",
    result: "本次未中獎",
    reward: "很可惜，這次沒中獎。明天再來試試手氣！",
    note: "明日再試一次",
    asset: "./assets/prizes/ember-grill.png", weight: 500, wheelScale: 1.0
  }
];

// ===== 店家手動維護：各獎「兩個月限量／剩餘」=====
// 發完獎就把對應的 left 改小，再推上線即可。
// （此版無後端，是手動快照：所有客人看到的都是這裡的數字，不會自動扣。）
const PRIZE_STOCK = {
  "crown":      { quota: 3,   left: 3 },
  "vip-card":   { quota: 5,   left: 5 },
  "bento":      { quota: 50,  left: 50 },
  "coupon":     { quota: 100, left: 100 },
  "pork-belly": { quota: 100, left: 100 }
};

const BULB_COUNT = 18;
const SPIN_TURNS = 6;
const SPIN_DURATION_MS = 3000;
const sectorAngle = 360 / PRIZES.length;
const DAILY_KEY = "uenoSlotDate";
const PRIZE_KEY = "uenoSlotPrize";
const HISTORY_KEY = "uenoSlotHistory";
const CODE_KEY = "uenoSlotCode";
const PRIZE_VALID_MS = 30 * 24 * 60 * 60 * 1000; // 中獎後有效期：30 天

const spinButton = document.getElementById("spinButton");
const resultLabel = document.getElementById("resultLabel");
const resultDetail = document.getElementById("resultDetail");
const resultIcon = document.getElementById("resultIcon");
const resultCS = document.getElementById("resultCS");
const prizeCards = document.getElementById("prizeCards");
const wheelRotator = document.querySelector("[data-wheel-rotator]");
const wheelTrack = document.querySelector("[data-wheel-track]");
const bulbRing = document.querySelector("[data-bulb-ring]");

let isSpinning = false;
let wheelRotation = 0;
let historyTimer = null;
let pendingUseIdx = -1;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hasSpunToday() {
  return localStorage.getItem(DAILY_KEY) === todayKey();
}

function buildPrizeCards() {
  prizeCards.innerHTML = "";
  for (const prize of PRIZES) {
    const article = document.createElement("article");
    article.className = "prize-card";
    article.dataset.prizeId = prize.id;
    const _st = PRIZE_STOCK[prize.id];
    const _stockLine = _st
      ? `<p class="prize-card__stock${_st.left === 0 ? " is-out" : ""}">${_st.left === 0 ? "已送完" : "剩餘 " + _st.left + " / " + _st.quota}</p>`
      : "";
    article.innerHTML = `
      <div class="prize-card__rank">${prize.rank}</div>
      <div class="prize-card__icon">
        <img src="${prize.asset}" alt="${prize.label}" />
      </div>
      <p class="prize-card__name">${prize.label}</p>
      <p class="prize-card__note">${prize.note}</p>
      ${_stockLine}
    `;
    prizeCards.appendChild(article);
  }
}

// 獎勵詳情視窗：列出每個獎的圖、獎項、完整獎勵文字、限量／剩餘
function buildPrizeDetailModal() {
  const modal = document.createElement("div");
  modal.id = "prizeDetailModal";
  modal.className = "prize-detail";
  const rows = PRIZES.filter((p) => p.id !== "ember-grill").map((p) => {
    const st = PRIZE_STOCK[p.id];
    let stockHtml = "";
    if (st) {
      const pct = Math.max(0, Math.min(100, st.quota ? (st.left / st.quota) * 100 : 0));
      const leftTxt = st.left === 0 ? "已送完" : "剩餘 " + st.left;
      stockHtml =
        `<div class="pd-stock"><span>限量 ${st.quota}</span><span class="pd-left${st.left === 0 ? " is-out" : ""}">${leftTxt}</span></div>` +
        `<div class="pd-bar"><i style="width:${pct}%"></i></div>`;
    }
    return `<div class="pd-item"><img src="${p.asset}" alt="${p.label}">` +
      `<div class="pd-info"><div class="pd-head"><span class="pd-rank">${p.rank}</span><b>${p.label}</b></div>` +
      `<p class="pd-reward">${p.reward}</p>${stockHtml}</div></div>`;
  }).join("");
  modal.innerHTML =
    `<div class="pd-box"><div class="pd-title">🎁 獎勵詳情</div>` +
    `<button class="pd-close" type="button" aria-label="關閉">×</button>` +
    `<div class="pd-list">${rows}</div>` +
    `<p class="pd-validity">⏳ 所有獎勵中獎後 30 天內有效，逾期自動失效</p>` +
    `<p class="pd-foot">數量為兩個月限量，送完為止 · 中獎後請截圖傳官方客服核銷</p></div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("pd-close")) modal.classList.remove("open");
  });
  return modal;
}

// 中獎兌換碼：UENO-當月(YYMM)-獎項碼-亂碼，每筆中獎唯一（避開易混淆字 O0I1）
function genCode(prize) {
  const d = new Date();
  const ym = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
  const rankNum = { "crown": "1", "vip-card": "2", "bento": "3", "coupon": "4", "pork-belly": "5" }[prize.id] || "0";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return "UENO-" + ym + "-" + rankNum + "-" + rand;
}

// 抽獎紀錄（存本機 localStorage：日期＋獎項＋兌換碼）
function recordDraw(prize, code) {
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const d = new Date();
    const dateStr = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
    hist.unshift({ date: dateStr, ts: Date.now(), id: prize.id, rank: prize.rank, label: prize.label, asset: prize.asset, code: code || "" });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 200)));
  } catch (e) {}
}

// 倒數顯示：未到期回 "剩 X天 HH:MM:SS"，到期回 null
function fmtRemain(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return "剩 " + d + " 天 " + pad(h) + ":" + pad(m) + ":" + pad(sec);
}

// 更新所有抽獎紀錄裡的倒數計時（每秒呼叫）
function tickCountdowns() {
  const now = Date.now();
  document.querySelectorAll(".hist-countdown[data-exp]").forEach((el) => {
    const txt = fmtRemain(Number(el.dataset.exp) - now);
    if (txt === null) { el.textContent = "已失效"; el.classList.add("expired"); }
    else { el.textContent = txt; el.classList.remove("expired"); }
  });
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch (e) {}
  if (!hist.length) {
    list.innerHTML = '<p class="hist-empty">尚無抽獎紀錄<br><small>抽過獎後就會記在這裡</small></p>';
    return;
  }
  list.innerHTML = hist.map((h, idx) => {
    const isWin = h.id !== "ember-grill";
    const prizeTxt = isWin ? (h.rank + " · " + h.label) : "未中獎";
    const codeLine = (isWin && h.code) ? `<span class="hist-code">兌換碼 ${h.code}</span>` : "";
    const expired = isWin && h.ts && (Date.now() > h.ts + PRIZE_VALID_MS);
    const cdLine = (isWin && h.ts && !h.used) ? `<span class="hist-countdown" data-exp="${h.ts + PRIZE_VALID_MS}"></span>` : "";
    const usedLine = (isWin && h.used && h.usedAt) ? `<span class="hist-used-time">已於 ${tsToDate(h.usedAt)} 使用</span>` : "";
    let action = "";
    if (isWin) {
      if (h.used) action = '<span class="hist-used">✓ 已使用</span>';
      else if (!expired) action = `<button class="hist-use-btn" type="button" data-idx="${idx}">使用</button>`;
    }
    return `<div class="hist-item${h.used ? " is-used" : ""}"><img src="${h.asset}" alt="">` +
      `<div class="hist-info"><span class="hist-date">${h.date}</span>` +
      `<span class="hist-prize${isWin ? "" : " is-miss"}">${prizeTxt}</span>${codeLine}${cdLine}${usedLine}</div>` +
      (action ? `<div class="hist-action">${action}</div>` : "") +
      `</div>`;
  }).join("");
  tickCountdowns();
}

function buildHistoryModal() {
  const modal = document.createElement("div");
  modal.id = "historyModal";
  modal.className = "prize-detail";
  modal.innerHTML =
    '<div class="pd-box"><div class="pd-title">📜 抽獎紀錄</div>' +
    '<button class="pd-close" type="button" aria-label="關閉">×</button>' +
    '<div class="pd-list" id="historyList"></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("pd-close")) {
      modal.classList.remove("open");
      if (historyTimer) { clearInterval(historyTimer); historyTimer = null; }
    }
  });
  return modal;
}

function tsToDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

// 標記某筆紀錄為「已使用」（本機）
function markUsed(idx) {
  try {
    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (hist[idx] && !hist[idx].used) {
      hist[idx].used = true;
      hist[idx].usedAt = Date.now();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    }
  } catch (e) {}
}

// 「確定要使用？」確認對話框
function buildConfirmDialog() {
  const dlg = document.createElement("div");
  dlg.id = "confirmDialog";
  dlg.className = "confirm-dialog";
  dlg.innerHTML =
    '<div class="cd-box"><p class="cd-msg">確定要使用？</p>' +
    '<p class="cd-sub"></p>' +
    '<div class="cd-actions"><button class="cd-cancel" type="button">取消</button>' +
    '<button class="cd-ok" type="button">確定</button></div></div>';
  document.body.appendChild(dlg);
  return dlg;
}

function buildWheel() {
  wheelTrack.innerHTML = "";
  for (let index = 0; index < PRIZES.length; index += 1) {
    const prize = PRIZES[index];
    const prizeNode = document.createElement("div");
    prizeNode.className = "wheel-prize";
    prizeNode.style.setProperty("--angle", `${index * sectorAngle}deg`);
    prizeNode.innerHTML = `
      <img src="${prize.asset}" alt="${prize.label}" style="--wheel-scale:${prize.wheelScale};" />
      <span class="wheel-prize__label">${prize.wheelLabel || prize.label}</span>
    `;
    wheelTrack.appendChild(prizeNode);
  }
}

function buildBulbs() {
  bulbRing.innerHTML = "";
  for (let index = 0; index < BULB_COUNT; index += 1) {
    const bulb = document.createElement("span");
    bulb.className = "wheel-bulb";
    bulb.style.setProperty("--angle", `${index * (360 / BULB_COUNT)}deg`);
    bulbRing.appendChild(bulb);
  }
}

function weightedPick() {
  const total = PRIZES.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;
  for (const prize of PRIZES) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return PRIZES[PRIZES.length - 1];
}

function normalizeAngle(degrees) {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function setActivePrize(prizeId) {
  for (const card of prizeCards.children) {
    card.classList.toggle("is-active", card.dataset.prizeId === prizeId);
  }
}

// 套用抽獎結果：顯示獎勵內容 + 客服核銷提示，並（中獎時）記錄當日
function applyResult(prize, fromSpin) {
  resultLabel.textContent = prize.result;
  resultDetail.textContent = prize.reward;
  resultIcon.src = prize.asset;
  resultIcon.alt = prize.label;
  const isWin = prize.id !== "ember-grill";
  let code = "";
  if (isWin) {
    if (fromSpin) { code = genCode(prize); localStorage.setItem(CODE_KEY, code); }
    else { code = localStorage.getItem(CODE_KEY) || ""; }
  }
  if (resultCS) {
    resultCS.innerHTML = !isWin ? "" :
      '兌換碼<br><span class="redeem-code">' + code + '</span><br>' +
      '<small>📸 請截圖此畫面（含兌換碼）傳給官方客服核銷 · 中獎後 30 天內有效</small>';
  }
  setActivePrize(prize.id);
  if (fromSpin) {
    localStorage.setItem(DAILY_KEY, todayKey());
    localStorage.setItem(PRIZE_KEY, prize.id);
    recordDraw(prize, code);
  }
}

function lockButtonForToday() {
  spinButton.disabled = true;
  spinButton.innerHTML = "<span>今日</span><span>已抽</span>";
}

// 同步設定輪盤轉角 + --spin（圖片靠 --spin 反向抵銷，永遠正立）
function setWheelToPrize(prizeIndex) {
  wheelRotation = normalizeAngle(-prizeIndex * sectorAngle);
  wheelRotator.style.transition = "none";
  wheelRotator.style.transform = `rotate(${wheelRotation}deg)`;
  wheelRotator.style.setProperty("--spin", `${wheelRotation}deg`);
}

function spinToPrize(prizeIndex) {
  return new Promise((resolve) => {
    const currentAngle = normalizeAngle(wheelRotation);
    const targetAngle = normalizeAngle(-prizeIndex * sectorAngle);
    const delta = (targetAngle - currentAngle + 360) % 360;
    const nextRotation = wheelRotation + SPIN_TURNS * 360 + delta;

    let done = false;
    const handleStop = () => {
      if (done) return;
      done = true;
      wheelRotator.removeEventListener("transitionend", handleStop);
      setWheelToPrize(prizeIndex);
      resolve();
    };

    wheelRotator.addEventListener("transitionend", handleStop, { once: true });
    // 先 reflow，確保 transition:none → 有過渡 能生效
    void wheelRotator.offsetWidth;
    wheelRotator.style.transition =
      `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.82, 0.18, 1),` +
      ` --spin ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.82, 0.18, 1)`;
    wheelRotator.style.transform = `rotate(${nextRotation}deg)`;
    wheelRotator.style.setProperty("--spin", `${nextRotation}deg`);
    wheelRotation = nextRotation;
    // 後備：即使 transitionend 沒觸發（部分環境）也能收尾
    setTimeout(handleStop, SPIN_DURATION_MS + 150);
  });
}

async function startSpin() {
  if (isSpinning) return;
  if (hasSpunToday()) { lockButtonForToday(); return; }

  isSpinning = true;
  spinButton.disabled = true;
  resultLabel.textContent = "抽獎中";
  resultDetail.textContent = "轉盤旋轉中";
  if (resultCS) resultCS.textContent = "";

  const selectedPrize = weightedPick();
  const prizeIndex = PRIZES.findIndex((prize) => prize.id === selectedPrize.id);

  await spinToPrize(prizeIndex);
  applyResult(selectedPrize, true);

  isSpinning = false;
  lockButtonForToday();
}

buildPrizeCards();
buildWheel();
buildBulbs();

// 獎勵詳情視窗 + 觸發按鈕
const prizeDetailModal = buildPrizeDetailModal();
{ const _b = document.getElementById("prizeDetailBtn"); if (_b) _b.addEventListener("click", () => prizeDetailModal.classList.add("open")); }
const historyModal = buildHistoryModal();
{ const _h = document.getElementById("historyBtn"); if (_h) _h.addEventListener("click", () => { renderHistory(); historyModal.classList.add("open"); if (historyTimer) clearInterval(historyTimer); historyTimer = setInterval(tickCountdowns, 1000); }); }

// 「使用」按鈕 → 確認對話框
const confirmDialog = buildConfirmDialog();
historyModal.addEventListener("click", (e) => {
  const btn = e.target.closest(".hist-use-btn");
  if (!btn) return;
  e.stopPropagation();
  pendingUseIdx = Number(btn.dataset.idx);
  let name = "";
  try { const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); const h = hist[pendingUseIdx]; if (h) name = h.rank + " · " + h.label; } catch (e2) {}
  confirmDialog.querySelector(".cd-sub").textContent = (name ? name + "　" : "") + "使用後無法復原";
  confirmDialog.classList.add("open");
});
confirmDialog.querySelector(".cd-cancel").addEventListener("click", () => { confirmDialog.classList.remove("open"); pendingUseIdx = -1; });
confirmDialog.addEventListener("click", (e) => { if (e.target === confirmDialog) { confirmDialog.classList.remove("open"); pendingUseIdx = -1; } });
confirmDialog.querySelector(".cd-ok").addEventListener("click", () => {
  if (pendingUseIdx >= 0) markUsed(pendingUseIdx);
  pendingUseIdx = -1;
  confirmDialog.classList.remove("open");
  renderHistory();
});

// 初始：若今日已抽過 → 轉到該獎項並恢復結果、鎖定；否則待機
const storedPrizeId = hasSpunToday() ? localStorage.getItem(PRIZE_KEY) : null;
const storedPrize = storedPrizeId ? PRIZES.find((p) => p.id === storedPrizeId) : null;
if (storedPrize) {
  setWheelToPrize(PRIZES.findIndex((p) => p.id === storedPrize.id));
  applyResult(storedPrize, false);
  lockButtonForToday();
} else {
  setWheelToPrize(5);
  setActivePrize("ember-grill");
  resultLabel.textContent = "待機中";
  resultDetail.textContent = "按下中心按鈕開始抽獎";
}

spinButton.addEventListener("click", startSpin);

// 背景音樂（沿用主遊戲的靜音設定）
(function () {
  const bgm = document.getElementById("bgm"), muteBtn = document.getElementById("muteBtn");
  if (!bgm) return;
  let started = false;
  const muted = () => localStorage.getItem("uenoMute") === "1";
  function icon() { if (muteBtn) muteBtn.textContent = (muted() || bgm.paused) ? "🔇" : "🔊"; }
  function start() {
    if (muted()) { icon(); return; }
    bgm.volume = 0.45;
    const p = bgm.play();
    if (p && p.then) { p.then(() => { started = true; icon(); }).catch(() => {}); } else { started = true; icon(); }
  }
  if (muteBtn) {
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (bgm.paused) { localStorage.removeItem("uenoMute"); bgm.volume = 0.45; bgm.play().catch(function () {}); started = true; }
      else { bgm.pause(); localStorage.setItem("uenoMute", "1"); }
      icon();
    });
  }
  start();
  document.addEventListener("click", function () { if (!started && !muted()) start(); });
  document.addEventListener("touchstart", function () { if (!started && !muted()) start(); }, { passive: true });
  icon();
})();
