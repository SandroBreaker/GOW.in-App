
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
        const r = Math.random();
        let crash = 0.96 / (1 - r);
        crash = Math.floor(crash * 100) / 100;
        
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
        console.log("Next Crash:", crashPoint); // Debug info
        
        startTime = Date.now();
        graphPoints = [{x: 0, y: height}]; 
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
        
        if (userStatus === 'BET_PLACED') {
            userStatus = 'NONE';
        }

        // Auto Restart Loop
        setTimeout(() => {
            resetGame();
        }, 3000);
        
        updateControls();
    }

    function resetGame() {
        gameStatus = 'IDLE';
        // Reset Visuals
        ctx.clearRect(0, 0, width, height);
        elCrashMsg.style.display = 'none';
        elMultiplier.textContent = "1.00x";
        elMultiplier.style.color = "#fff";
        
        if (userStatus === 'CASHED_OUT') userStatus = 'NONE';
        
        updateControls();
        
        // CRITICAL FIX: Schedule next round
        setTimeout(startGame, 2000);
    }

    function updateControls() {
        btnMain.disabled = false;
        btnMain.className = 'action-btn'; // reset base class

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
        
        // Curva de crescimento
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

        // Desenhar
        ctx.clearRect(0, 0, width, height);
        
        // Curva Visual
        let progress = Math.min(1, diff / 5000); 
        let drawX = progress * (width - 60);
        let drawY = height - (progress * (height - 60));
        
        const curveX = (diff / 100) * 2; 
        const curveY = height - ((currentMultiplier - 1) * 100);
        
        let visualX = Math.min(width - 80, curveX);
        let visualY = Math.max(80, curveY);
        
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#e94358';
        ctx.lineCap = 'round';
        
        ctx.moveTo(0, height);
        ctx.quadraticCurveTo(visualX / 2, height, visualX, visualY);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(233, 67, 88, 0.1)";
        ctx.lineTo(visualX, height);
        ctx.lineTo(0, height);
        ctx.fill();

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
            // Permite selecionar mesmo sem saldo para UX, validação é no placeBet
            betAmount = v;
            inpBet.value = betAmount.toFixed(2);
        });
    });

    inpBet.addEventListener('change', (e) => {
        let v = parseFloat(e.target.value);
        if (v < 1) v = 1;
        betAmount = v;
        e.target.value = v.toFixed(2);
    });

    // Inicia o loop
    resetGame();

});
