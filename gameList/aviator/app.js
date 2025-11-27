
document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIG ---
    let balance = 50.00;
    let betAmount = 2.00;
    let currentMultiplier = 1.00;
    let crashPoint = 0;
    let gameStatus = 'IDLE'; // IDLE, RUNNING, CRASHED
    let userStatus = 'NONE'; // NONE, BET_PLACED, CASHED_OUT
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const planeImg = document.getElementById('planeImg');
    
    // UI Elements
    const elMultiplier = document.getElementById('multiplierDisplay');
    const elCrashMsg = document.getElementById('crashMsg');
    const elBalance = document.getElementById('balanceDisplay');
    const btnMain = document.getElementById('mainBtn');
    const lblMain = btnMain.querySelector('.btn-label');
    const lblSub = document.getElementById('btnSubLabel');
    const historyList = document.getElementById('historyList');
    const inpBet = document.getElementById('betInput');

    // --- CANVAS SETUP ---
    let width, height;
    function resize() {
        width = canvas.parentElement.clientWidth;
        height = canvas.parentElement.clientHeight;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resize);
    resize();

    // --- GAME LOOP VARS ---
    let startTime;
    let animationId;
    let graphPoints = [];

    // --- CORE LOGIC ---
    
    function generateCrashPoint() {
        // E = 100 / (100 - RTP) ... Simulação simplificada
        // O algoritmo clássico é 0.99 / (1 - random)
        // Crash instantâneo em 1.00 existe em ~1-3% das vezes
        
        const r = Math.random();
        let crash = 0.96 / (1 - r);
        crash = Math.floor(crash * 100) / 100;
        
        // Cap máximo e mínimo
        if (crash < 1.00) crash = 1.00;
        if (crash > 1000) crash = 1000;
        
        return crash;
    }

    function placeBet() {
        if (betAmount > balance) {
            alert("Saldo insuficiente!");
            return;
        }
        balance -= betAmount;
        updateBalance();
        userStatus = 'BET_PLACED';
        updateControls();
    }

    function startGame() {
        gameStatus = 'RUNNING';
        userStatus = (userStatus === 'BET_PLACED') ? 'BET_PLACED' : 'NONE';
        
        crashPoint = generateCrashPoint();
        console.log("Next Crash:", crashPoint); // Cheat for debug
        
        startTime = Date.now();
        graphPoints = [{x: 0, y: height}]; // Start at bottom-left visual
        currentMultiplier = 1.00;
        
        elMultiplier.style.color = "#fff";
        elCrashMsg.style.display = 'none';
        
        updateControls();
        animate();
    }

    function cashOut() {
        if (userStatus !== 'BET_PLACED') return;
        
        const win = betAmount * currentMultiplier;
        balance += win;
        updateBalance();
        
        userStatus = 'CASHED_OUT';
        
        // Feedback visual
        lblMain.textContent = "GANHOU";
        lblSub.textContent = `R$ ${win.toFixed(2)}`;
        btnMain.classList.remove('cashout');
        btnMain.classList.add('bet'); // Volta pra verde mas desativado visualmente pela lógica
        btnMain.disabled = true;
    }

    function crash() {
        gameStatus = 'CRASHED';
        cancelAnimationFrame(animationId);
        
        elMultiplier.style.color = "#e94358";
        elCrashMsg.style.display = 'block';
        
        addHistory(crashPoint);
        
        if (userStatus === 'BET_PLACED') {
            // Perdeu
            userStatus = 'NONE';
        }

        // Auto Restart
        setTimeout(() => {
            resetGame();
        }, 3000);
        
        updateControls();
    }

    function resetGame() {
        gameStatus = 'IDLE';
        // Limpa canvas
        ctx.clearRect(0, 0, width, height);
        elCrashMsg.style.display = 'none';
        elMultiplier.textContent = "1.00x";
        elMultiplier.style.color = "#fff";
        
        // Se usuário já apostou pra próxima? (Simplificação: reseta status)
        if (userStatus === 'CASHED_OUT') userStatus = 'NONE';
        
        // Verifica se clicou em apostar durante o crash (Bet Next Round)
        // Aqui simplificado: User tem que clicar de novo
        
        updateControls();
    }

    function updateControls() {
        btnMain.disabled = false;
        btnMain.className = 'action-btn'; // reset

        if (gameStatus === 'IDLE') {
            if (userStatus === 'BET_PLACED') {
                btnMain.classList.add('cancel');
                lblMain.textContent = "CANCELAR";
                lblSub.textContent = "Aguardando...";
            } else {
                btnMain.classList.add('bet');
                lblMain.textContent = "APOSTAR";
                lblSub.textContent = "PRÓXIMA RODADA";
            }
        } 
        else if (gameStatus === 'RUNNING') {
            if (userStatus === 'BET_PLACED') {
                btnMain.classList.add('cashout');
                lblMain.textContent = "SAQUE";
                lblSub.textContent = (betAmount * currentMultiplier).toFixed(2) + " R$";
            } else if (userStatus === 'CASHED_OUT') {
                btnMain.classList.add('bet');
                btnMain.disabled = true;
                lblMain.textContent = "GANHOU";
                // Sub já definido no click
            } else {
                btnMain.classList.add('bet');
                lblMain.textContent = "ESPERE";
                lblSub.textContent = "JOGO EM ANDAMENTO";
                btnMain.disabled = true;
            }
        } 
        else if (gameStatus === 'CRASHED') {
            btnMain.classList.add('bet');
            lblMain.textContent = "AGUARDE";
            lblSub.textContent = "INICIANDO...";
            btnMain.disabled = true;
        }
    }

    // --- ANIMATION LOOP ---
    function animate() {
        const now = Date.now();
        const diff = now - startTime;
        
        // Crescimento Exponencial
        // M = e ^ (k * t)
        // Ajuste k para velocidade (0.00006 é lento, 0.0001 é médio)
        currentMultiplier = 1.00 + (0.00006 * Math.pow(diff, 1.6));
        
        if (currentMultiplier >= crashPoint) {
            currentMultiplier = crashPoint;
            elMultiplier.textContent = currentMultiplier.toFixed(2) + "x";
            crash();
            return;
        }
        
        elMultiplier.textContent = currentMultiplier.toFixed(2) + "x";
        if(userStatus === 'BET_PLACED') {
            lblSub.textContent = (betAmount * currentMultiplier).toFixed(2) + " R$";
        }

        // Draw Logic
        ctx.clearRect(0, 0, width, height);
        
        // Grid Lines (Static bg)
        // ... (simplified)

        // Curve
        // X axis = Time, Y axis = Value
        // Precisamos normalizar para caber na tela
        // Conforme o tempo passa, a escala muda para manter o avião visível
        
        const scaleX = width / (diff + 2000); 
        const scaleY = height / (currentMultiplier + 0.5); 

        // Desenhar Curva
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#e94358';
        ctx.lineCap = 'round';
        
        // Desenha apenas o segmento visível ou recalcula tudo?
        // Simples: desenha curva de Bezier ou Quad baseada em pontos
        
        const x = width - 50; // Avião fixo na direita? Ou movendo?
        // Estilo Aviator: Avião vai pra cima e direita.
        // X = time % width (mas escala), Y = multiplier relative height
        
        // Simulação Visual Simples
        // Ponto inicial (0, H)
        // Ponto final (X_current, Y_current)
        
        let progress = Math.min(1, diff / 5000); // Primeiros 5s, animação inicial
        let drawX = progress * (width - 60);
        let drawY = height - (progress * (height - 60));
        
        // Depois de 5s, mantém posição e anima o fundo (não implementado full aqui)
        // Vamos fazer o avião subir em curva simples
        
        const curveX = (diff / 100) * 2; 
        const curveY = height - ((currentMultiplier - 1) * 100);
        
        // Clamping visual para não sair da tela
        let visualX = Math.min(width - 80, curveX);
        let visualY = Math.max(80, curveY);
        
        // Desenha linha
        ctx.moveTo(0, height);
        ctx.quadraticCurveTo(visualX / 2, height, visualX, visualY);
        ctx.stroke();
        
        // Fill area below
        ctx.fillStyle = "rgba(233, 67, 88, 0.1)";
        ctx.lineTo(visualX, height);
        ctx.lineTo(0, height);
        ctx.fill();

        // Draw Plane
        const planeSize = 60;
        ctx.drawImage(planeImg, visualX - 10, visualY - 30, planeSize, planeSize);

        animationId = requestAnimationFrame(animate);
    }

    // --- HELPERS ---
    function updateBalance() {
        elBalance.textContent = balance.toFixed(2);
    }

    function addHistory(val) {
        const div = document.createElement('div');
        div.textContent = val.toFixed(2) + "x";
        div.className = 'hist-item ' + (val >= 10 ? 'high' : val >= 2 ? 'mid' : 'low');
        historyList.prepend(div);
        if (historyList.children.length > 20) historyList.lastChild.remove();
    }

    // --- INPUT HANDLERS ---
    btnMain.addEventListener('click', () => {
        if (gameStatus === 'IDLE') {
            if (userStatus === 'NONE') {
                placeBet();
            } else if (userStatus === 'BET_PLACED') {
                // Cancelar aposta
                balance += betAmount;
                updateBalance();
                userStatus = 'NONE';
                updateControls();
            }
        } else if (gameStatus === 'RUNNING') {
            if (userStatus === 'BET_PLACED') {
                cashOut();
            }
        }
    });

    document.getElementById('btnDec').addEventListener('click', () => {
        if (betAmount > 1) { betAmount--; inpBet.value = betAmount.toFixed(2); }
    });
    document.getElementById('btnInc').addEventListener('click', () => {
        if (betAmount < balance) { betAmount++; inpBet.value = betAmount.toFixed(2); }
    });
    
    document.querySelectorAll('.q-btn').forEach(b => {
        b.addEventListener('click', () => {
            let v = parseInt(b.dataset.val);
            if(v <= balance) {
                betAmount = v;
                inpBet.value = betAmount.toFixed(2);
            }
        });
    });

    inpBet.addEventListener('change', (e) => {
        let v = parseFloat(e.target.value);
        if (v < 1) v = 1;
        if (v > balance) v = balance;
        betAmount = v;
        e.target.value = v.toFixed(2);
    });

    // START LOOP (Simula servidor iniciando rodadas)
    resetGame();
    // Auto start first round after 2s
    setTimeout(startGame, 2000);

});
