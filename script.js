
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================= VARIABLES (WITH LOAD) =================
let totalClicks = Number(localStorage.getItem("totalClicks")) || 0;
let coins = Number(localStorage.getItem("coins")) || 0;
let coinsPerClick = Number(localStorage.getItem("coinsPerClick")) || 1;
let passiveIncome = Number(localStorage.getItem("passiveIncome")) || 0;

let clickCost = Number(localStorage.getItem("clickCost")) || 10;
let passiveCost = Number(localStorage.getItem("passiveCost")) || 25;
let passiveLevel = Number(localStorage.getItem("passiveLevel")) || 0;

let autoClickerBought = localStorage.getItem("autoClickerBought") === "true";
let isAutoClickerActive = true;
let isMouseHeld = false;
let nickname = localStorage.getItem("nickname");
let comboText = "",
  comboTimeout = null;
let clicksThisSecond = 0;
let lastSecondReset = Date.now();
let clicksLastSecond = 0;

let unlockedAchievements =
  JSON.parse(localStorage.getItem("achievements")) || [];

const achievements = [
  {
    id: "firstMsg",
    title: "Слово",
    desc: "В начале было Слово...",
    check: () => false,
  },
  {
    id: "autoSend",
    title: "Течение времени",
    desc: "Не всё в этом мире требует твоего контроля",
    check: () => false,
  },
  {
    id: "clicks1k",
    title: "Первая искра",
    desc: "Ты начал понимать правила этой вселенной",
    check: () => totalClicks >= 1,
  },
  {
    id: "clicks10k",
    title: "Пламя творения",
    desc: "Твоя энергия не знает границ",
    check: () => totalClicks >= 3000,
  },
  {
    id: "autoUnlocked",
    title: "Вечный двигатель",
    desc: "Мир продолжает вращаться, даже если ты спишь",
    check: () => autoClickerBought,
  },
  {
    id: "trailChanged",
    title: "Призма восприятия",
    desc: "Ты видишь этот мир в других цветах",
    check: () => isRGBMode || currentTrailColor !== "#ff0000",
  },
  {
    id: "passive300",
    title: "Гармония чисел",
    desc: "Математическое совершенство достигнуто",
    check: () => passiveIncome >= 150,
  },
  {
    id: "clickX40",
    title: "Божественный чертеж",
    desc: "Твой клик стал законом природы",
    check: () => coinsPerClick >= 20,
  },
  {
    id: "millionBalance",
    title: "Порог Пробуждения",
    desc: "Шесть знаков судьбы выжжены на твоем счету. Тень твоего влияния становится длиннее самого солнца.",
    check: () => coins >= 100000,
  },
  {
    id: "speedDemon",
    title: "Биение пульса",
    desc: "Секунда замерла, когда ритм твоего созидания превысил пределы плоти.",
    check: () => false,
  },
];

// Цвета и таймеры
let currentTrailColor = "#ff0000";
let mouseX = 0,
  mouseY = 0,
  lastX = 0,
  lastY = 0,
  hue = 0,
  isRGBMode = false;
let autoClickInterval = null; // Таймер для самого клика

const coinsEl = document.getElementById("coins"),
  passiveEl = document.getElementById("passive"),
  typingDisplay = document.getElementById("typingDisplay"),
  autoBtn = document.getElementById("autoClickerBuy");

// SAVE
function saveProgress() {
  localStorage.setItem("totalClicks", totalClicks);
  localStorage.setItem("coins", coins);
  localStorage.setItem("coinsPerClick", coinsPerClick);
  localStorage.setItem("passiveIncome", passiveIncome);
  localStorage.setItem("clickCost", clickCost);
  localStorage.setItem("passiveCost", passiveCost);
  localStorage.setItem("passiveLevel", passiveLevel);
  localStorage.setItem("autoClickerBought", autoClickerBought);
}

// ================= LOGIC =================
function updateUI() {
  coinsEl.textContent = Math.floor(coins);
  passiveEl.textContent = passiveIncome;
  document.getElementById("clickCost").textContent = clickCost;
  document.getElementById("passiveCost").textContent = passiveCost;
}

function doClick(x, y) {
  // 1. Если включен OSU и мы сейчас ТАЩИМ слайдер или КЛИКНУЛИ в точку — ПОЛНАЯ БЛОКИРОВКА
  if (isOsuMode) {
    if (window.isOsuDragging) return; // Если палец занят целью, автокликер и "Мимо" молчат

    // 2. Если OSU включен, но мы кликнули реально в пустоту
    const miss = document.createElement("div");
    miss.className = "float-text";
    miss.textContent = "Мимо!";
    miss.style.color = "#555";
    miss.style.left = x + "px";
    miss.style.top = y + "px";
    document.body.appendChild(miss);
    setTimeout(() => miss.remove(), 500);
    return;
  }

  // Обычная логика (если osu! режим ВЫКЛ)
  coins += coinsPerClick;
  totalClicks++;
  clicksLastSecond++;

  broadcastClick();

  // ЛОГИКА ДЛЯ ДОСТИЖЕНИЯ СКОРОСТИ
  clicksThisSecond++;
  const now = Date.now();
  if (now - lastSecondReset >= 1000) {
    clicksThisSecond = 0;
    lastSecondReset = now;
  }

  if (clicksThisSecond >= 12 && !unlockedAchievements.includes("speedDemon")) {
    giveAchievement("speedDemon");
  }

  updateUI();

  const text = document.createElement("div");
  text.className = "float-text";
  text.textContent = `+${coinsPerClick}`;

  // ДОБАВЛЯЕМ РАНДОМНЫЙ РАЗБРОС (в радиусе 40 пикселей)
  const randomX = x + (Math.random() - 0.5) * 80;
  const randomY = y + (Math.random() - 0.5) * 80;

  text.style.left = randomX + "px";
  text.style.top = randomY + "px";

  document.body.appendChild(text);
  setTimeout(() => text.remove(), 800);
}

// КЛАВИАТУРА (ТАЙПИНГ)
window.addEventListener("keydown", (e) => {
  if (document.activeElement === mobileInput) return;
  if (e.key === "Enter") {
    if (comboText.trim().length > 0) {
      clearTimeout(comboTimeout);
      finishCombo(false); // Ручная отправка
    }
    return;
  }

  if (e.key.length === 1) {
    clearTimeout(comboTimeout); // Сначала чистим старый таймер
    comboText += e.key;
    typingDisplay.textContent = comboText;
    typingDisplay.classList.remove("fade-out-up");

    // Ставим новый таймер на 10 секунд
    comboTimeout = setTimeout(() => finishCombo(true), 10000);
  }

  if (e.key === "Backspace") {
    comboText = comboText.slice(0, -1);
    typingDisplay.textContent = comboText;
  }
});

let isFinishing = false; // Флаг блокировки

async function finishCombo(isAuto = false) {
  if (!comboText.trim() || isFinishing) return;

  isFinishing = true;

  // 1. Достижения
  if (!unlockedAchievements.includes("firstMsg")) giveAchievement("firstMsg");
  if (isAuto && !unlockedAchievements.includes("autoSend"))
    giveAchievement("autoSend");

  // ИЗМЕНЕНО: Теперь бонус всегда равен Сила Клика * 5
  const bonus = coinsPerClick * 5;
  const messageToSend = comboText;

  try {
    if (nickname) {
      await db.collection("globalChat").add({
        user: nickname,
        text: messageToSend,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Ошибка при отправке в чат:", error);
  }

  // Визуальный эффект бонуса
  typingDisplay.textContent = `Бонус: +${bonus}`;
  typingDisplay.classList.add("fade-out-up");

  // Очистка
  setTimeout(() => {
    comboText = "";
    typingDisplay.textContent = "";
    isFinishing = false;
    coins += bonus; // Добавляем рассчитанный бонус к балансу
    updateUI();
  }, 1000);
}

// Вспомогательная функция для мгновенной выдачи
function giveAchievement(id) {
  const ach = achievements.find((a) => a.id === id);
  if (ach && !unlockedAchievements.includes(id)) {
    unlockedAchievements.push(id);
    localStorage.setItem("achievements", JSON.stringify(unlockedAchievements));
    showAchievementNotify(ach);
  }
}

// ЧАТ: С автоматической прокруткой вниз
function listenToMessages() {
  db.collection("globalChat")
    .orderBy("timestamp", "desc")
    .limit(15) // Можно вернуть 15, так как теперь есть автоскролл
    .onSnapshot((snap) => {
      const list = document.getElementById("chatList");
      if (!list) return;

      list.innerHTML = "";

      let msgs = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.timestamp) msgs.push(data);
      });

      // Отображаем старые вверху, новые внизу
      msgs.reverse().forEach((d) => {
        const div = document.createElement("div");
        div.className = "chat-item";
        div.innerHTML = `
          <strong style="cursor:pointer; color:var(--main-color); pointer-events:auto;" 
                  onclick="showUserProfile('${d.user}')">${
          d.user || "Аноним"
        }:</strong> 
          <span>${d.text || ""}</span>`;
        list.appendChild(div);
      });

      // АВТОСКРОЛЛ: Мгновенно прокручиваем список к самому последнему сообщению
      // Делаем это с небольшой задержкой, чтобы браузер успел отрисовать новые элементы
      setTimeout(() => {
        list.scrollTo({
          top: list.scrollHeight,
          behavior: "smooth", // 'smooth' для плавной прокрутки или 'auto' для мгновенной
        });
      }, 50);
    });
}
listenToMessages();

// ТРЕЙЛ (ВИЗУАЛ)
function spawnPart(x, y) {
  const p = document.createElement("div");
  p.className = "trail-ember";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.backgroundColor = currentTrailColor;
  p.style.boxShadow = `0 0 10px ${currentTrailColor}`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 600);
}

// ================= УПРАВЛЕНИЕ КЛИКАМИ (ИСПРАВЛЕНО) =================

window.isOsuDragging = false; // КРИТИЧЕСКИ ВАЖНО: Инициализация

function getCoords(e) {
  const x =
    e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : mouseX);
  const y =
    e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : mouseY);
  return { x, y };
}

function startAutoClicking() {
  if (autoClickInterval) return;
  autoClickInterval = setInterval(() => {
    if (isMouseHeld && isAutoClickerActive && autoClickerBought) {
      doClick(mouseX, mouseY);
      // Частицы здесь не вызываем, doClick сам решит, можно ли их спавнить через spawnPart
    }
  }, 75);
}

function stopAutoClicking() {
  clearInterval(autoClickInterval);
  autoClickInterval = null;
}

const clickArea = document.getElementById("clickArea");

clickArea.addEventListener("pointerdown", (e) => {
  const coords = getCoords(e);
  mouseX = coords.x;
  mouseY = coords.y;

  doClick(mouseX, mouseY);

  if (autoClickerBought && isAutoClickerActive) {
    isMouseHeld = true;
    lastX = mouseX;
    lastY = mouseY;
    startAutoClicking();
  }
});

// Глобальный обработчик движения для трейла
document.addEventListener(
  "pointermove",
  (e) => {
    const coords = getCoords(e);
    mouseX = coords.x;
    mouseY = coords.y;

    if (autoClickerBought && isAutoClickerActive && isMouseHeld) {
      const dist = Math.hypot(mouseX - lastX, mouseY - lastY);
      if (dist > 5) {
        const steps = Math.floor(dist / 8);
        for (let i = 0; i <= steps; i++) {
          const x = lastX + (mouseX - lastX) * (i / (steps || 1));
          const y = lastY + (mouseY - lastY) * (i / (steps || 1));
          spawnPart(x, y);
        }
        lastX = mouseX;
        lastY = mouseY;
      }
    }
  },
  { passive: false }
);

document.addEventListener("pointerup", () => {
  isMouseHeld = false;
  stopAutoClicking();
});

// Исправленный трейл для телефона
document.addEventListener(
  "pointermove",
  (e) => {
    const coords = getCoords(e);
    mouseX = coords.x;
    mouseY = coords.y;

    if (autoClickerBought && isAutoClickerActive && isMouseHeld) {
      const dist = Math.hypot(mouseX - lastX, mouseY - lastY);
      // Отрисовка только если палец реально сдвинулся
      if (dist > 5) {
        const steps = Math.floor(dist / 8);
        for (let i = 0; i <= steps; i++) {
          const x = lastX + (mouseX - lastX) * (i / (steps || 1));
          const y = lastY + (mouseY - lastY) * (i / (steps || 1));
          spawnPart(x, y);
        }
        lastX = mouseX;
        lastY = mouseY;
      }
    }
  },
  { passive: false }
); // passive: false критически важен для корректной работы на мобильных

document.addEventListener("pointerup", () => {
  isMouseHeld = false;
  stopAutoClicking();
});
document.addEventListener("pointercancel", () => {
  isMouseHeld = false;
  stopAutoClicking();
});

// ================= МАГАЗИН И ПРОЧЕЕ =================
document.getElementById("clickUpgrade").onclick = () => {
  if (coins >= clickCost) {
    coins -= clickCost;
    coinsPerClick++;
    clickCost = Math.floor(clickCost * 1.25 + 5);
    updateUI();
    saveProgress(); // Сохраняем
  }
};

document.getElementById("passiveUpgrade").onclick = () => {
  if (coins >= passiveCost) {
    coins -= passiveCost;
    passiveLevel++;

    if (passiveLevel <= 10) {
      passiveIncome += 2;
    } else if (passiveLevel <= 30) {
      passiveIncome += 5;
    } else {
      passiveIncome += 10;
    }

    passiveCost = Math.floor(passiveCost * 1.1 + 20);
    updateUI();
    saveProgress(); // Сохраняем
  }
};

autoBtn.onclick = () => {
  if (!autoClickerBought && coins >= 5000) {
    coins -= 5000;
    autoClickerBought = true;
    isAutoClickerActive = true;
    updateAutoBtn();
    updateUI();
    saveProgress(); // Сохраняем
  } else if (autoClickerBought) {
    isAutoClickerActive = !isAutoClickerActive;
    updateAutoBtn();
  }
};

function updateAutoBtn() {
  if (autoClickerBought) {
    autoBtn.textContent = isAutoClickerActive
      ? "АВТОКЛИКЕР: ВКЛ"
      : "АВТОКЛИКЕР: ВЫКЛ";

    // МЕНЯЕМ ВИЗУАЛ (Светлая / Серая)
    if (isAutoClickerActive) {
      autoBtn.style.filter = "grayscale(0%) brightness(1)";
    } else {
      autoBtn.style.filter = "grayscale(100%)";
    }
  } else {
    autoBtn.textContent = "Автокликер (100)";
  }
}

function rgbEffect() {
  if (isRGBMode) {
    hue = (hue + 4) % 360;
    currentTrailColor = `hsl(${hue}, 100%, 50%)`;
  }
  requestAnimationFrame(rgbEffect);
}
rgbEffect();

document.getElementById("rgbToggle").onclick = () => {
  isRGBMode = !isRGBMode;
  document.getElementById("rgbToggle").textContent = isRGBMode
    ? "RGB: ВКЛ"
    : "RGB: ВЫКЛ";
};
document.getElementById("trailColorPicker").oninput = (e) => {
  isRGBMode = false;
  currentTrailColor = e.target.value;
};

if (!nickname) {
  document.getElementById("saveNick").onclick = () => {
    const val = document.getElementById("nicknameInput").value.trim();
    if (val.length >= 2) {
      nickname = val;
      localStorage.setItem("nickname", nickname);
      document.getElementById("nicknameModal").remove();
    }
  };
} else {
  document.getElementById("nicknameModal").remove();
}

setInterval(() => {
  coins += passiveIncome;
  updateUI();
}, 1000);
setInterval(() => {
  if (nickname) {
    db.collection("leaders")
      .doc(nickname)
      .set({ name: nickname, score: Math.floor(coins) });
    db.collection("leaders")
      .orderBy("score", "desc")
      .limit(10)
      .get()
      .then((snap) => {
        const l = document.getElementById("leaders");
        l.innerHTML = "";
        snap.forEach((doc) => {
          const li = document.createElement("li");
          li.textContent = `${doc.data().name}: ${doc.data().score}`;
          l.appendChild(li);
        });
      });
  }
}, 5000);

// бургер
// Логика Бургера
const burgerBtn = document.getElementById("burgerBtn");
const sideMenu = document.getElementById("sideMenu");

burgerBtn.onclick = () => {
  sideMenu.classList.toggle("active");
};

// Привязываем функции к окну (window), чтобы onclick в HTML их видел
window.openModal = openModal;
window.closeModal = closeModal;

// Открытие модалок
// Обновите функцию openModal в вашем script.js:
function openModal(id) {
  if (id === "profileModal") {
    // Заполняем основные данные
    document.getElementById("profNick").textContent = nickname || "Гость";
    document.getElementById("profClicks").textContent = totalClicks;
    document.getElementById("profTotalCoins").textContent = Math.floor(coins);
    document.getElementById("profClickPower").textContent = `x${coinsPerClick}`;
    document.getElementById("profPassive").textContent = `${passiveIncome}/сек`;

    // Считаем количество достижений
    // Используем актуальную длину массива из localStorage или переменной
    const achCount = unlockedAchievements.length;
    const totalPossible = achievements.length; // Всего достижений в конфиге (сейчас их 10)

    // Обновляем строку в профиле
    document.getElementById(
      "profAchCount"
    ).textContent = `${achCount}/${totalPossible}`;
  }

  // Остальная логика открытия модалок...
  if (id === "onlineModal") updateOnlineList();

  if (id === "achievementsModal") {
    const list = document.getElementById("achievementsList");
    list.innerHTML = "";
    achievements.forEach((ach) => {
      const isUnlocked = unlockedAchievements.includes(ach.id);
      list.innerHTML += `
        <div class="ach-card ${isUnlocked ? "unlocked" : ""}">
          <h4>${isUnlocked ? "✅" : "🔒"} ${ach.title}</h4>
          <p>${ach.desc}</p>
        </div>
      `;
    });
  }

  if (id === "trailModal" && !autoClickerBought) {
    alert("Сначала купите Автокликер!");
    return;
  }
  document.getElementById(id).classList.add("active");
  sideMenu.classList.remove("active");
}

// Закрытие при клике на фон
function closeModal(e) {
  if (e.target.classList.contains("game-modal")) {
    e.target.classList.remove("active");
    sideMenu.classList.add("active"); // Возвращаем меню, как ты просил
  }
}

// Обновляем doClick, чтобы считать общие клики
const originalDoClick = doClick;
doClick = function (x, y) {
  totalClicks++; // Считаем клик в профиль
  originalDoClick(x, y);
};

// Проверка достижений
function checkAchievements() {
  achievements.forEach((ach) => {
    if (!unlockedAchievements.includes(ach.id) && ach.check()) {
      unlockedAchievements.push(ach.id);
      localStorage.setItem(
        "achievements",
        JSON.stringify(unlockedAchievements)
      );
      showAchievementNotify(ach);
    }
  });
}

function showAchievementNotify(ach) {
  const notify = document.getElementById("achNotify");
  notify.innerHTML = `<strong>🏆 Достижение получено!</strong><br>${ach.title}`;
  notify.classList.add("show");
  setTimeout(() => notify.classList.remove("show"), 4000);
}

// Запускаем проверку каждую секунду
setInterval(checkAchievements, 1000);

// Обновление КПС
setInterval(() => {
  // Обновляем текст на экране
  document.getElementById("cps").textContent = clicksLastSecond;

  // Сбрасываем счетчик для следующей секунды
  clicksLastSecond = 0;
}, 1000);

// Печатать телефон
const mobileInput = document.getElementById("mobileInput");
const chatPanel = document.getElementById("recentMessage");

// При клике на чат — открываем клавиатуру
chatPanel.addEventListener("click", () => {
  mobileInput.focus();
});

// Слушаем ввод в скрытое поле
mobileInput.addEventListener("input", (e) => {
  const char = e.data; // Получаем введенный символ

  if (char) {
    // Эмулируем нажатие клавиши для твоей системы комбо
    // Мы просто добавляем символ в comboText, как это делает твой keydown
    clearTimeout(comboTimeout);
    comboText += char;
    typingDisplay.textContent = comboText;
    typingDisplay.classList.remove("fade-out-up");
    comboTimeout = setTimeout(() => finishCombo(true), 10000);

    // Очищаем поле, чтобы можно было вводить дальше
    mobileInput.value = "";
  }
});

// Обработка Enter на мобильной клавиатуре
mobileInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (comboText.trim().length > 0) {
      clearTimeout(comboTimeout);
      finishCombo(false);
    }
    mobileInput.blur(); // Закрываем клавиатуру после отправки
  }
});

// Кто куда кликнул
let clickBatch = 0;

function broadcastClick() {
  clickBatch += coinsPerClick;

  // Отправляем инфо в сеть каждые 50 накопленных монет
  if (clickBatch >= 50) {
    db.collection("globalEvents").add({
      user: nickname,
      type: "CLICK",
      amount: clickBatch,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    clickBatch = 0;
  }
}

// кто куда кликнул 2
function listenToGlobalEvents() {
  // Слушаем только события, созданные в последние 5 секунд
  const startTime = firebase.firestore.Timestamp.now();

  db.collection("globalEvents")
    .where("timestamp", ">", startTime)
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.user !== nickname) {
            // Не показываем свои же клики
            showGlobalHint(`${data.user} заработал +${data.amount}!`);
          }
        }
      });
    });
}

function showGlobalHint(text) {
  const feed = document.getElementById("liveFeed");
  const el = document.createElement("div");
  el.textContent = text;
  el.className = "fade-out-up"; // Используем твою готовую анимацию
  feed.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

listenToGlobalEvents();

// Авто-сохранение прогресса каждые 3 секунды (на всякий случай)
setInterval(saveProgress, 3000);

// Обновление UI при загрузке, чтобы сразу увидеть загруженные цифры
updateUI();
updateAutoBtn();

// Периодическое сохранение монет в Firebase (твоя существующая логика лидеров)
setInterval(() => {
  if (nickname) {
    db.collection("leaders")
      .doc(nickname)
      .set({ name: nickname, score: Math.floor(coins) });
    // ... твой код получения списка лидеров ...
  }
}, 5000);

// ОТСЛЕЖИВАНИЕ В СЕТИ
setInterval(() => {
  if (nickname) {
    db.collection("leaders")
      .doc(nickname)
      .set(
        {
          name: nickname,
          score: Math.floor(coins),
          clicks: totalClicks,
          power: coinsPerClick,
          passive: passiveIncome,
          achievements: unlockedAchievements,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
  }
}, 5000);

if (nickname) {
  const nickModal = document.getElementById("nicknameModal");
  if (nickModal) nickModal.remove();
}

// Показ чужого профиля
async function showUserProfile(targetNick) {
  const doc = await db.collection("leaders").doc(targetNick).get();
  if (doc.exists) {
    const data = doc.data();
    document.getElementById("viewedNick").textContent = data.name;
    document.getElementById("viewedClicks").textContent = data.clicks || 0;
    document.getElementById("viewedCoins").textContent = data.score || 0;
    document.getElementById("viewedPower").textContent = `x${data.power || 1}`;
    document.getElementById("viewedPassive").textContent = `${
      data.passive || 0
    }/сек`;

    // ДОБАВЛЕНО: Считаем достижения из полученных данных
    const remoteAchs = data.achievements || [];
    document.getElementById("viewedAchCount").textContent = remoteAchs.length;

    openModal("userProfileModal");
  }
}

// Обновление списка "В сети" (кто заходил последние 15 секунд)
async function updateOnlineList() {
  const now = Date.now();
  const snap = await db
    .collection("leaders")
    .where("lastSeen", ">", now - 15000)
    .get();
  const list = document.getElementById("onlineList");
  list.innerHTML = "";
  snap.forEach((doc) => {
    const div = document.createElement("div");
    div.className = "online-user";
    div.textContent = `🟢 ${doc.data().name}`;
    div.onclick = () => showUserProfile(doc.data().name);
    list.appendChild(div);
  });
}

// Система эмодзи
function sendEmoji(emoji) {
  if (!nickname) return;

  db.collection("globalEvents").add({
    user: nickname,
    type: "EMOJI",
    emoji: emoji,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Показываем у себя (передаем и эмодзи, и свой ник)
  displayEmoji(emoji, nickname);
}

function displayEmoji(emoji, senderNick) {
  const container = document.createElement("div");
  container.className = "emoji-fly-container";

  // Создаем само эмодзи
  const emojiEl = document.createElement("div");
  emojiEl.className = "emoji-main";
  emojiEl.textContent = emoji;

  // Создаем подпись с ником
  const nameEl = document.createElement("div");
  nameEl.className = "emoji-sender-name";
  nameEl.textContent = senderNick;

  container.appendChild(emojiEl);
  container.appendChild(nameEl);

  // Рандомное смещение от центра, чтобы не перекрывали друг друга
  container.style.left = 50 + (Math.random() * 30 - 15) + "%";
  container.style.top = 50 + (Math.random() * 20 - 10) + "%";

  document.body.appendChild(container);

  // Удаляем через 1.2 секунды (чуть дольше, чтобы успели прочитать ник)
  setTimeout(() => container.remove(), 1200);
}

// Модифицируем прослушивание событий, чтобы ловить эмодзи
function listenToGlobalEventsExtended() {
  const startTime = firebase.firestore.Timestamp.now();
  db.collection("globalEvents")
    .where("timestamp", ">", startTime)
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.type === "EMOJI" && data.user !== nickname) {
            displayEmoji(data.emoji, data.user);
          }
        }
      });
    });
}
listenToGlobalEventsExtended();

// OSU
// ================= OSU CONFIG & SETTINGS =================
const OSU_CONFIG = {
  targetSize: 80, // Размер круга (оптимально для пальца)
  sliderDist: 150, // Чуть уменьшил длину, чтобы не вылезало на узких экранах
  spawnDelay: 150,
  bonusMultiplier: 5,
  finishRadius: 70,
};

// Переменная для хранения состояния автокликера перед включением OSU
let wasAutoClickerActiveBeforeOsu = false;

// ================= OSU MODE LOGIC =================
let isOsuMode = false;
let nextOsuData = null;
window.isOsuDragging = false;

function toggleOsuMode() {
  isOsuMode = !isOsuMode;
  const btn = document.getElementById("osuBtn");
  const body = document.body;

  if (isOsuMode) {
    // Сохраняем и выключаем автокликер
    wasAutoClickerActiveBeforeOsu = isAutoClickerActive;
    isAutoClickerActive = false;
    if (typeof updateAutoBtn === "function") updateAutoBtn();

    btn.textContent = "OSU РЕЖИМ: ВКЛ";
    btn.style.color = "#ff0000";

    // ВКЛЮЧАЕМ ЧИСТЫЙ ИНТЕРФЕЙС
    body.classList.add("osu-active-ui");

    prepareNextStep();
    spawnOsuElement();
  } else {
    // Возвращаем настройки
    isAutoClickerActive = wasAutoClickerActiveBeforeOsu;
    if (typeof updateAutoBtn === "function") updateAutoBtn();

    btn.textContent = "OSU РЕЖИМ: ВЫКЛ";
    btn.style.color = "var(--main-color)";

    // ВЫКЛЮЧАЕМ ЧИСТЫЙ ИНТЕРФЕЙС
    body.classList.remove("osu-active-ui");

    clearOsu();
    nextOsuData = null;
    window.isOsuDragging = false;
  }
}

// Изменяем стили динамически для размера
function applyOsuStyles() {
  const styleId = "osu-dynamic-styles";
  let styleTag = document.getElementById(styleId);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }
  styleTag.innerHTML = `
        .osu-target, .osu-finish, .osu-ball {
            width: ${OSU_CONFIG.targetSize}px !important;
            height: ${OSU_CONFIG.targetSize}px !important;
        }
    `;
}
applyOsuStyles(); // Запускаем один раз при загрузке

function prepareNextStep() {
  // Делаем зону чуть уже сверху и снизу, чтобы не перекрывать баланс и меню
  const safeZoneWidth = window.innerWidth * 0.8;
  const safeZoneHeight = window.innerHeight * 0.6;

  const startX = (window.innerWidth - safeZoneWidth) / 2;
  const startY = (window.innerHeight - safeZoneHeight) / 2 + 30; // Смещаем чуть ниже баланса

  let x = startX + Math.random() * safeZoneWidth;
  let y = startY + Math.random() * safeZoneHeight;

  const halfSize = OSU_CONFIG.targetSize / 2;
  x = Math.max(halfSize, Math.min(window.innerWidth - halfSize, x));
  y = Math.max(halfSize, Math.min(window.innerHeight - halfSize, y));

  nextOsuData = {
    x: x,
    y: y,
    type: Math.random() > 0.4 ? "circle" : "slider",
    angle: Math.random() * Math.PI * 2,
    dist: OSU_CONFIG.sliderDist,
  };
}

function showNextPreview() {
  document.querySelectorAll(".osu-next-wrapper").forEach((el) => el.remove());
  const wrapper = document.createElement("div");
  wrapper.className = "osu-next-wrapper";
  wrapper.style.opacity = "0.15";
  wrapper.style.pointerEvents = "none";

  if (nextOsuData.type === "circle") {
    const preview = document.createElement("div");
    preview.className = "osu-target";
    preview.style.left = nextOsuData.x + "px";
    preview.style.top = nextOsuData.y + "px";
    wrapper.appendChild(preview);
  } else {
    const { x, y, angle, dist } = nextOsuData;
    const endX = x + Math.cos(angle) * dist;
    const endY = y + Math.sin(angle) * dist;
    wrapper.innerHTML = `
            <div class="osu-slider-line" style="left:${x}px; top:${y}px; width:${dist}px; transform:rotate(${angle}rad)"></div>
            <div class="osu-finish" style="left:${endX}px; top:${endY}px"></div>
            <div class="osu-target" style="left:${x}px; top:${y}px"></div>`;
  }
  document.body.appendChild(wrapper);
}

function spawnOsuElement() {
  if (!isOsuMode || !nextOsuData) return;
  const current = nextOsuData;
  prepareNextStep();

  if (current.type === "circle") {
    const circle = document.createElement("div");
    circle.className = "osu-target";
    circle.style.left = current.x + "px";
    circle.style.top = current.y + "px";
    circle.onpointerdown = (e) => {
      e.stopPropagation();
      window.isOsuDragging = true;
      circle.classList.add("hit-anim");
      processOsuHit(current.x, current.y);
      setTimeout(() => {
        circle.remove();
        window.isOsuDragging = false;
        spawnOsuElement();
      }, OSU_CONFIG.spawnDelay);
    };
    document.body.appendChild(circle);
  } else {
    createOsuSlider(current);
  }
  showNextPreview();
}

function createOsuSlider(data) {
  const wrapper = document.createElement("div");
  wrapper.className = "osu-wrapper";
  document.body.appendChild(wrapper);

  const { x: startX, y: startY, angle, dist } = data;
  const endX = startX + Math.cos(angle) * dist;
  const endY = startY + Math.sin(angle) * dist;

  wrapper.innerHTML = `
        <div class="osu-slider-line" style="left:${startX}px; top:${startY}px; width:${dist}px; transform:rotate(${angle}rad)"></div>
        <div class="osu-finish" style="left:${endX}px; top:${endY}px"></div>`;

  const start = document.createElement("div");
  start.className = "osu-target";
  start.style.left = startX + "px";
  start.style.top = startY + "px";
  wrapper.appendChild(start);

  let ball = null;

  start.onpointerdown = (e) => {
    e.stopPropagation();
    window.isOsuDragging = true;
    start.style.opacity = "0";
    ball = document.createElement("div");
    ball.className = "osu-ball";
    ball.style.left = startX + "px";
    ball.style.top = startY + "px";
    document.body.appendChild(ball);

    const onMove = (me) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      const t = Math.max(
        0,
        Math.min(1, (dx * Math.cos(angle) + dy * Math.sin(angle)) / dist)
      );
      const curX = startX + t * Math.cos(angle) * dist;
      const curY = startY + t * Math.sin(angle) * dist;
      ball.style.left = curX + "px";
      ball.style.top = curY + "px";
      spawnPart(curX, curY);
    };

    const onUp = (ue) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalDist = Math.hypot(ue.clientX - endX, ue.clientY - endY);

      if (finalDist < OSU_CONFIG.finishRadius) {
        processOsuHit(endX, endY);
        wrapper.classList.add("fade-out");
        setTimeout(() => {
          wrapper.remove();
          if (ball) ball.remove();
          window.isOsuDragging = false;
          spawnOsuElement();
        }, OSU_CONFIG.spawnDelay);
      } else {
        start.style.opacity = "1";
        if (ball) ball.remove();
        window.isOsuDragging = false;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
}

function processOsuHit(x, y) {
  const bonus = coinsPerClick * OSU_CONFIG.bonusMultiplier;
  coins += bonus;
  updateUI();
  const text = document.createElement("div");
  text.className = "float-text";
  text.style.color = "var(--main-color)";
  text.style.fontWeight = "bold";
  text.textContent = `+${bonus}`;
  text.style.left = x + "px";
  text.style.top = y + "px";
  document.body.appendChild(text);
  setTimeout(() => text.remove(), 800);
  for (let i = 0; i < 6; i++) spawnPart(x, y);
}

function spawnPart(x, y) {
  if (isOsuMode && !window.isOsuDragging) return;
  const p = document.createElement("div");
  p.className = "trail-ember";
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.backgroundColor = currentTrailColor;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 600);
}

function clearOsu() {
  document
    .querySelectorAll(
      ".osu-target, .osu-slider-line, .osu-finish, .osu-ball, .osu-wrapper, .osu-next-wrapper"
    )
    .forEach((el) => el.remove());
}

