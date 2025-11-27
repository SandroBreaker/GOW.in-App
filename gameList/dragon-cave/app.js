
document.addEventListener('DOMContentLoaded', () => {
    
    const LEVEL_MULTIPLIERS = [1.28, 1.64, 2.10, 2.69, 3.44, 4.41, 5.64, 7.22, 9.24, 11.83];
    let balance = 0.00;
    let currentBet = 2.00;
    let currentLevel = 0;
    let isPlaying = false;

    const balanceEl = document.getElementById('balanceDisplay');
    const betInput = document.getElementById('betInput');
    const btnDec = document.getElementById('btnDec');
    const btnInc = document.getElementById('btnInc');
    const btnPlay = document.getElementById('btnPlay');
    const btnCashout = document.getElementById('btnCashout');
    const cashoutValueEl = document.getElementById('cashoutValue');
    const caveGrid = document.getElementById('caveGrid');
    const multSidebar = document.getElementById('multSidebar');
    const statusMsg = document.getElementById('statusMsg');
    const bettingControls = document.getElementById('bettingControls');

    // --- BRIDGE LISTENER ---
    window.addEventListener('message', (event) => {
        if(event.data.type === 'INIT_GAME') {
            balance = parseFloat(event.data.balance);
            updateBalanceDisplay();
        }
    });

    function broadcastUpdate(delta, action) {
        window.parent.postMessage({
            type: 'GAME_UPDATE',
            payload: { newBalance: balance, delta: delta, action: action }
        }, '*');
    }

    function initUI() {
        updateBalanceDisplay();
        renderGridStructure();
    }

    function updateBalanceDisplay() {
        balanceEl.textContent = `R$ ${balance.toFixed(2)}`;
    }

    function renderGridStructure() {
        caveGrid.innerHTML = '';
        multSidebar.innerHTML = '';
        for (let i = 0; i < LEVEL_MULTIPLIERS.length; i++) {
            const multTag = document.createElement('div');
            multTag.className = 'mult-tag';
            multTag.id = `mult-${i}`;
            multTag.textContent = `${LEVEL_MULTIPLIERS[i].toFixed(2)}x`;
            multSidebar.appendChild(multTag);

            const row = document.createElement('div');
            row.className = 'cave-row';
            row.id = `row-${i}`;
            
            for (let j = 0; j < 3; j++) {
                const eggBox = document.createElement('div');
                eggBox.className = 'egg-box';
                const eggContent = document.createElement('div');
                eggContent.className = 'egg-content egg-default';
                eggBox.appendChild(eggContent);
                eggBox.addEventListener('click', () => handleEggClick(i, j, eggBox, eggContent));
                row.appendChild(eggBox);
            }
            caveGrid.appendChild(row);
        }
    }

    function startGame() {
        if (currentBet > balance) {
            statusMsg.textContent = "Saldo insuficiente!";
            statusMsg.style.color = "red";
            return;
        }

        isPlaying = true;
        currentLevel = 0;
        balance -= currentBet;
        updateBalanceDisplay();
        broadcastUpdate(-currentBet, 'bet'); 

        renderGridStructure();
        document.getElementById(`row-${currentLevel}`).classList.add('active');
        document.getElementById(`mult-${currentLevel}`).classList.add('active');

        bettingControls.style.display = 'none';
        btnCashout.style.display = 'flex';
        updateCashoutButton();
        statusMsg.textContent = "Escolha um ovo...";
        statusMsg.style.color = "var(--text)";
    }

    function handleEggClick(rowIdx, colIdx, boxEl, contentEl) {
        if (!isPlaying || rowIdx !== currentLevel) return;

        const dragonPos = Math.floor(Math.random() * 3);
        const isDragon = (colIdx === dragonPos);

        boxEl.classList.add('revealed');
        contentEl.classList.remove('egg-default');

        if (isDragon) {
            contentEl.classList.add('egg-dragon');
            boxEl.classList.add('bad');
            gameOver(false);
        } else {
            contentEl.classList.add('egg-diamond');
            boxEl.classList.add('good');
            levelUp();
        }
    }

    function levelUp() {
        document.getElementById(`row-${currentLevel}`).classList.remove('active');
        document.getElementById(`row-${currentLevel}`).classList.add('passed');
        document.getElementById(`mult-${currentLevel}`).classList.remove('active');

        currentLevel++;
        if (currentLevel >= LEVEL_MULTIPLIERS.length) { gameOver(true); return; }

        document.getElementById(`row-${currentLevel}`).classList.add('active');
        document.getElementById(`mult-${currentLevel}`).classList.add('active');
        
        const gridWrapper = document.querySelector('.cave-grid-wrapper');
        gridWrapper.scrollTop = gridWrapper.scrollHeight;

        updateCashoutButton();
        statusMsg.textContent = "Excelente! Continue ou retire.";
        statusMsg.style.color = "var(--safe-green)";
    }

    function gameOver(win) {
        isPlaying = false;
        if (win) cashOut();
        else {
            statusMsg.textContent = "O DRAGÃO ACORDOU! VOCÊ PERDEU TUDO.";
            statusMsg.style.color = "var(--dragon-red)";
            document.body.classList.add('shake-screen');
            setTimeout(() => document.body.classList.remove('shake-screen'), 500);
            
            const currentRow = document.getElementById(`row-${currentLevel}`);
            currentRow.querySelectorAll('.egg-box').forEach(box => {
                if (!box.classList.contains('revealed')) {
                    box.classList.add('revealed');
                    box.style.opacity = '0.5';
                    box.querySelector('.egg-content').classList.add('egg-diamond');
                }
            });
            resetControlsDelay();
        }
    }

    function cashOut() {
        let winIndex = currentLevel - 1;
        if (winIndex < 0) return;

        const winAmount = currentBet * LEVEL_MULTIPLIERS[winIndex];
        balance += winAmount;
        updateBalanceDisplay();
        broadcastUpdate(winAmount, 'win');

        statusMsg.innerHTML = `VOCÊ ESCAPOU!<br>Ganho: R$ ${winAmount.toFixed(2)}`;
        statusMsg.style.color = "var(--gold)";
        resetControlsDelay();
    }

    function updateCashoutButton() {
        if (currentLevel > 0) {
            const currentWin = currentBet * LEVEL_MULTIPLIERS[currentLevel - 1];
            cashoutValueEl.textContent = `R$ ${currentWin.toFixed(2)}`;
            btnCashout.disabled = false;
        } else {
            btnCashout.disabled = true;
        }
    }

    function resetControlsDelay() {
        btnCashout.style.display = 'none';
        setTimeout(() => { bettingControls.style.display = 'flex'; }, 1500);
    }

    btnPlay.addEventListener('click', startGame);
    btnCashout.addEventListener('click', () => { if(isPlaying) { isPlaying = false; cashOut(); } });
    btnDec.addEventListener('click', () => { if (!isPlaying && currentBet > 1) { currentBet--; betInput.value = currentBet.toFixed(2); } });
    btnInc.addEventListener('click', () => { if (!isPlaying && currentBet < balance) { currentBet++; betInput.value = currentBet.toFixed(2); } });

    initUI();
});
