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

const VALID_CODES = ['2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035'];

function switchScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('is-active'));
  screens[name].classList.add('is-active');
}

function renderCode() {
  codeBoxes.forEach((box, index) => {
    box.textContent = code[index] || '';
  });
  updateSubmitState();
}

function addDigit(digit) {
  if (code.length >= 4) return;
  code += digit;
  setInputError('');
  renderCode();
}

function removeDigit() {
  code = code.slice(0, -1);
  setInputError('');
  renderCode();
}

function clearCode() {
  code = '';
  setInputError('');
  renderCode();
}

function setInputError(message) {
  inputError.textContent = message;
  inputError.classList.toggle('hidden', !message);
}

function updateSubmitState() {
  const isComplete = /^\d{4}$/.test(code);
  submitBtn.disabled = !isComplete;
}

function isValidCode() {
  return /^\d{4}$/.test(code) && VALID_CODES.includes(code);
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
  if (!/^\d{4}$/.test(code)) return;
  if (!isValidCode()) {
    setInputError('無効な番号です');
    return;
  }
  submitBtn.disabled = true;

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
    submitBtn.disabled = false;
    setInputError('通信エラー。時間をおいて再試行してください。');
    return;
  }

  if (data.status === 'invalid') {
    submitBtn.disabled = false;
    setInputError(data.message || '無効な番号です');
    return;
  }

  if (data.status !== 'win' && data.status !== 'lose') {
    submitBtn.disabled = false;
    setInputError(data.message || 'エラーが発生しました。');
    return;
  }

  resultMessage.textContent = '抽選中...';
  resultDetail.textContent = '';
  showCouponBtn.classList.add('hidden');
  switchScreen('result');

  const spinPromise = spinReels(1400);
  await spinPromise;

  if (data.status === 'win') {
    setReels([7, 7, 7]);
    resultMessage.textContent = '当たり！';
    resultDetail.textContent = data.message || 'おめでとうございます！';
    showCouponBtn.classList.remove('hidden');
    currentCoupon = data.coupon_token;
    currentExpiry = data.expires_at;
  } else {
    const digits = randomDigits();
    if (digits[0] === 7 && digits[1] === 7 && digits[2] === 7) {
      digits[2] = 5;
    }
    setReels(digits);
    resultMessage.textContent = '残念...';
    resultDetail.textContent = data.message || 'また挑戦してください。';
  }
  submitBtn.disabled = false;
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
  if (VALID_CODES.includes(codeParam)) {
    code = codeParam;
    renderCode();
  }
}

renderCode();
initFromQuery();
