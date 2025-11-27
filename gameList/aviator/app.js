
document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    let balance = 0.00;
    let betAmount = 2.00;
    let currentMultiplier = 1.00;
    let crashPoint = 0;
    let gameStatus = 'IDLE'; 
    let userStatus = 'NONE'; 
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const planeImg = document.getElementById('planeImg');
    const elMultiplier = document.getElementById('multiplierDisplay');
    const elCrashMsg = document.getElementById('crashMsg');
    const elBalance = document.getElementById('balanceDisplay');
    const btnMain = document.getElementById('mainBtn');
    const lblMain = btnMain.querySelector('.btn-label');
    const lblSub = document.getElementById('btnSubLabel');
    const historyList = document.getElementById('historyList');
    const inpBet = document.getElementById('betInput');

    // --- BRIDGE LISTENER ---
    window.addEventListener('message', (event) => {
        if(event.data.type === 'INIT_GAME') {
            balance = parseFloat(event.data.balance);
            updateBalance();
        }
    });

    function broadcastUpdate(delta, action) {
        window.parent.postMessage({
            type: 'GAME_UPDATE',
            payload: { newBalance: balance, delta: delta, action: action }
        }, '*');
    }

    let width, height;
    function resize() {
        width = canvas.parentElement.clientWidth;
        height = canvas.parentElement.clientHeight;
        canvas.width = width;
        canvas.height = height;
    }
    window.addEventListener('resize', resize);
    resize();

    let startTime, animationId;

    function generateCrashPoint() {
        const r = Math.random();
        // Curva ajustada para permitir voos mais longos ocasionalmente
        let crash = 0.99 / (1 - r);
        if (crash < 1.00) crash = 1.00;
        if (crash > 1000) crash = 1000;
        return crash;
    }

    function placeBet() {
        if (betAmount > balance) { alert("Saldo insuficiente!"); return; }
        balance -= betAmount;
        updateBalance();
        broadcastUpdate(-betAmount, 'bet'); 
        userStatus = 'BET_PLACED';
        updateControls();
    }

    function startGame() {
        gameStatus = 'RUNNING';
        userStatus = (userStatus === 'BET_PLACED') ? 'BET_PLACED' : 'NONE';
        crashPoint = generateCrashPoint();
        startTime = Date.now();
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
        broadcastUpdate(win, 'win'); 
        userStatus = 'CASHED_OUT';
        lblMain.textContent = "GANHOU";
        lblSub.textContent = `R$ ${win.toFixed(2)}`;
        btnMain.classList.remove('cashout');
        btnMain.classList.add('bet'); 
        btnMain.disabled = true;
    }

    function crash() {
        gameStatus = 'CRASHED';
        cancelAnimationFrame(animationId);
        elMultiplier.style.color = "#e94358";
        elCrashMsg.style.display = 'block';
        addHistory(crashPoint);
        if (userStatus === 'BET_PLACED') userStatus = 'NONE';
        setTimeout(resetGame, 3000);
        updateControls();
    }

    function resetGame() {
        gameStatus = 'IDLE';
        ctx.clearRect(0, 0, width, height);
        elCrashMsg.style.display = 'none';
        elMultiplier.textContent = "1.00x";
        elMultiplier.style.color = "#fff";
        if (userStatus === 'CASHED_OUT') userStatus = 'NONE';
        updateControls();
        setTimeout(startGame, 2000);
    }

    function updateControls() {
        btnMain.disabled = false;
        btnMain.className = 'action-btn'; 
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
        } else if (gameStatus === 'RUNNING') {
            if (userStatus === 'BET_PLACED') {
                btnMain.classList.add('cashout');
                lblMain.textContent = "SAQUE";
                lblSub.textContent = (betAmount * currentMultiplier).toFixed(2) + " R$";
            } else if (userStatus === 'CASHED_OUT') {
                btnMain.classList.add('bet');
                btnMain.disabled = true;
                lblMain.textContent = "GANHOU";
            } else {
                btnMain.classList.add('bet');
                lblMain.textContent = "ESPERE";
                btnMain.disabled = true;
            }
        } else {
            btnMain.classList.add('bet');
            lblMain.textContent = "AGUARDE";
            btnMain.disabled = true;
        }
    }

    function animate() {
        const now = Date.now();
        const diff = now - startTime;
        
        // UX FIX: Curva de crescimento suavizada (Logarítmica no início, exponencial depois)
        // Isso evita que o avião "decole" rápido demais nos primeiros 2 segundos
        const speedFactor = 0.00004; // Reduzido de 0.00006
        currentMultiplier = 1.00 + (speedFactor * Math.pow(diff, 1.5)); // Exponente reduzido de 1.6
        
        if (currentMultiplier >= crashPoint) {
            currentMultiplier = crashPoint;
            elMultiplier.textContent = currentMultiplier.toFixed(2) + "x";
            crash();
            return;
        }
        
        elMultiplier.textContent = currentMultiplier.toFixed(2) + "x";
        if(userStatus === 'BET_PLACED') lblSub.textContent = (betAmount * currentMultiplier).toFixed(2) + " R$";

        ctx.clearRect(0, 0, width, height);
        
        // UX FIX: Animação do avião mais suave no canvas
        let progress = Math.min(1, diff / 8000); // Demora mais para chegar no topo da tela (8s)
        
        // Curva visual suave
        let drawX = progress * (width - 80);
        let drawY = height - (Math.pow(progress, 0.5) * (height - 100));
        
        // Rastro Vermelho
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#e94358';
        ctx.moveTo(0, height);
        // Bezier para curva perfeita
        ctx.quadraticCurveTo(drawX * 0.4, height, drawX + 20, drawY + 40);
        ctx.stroke();
        
        // Fundo gradiente do rastro
        ctx.lineTo(drawX + 20, height);
        ctx.lineTo(0, height);
        ctx.fillStyle = "rgba(233, 67, 88, 0.1)";
        ctx.fill();

        // Desenha Avião
        ctx.drawImage(planeImg, drawX, drawY, 50, 50);
        
        animationId = requestAnimationFrame(animate);
    }

    function updateBalance() { elBalance.textContent = balance.toFixed(2); }
    function addHistory(val) {
        const div = document.createElement('div');
        div.textContent = val.toFixed(2) + "x";
        div.className = 'hist-item ' + (val >= 10 ? 'high' : val >= 2 ? 'mid' : 'low');
        historyList.prepend(div);
        if (historyList.children.length > 20) historyList.lastChild.remove();
    }

    btnMain.addEventListener('click', () => {
        if (gameStatus === 'IDLE') {
            if (userStatus === 'NONE') placeBet();
            else if (userStatus === 'BET_PLACED') {
                balance += betAmount;
                updateBalance();
                broadcastUpdate(betAmount, 'refund');
                userStatus = 'NONE';
                updateControls();
            }
        } else if (gameStatus === 'RUNNING' && userStatus === 'BET_PLACED') {
            cashOut();
        }
    });

    document.getElementById('btnDec').addEventListener('click', () => { if (betAmount > 1) { betAmount--; inpBet.value = betAmount.toFixed(2); } });
    document.getElementById('btnInc').addEventListener('click', () => { if (betAmount < balance) { betAmount++; inpBet.value = betAmount.toFixed(2); } });
    inpBet.addEventListener('change', (e) => { betAmount = parseFloat(e.target.value) || 1; });

    resetGame();
});
