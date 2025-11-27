
import { gamesList, depositOptions, tasks, userProfile } from './data.js';

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function animateBalanceUI(newBalance) {
    const els = [document.getElementById('user-balance'), document.getElementById('profile-balance-display'), document.getElementById('withdraw-available')];
    const start = userProfile.balance;
    const end = newBalance;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - (1 - progress) * (1 - progress);
        const currentVal = start + (end - start) * ease;
        
        const formatted = formatCurrency(currentVal);
        els.forEach(el => { if(el) el.textContent = formatted; });

        if (progress < 1) requestAnimationFrame(update);
        else els.forEach(el => { if(el) el.textContent = formatCurrency(end); });
    }
    requestAnimationFrame(update);
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'info-circle';
    if(type === 'success') icon = 'check-circle';
    if(type === 'error') icon = 'exclamation-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// LÓGICA DO LAUNCHER (IFRAME)
export function openGameLauncher(gameName, gameUrl = null) {
    const modal = document.getElementById('game-modal');
    const title = document.getElementById('modal-game-title');
    const loader = document.querySelector('.game-loader');
    const frame = document.querySelector('.game-frame-placeholder');

    if(modal) {
        title.textContent = gameName;
        modal.style.display = 'flex'; // Flex p/ centralizar
        
        // Reset
        loader.style.display = 'flex';
        frame.style.display = 'none';
        frame.innerHTML = ''; 

        if (gameUrl) {
            const iframe = document.createElement('iframe');
            iframe.src = gameUrl;
            iframe.setAttribute('scrolling', 'no'); 
            
            // Evento de carregamento
            iframe.onload = () => {
                loader.style.display = 'none';
                frame.style.display = 'block';
                
                // INJEÇÃO DE SALDO INICIAL NO JOGO (BRIDGE)
                setTimeout(() => {
                    iframe.contentWindow.postMessage({
                        type: 'INIT_GAME',
                        balance: userProfile.balance
                    }, '*');
                }, 500);
            };

            // FAILSAFE: Se o onload não disparar em 3s, força a exibição
            // Isso resolve o problema de "Loading Infinito" em alguns navegadores/jogos locais
            setTimeout(() => {
                if(loader.style.display !== 'none') {
                    console.warn("Iframe onload timeout - Forcing display");
                    loader.style.display = 'none';
                    frame.style.display = 'block';
                    iframe.contentWindow.postMessage({
                        type: 'INIT_GAME',
                        balance: userProfile.balance
                    }, '*');
                }
            }, 3000);
            
            frame.appendChild(iframe);
        } else {
            setTimeout(() => {
                loader.style.display = 'none';
                frame.style.display = 'flex';
                frame.innerHTML = `<i class="fas fa-exclamation-triangle" style="font-size:40px; color:#aaa; margin-bottom:10px;"></i><p>Jogo indisponível</p>`;
            }, 1000);
        }
    }
}

export function closeGameLauncher() {
    const modal = document.getElementById('game-modal');
    if(modal) {
        modal.style.display = 'none';
        const frame = document.querySelector('.game-frame-placeholder');
        if(frame) frame.innerHTML = ''; 
    }
}

// Render Games com suporte a filtro
export function renderGames(containerId, filter = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let filteredList = gamesList;
    
    if (filter === 'slots') {
        filteredList = gamesList.filter(g => g.name.toLowerCase().includes('slot') || g.name.toLowerCase().includes('fortune') || g.name.toLowerCase().includes('gates'));
    } else if (filter === 'crash') {
        filteredList = gamesList.filter(g => g.provider === 'CRASH' || g.name.includes('Mines') || g.name.includes('Dragon'));
    } else if (filter === 'exclusive') {
        filteredList = gamesList.filter(g => g.provider === 'EXCLUSIVO');
    }

    container.innerHTML = filteredList.map(game => `
        <div class="game-card" data-game="${game.name}">
            <span class="provider-badge">${game.provider}</span>
            <img src="${game.img}" class="game-img" loading="lazy" alt="${game.name}">
            <div class="game-info">
                <div class="game-name">${game.name}</div>
            </div>
        </div>
    `).join('');
}

export function renderDeposit(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = depositOptions.map((opt, index) => `
        <div class="dep-btn" data-value="${opt.value}">
            <span class="val">R$ ${opt.value}</span>
            <span class="bonus">+R$ ${opt.bonus} Bônus</span>
        </div>
    `).join('');
}

export function renderTasks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = tasks.map((task, index) => {
        const isClaimable = task.status === 'Receber';
        const isLocked = task.status === 'Bloqueado';
        const isDone = task.status === 'Resgatado';

        let btnText = 'RESGATAR';
        let btnClass = 'claimable';
        let iconClass = 'fa-scroll';

        if (isLocked) {
            btnText = '<i class="fas fa-lock"></i> BLOQUEADO';
            btnClass = '';
        } else if (isDone) {
            btnText = '<i class="fas fa-check"></i> FEITO';
            btnClass = '';
            iconClass = 'fa-check-circle';
        }
        
        return `
        <div class="task-card" style="${isDone ? 'opacity:0.6' : ''}">
            <div class="task-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="task-details">
                <div class="task-title">${task.title}</div>
                <div class="task-reward">Recompensa: R$ ${task.reward.toFixed(2)}</div>
            </div>
            <button class="task-btn ${btnClass}" data-index="${index}" ${!isClaimable ? 'disabled' : ''}>
                ${btnText}
            </button>
        </div>
    `}).join('');
}

export function updateUserUI() {
    const balEl = document.getElementById('user-balance');
    const balDisplay = document.getElementById('profile-balance-display');
    const withdrawAvail = document.getElementById('withdraw-available');
    
    const val = formatCurrency(userProfile.balance);
    
    if (balEl) balEl.textContent = val;
    if (balDisplay) balDisplay.textContent = val;
    if (withdrawAvail) withdrawAvail.textContent = val; 

    const idDisplay = document.getElementById('profile-id-display');
    const nameDisplay = document.getElementById('profile-name');
    const imgDisplay = document.getElementById('profile-img');
    
    if(idDisplay) idDisplay.textContent = userProfile.id ? userProfile.id.substring(0,8) : '...';
    if(nameDisplay) nameDisplay.textContent = userProfile.username || 'Jogador';
    if(imgDisplay && userProfile.username) imgDisplay.src = `https://ui-avatars.com/api/?name=${userProfile.username}&background=random&color=fff`;
}

export function switchPage(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0,0);
        if(targetId === 'saque' || targetId === 'perfil') updateUserUI();
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        const t = item.dataset.target || item.dataset.nav;
        if(t === targetId) item.classList.add('active');
        else item.classList.remove('active');
    });
}
