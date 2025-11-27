
document.addEventListener('DOMContentLoaded', () => {

  const SYMBOLS = [
    { id: 'axe', icon: 'fas fa-hammer', color: '#3498db', weight: 75, mult3: 0.8, mult4: 1.2 },
    { id: 'shield', icon: 'fas fa-shield-halved', color: '#f39c12', weight: 40, mult3: 1.5, mult4: 3 },
    { id: 'blades', icon: 'fas fa-fire', color: '#e74c3c', weight: 25, mult3: 3, mult4: 6 },
    { id: 'omega', icon: 'fas fa-om', color: '#c0392b', weight: 5, mult3: 50, mult4: 100 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3 }]));
  const ID_LIST = SYMBOLS.map(s => s.id);

  let balance = 0.0;
  let bet = 2.0;
  let totalWinAccum = 0;
  let totalBetAccum = 0;
  let spinning = false;

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
  const spinBtn = document.getElementById('spinBtn');
  const reelsEls = [...document.querySelectorAll('.reel')];
  const decBetBtn = document.getElementById('decBet');
  const incBetBtn = document.getElementById('incBet');
  const payoutsEl = document.getElementById('payouts');
  const totalWinEl = document.getElementById('totalWin');
  const totalBetEl = document.getElementById('totalBet');

  if(!spinBtn || reelsEls.length === 0) return;
  const reelCells = reelsEls.map(reel => [...reel.querySelectorAll('.cell')]);

  function formatMoney(val){ return `R$ ${Number(val || 0).toFixed(1)}`; }
  function getRandomSymbolID(){ return ID_LIST[Math.floor(Math.random()*ID_LIST.length)]; }

  function renderPayoutCards(){
    payoutsEl.innerHTML = '';
    SYMBOLS.forEach(s => {
      const mult3 = PAYOUT_BY_ID[s.id].mult3;
      const card = document.createElement('div');
      card.className = 'payout-card';
      card.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size:20px;"></i>
        <div class="mult" style="margin-top:4px;">3x = ${mult3}</div><div class="value">${formatMoney(bet * mult3)}</div>`;
      payoutsEl.appendChild(card);
    });
  }

  function canSpin(){ return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance; }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = bet.toFixed(2);
    renderPayoutCards();
    totalWinEl.textContent = `Win: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Oferenda: ${formatMoney(totalBetAccum)}`;
    spinBtn.disabled = !canSpin();
  }

  function showCentralWin(amount){
    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = `RAGNARÖK!<br>💰 ${formatMoney(amount)}`;
    document.body.appendChild(popup);
    requestAnimationFrame(()=> { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{ popup.remove(); }, 2000);
  }

  function fullComputeWin(results) {
    let win = 0;
    const rows = results[0].length;
    const cols = results.length;
    
    // Reset visual
    document.querySelectorAll('.cell i').forEach(el => {
        el.style.transform = 'scale(1)';
        el.style.textShadow = 'none';
    });

    for (let row = 0; row < rows; row++) {
        const symbolID = results[0][row];
        let count = 1;
        for (let col = 1; col < cols; col++) {
            if (results[col][row] === symbolID) count++;
            else break;
        }
        if (count >= 3 && PAYOUT_BY_ID[symbolID]) {
            win += bet * PAYOUT_BY_ID[symbolID].mult3;
            // Win Animation
             for(let i=0; i<count; i++){
                const icon = reelCells[i][row].querySelector('i');
                icon.style.transform = 'scale(1.5)';
                icon.style.textShadow = `0 0 10px ${SYMBOLS_MAP[symbolID].color}`;
            }
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
      const cells = reelCells[colIdx];
      
      // Animação de giro (Shake)
      reelEl.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
          reelEl.style.transform = 'translateY(0)';
          cells.forEach((cell, i) => { 
              const s = SYMBOLS_MAP[results[colIdx][i]];
              cell.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size:36px; filter: drop-shadow(2px 4px 6px #000);"></i>`;
          });
          if (colIdx === reelsEls.length - 1) {
            fullComputeWin(results);
            spinning = false;
            updateDisplay();
          }
      }, 1000 + (colIdx * 300));
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
    for (let col = 0; col < 3; col++) {
      results[col] = [];
      for (let row = 0; row < 3; row++) results[col][row] = getRandomSymbolID();
    }
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
