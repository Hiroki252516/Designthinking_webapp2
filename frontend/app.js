const screens = {
  input: document.getElementById('screen-input'),
  result: document.getElementById('screen-result'),
  coupon: document.getElementById('screen-coupon')
};

const codeBoxes = Array.from(document.querySelectorAll('.code-box'));
const keypad = document.querySelector('.keypad');
const submitBtn = document.getElementById('submit-btn');
const resultMessage = document.getElementById('result-message');
const resultDetail = document.getElementById('result-detail');
const showCouponBtn = document.getElementById('show-coupon');
const retryBtn = document.getElementById('retry');
const slotMachine = document.getElementById('slot-machine');
const reels = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2')
];
const qrTarget = document.getElementById('qr');
const couponTokenEl = document.getElementById('coupon-token');
const couponExpiryEl = document.getElementById('coupon-expiry');
const backHomeBtn = document.getElementById('back-home');
const inputError = document.getElementById('input-error');

let code = '';
let currentCoupon = null;
let currentExpiry = null;
let spinTimer = null;

const VALID_CODE = '2026';

function switchScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('is-active'));
  screens[name].classList.add('is-active');
}

function renderCode() {
  codeBoxes.forEach((box, index) => {
    box.textContent = code[index] || '';
  });
  validateCode();
}

function addDigit(digit) {
  if (code.length >= 4) return;
  code += digit;
  renderCode();
}

function removeDigit() {
  code = code.slice(0, -1);
  renderCode();
}

function clearCode() {
  code = '';
  renderCode();
}

function setInputError(message) {
  inputError.textContent = message;
  inputError.classList.toggle('hidden', !message);
}

function validateCode({ forceMessage = false } = {}) {
  const isNumeric = /^\d{4}$/.test(code);
  const isComplete = code.length === 4;
  const isValid = isNumeric && code === VALID_CODE;
  const showError = !isValid && (forceMessage || isComplete);

  setInputError(showError ? '番号が無効です' : '');
  submitBtn.disabled = !isValid;
  return isValid;
}

function randomDigits() {
  return [
    Math.floor(Math.random() * 10),
    Math.floor(Math.random() * 10),
    Math.floor(Math.random() * 10)
  ];
}

function setReels(digits) {
  reels.forEach((reel, index) => {
    reel.textContent = digits[index];
  });
}

function spinReels(durationMs) {
  slotMachine.classList.add('spinning');
  spinTimer = setInterval(() => {
    setReels(randomDigits());
  }, 80);

  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(spinTimer);
      slotMachine.classList.remove('spinning');
      resolve();
    }, durationMs);
  });
}

function formatExpiry(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return `有効期限: ${date.toLocaleString('ja-JP')}`;
}

async function play() {
  if (!validateCode({ forceMessage: true })) return;
  submitBtn.disabled = true;
  resultMessage.textContent = '抽選中...';
  resultDetail.textContent = '';
  showCouponBtn.classList.add('hidden');
  switchScreen('result');

  const spinPromise = spinReels(1400);

  let data = null;
  try {
    const response = await fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lid_code: code })
    });
    if (!response.ok) {
      throw new Error('API error');
    }
    data = await response.json();
  } catch (error) {
    await spinPromise;
    setReels([0, 0, 0]);
    resultMessage.textContent = '通信エラー';
    resultDetail.textContent = '時間をおいて再試行してください。';
    return;
  }

  await spinPromise;

  if (data.status === 'win') {
    setReels([7, 7, 7]);
    resultMessage.textContent = '当たり！';
    resultDetail.textContent = data.message || 'おめでとうございます！';
    showCouponBtn.classList.remove('hidden');
    currentCoupon = data.coupon_token;
    currentExpiry = data.expires_at;
  } else if (data.status === 'lose') {
    const digits = randomDigits();
    if (digits[0] === 7 && digits[1] === 7 && digits[2] === 7) {
      digits[2] = 5;
    }
    setReels(digits);
    resultMessage.textContent = '残念...';
    resultDetail.textContent = data.message || 'また挑戦してください。';
  } else {
    setReels([0, 0, 0]);
    resultMessage.textContent = '無効';
    resultDetail.textContent = data.message || '識別番号を確認してください。';
  }
}

function renderCoupon() {
  if (!currentCoupon) return;
  qrTarget.innerHTML = '';
  const qr = qrcode(0, 'M');
  qr.addData(currentCoupon);
  qr.make();
  qrTarget.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
  couponTokenEl.textContent = currentCoupon;
  couponExpiryEl.textContent = formatExpiry(currentExpiry);
}

keypad.addEventListener('click', (event) => {
  const key = event.target.dataset.key;
  if (!key) return;
  if (key === 'back') {
    removeDigit();
    return;
  }
  if (key === 'clear') {
    clearCode();
    return;
  }
  if (/^\d$/.test(key)) {
    addDigit(key);
  }
});

submitBtn.addEventListener('click', play);

showCouponBtn.addEventListener('click', () => {
  renderCoupon();
  switchScreen('coupon');
});

retryBtn.addEventListener('click', () => {
  clearCode();
  switchScreen('input');
});

backHomeBtn.addEventListener('click', () => {
  clearCode();
  switchScreen('input');
});

window.addEventListener('keydown', (event) => {
  if (screens.input.classList.contains('is-active') === false) return;
  if (event.key >= '0' && event.key <= '9') {
    addDigit(event.key);
  } else if (event.key === 'Backspace') {
    removeDigit();
  } else if (event.key === 'Enter') {
    play();
  }
});

function initFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get('code');
  if (codeParam === VALID_CODE) {
    code = codeParam;
    renderCode();
  }
}

renderCode();
initFromQuery();
