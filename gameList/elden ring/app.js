
document.addEventListener('DOMContentLoaded', () => {

  const SYMBOLS = [
    { id: 'rune', img: 'assets/symbols/rune.png', weight: 75, mult3: 0.1, mult4: 0.2, mult5: 1.5 },
    { id: 'grace', img: 'assets/symbols/grace.png', weight: 40, mult3: 0.3, mult4: 0.5, mult5: 4 },
    { id: 'erdtree', img: 'assets/symbols/erdtree.png', weight: 20, mult3: 0.5, mult4: 1.2, mult5: 8 },
    { id: 'pot', img: 'assets/symbols/pot.png', weight: 5, mult3: 6, mult4: 15, mult5: 40 },
    { id: 'ring', img: 'assets/symbols/ring.png', weight: 4, mult3: 15, mult4: 80, mult5: 400 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3, mult4: s.mult4, mult5: s.mult5 }]));
  const ID_LIST = SYMBOLS.map(s => s.id);
  const PLACEHOLDERS = { rune: '', grace: '', erdtree: '', pot: '', ring: '' };

  let balance = 0.0;
  let bet = 2.0;
  let totalWinAccum = 0;
  let totalBetAccum = 0;
  let spinning = false;

  // --- BRIDGE LISTENER ---
  window.addEventListener('message', (event) => {
      if(event.data.type === 'INIT_GAME') {
          balance = parseFloat(event.data.balance);
          updateDisplay();
      }
  });

  function broadcastUpdate(delta, action) {
      window.parent.postMessage({
          type: 'GAME_UPDATE',
          payload: { newBalance: balance, delta: delta, action: action }
      }, '*');
  }

  const balanceEl = document.getElementById('balance');
  const betDisplayEl = document.getElementById('betDisplay');
  const betValueEl = document.getElementById('betValue');
  const lastResultEl = document.getElementById('lastResult');
  const spinBtn = document.getElementById('spinBtn');
  const reelsEls = [...document.querySelectorAll('.reel')];
  const decBetBtn = document.getElementById('decBet');
  const incBetBtn = document.getElementById('incBet');
  const payoutsEl = document.getElementById('payouts');
  const totalWinEl = document.getElementById('totalWin');
  const totalBetEl = document.getElementById('totalBet');
  const balanceScaleText = document.getElementById('balanceScaleText');
  const balanceScaleGreen = document.getElementById('balanceScaleGreen');
  const balanceScaleRed = document.getElementById('balanceScaleRed');
  let personaAdviceEl = document.getElementById('personaAdvice');

  if(!spinBtn || reelsEls.length === 0) return;
  const reelImages = reelsEls.map(reel => [...reel.querySelectorAll('.cell img')]);

  function formatMoney(val){ return `R$ ${Number(val || 0).toFixed(1)}`; }
  function getRandomSymbolID(){ return ID_LIST[Math.floor(Math.random()*ID_LIST.length)]; }

  function renderPayoutCards(){
    payoutsEl.innerHTML = '';
    SYMBOLS.forEach(s => {
      const p = PAYOUT_BY_ID[s.id];
      const card = document.createElement('div');
      card.className = 'payout-card';
      card.innerHTML = `<img src="${s.img}" onerror="this.src='${PLACEHOLDERS[s.id]}'">
        <div class="mult">5x: ${p.mult5}</div><div class="value">Max: ${formatMoney(bet * p.mult5)}</div>`;
      payoutsEl.appendChild(card);
    });
  }

  function updateBalanceScale(){
    const lucroLiquido = totalWinAccum - totalBetAccum;
    const pct = totalBetAccum ? (lucroLiquido / totalBetAccum) * 100 : 0;
    balanceScaleText.textContent = pct >= 0 ? `Progresso: ${Math.round(pct)}%` : `Dano: ${Math.round(pct)}%`;
    balanceScaleGreen.style.width = pct >= 0 ? `${Math.min(50+(pct/2), 100)}%` : '50%';
    balanceScaleRed.style.width = pct < 0 ? `${Math.min(50+(Math.abs(pct)/2), 100)}%` : '50%';
  }

  function canSpin(){ return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance; }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = bet.toFixed(2);
    renderPayoutCards();
    totalWinEl.textContent = `Runas: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Gastas: ${formatMoney(totalBetAccum)}`;
    updateBalanceScale();
    spinBtn.disabled = !canSpin();
  }

  function showCentralWin(amount){
    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = `GREAT RUNE!<br>💰 ${formatMoney(amount)}`;
    document.body.appendChild(popup);
    requestAnimationFrame(()=> { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{ popup.remove(); }, 2000);
  }

  function fullComputeWin(results) {
    let win = 0;
    const rows = results[0].length;
    const cols = results.length;
    
    // (Lógica Simplificada para integridade do patch)
    for (let row = 0; row < rows; row++) {
        const symbolID = results[0][row];
        if(!PAYOUT_BY_ID[symbolID]) continue;
        let count = 1;
        for (let col = 1; col < cols; col++) {
            if (results[col][row] === symbolID) count++;
            else break;
        }
        if (count >= 3) {
            const p = PAYOUT_BY_ID[symbolID];
            let mult = count === 3 ? p.mult3 : count === 4 ? p.mult4 : p.mult5;
            win += bet * mult;
        }
    }

    if (win > 0) {
        balance += win;
        totalWinAccum += win;
        broadcastUpdate(win, 'win');
        showCentralWin(win);
    }
    updateDisplay();
  }

  function spinReels(results) {
    spinning = true;
    reelsEls.forEach((reelEl, colIdx) => {
      const imgs = reelImages[colIdx];
      setTimeout(() => {
          imgs.forEach((img, i) => img.src = SYMBOLS_MAP[results[colIdx][i]].img);
          if (colIdx === reelsEls.length - 1) {
            fullComputeWin(results);
            spinning = false;
            updateDisplay();
          }
      }, 1000 + (colIdx * 200));
    });
  }

  decBetBtn.addEventListener('click', () => { bet = Math.max(0.1, bet - 0.5); updateDisplay(); });
  incBetBtn.addEventListener('click', () => { bet = Math.min(balance, bet + 0.5); updateDisplay(); });
  
  spinBtn.addEventListener('click', () => {
    if (!canSpin()) return;
    balance -= bet;
    totalBetAccum += bet;
    broadcastUpdate(-bet, 'bet');
    updateDisplay();
    const results = [];
    for (let col = 0; col < 5; col++) {
      results[col] = [];
      for (let row = 0; row < 4; row++) results[col][row] = getRandomSymbolID();
    }
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
