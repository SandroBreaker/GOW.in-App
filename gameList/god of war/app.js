
document.addEventListener('DOMContentLoaded', () => {

  // ------------------- CONFIG GOD OF WAR (3x3 ZIG-ZAG STRICT) -------------------
  const SYMBOLS = [
    { id: 'axe', img: 'assets/symbols/axe.png', weight: 75, mult3: 0.75, mult4: 1 }, 
    { id: 'shield', img: 'assets/symbols/shield.png', weight: 40, mult3: 1.5, mult4: 2 }, 
    { id: 'blades', img: 'assets/symbols/blades.png', weight: 25, mult3: 2.5, mult4: 5 }, 
    { id: 'omega', img: 'assets/symbols/omega.png', weight: 5, mult3: 50, mult4: 100 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const WEIGHT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, s.weight]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3, mult4: s.mult4 }]));
  const ID_LIST = SYMBOLS.map(s => s.id);

  const PLACEHOLDERS = {
    axe: 'https://cdn-icons-png.flaticon.com/128/3466/3466073.png',
    shield: 'https://cdn-icons-png.flaticon.com/128/3004/3004618.png',
    blades: 'https://cdn-icons-png.flaticon.com/128/836/836069.png',
    omega: 'https://cdn-icons-png.flaticon.com/128/7325/7325373.png'
  };

  // ------------------- STATE -------------------
  let balance = 50.0;
  let bet = 5.0;
  let totalWinAccum = 0;
  let totalBetAccum = 0;
  let spinning = false;

  // ------------------- DOM -------------------
  const balanceEl = document.getElementById('balance');
  const betDisplayEl = document.getElementById('betDisplay');
  const betValueEl = document.getElementById('betValue');
  const lastResultEl = document.getElementById('lastResult');
  let personaAdviceEl = document.getElementById('personaAdvice');
  const rtpEl = document.getElementById('rtp');
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

  const reelImages = reelsEls.map(reel => [...reel.querySelectorAll('.cell img')]);

  // ------------------- UTILITÁRIOS -------------------
  function formatMoney(val){ return `R$ ${Number(val || 0).toFixed(1)}`; }

  const weightedSymbols = [];
  (function buildInitialWeightedSymbols(){
    ID_LIST.forEach(id => {
      const w = Math.max(0, Number(WEIGHT_BY_ID[id] || 0));
      for(let i=0;i<w;i++) weightedSymbols.push(id);
    });
  })();
  
  function getRandomSymbolID(){
    if(weightedSymbols.length === 0) return ID_LIST[0];
    return weightedSymbols[Math.floor(Math.random()*weightedSymbols.length)];
  }

  // ------------------- DISPLAY -------------------
  function renderPayoutCards(){
    payoutsEl.innerHTML = '';
    SYMBOLS.forEach(s => {
      const mult3 = PAYOUT_BY_ID[s.id].mult3;
      const card = document.createElement('div');
      card.className = 'payout-card';
      card.innerHTML = `
        <img src="${s.img}" onerror="this.src='${PLACEHOLDERS[s.id]}'">
        <div class="mult" style="margin-top:4px;">3x = ${mult3}</div>
        <div class="value">${formatMoney(bet * mult3)}</div>
      `;
      payoutsEl.appendChild(card);
    });
  }

  function updateBalanceScale(){
    const lucroLiquido = totalWinAccum - totalBetAccum;
    const pct = totalBetAccum ? (lucroLiquido / totalBetAccum) * 100 : 0;
    balanceScaleText.textContent = pct >= 0 
      ? `Favor dos Deuses: ${Math.round(pct)}%` 
      : `Dívida de Sangue: ${Math.round(pct)}%`;

    let greenWidth = 50, redWidth = 50;
    if (pct >= 0) greenWidth = 50 + (pct / 2);
    else redWidth = 50 + (Math.abs(pct) / 2);

    const maxWidth = window.innerWidth < 480 ? 120 : 180;
    balanceScaleGreen.style.width = `${Math.min(greenWidth, maxWidth)}%`;
    balanceScaleRed.style.width = `${Math.min(redWidth, maxWidth)}%`;
  }

  function canSpin(){ return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance; }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    if(!Number.isFinite(bet)) bet = 1;
    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = Number.isInteger(bet) ? bet.toFixed(0) : bet.toFixed(2);
    renderPayoutCards();
    totalWinEl.textContent = `Saque: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Oferenda Total: ${formatMoney(totalBetAccum)}`;
    updateBalanceScale();
    updatePersonaAdvice();
    spinBtn.disabled = !canSpin();
    decBetBtn.disabled = bet <= 0.1 || spinning;
    incBetBtn.disabled = bet >= balance || spinning;
  }

  // ------------------- PERSONA -------------------
  function personaAdviceString(){
    let recommended = parseFloat(Math.max(0.5, Math.min(balance * 0.1, 5)).toFixed(2));
    const phrases = [
      `Mimir: "Irmão, concentre-se. Tente R$${recommended}."`,
      `Kratos: "Não aposte o que não pode perder. R$${recommended}."`,
      `Mimir: "As Nornas sussurram sorte com R$${recommended}."`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  function updatePersonaAdvice(){
    if(!personaAdviceEl){
      const meta = document.querySelector('.meta-card');
      if(meta){
        personaAdviceEl = document.createElement('div');
        personaAdviceEl.id = 'personaAdvice';
        personaAdviceEl.style.color = '#c0a062';
        personaAdviceEl.style.fontWeight = 'bold';
        meta.insertBefore(personaAdviceEl, meta.firstChild);
      }
    }
    if(personaAdviceEl) personaAdviceEl.textContent = personaAdviceString();
  }

  // ------------------- POPUP -------------------
  function showCentralWin(amount){
    const phrases = [`RAGNARÖK!<br>💰 ${formatMoney(amount)}`, `FÚRIA!<br>💰 ${formatMoney(amount)}`];
    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = phrases[Math.floor(Math.random()*phrases.length)];
    document.body.appendChild(popup);
    requestAnimationFrame(()=> { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{ popup.style.opacity = '0'; setTimeout(()=> popup.remove(), 350); }, 2500);
  }

  let activeWinLines = [];
  let winLineAnimationId = null;

  function clearWinLines() {
    const canvas = document.getElementById("hlCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    activeWinLines = [];
    if (winLineAnimationId) cancelAnimationFrame(winLineAnimationId);
    winLineAnimationId = null;
  }

  // ------------------- LOGIC CORE (3x3 ZIG-ZAG STRICT) -------------------
  function computeWin(results, highlight = true) {
    let win = 0;
    const matchedPositions = [];
    const rows = results[0].length; // 3
    const cols = results.length;    // 3
    const uniquePathKeys = new Set();
    const usedPositions = new Set();

    function isPositionFree(col, row) {
        return !usedPositions.has(`${col},${row}`);
    }

    function markPositionsAsUsed(positions) {
        positions.forEach(pos => {
            usedPositions.add(`${pos.col},${pos.row}`);
        });
    }

    // 1. Linhas Retas (Horizontais)
    for (let row = 0; row < rows; row++) {
        const startCol = 0;
        const symbolID = results[startCol][row];
        if (!PAYOUT_BY_ID[symbolID] || !isPositionFree(startCol, row)) continue;

        let count = 1;
        const path = [{ col: startCol, row: row }];
        for (let col = startCol + 1; col < cols; col++) {
            if (results[col][row] === symbolID && isPositionFree(col, row)) {
                count++;
                path.push({ col: col, row: row });
            } else break;
        }
        
        if (count >= 3) { // Apenas linhas completas em 3x3
            const payout = PAYOUT_BY_ID[symbolID];
            win += bet * payout.mult3;
            matchedPositions.push([...path]);
            markPositionsAsUsed(path);
        }
    }

    // 2. ZigZag (Conexões Adjacentes)
    function findZigZagPaths(col, row, currentSymbolID, currentPath) {
        if (currentPath.length >= 3) {
            const pathKey = currentPath.map(p => `${p.col},${p.row}`).join('|');
            if (!uniquePathKeys.has(pathKey)) {
                uniquePathKeys.add(pathKey);
                const payout = PAYOUT_BY_ID[currentSymbolID];
                win += bet * payout.mult3;
                matchedPositions.push([...currentPath]);
                markPositionsAsUsed(currentPath);
            }
            return;
        }

        if (col + 1 < cols) {
            const nextCol = col + 1;
            const candidates = [row - 1, row, row + 1].filter(r => r >= 0 && r < rows && isPositionFree(nextCol, r));
            
            for (let nextRow of candidates) {
                if (results[nextCol][nextRow] === currentSymbolID) {
                    currentPath.push({ col: nextCol, row: nextRow });
                    findZigZagPaths(nextCol, nextRow, currentSymbolID, currentPath);
                    currentPath.pop();
                    if(matchedPositions.length > 0 && matchedPositions[matchedPositions.length-1][0].row === row) break;
                }
            }
        }
    }

    for (let r = 0; r < rows; r++) {
       const symbolID = results[0][r];
       if (PAYOUT_BY_ID[symbolID] && isPositionFree(0, r)) {
           findZigZagPaths(0, r, symbolID, [{col: 0, row: r}]);
       }
    }

    if (win > 0) {
      balance += win;
      totalWinAccum += win;
      const container = document.querySelector(".machine");
      if (container) {
          container.style.animation = 'none';
          container.offsetHeight; /* trigger reflow */
          container.style.animation = 'godPulse 0.2s 2 alternate';
      }
      if(navigator.vibrate) navigator.vibrate([100,50,100]);
    }

    if (highlight && win > 0) showCentralWin(win);

    reelImages.forEach(imgs => imgs.forEach(img => (img.parentElement.style.opacity = "0.3")));

    if (matchedPositions.length) {
      activeWinLines.push(...matchedPositions);
      startWinLineAnimation();
    }

    matchedPositions.forEach(line => {
      line.forEach(pos => {
          const img = reelImages[pos.col][pos.row];
          img.parentElement.style.opacity = "1";
          img.parentElement.classList.add('win');
      });
    });

    setTimeout(() => {
      reelImages.forEach(imgs => {
        imgs.forEach(img => {
          img.parentElement.style.opacity = "1";
          img.parentElement.classList.remove('win');
        });
      });
    }, 2500);

    if (lastResultEl && win > 0) {
      lastResultEl.textContent = `Última Conquista: ${formatMoney(win)}`;
    }
    
    updateDisplay();
    return { win, matchedPositions };
  }

  function startWinLineAnimation() {
    const canvas = document.getElementById("hlCanvas");
    if (!canvas || activeWinLines.length === 0) return;
    const ctx = canvas.getContext("2d");
    const reelsEl = document.getElementById("reels");
    const rect = reelsEl.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    if (winLineAnimationId) cancelAnimationFrame(winLineAnimationId);
    let t = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      activeWinLines.forEach((line) => {
        if (!line.length) return;
        const points = line.map(p => {
            const r = reelImages[p.col][p.row].getBoundingClientRect();
            return { x: r.left - rect.left + r.width/2, y: r.top - rect.top + r.height/2 };
        });
        if (points.length < 2) return;

        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#c0392b"; 
        ctx.strokeStyle = "#fff"; 
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i=1;i<points.length;i++) {
            const midX = (points[i-1].x + points[i].x)/2 + (Math.random()*10 - 5);
            const midY = (points[i-1].y + points[i].y)/2 + (Math.random()*10 - 5);
            ctx.quadraticCurveTo(midX, midY, points[i].x, points[i].y);
        }
        ctx.stroke();
      });
      t++;
      if(t < 120) winLineAnimationId = requestAnimationFrame(draw); 
      else clearWinLines();
    }
    draw();
  }

  // ------------------- SPIN -------------------
  function spinReels(results) {
    spinning = true;
    const baseDuration = 2000;
    const now = performance.now();
    reelsEls.forEach((reelEl, colIdx) => {
      const imgs = reelImages[colIdx];
      const startTime = now + colIdx * 400; 
      let lastUpdate = startTime;
      function frame(t) {
        if (t < startTime) { requestAnimationFrame(frame); return; }
        const elapsed = t - startTime;
        if (t - lastUpdate >= 50 && elapsed < baseDuration) {
           const tempSet = [getRandomSymbolID(), getRandomSymbolID(), getRandomSymbolID()];
           imgs.forEach((img, i) => {
             img.src = SYMBOLS_MAP[tempSet[i]].img;
             img.onerror = function(){ this.src = PLACEHOLDERS[tempSet[i]]; };
           });
           lastUpdate = t;
           reelEl.style.transform = `translateY(${Math.random()*4}px)`;
        }
        if (elapsed < baseDuration) {
          requestAnimationFrame(frame);
        } else {
          reelEl.style.transform = 'translateY(0)';
          imgs.forEach((img, i) => {
            const finalID = results[colIdx][i];
            img.src = SYMBOLS_MAP[finalID].img;
            img.onerror = function(){ this.src = PLACEHOLDERS[finalID]; };
          });
          reelEl.animate([{ transform: 'translateY(-20px)' }, { transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
          if (colIdx === reelsEls.length - 1) {
            const resultObj = computeWin(results, true);
            spinning = false;
            updateDisplay();
          }
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // ------------------- CONTROLES -------------------
  decBetBtn.addEventListener('click', () => { bet = Math.max(0.1, bet - 0.1); updateDisplay(); });
  incBetBtn.addEventListener('click', () => { bet = Math.min(balance, bet + 0.1); updateDisplay(); });
  betDisplayEl.addEventListener('change', () => { let v = parseFloat(betDisplayEl.value); bet = (!Number.isFinite(v) || v < 0.1) ? 1 : Math.min(balance, v); updateDisplay(); });
  spinBtn.addEventListener('click', () => {
    if (!canSpin()) return;
    balance -= bet;
    totalBetAccum += bet;
    updateDisplay();
    const results = [];
    for (let col = 0; col < 3; col++) {
      results[col] = [];
      for (let row = 0; row < 3; row++) results[col][row] = getRandomSymbolID();
    }
    clearWinLines();
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
