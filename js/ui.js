import { gamesList, depositOptions, tasks, userProfile } from './data.js';

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function animateBalanceUI(newBalance) {
    const els = [document.getElementById('user-balance'), document.getElementById('profile-balance-display')];
    const start = userProfile.balance;
    const end = newBalance;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - (1 - progress) * (1 - progress);
        const currentVal = start + (end - start) * ease;
        
        els.forEach(el => { if(el) el.textContent = formatCurrency(currentVal); });

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
        modal.style.display = 'flex';
        
        // Reset
        loader.style.display = 'flex';
        frame.style.display = 'none';
        frame.innerHTML = ''; // Limpa conteúdo anterior

        if (gameUrl) {
            // Se tiver URL, cria Iframe
            const iframe = document.createElement('iframe');
            iframe.src = gameUrl;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            
            iframe.onload = () => {
                loader.style.display = 'none';
                frame.style.display = 'block';
            };
            
            frame.appendChild(iframe);
            // Fallback
            setTimeout(() => { loader.style.display = 'none'; frame.style.display = 'block'; }, 3000);
        } else {
            // Simulação
            setTimeout(() => {
                loader.style.display = 'none';
                frame.style.display = 'flex';
                frame.innerHTML = `<i class="fas fa-play-circle" style="font-size:50px; color:white; margin-bottom:10px;"></i><p>Jogo Carregado (Simulação)</p>`;
            }, 2000);
        }
    }
}

export function closeGameLauncher() {
    const modal = document.getElementById('game-modal');
    if(modal) {
        modal.style.display = 'none';
        const frame = document.querySelector('.game-frame-placeholder');
        if(frame) frame.innerHTML = ''; // Mata o iframe pra parar som
    }
}

export function renderGames(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = gamesList.map(game => `
        <div class="game-card" data-game="${game.name}">
            <span class="provider-badge">${game.provider}</span>
            <img src="${game.img}" class="game-img" loading="lazy" alt="${game.name}">
            <div style="padding: 5px; font-size: 11px; text-align: center;">${game.name}</div>
        </div>
    `).join('');
}

export function renderDeposit(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = depositOptions.map((opt, index) => `
        <div class="dep-btn" data-value="${opt.value}">
            <span class="val">R$ ${opt.value}</span>
            <span class="bonus">+R$ ${opt.bonus}</span>
        </div>
    `).join('');
}

export function renderTasks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = tasks.map((task, index) => `
        <div style="background:var(--bg-light); padding:10px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-size:13px; font-weight:bold;">${task.title}</div>
                <div style="font-size:10px; color:#aaa; margin-top:2px;">Prêmio: R$ ${task.reward.toFixed(2)}</div>
            </div>
            <button class="btn-header btn-claim-task" data-index="${index}" style="background:${task.status === 'Receber' ? 'var(--accent)' : '#444'}; opacity:${task.status === 'Receber' ? '1' : '0.6'};">
                ${task.status}
            </button>
        </div>
    `).join('');
}

export function updateUserUI() {
    const balEl = document.getElementById('user-balance');
    const balDisplay = document.getElementById('profile-balance-display');
    const val = formatCurrency(userProfile.balance);
    if (balEl) balEl.textContent = val;
    if (balDisplay) balDisplay.textContent = val;
}

export function switchPage(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0,0);
    }
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.target === targetId);
    });
}