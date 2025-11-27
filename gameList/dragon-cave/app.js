
document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURAÇÃO ---
    // Níveis de dificuldade (Multiplicadores progressivos)
    // 3 opções: 2 Boas (Diamante), 1 Ruim (Dragão)
    // Chance de vitória: 66% por nível.
    const LEVEL_MULTIPLIERS = [
        1.28, 1.64, 2.10, 2.69, 3.44, 
        4.41, 5.64, 7.22, 9.24, 11.83
    ];

    let balance = 50.00;
    let currentBet = 2.00;
    let currentLevel = 0; // 0 é o primeiro nível (base)
    let isPlaying = false;
    let gameResult = null; // 'win', 'loss'

    // --- DOM ELEMENTS ---
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

    // --- INICIALIZAÇÃO VISUAL ---
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

        // Cria as linhas (Levels)
        // Usamos reverse para renderizar do último para o primeiro (mas CSS column-reverse inverte visualmente)
        // No loop JS, i=0 é o nível mais baixo (multiplicador menor)
        
        for (let i = 0; i < LEVEL_MULTIPLIERS.length; i++) {
            // SIDEBAR
            const multTag = document.createElement('div');
            multTag.className = 'mult-tag';
            multTag.id = `mult-${i}`;
            multTag.textContent = `${LEVEL_MULTIPLIERS[i].toFixed(2)}x`;
            multSidebar.appendChild(multTag);

            // GRID ROW
            const row = document.createElement('div');
            row.className = 'cave-row';
            row.id = `row-${i}`;
            
            // 3 OVOS POR LINHA
            for (let j = 0; j < 3; j++) {
                const eggBox = document.createElement('div');
                eggBox.className = 'egg-box';
                eggBox.dataset.row = i;
                eggBox.dataset.col = j;
                
                const eggContent = document.createElement('div');
                eggContent.className = 'egg-content egg-default';
                
                eggBox.appendChild(eggContent);
                eggBox.addEventListener('click', () => handleEggClick(i, j, eggBox, eggContent));
                
                row.appendChild(eggBox);
            }
            caveGrid.appendChild(row);
        }
    }

    // --- LÓGICA DO JOGO ---

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

        // UI Reset
        renderGridStructure(); // Limpa grid anterior
        document.getElementById(`row-${currentLevel}`).classList.add('active');
        document.getElementById(`mult-${currentLevel}`).classList.add('active');

        // Toggle Buttons
        bettingControls.style.display = 'none';
        btnCashout.style.display = 'flex';
        updateCashoutButton();
        
        statusMsg.textContent = "Escolha um ovo...";
        statusMsg.style.color = "var(--text)";
    }

    function handleEggClick(rowIdx, colIdx, boxEl, contentEl) {
        if (!isPlaying) return;
        if (rowIdx !== currentLevel) return; // Só pode clicar no nível atual

        // Lógica de Resultado (Decidido no clique para simplicidade client-side)
        // 1 Dragão (Perde), 2 Diamantes (Ganha)
        // Posição do Dragão aleatória (0, 1 ou 2)
        const dragonPos = Math.floor(Math.random() * 3);
        const isDragon = (colIdx === dragonPos);

        boxEl.classList.add('revealed');
        contentEl.classList.remove('egg-default');

        if (isDragon) {
            // PERDEU
            contentEl.classList.add('egg-dragon');
            boxEl.classList.add('bad');
            gameOver(false);
        } else {
            // GANHOU / PASSOU
            contentEl.classList.add('egg-diamond');
            boxEl.classList.add('good');
            levelUp();
        }
    }

    function levelUp() {
        const potentialWin = currentBet * LEVEL_MULTIPLIERS[currentLevel];
        
        // Marca linha como passada
        document.getElementById(`row-${currentLevel}`).classList.remove('active');
        document.getElementById(`row-${currentLevel}`).classList.add('passed');
        document.getElementById(`mult-${currentLevel}`).classList.remove('active');

        currentLevel++;

        // Verifica se completou o jogo
        if (currentLevel >= LEVEL_MULTIPLIERS.length) {
            gameOver(true); // Venceu tudo
            return;
        }

        // Ativa próxima linha
        document.getElementById(`row-${currentLevel}`).classList.add('active');
        document.getElementById(`mult-${currentLevel}`).classList.add('active');
        
        // Scroll para ver a próxima linha se necessário
        const gridWrapper = document.querySelector('.cave-grid-wrapper');
        gridWrapper.scrollTop = gridWrapper.scrollHeight;

        updateCashoutButton();
        statusMsg.textContent = "Excelente! Continue ou retire.";
        statusMsg.style.color = "var(--safe-green)";
    }

    function gameOver(win) {
        isPlaying = false;
        
        if (win) {
            // Venceu tudo (chegou no topo) - Cashout automático
            cashOut();
        } else {
            // Perdeu (Dragão)
            statusMsg.textContent = "O DRAGÃO ACORDOU! VOCÊ PERDEU TUDO.";
            statusMsg.style.color = "var(--dragon-red)";
            document.body.classList.add('shake-screen');
            setTimeout(() => document.body.classList.remove('shake-screen'), 500);

            // Revela onde estavam os outros itens na linha atual
            const currentRow = document.getElementById(`row-${currentLevel}`);
            const boxes = currentRow.querySelectorAll('.egg-box');
            boxes.forEach(box => {
                if (!box.classList.contains('revealed')) {
                    box.classList.add('revealed');
                    box.style.opacity = '0.5';
                    const content = box.querySelector('.egg-content');
                    content.classList.remove('egg-default');
                    // Como já sabemos onde o dragão estava (o clique do user), os outros são diamantes
                    content.classList.add('egg-diamond');
                }
            });

            resetControlsDelay();
        }
    }

    function cashOut() {
        // Multiplicador do nível ANTERIOR (o que foi completado)
        // Se sacou antes de jogar o nível 0? Não acontece, botão só aparece se nível > 0?
        // Na nossa lógica, o cashout é sobre o nível que acabou de completar (currentLevel - 1)
        // Mas espere, ao passar de nível o currentLevel incrementou.
        // O prêmio atual garantido é baseado no (currentLevel - 1).
        
        // CORREÇÃO: Se eu acertei o nível 0, eu tenho o mult[0] garantido. Estou prestes a jogar o 1.
        
        let winIndex = currentLevel - 1;
        if (winIndex < 0) return; // Não deveria acontecer

        const winAmount = currentBet * LEVEL_MULTIPLIERS[winIndex];
        balance += winAmount;
        updateBalanceDisplay();

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
            // Ainda não completou nível 0
            btnCashout.disabled = true;
        }
    }

    function resetControlsDelay() {
        btnCashout.style.display = 'none';
        setTimeout(() => {
            bettingControls.style.display = 'flex';
        }, 1500);
    }

    // --- EVENTOS ---
    
    btnPlay.addEventListener('click', startGame);

    btnCashout.addEventListener('click', () => {
        if(isPlaying) {
            isPlaying = false;
            cashOut();
        }
    });

    // Ajuste de Aposta
    btnDec.addEventListener('click', () => {
        if (!isPlaying && currentBet > 1) {
            currentBet = Math.max(1, currentBet - 1);
            betInput.value = currentBet.toFixed(2);
        }
    });

    btnInc.addEventListener('click', () => {
        if (!isPlaying && currentBet < balance) {
            currentBet = Math.min(balance, currentBet + 1);
            betInput.value = currentBet.toFixed(2);
        }
    });

    initUI();
});
