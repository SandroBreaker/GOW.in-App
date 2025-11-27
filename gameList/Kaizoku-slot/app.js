
document.addEventListener('DOMContentLoaded', () => {

  const SYMBOLS = [
    { id: 'hat', icon: 'fas fa-hat-cowboy', color: '#f1c40f', weight: 75, mult3: 0.2, mult4: 0.5 },
    { id: 'fruit', icon: 'fas fa-apple-whole', color: '#9b59b6', weight: 40, mult3: 0.5, mult4: 1.5 },
    { id: 'meat', icon: 'fas fa-drumstick-bite', color: '#e67e22', weight: 30, mult3: 1.5, mult4: 4 },
    { id: 'skull', icon: 'fas fa-skull-crossbones', color: '#ecf0f1', weight: 5, mult3: 25, mult4: 60 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3 }]));
  const ID_LIST = SYMBOLS.map(s => s.id);
  
  const TIPS = [
      "O One Piece existe!",
      "Gomu Gomu no...",
      "Cuidado com a Marinha!",
      "Eu serei o Rei dos Piratas!"
  ];

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
  const lastResultEl = document.getElementById('lastResult');
  const pirateTipEl = document.getElementById('pirateTip');

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
      card.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size:24px;"></i>
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
    totalWinEl.textContent = `Ganho: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Aposta: ${formatMoney(totalBetAccum)}`;
    spinBtn.disabled = !canSpin();
  }

  function showCentralWin(amount){
    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = `PIRATE KING!<br>💰 ${formatMoney(amount)}`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%,-50%) scale(1.1)'; });
    setTimeout(() => { popup.remove(); }, 2000);
  }

  function fullComputeWin(results) {
    let win = 0;
    const rows = results[0].length;
    const cols = results.length;
    
    // Reset Animations
    document.querySelectorAll('.cell').forEach(c => {
        c.style.transform = 'none';
        c.querySelector('i').style.animation = 'none';
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
            win += bet * PAYOUT_BY_ID[symbolID].mult3;
            // Animate row
             for(let i=0; i<count; i++){
                const icon = reelCells[i][row].querySelector('i');
                icon.style.animation = 'pulse 0.5s infinite';
                reelCells[i][row].style.transform = 'scale(1.1)';
            }
        }
    }
    
    if (win > 0) {
        balance += win;
        totalWinAccum += win;
        lastResultEl.textContent = `Último ganho: ${formatMoney(win)}`;
        lastResultEl.style.color = '#00e676';
        broadcastUpdate(win, 'win');
        showCentralWin(win);
    } else {
        lastResultEl.textContent = `Último ganho: R$ 0,00`;
        lastResultEl.style.color = '#ccc';
    }
    updateDisplay();
  }

  function spinReels(results) {
    spinning = true;
    pirateTipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    
    reelsEls.forEach((reelEl, colIdx) => {
      const cells = reelCells[colIdx];
      // Blur effect
      cells.forEach(c => c.style.filter = 'blur(4px)');
      
      setTimeout(() => {
          cells.forEach((cell, i) => { 
              cell.style.filter = 'none';
              const s = SYMBOLS_MAP[results[colIdx][i]];
              cell.innerHTML = `<i class="${s.icon}" style="color:${s.color}; font-size: 40px; text-shadow: 2px 2px 0 #000;"></i>`;
          });
          
          if (colIdx === reelsEls.length - 1) {
            fullComputeWin(results);
            spinning = false;
            updateDisplay();
          }
      }, 800 + (colIdx * 300));
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
    for (let col = 0; col < reelsEls.length; col++) {
      results[col] = [];
      for (let row = 0; row < 3; row++) results[col][row] = getRandomSymbolID();
    }
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
