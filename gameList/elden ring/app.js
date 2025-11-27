
document.addEventListener('DOMContentLoaded', () => {

  const SYMBOLS = [
    { id: 'rune', icon: 'fas fa-ring', color: '#f1c40f', weight: 75, mult3: 0.1, mult4: 0.2, mult5: 1.5 },
    { id: 'grace', icon: 'fas fa-sun', color: '#ecf0f1', weight: 40, mult3: 0.3, mult4: 0.5, mult5: 4 },
    { id: 'erdtree', icon: 'fas fa-tree', color: '#2ecc71', weight: 20, mult3: 0.5, mult4: 1.2, mult5: 8 },
    { id: 'pot', icon: 'fas fa-jar', color: '#e67e22', weight: 5, mult3: 6, mult4: 15, mult5: 40 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3, mult4: s.mult4, mult5: s.mult5 }]));
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
      const p = PAYOUT_BY_ID[s.id];
      const card = document.createElement('div');
      card.className = 'payout-card';
      card.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size:20px;"></i>
        <div class="mult">5x: ${p.mult5}</div><div class="value">Max: ${formatMoney(bet * p.mult5)}</div>`;
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
    totalWinEl.textContent = `Runas: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Gastas: ${formatMoney(totalBetAccum)}`;
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
    
    // Reset effects
    document.querySelectorAll('.cell').forEach(c => {
        c.style.background = 'transparent';
        c.style.boxShadow = 'none';
    });

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
            
            // Elden Ring Glow Effect
            for(let i=0; i<count; i++){
                reelCells[i][row].style.background = 'rgba(241, 196, 15, 0.1)';
                reelCells[i][row].style.boxShadow = 'inset 0 0 10px #f1c40f';
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
      // Fade out
      cells.forEach(c => c.style.opacity = '0.5');
      
      setTimeout(() => {
          cells.forEach((cell, i) => { 
              cell.style.opacity = '1';
              const s = SYMBOLS_MAP[results[colIdx][i]];
              cell.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size:32px; filter: drop-shadow(0 0 5px ${s.color});"></i>`;
          });
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
