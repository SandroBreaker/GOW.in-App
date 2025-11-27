
document.addEventListener('DOMContentLoaded', () => {

  // --- ASSETS LOCAIS (Pasta Raiz /assets/) ---
  const SYMBOLS = [
    { id: 'kunai',  img: '../../assets/kunai.png',  weight: 80, mult3: 0.1, mult4: 0.3, mult5: 1.5 },
    { id: 'scroll', img: '../../assets/scroll.png', weight: 50, mult3: 0.3, mult4: 1.0, mult5: 4 },
    { id: 'ring',   img: '../../assets/ring.png',   weight: 35, mult3: 0.8, mult4: 2.5, mult5: 8 },
    { id: 'cloud',  img: '../../assets/cloud.png',  weight: 15, mult3: 3,   mult4: 10,  mult5: 40 },
    { id: 'eye',    img: '../../assets/eye.png',    weight: 4,  mult3: 15,  mult4: 80,  mult5: 400 }
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
  const balanceScaleGreen = document.getElementById('balanceScaleGreen');
  const balanceScaleRed = document.getElementById('balanceScaleRed');
  const balanceScaleText = document.getElementById('balanceScaleText');

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
      // Renderiza IMG em vez de Ícone
      card.innerHTML = `
        <img src="${s.img}" alt="${s.id}">
        <div class="mult">5x: ${p.mult5}</div>
        <div class="value">Max: ${formatMoney(bet * p.mult5)}</div>
      `;
      payoutsEl.appendChild(card);
    });
  }

  function updateBalanceScale(){
    const lucroLiquido = totalWinAccum - totalBetAccum;
    const pct = totalBetAccum ? (lucroLiquido / totalBetAccum) * 100 : 0;
    balanceScaleText.textContent = pct >= 0 ? `Plano: ${Math.round(pct)}%` : `Dano: ${Math.round(pct)}%`;
    let greenWidth = pct >= 0 ? 50 + (pct / 2) : 50;
    let redWidth = pct < 0 ? 50 + (Math.abs(pct) / 2) : 50;
    balanceScaleGreen.style.width = `${Math.min(greenWidth, 180)}%`;
    balanceScaleRed.style.width = `${Math.min(redWidth, 180)}%`;
  }

  function canSpin(){ return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance; }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = bet.toFixed(2);
    renderPayoutCards();
    totalWinEl.textContent = `Win: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Bet: ${formatMoney(totalBetAccum)}`;
    updateBalanceScale();
    spinBtn.disabled = !canSpin();
  }

  function showCentralWin(amount){
    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = `VITÓRIA!<br>💰 ${formatMoney(amount)}`;
    document.body.appendChild(popup);
    requestAnimationFrame(()=> { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{ popup.remove(); }, 2000);
  }

  function fullComputeWin(results) {
    let win = 0;
    const rows = results[0].length;
    const cols = results.length;
    
    // Reset visual
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('win', 'blur');
        c.style.transform = 'none';
        const img = c.querySelector('img');
        if(img) img.style.filter = 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))';
    });

    for (let row = 0; row < rows; row++) {
        const symbolID = results[0][row];
        if (!PAYOUT_BY_ID[symbolID]) continue;
        let count = 1;
        for (let col = 1; col < cols; col++) {
            if (results[col][row] === symbolID) count++;
            else break;
        }
        if (count >= 3) {
            const payout = PAYOUT_BY_ID[symbolID];
            let mult = count === 3 ? payout.mult3 : count === 4 ? payout.mult4 : payout.mult5;
            win += bet * mult;

            // Highlight win
            for(let i=0; i<count; i++){
                reelCells[i][row].classList.add('win');
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

  function renderSymbol(cell, symbolId) {
      const sym = SYMBOLS_MAP[symbolId];
      // Injeta IMG apontando para assets
      cell.innerHTML = `<img src="${sym.img}" class="symbol-img" alt="${symbolId}">`;
      cell.classList.remove('blur');
  }

  function spinReels(results) {
    spinning = true;
    reelsEls.forEach((reelEl, colIdx) => {
      const cells = reelCells[colIdx];
      // Adiciona blur
      cells.forEach(c => c.classList.add('blur'));
      
      setTimeout(() => {
          cells.forEach((cell, i) => { 
              renderSymbol(cell, results[colIdx][i]);
          });
          
          if (colIdx === reelsEls.length - 1) {
            fullComputeWin(results);
            spinning = false;
            updateDisplay();
          }
      }, 600 + (colIdx * 200)); 
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
      for (let row = 0; row < 4; row++) { results[col][row] = getRandomSymbolID(); }
    }
    
    // Placeholder borrado
    document.querySelectorAll('.cell').forEach(c => {
        c.innerHTML = '<div class="blur-effect"></div>';
        c.classList.add('blur');
    });
    
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
