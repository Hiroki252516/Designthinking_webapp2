const redeemBtn = document.getElementById('redeem-btn');
const tokenInput = document.getElementById('redeem-token');
const resultEl = document.getElementById('redeem-result');

function setResult(message, tone) {
  resultEl.textContent = message;
  resultEl.style.color = tone === 'ok' ? '#b63a2b' : '';
}

redeemBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setResult('トークンを入力してください。');
    return;
  }
  setResult('確認中...');
  try {
    const response = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon_token: token })
    });
    const data = await response.json();
    if (data.status === 'ok') {
      setResult('引換完了しました。', 'ok');
    } else if (data.status === 'already_redeemed') {
      setResult('既に引換済みです。');
    } else if (data.status === 'expired') {
      setResult('有効期限切れです。');
    } else {
      setResult('無効なクーポンです。');
    }
  } catch (error) {
    setResult('通信エラー。再試行してください。');
  }
});
