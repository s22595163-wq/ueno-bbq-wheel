const PRIZES = [
  {
    id: "crown", rank: "一獎", label: "皇冠禮",
    result: "恭喜抽中一獎  皇冠禮",
    reward: "平日每天可兌換 100 元便當共 5 個（限內用並留下每日用餐評論）",
    note: "最高獎項",
    asset: "./assets/prizes/crown.png", weight: 2, wheelScale: 0.95
  },
  {
    id: "vip-card", rank: "二獎", label: "VIP 卡",
    result: "恭喜抽中二獎  VIP 卡",
    reward: "平日每天可兌換 100 元便當共 3 個（限內用並留下每日用餐評論）",
    note: "會員資格",
    asset: "./assets/prizes/vip-card.png", weight: 3, wheelScale: 1.1
  },
  {
    id: "bento", rank: "三獎", label: "豪華便當",
    result: "恭喜抽中三獎  豪華便當",
    reward: "本次用餐升級雙主餐 + 加碼炭烤肋排",
    note: "人氣主餐",
    asset: "./assets/prizes/bento.png", weight: 4, wheelScale: 1.08
  },
  {
    id: "coupon", rank: "四獎", label: "折價券",
    result: "恭喜抽中四獎  折價券",
    reward: "10 元折價券，下次來店現場折抵",
    note: "下次折抵",
    asset: "./assets/prizes/coupon.png", weight: 5, wheelScale: 1.18
  },
  {
    id: "pork-belly", rank: "五獎", label: "五花肉",
    result: "恭喜抽中五獎  加菜五花肉",
    reward: "當月壽星可享加贈五花烤肉片一片（限當月使用）",
    note: "加菜獎",
    asset: "./assets/prizes/pork-belly.png", weight: 6, wheelScale: 1.02
  },
  {
    id: "ember-grill", rank: "未中獎", label: "熄火炭爐",
    result: "本次未中獎",
    reward: "很可惜，這次沒中獎。明天再來試試手氣！",
    note: "明日再試一次",
    asset: "./assets/prizes/ember-grill.png", weight: 14, wheelScale: 1.02
  }
];

const BULB_COUNT = 18;
const SPIN_TURNS = 6;
const SPIN_DURATION_MS = 3000;
const sectorAngle = 360 / PRIZES.length;
const DAILY_KEY = "uenoSlotDate";
const PRIZE_KEY = "uenoSlotPrize";

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
    article.innerHTML = `
      <div class="prize-card__rank">${prize.rank}</div>
      <div class="prize-card__icon">
        <img src="${prize.asset}" alt="${prize.label}" />
      </div>
      <p class="prize-card__name">${prize.label}</p>
      <p class="prize-card__note">${prize.note}</p>
    `;
    prizeCards.appendChild(article);
  }
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
  if (resultCS) {
    resultCS.textContent = prize.id === "ember-grill"
      ? ""
      : "📸 請截圖此畫面傳給官方客服核銷您的獎品";
  }
  setActivePrize(prize.id);
  if (fromSpin) {
    localStorage.setItem(DAILY_KEY, todayKey());
    localStorage.setItem(PRIZE_KEY, prize.id);
  }
}

function lockButtonForToday() {
  spinButton.disabled = true;
  spinButton.innerHTML = "<span>今日</span><span>已抽</span>";
}

function setWheelToPrize(prizeIndex) {
  wheelRotation = normalizeAngle(-prizeIndex * sectorAngle);
  wheelRotator.style.transition = "none";
  wheelRotator.style.transform = `rotate(${wheelRotation}deg)`;
}

function spinToPrize(prizeIndex) {
  return new Promise((resolve) => {
    const currentAngle = normalizeAngle(wheelRotation);
    const targetAngle = normalizeAngle(-prizeIndex * sectorAngle);
    const delta = (targetAngle - currentAngle + 360) % 360;
    const nextRotation = wheelRotation + SPIN_TURNS * 360 + delta;

    const handleStop = () => {
      wheelRotator.removeEventListener("transitionend", handleStop);
      setWheelToPrize(prizeIndex);
      resolve();
    };

    wheelRotator.addEventListener("transitionend", handleStop, { once: true });
    wheelRotator.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.82, 0.18, 1)`;
    wheelRotator.style.transform = `rotate(${nextRotation}deg)`;
    wheelRotation = nextRotation;
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
