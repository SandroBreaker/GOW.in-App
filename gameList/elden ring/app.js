
document.addEventListener('DOMContentLoaded', () => {

  // ------------------- CONFIG ELDEN RING (5x4 ZIG-ZAG) -------------------
  const SYMBOLS = [
    { id: 'rune', img: 'assets/symbols/rune.png', weight: 75, mult3: 0.0301, mult4: 0.0602, mult5: 1.5 },
    { id: 'grace', img: 'assets/symbols/grace.png', weight: 40, mult3: 0.1505, mult4: 0.4514, mult5: 4 },
    { id: 'erdtree', img: 'assets/symbols/erdtree.png', weight: 20, mult3: 0.4514, mult4: 1.2038, mult5: 8 },
    { id: 'pot', img: 'assets/symbols/pot.png', weight: 5, mult3: 6.0192, mult4: 15.0479, mult5: 40 },
    { id: 'ring', img: 'assets/symbols/ring.png', weight: 4, mult3: 15, mult4: 80, mult5: 400 }
  ];

  const SYMBOLS_MAP = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const WEIGHT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, s.weight]));
  const PAYOUT_BY_ID = Object.fromEntries(SYMBOLS.map(s => [s.id, { mult3: s.mult3, mult4: s.mult4, mult5: s.mult5 }]));
  const ID_LIST = SYMBOLS.map(s => s.id);

  const PLACEHOLDERS = {
    rune: 'https://cdn-icons-png.flaticon.com/128/3600/3600967.png',
    grace: 'https://cdn-icons-png.flaticon.com/128/1828/1828961.png',
    erdtree: 'https://cdn-icons-png.flaticon.com/128/490/490091.png',
    pot: 'https://cdn-icons-png.flaticon.com/128/9474/9474720.png',
    ring: 'https://cdn-icons-png.flaticon.com/128/2237/2237680.png'
  };

  // ------------------- ÁUDIO TEMÁTICO -------------------
  // Certifique-se de ter esses arquivos na pasta 'assets' do jogo ou ajuste os caminhos
  const sfx = {
    spinStart: new Audio('assets/elden_start.mp3'), // Som de espada/magia ao clicar
    reelsLoop: new Audio('assets/elden_roll.mp3'),  // Som de pedra/mecânica girando
    win: new Audio('assets/elden_win.mp3')          // Som de coleta de runas
  };

  // Configurações de áudio
  sfx.reelsLoop.loop = true;
  sfx.reelsLoop.volume = 0.6;
  sfx.win.volume = 0.8;
  sfx.spinStart.volume = 0.7;

  // ------------------- STATE -------------------
  let balance = 50.0;
  let bet = 2.0;
  let totalWinAccum = 0;
  let totalBetAccum = 0;
  let audioCtxStarted = false;
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

  function startAudioContext(){
    if(!audioCtxStarted){
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        new AudioContext();
        audioCtxStarted = true;
      } catch(e) { console.warn(e); }
    }
  }

  function playSound(name) {
      if(sfx[name]) {
          sfx[name].currentTime = 0;
          sfx[name].play().catch(e => console.log("Audio play blocked", e));
      }
  }

  function stopSound(name) {
      if(sfx[name]) {
          sfx[name].pause();
          sfx[name].currentTime = 0;
      }
  }

  // ------------------- DISPLAY -------------------
  function renderPayoutCards(){
    payoutsEl.innerHTML = '';
    SYMBOLS.forEach(s => {
      const p = PAYOUT_BY_ID[s.id];
      const card = document.createElement('div');
      card.className = 'payout-card';
      card.innerHTML = `
        <img src="${s.img}" onerror="this.src='${PLACEHOLDERS[s.id]}'">
        <div class="mult">5x: ${p.mult5}</div>
        <div class="value">Max: ${formatMoney(bet * p.mult5)}</div>
      `;
      payoutsEl.appendChild(card);
    });
  }

  function updateBalanceScale(){
    const lucroLiquido = totalWinAccum - totalBetAccum;
    const pct = totalBetAccum ? (lucroLiquido / totalBetAccum) * 100 : 0;
    
    balanceScaleText.textContent = pct >= 0 
      ? `Progresso: ${Math.round(pct)}%` 
      : `Dano Recebido: ${Math.round(pct)}%`;

    let greenWidth = 50;
    let redWidth = 50;
    if (pct >= 0) greenWidth = 50 + (pct / 2);
    else redWidth = 50 + (Math.abs(pct) / 2);

    const maxWidth = window.innerWidth < 480 ? 120 : 180;
    balanceScaleGreen.style.width = `${Math.min(greenWidth, maxWidth)}%`;
    balanceScaleRed.style.width = `${Math.min(redWidth, maxWidth)}%`;
  }

  function canSpin(){
    return !spinning && Number.isFinite(bet) && bet > 0 && bet <= balance;
  }

  function updateDisplay(){
    if(!Number.isFinite(balance)) balance = 0;
    if(!Number.isFinite(bet)) bet = 1;

    balanceEl.textContent = formatMoney(balance);
    betValueEl.textContent = formatMoney(bet);
    betDisplayEl.value = Number.isInteger(bet) ? bet.toFixed(0) : bet.toFixed(2);

    renderPayoutCards();
    totalWinEl.textContent = `Runas Coletadas: ${formatMoney(totalWinAccum)}`;
    totalBetEl.textContent = `Runas Gastas: ${formatMoney(totalBetAccum)}`;
    updateBalanceScale();
    updatePersonaAdvice();

    spinBtn.disabled = !canSpin();
    decBetBtn.disabled = bet <= 0.1 || spinning;
    incBetBtn.disabled = bet >= balance || spinning;
  }

  // ------------------- PERSONA -------------------
  function personaAdviceString(){
    let recommended = Math.min(balance * 0.1, 5);
    recommended = Math.max(recommended, 0.5);
    recommended = parseFloat(recommended.toFixed(2));
    const phrases = [
      `Melina: "Que a graça guie você... R$${recommended}."`,
      `Ranni: "Um destino sob as estrelas... R$${recommended}."`,
      `Godrick: "Eu me lembro... R$${recommended}!"`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  function calculateTreasureChance(forBet){
    let chance = 0;
    ID_LIST.forEach(id => {
      const weight = WEIGHT_BY_ID[id] || 0;
      const prob = weight / weightedSymbols.length;
      const prob3 = (prob ** 3) * 2.5; 
      if(forBet * PAYOUT_BY_ID[id].mult3 > 0) chance += prob3;
    });
    return Math.min(Math.max(chance * 100,0),100).toFixed(1);
  }

  function updateRTPDisplay(){
    if(!rtpEl) return;
    const personaBetMatch = personaAdviceString().match(/R\$(\d+(\.\d+)?)/);
    const val = personaBetMatch ? parseFloat(personaBetMatch[1]) : 0.5;
    rtpEl.textContent = `Visão da Graça: ${calculateTreasureChance(val)}%`;
  }

  function updatePersonaAdvice(){
    if(!personaAdviceEl){
      const meta = document.querySelector('.meta-card');
      if(meta){
        personaAdviceEl = document.createElement('div');
        personaAdviceEl.id = 'personaAdvice';
        personaAdviceEl.style.color = '#d4af37'; 
        personaAdviceEl.style.fontWeight = 'bold';
        personaAdviceEl.style.fontSize = '0.85rem';
        personaAdviceEl.style.marginTop = '6px';
        meta.insertBefore(personaAdviceEl, meta.firstChild);
      }
    }
    if(personaAdviceEl) {
      personaAdviceEl.textContent = personaAdviceString();
      updateRTPDisplay();
    }
  }

  // ------------------- POPUP VITÓRIA -------------------
  function showCentralWin(amount){
    const phrases = [
      `GREAT RUNE!<br><br>💰 ${formatMoney(amount)}`,
      `ELDEN LORD!<br><br>💰 ${formatMoney(amount)}`,
      `MAIDENLESS NO MORE!<br><br>💰 ${formatMoney(amount)}`
    ];

    const popup = document.createElement('div');
    popup.className = 'win-popup';
    popup.innerHTML = phrases[Math.floor(Math.random()*phrases.length)];
    document.body.appendChild(popup);
    popup.classList.add('show');

    requestAnimationFrame(()=> {
      popup.style.opacity = '1';
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(()=>{
      popup.style.opacity = '0';
      popup.style.transform = 'translate(-50%,-50%) scale(1.5)';
      setTimeout(()=> popup.remove(), 400);
    }, 2500);
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

  // ------------------- LOGIC CORE (5x4 ZIG-ZAG STRICT) -------------------
  function computeWin(results, highlight = true) {
    let win = 0;
    const matchedPositions = [];
    const rows = results[0].length; // 4
    const cols = results.length;    // 5
    const uniquePathKeys = new Set();
    const usedPositions = new Set(); // Evita sobreposição

    function isPositionFree(col, row) {
        return !usedPositions.has(`${col},${row}`);
    }

    function markPositionsAsUsed(positions) {
        positions.forEach(pos => {
            usedPositions.add(`${pos.col},${pos.row}`);
        });
    }

    // 1. Prioridade: Linhas Retas (Horizontais)
    for (let row = 0; row < rows; row++) {
        const startCol = 0;
        const symbolID = results[startCol][row];
        if (!PAYOUT_BY_ID[symbolID]) continue;
        
        if (!isPositionFree(startCol, row)) continue;
        
        let count = 1;
        const path = [{ col: startCol, row: row }];
        
        for (let col = startCol + 1; col < cols; col++) {
            if (results[col][row] === symbolID && isPositionFree(col, row)) {
                count++;
                path.push({ col: col, row: row });
            } else {
                break;
            }
        }
        
        if (count >= 3) {
            const pathKey = path.map(p => `${p.col},${p.row}`).join('|');
            if (!uniquePathKeys.has(pathKey)) {
                uniquePathKeys.add(pathKey);
                
                const payout = PAYOUT_BY_ID[symbolID];
                let mult = 0;
                if (count === 3) mult = payout.mult3;
                else if (count === 4) mult = payout.mult4;
                else if (count >= 5) mult = payout.mult5;
                
                win += bet * mult;
                matchedPositions.push([...path]);
                markPositionsAsUsed(path);
            }
        }
    }

    // 2. Zig-Zag
    function findZigZagPaths(col, row, currentSymbolID, currentPath) {
        if (currentPath.length >= 3) {
             const pathKey = currentPath.map(p => `${p.col},${p.row}`).join('|');
             const allFree = currentPath.every(p => isPositionFree(p.col, p.row) || usedPositions.has(`${p.col},${p.row}`) === false);
        }

        let extended = false;
        if (col + 1 < cols) {
            const nextCol = col + 1;
            const candidates = [row - 1, row, row + 1].filter(r => 
                r >= 0 && r < rows && isPositionFree(nextCol, r)
            );
            
            for (let nextRow of candidates) {
                if (results[nextCol][nextRow] === currentSymbolID) {
                    currentPath.push({ col: nextCol, row: nextRow });
                    findZigZagPaths(nextCol, nextRow, currentSymbolID, currentPath);
                    currentPath.pop();
                    extended = true;
                    if(extended) break; 
                }
            }
        }

        if (!extended && currentPath.length >= 3) {
            const pathKey = currentPath.map(p => `${p.col},${p.row}`).join('|');
            const noOverlap = currentPath.every(p => isPositionFree(p.col, p.row));
            
            if (noOverlap && !uniquePathKeys.has(pathKey)) {
                uniquePathKeys.add(pathKey);
                
                const count = currentPath.length;
                const payout = PAYOUT_BY_ID[currentSymbolID];
                let mult = 0;
                if (count === 3) mult = payout.mult3;
                else if (count === 4) mult = payout.mult4;
                else if (count >= 5) mult = payout.mult5;
                
                win += bet * mult;
                matchedPositions.push([...currentPath]);
                markPositionsAsUsed(currentPath);
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
      if(navigator.vibrate) navigator.vibrate([50,100]);
      playSound('win'); // Efeito sonoro de vitória
    }

    if (highlight && win > 0) showCentralWin(win);

    // Diminui opacidade de quem não ganhou
    reelImages.forEach(imgs => imgs.forEach(img => (img.parentElement.style.opacity = "0.3")));

    if (matchedPositions.length) {
      activeWinLines.push(...matchedPositions);
      startWinLineAnimation();
    }

    if(matchedPositions.length > 0){
        matchedPositions.forEach(line => {
            line.forEach(pos => {
                const img = reelImages[pos.col][pos.row];
                img.parentElement.style.opacity = "1";
                img.parentElement.classList.add('win');
            });
        });
    }

    setTimeout(() => {
      reelImages.forEach(imgs => {
        imgs.forEach(img => {
            img.parentElement.style.opacity = "1";
            img.parentElement.classList.remove('win');
        });
      });
    }, 2500);

    if (lastResultEl && win > 0) {
      lastResultEl.textContent = `Runas Encontradas: ${formatMoney(win)}`;
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
          const img = reelImages[p.col][p.row];
          if (!img) return null;
          const r = img.getBoundingClientRect();
          return { x: r.left - rect.left + r.width/2, y: r.top - rect.top + r.height/2 };
        }).filter(Boolean);

        if (points.length < 2) return;

        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#d4af37"; 
        ctx.strokeStyle = "#fff"; 
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i=1;i<points.length;i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      t++;
      if(t < 120) winLineAnimationId = requestAnimationFrame(draw); 
      else clearWinLines();
    }
    draw();
  }

  // ------------------- SPIN ENGINE -------------------
  function spinReels(results) {
    spinning = true;
    
    // Inicia som de loop dos rolos
    playSound('reelsLoop');

    const baseDuration = 2000;
    const now = performance.now();

    reelsEls.forEach((reelEl, colIdx) => {
      const imgs = reelImages[colIdx];
      const startTime = now + colIdx * 300; 
      let lastUpdate = startTime;

      function frame(t) {
        if (t < startTime) {
          requestAnimationFrame(frame);
          return;
        }
        const elapsed = t - startTime;
        
        if (t - lastUpdate >= 40 && elapsed < baseDuration) {
           const tempSet = [];
           // Gera 4 símbolos para o visual (5x4)
           for(let k=0; k<4; k++) tempSet.push(getRandomSymbolID());
           
           imgs.forEach((img, i) => {
             img.src = SYMBOLS_MAP[tempSet[i]].img;
             img.onerror = function(){ this.src = PLACEHOLDERS[tempSet[i]]; };
           });
           lastUpdate = t;
           reelEl.style.transform = `translateY(${Math.random()*2}px)`;
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
          
          reelEl.animate([
            { transform: 'translateY(-10px)' },
            { transform: 'translateY(0)' }
          ], { duration: 150, easing: 'ease-out' });

          if (colIdx === reelsEls.length - 1) {
            // Parar som de loop ao finalizar todos os rolos
            stopSound('reelsLoop');

            const resultObj = computeWin(results, true);
            spinning = false;
            updateDisplay();
          }
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // ------------------- HANDLERS -------------------
  decBetBtn.addEventListener('click', () => {
    bet = parseFloat(Math.max(0.1, (bet - 0.5)).toFixed(2));
    if(bet > balance) bet = balance;
    updateDisplay();
  });
  incBetBtn.addEventListener('click', () => {
    bet = parseFloat(Math.min(balance, (bet + 0.5)).toFixed(2));
    updateDisplay();
  });
  
  betDisplayEl.addEventListener('change', () => {
    let v = parseFloat(betDisplayEl.value);
    if (!Number.isFinite(v) || v < 0.1) v = 1;
    if (v > balance) v = balance;
    bet = v;
    updateDisplay();
  });
  
  spinBtn.addEventListener('click', () => {
    if (!canSpin()) return;
    startAudioContext();
    
    playSound('spinStart'); // Som épico de início

    balance -= bet;
    totalBetAccum += bet;
    updateDisplay();

    // Gera matriz 5x4 com IDs
    const results = [];
    for (let col = 0; col < 5; col++) {
      results[col] = [];
      for (let row = 0; row < 4; row++) {
        results[col][row] = getRandomSymbolID();
      }
    }
    clearWinLines();
    spinReels(results);
  });

  renderPayoutCards();
  updateDisplay();
});
