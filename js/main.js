import { renderGames, renderDeposit, renderTasks, updateUserUI, switchPage, showToast, animateBalanceUI, openGameLauncher, closeGameLauncher } from './ui.js';
import { userProfile, tasks, gamesList, saveTasksData } from './data.js';
import { supabase } from './supabaseClient.js';

// --- CONFIGURAÇÃO ---
const API_INVICTUS_TOKEN = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
const API_INVICTUS_ENDPOINT = "https://api.invictuspay.app.br/api";
const OFFER_HASH_DEFAULT = "png8aj6v6p"; 

let pollingInterval = null;

// --- UTILS (Hoisted) ---
const Masker = {
    cpf: (v) => {
        v = v.replace(/\D/g, "");
        if (v.length > 11) v = v.substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        return v;
    },
    phone: (v) => {
        v = v.replace(/\D/g, "");
        if (v.length > 11) v = v.substring(0, 11);
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d)(\d{4})$/, "$1-$2");
        return v;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
});

function initApp() {
    // Verificações de segurança para evitar erros em elementos inexistentes
    if(document.getElementById('gameGrid')) renderGames('gameGrid');
    if(document.getElementById('depositAmounts')) renderDeposit('depositAmounts');
    if(document.getElementById('taskList')) renderTasks('taskList');
    
    updateUserUI();

    setupNavigation();
    setupDepositInteraction();
    setupWithdrawalLogic();
    setupGameInteraction();
    setupTaskInteraction();
    setupCategoryFilter();
    setupLogout();
}

// --- AUTH SYSTEM (SUPABASE) ---
async function checkLoginState() {
    const localId = localStorage.getItem('gowin_player_id');
    
    if (localId) {
        // Tenta buscar dados atualizados do DB
        try {
            const { data: player, error } = await supabase
                .from('players')
                .select(`
                    id, username, email, cpf, phone, vip_level,
                    wallets ( balance )
                `)
                .eq('id', localId)
                .single();

            if (error || !player) {
                console.error("Erro ao buscar player:", error);
                // Se der erro de conexão, não desloga, tenta usar cache se houver (futuro)
                // Por enquanto, força login se token for inválido
                if(error.code === 'PGRST116') { // Não encontrado
                    localStorage.removeItem('gowin_player_id');
                    showLogin();
                } else {
                    // Erro genérico (ex: rede), tenta mostrar app mas avisa
                    showToast('Modo Offline: Verifique sua conexão', 'info');
                    showApp(); 
                }
                return;
            }

            // Popula Store Global
            userProfile.id = player.id;
            userProfile.username = player.username;
            // Supabase retorna array ou objeto dependendo da relação, assumindo single object aqui
            userProfile.balance = player.wallets ? parseFloat(player.wallets.balance) : 0.00;
            userProfile.vipLevel = player.vip_level;
            userProfile.fullData = {
                name: player.username,
                email: player.email,
                cpf: player.cpf,
                phone: player.phone
            };

            showApp();
        } catch (err) {
            console.error(err);
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    const loginView = document.getElementById('login-view');
    if(loginView) {
        loginView.style.display = 'flex';
        setupLoginInteraction();
    }
}

function showApp() {
    const loginView = document.getElementById('login-view');
    if(loginView) loginView.style.display = 'none';
    
    const header = document.getElementById('mainHeader');
    if(header) header.style.display = 'flex';
    
    const container = document.getElementById('app-container');
    if(container) container.style.display = 'block';
    
    const nav = document.getElementById('mainNav');
    if(nav) nav.style.display = 'flex';
    
    initApp();
}

function setupLoginInteraction() {
    const form = document.getElementById('registerForm');
    if(!form) return;

    const btnLogin = document.querySelector('.btn-login');

    // Máscaras
    const cpfInput = document.getElementById('regCpf');
    if(cpfInput) cpfInput.addEventListener('input', (e) => e.target.value = Masker.cpf(e.target.value));
    
    const phoneInput = document.getElementById('regPhone');
    if(phoneInput) phoneInput.addEventListener('input', (e) => e.target.value = Masker.phone(e.target.value));

    // Mudar para modo "Entrar"
    const footerSpan = document.querySelector('.login-footer span');
    let isLoginMode = false;
    
    if(footerSpan) {
        footerSpan.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            const subtitle = document.querySelector('.login-subtitle');
            const terms = document.querySelector('.terms');
            
            if(isLoginMode) {
                if(subtitle) subtitle.textContent = "Bem-vindo de volta!";
                ['regName', 'regCpf', 'regPhone'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.parentElement.style.display = 'none';
                });
                if(terms) terms.style.display = 'none';
                if(btnLogin) btnLogin.textContent = "ENTRAR";
                footerSpan.textContent = "Criar Conta";
            } else {
                if(subtitle) subtitle.textContent = "Jogue. Conquiste. Lucre.";
                ['regName', 'regCpf', 'regPhone'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.parentElement.style.display = 'block';
                });
                if(terms) terms.style.display = 'flex';
                if(btnLogin) btnLogin.textContent = "CRIAR CONTA GRÁTIS";
                footerSpan.textContent = "Entrar";
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailEl = document.getElementById('regEmail');
        const email = emailEl ? emailEl.value : '';
        
        if(btnLogin) {
            btnLogin.disabled = true;
            btnLogin.textContent = "Processando...";
        }

        if(isLoginMode) {
            // LOGIN
            const { data, error } = await supabase
                .from('players')
                .select('id')
                .eq('email', email)
                .single();

            if(error || !data) {
                showToast('Usuário não encontrado.', 'error');
                if(btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = "ENTRAR";
                }
                return;
            }
            
            localStorage.setItem('gowin_player_id', data.id);
            location.reload(); 
            
        } else {
            // REGISTRO
            const name = document.getElementById('regName').value;
            const cpf = document.getElementById('regCpf').value;
            const phone = document.getElementById('regPhone').value;

            if(name.length < 3 || cpf.length < 14) {
                showToast('Preencha todos os dados corretamente.', 'error');
                if(btnLogin) btnLogin.disabled = false;
                return;
            }

            // Insert Player
            const { data, error } = await supabase
                .from('players')
                .insert([{ username: name, email, cpf, phone }])
                .select()
                .single();

            if (error) {
                console.error(error);
                if(error.code === '23505') showToast('E-mail ou CPF já cadastrados.', 'error');
                else showToast('Erro ao criar conta.', 'error');
                if(btnLogin) btnLogin.disabled = false;
            } else {
                localStorage.setItem('gowin_player_id', data.id);
                showToast('Conta criada com sucesso!', 'success');
                setTimeout(() => location.reload(), 1500);
            }
        }
    });
}

// --- LOGOUT ---
function setupLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            if(confirm('Tem certeza que deseja sair?')) {
                localStorage.removeItem('gowin_player_id');
                location.reload();
            }
        });
    }
}

// --- JOGOS E UI ---
function setupCategoryFilter() {
    const catItems = document.querySelectorAll('.cat-item');
    const gridEl = document.getElementById('gameGrid');
    const titleEl = document.getElementById('homeSectionTitle');

    if(!gridEl) return;

    catItems.forEach(item => {
        item.addEventListener('click', () => {
            catItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const cat = item.dataset.cat;
            
            gridEl.style.opacity = '0.5';
            setTimeout(() => {
                renderGames('gameGrid', cat);
                gridEl.style.opacity = '1';
                if(titleEl) titleEl.innerHTML = `<i class="${item.querySelector('i').className}"></i> ${item.querySelector('span').textContent}`;
            }, 200);
        });
    });
}

function setupGameInteraction() {
    const grid = document.getElementById('gameGrid');
    if(grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.game-card');
            if(card) {
                const gameName = card.dataset.game;
                const gameData = gamesList.find(g => g.name === gameName);
                openGameLauncher(gameName, gameData ? gameData.url : null);
            }
        });
    }
    const closeBtn = document.getElementById('btnCloseModal');
    if(closeBtn) closeBtn.addEventListener('click', closeGameLauncher);
}

// --- TAREFAS ---
function setupTaskInteraction() {
    const list = document.getElementById('taskList');
    if(list) {
        list.addEventListener('click', async (e) => {
            if(e.target.classList.contains('task-btn') && !e.target.classList.contains('claimable') === false) {
                // Checa se está habilitado
                if(e.target.disabled) return;

                const index = e.target.dataset.index;
                const task = tasks[index];

                // RPC Add Balance
                const { data: newBalance, error } = await supabase
                    .rpc('add_balance', { p_id: userProfile.id, amount: task.reward });

                if (!error) {
                    userProfile.balance = newBalance;
                    task.status = "Resgatado";
                    saveTasksData(); 
                    animateBalanceUI(newBalance);
                    showToast(`Bônus de R$ ${task.reward.toFixed(2)} resgatado!`, 'success');
                    renderTasks('taskList');
                } else {
                    showToast('Erro ao resgatar bônus.', 'error');
                }
            }
        });
    }
}

// --- DEPÓSITO INTEGRADO (SUPABASE + INVICTUS) ---
function setupDepositInteraction() {
    const manualInput = document.getElementById('manualDepositInput');
    const actionBtn = document.getElementById('btnDepositAction');
    const container = document.getElementById('depositAmounts');

    // Preencher Info Confirmada
    const userData = userProfile.fullData || {};
    const nameEl = document.getElementById('confirmName');
    const cpfEl = document.getElementById('confirmCpf');
    if(nameEl) nameEl.textContent = userData.name || "Visitante";
    if(cpfEl) cpfEl.textContent = userData.cpf || "CPF não verificado";

    const validate = (val) => {
        const num = parseFloat(val);
        if(!num || num < 15) {
            actionBtn.disabled = true;
            actionBtn.textContent = 'Mínimo R$ 15,00';
            actionBtn.style.opacity = '0.5';
        } else {
            actionBtn.disabled = false;
            actionBtn.textContent = `PAGAR R$ ${num.toFixed(2)}`;
            actionBtn.style.opacity = '1';
        }
    };

    if(container) {
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.dep-btn');
            if(btn) {
                document.querySelectorAll('.dep-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                const val = btn.dataset.value;
                if(manualInput) manualInput.value = val;
                validate(val);
            }
        });
    }
    if(manualInput) manualInput.addEventListener('input', (e) => validate(e.target.value));

    if(actionBtn) {
        actionBtn.addEventListener('click', async () => {
            const amount = parseFloat(manualInput.value);
            const amountCents = Math.round(amount * 100);

            actionBtn.disabled = true;
            actionBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> GERANDO...';

            // 1. Transaction Pending no DB
            const { data: txn, error } = await supabase
                .from('transactions')
                .insert([{
                    player_id: userProfile.id,
                    type: 'DEPOSIT',
                    amount: amount,
                    status: 'pending'
                }])
                .select()
                .single();

            if(error) {
                console.error(error);
                showToast('Erro interno ao iniciar depósito.', 'error');
                actionBtn.disabled = false;
                actionBtn.textContent = "TENTAR NOVAMENTE";
                return;
            }

            // 2. Invictus API
            const payload = {
                "amount": amountCents, 
                "offer_hash": OFFER_HASH_DEFAULT, 
                "payment_method": "pix", 
                "customer": {
                    name: userData.name || "Cliente GOW",
                    email: userData.email || "email@temp.com",
                    document: userData.cpf ? userData.cpf.replace(/\D/g,'') : "00000000000",
                    phone_number: userData.phone ? userData.phone.replace(/\D/g,'') : "00000000000",
                    street_name: "Rua Digital", street_number: "100", neighborhood: "Centro", 
                    zip_code: "01001000", city: "Sao Paulo", state: "SP"
                },
                "cart": [{
                    "product_hash": OFFER_HASH_DEFAULT,
                    "title": `Creditos GOW - ${amount}`,
                    "price": amountCents,
                    "quantity": 1,
                    "operation_type": 1, "tangible": false
                }],
                "transaction_origin": "api"
            };

            try {
                const response = await fetch(`${API_INVICTUS_ENDPOINT}/public/v1/transactions?api_token=${API_INVICTUS_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const apiData = await response.json();

                if(response.ok && apiData.payment_method === 'pix') {
                    // Update Transaction ID
                    await supabase.from('transactions')
                        .update({ external_id: apiData.hash })
                        .eq('id', txn.id);

                    showPixModal(apiData, amount);
                    monitorPayment(apiData.hash, amount, txn.id);
                } else {
                    console.error("Invictus Error:", apiData);
                    showToast('Erro na geração do PIX.', 'error');
                }

            } catch(e) {
                console.error(e);
                showToast('Erro de conexão com gateway.', 'error');
            } finally {
                actionBtn.disabled = false;
                actionBtn.textContent = `PAGAR R$ ${amount.toFixed(2)}`;
            }
        });
    }
}

function monitorPayment(externalHash, amount, txnId) {
    if(pollingInterval) clearInterval(pollingInterval);
    const startTime = Date.now();
    
    pollingInterval = setInterval(async () => {
        if (Date.now() - startTime > 1200000) { // 20 min
            clearInterval(pollingInterval);
            return;
        }
        try {
            const response = await fetch(`${API_INVICTUS_ENDPOINT}/public/v1/transactions/${externalHash}?api_token=${API_INVICTUS_TOKEN}`);
            const data = await response.json();

            if (['PAID', 'paid', 'COMPLETED'].includes(data.status)) {
                clearInterval(pollingInterval);
                
                // Add Balance Atomically
                const { data: newBal } = await supabase.rpc('add_balance', { p_id: userProfile.id, amount: amount });
                
                // Complete Transaction
                await supabase.from('transactions').update({ status: 'completed' }).eq('id', txnId);

                userProfile.balance = newBal;
                animateBalanceUI(newBal);
                
                const modal = document.getElementById('pixModal');
                if(modal) modal.style.display = 'none';
                
                showToast(`Pagamento de R$ ${amount.toFixed(2)} APROVADO!`, 'success');
                switchPage('home');
            }
        } catch (error) {}
    }, 5000);
}

function showPixModal(data, amount) {
    const modal = document.getElementById('pixModal');
    if(!modal) return;
    
    const amountEl = document.getElementById('modalAmount');
    if(amountEl) amountEl.textContent = `R$ ${amount.toFixed(2)}`;
    
    const hashEl = document.getElementById('modalHash');
    if(hashEl) hashEl.textContent = `ID: ${data.hash}`;
    
    const textarea = document.getElementById('pixCodeTextarea');
    if(textarea) textarea.value = data.pix.pix_qr_code;
    
    const qrImg = document.getElementById('qrCodeImage');
    if (qrImg && data.pix.qr_code_base64) qrImg.src = `data:image/png;base64,${data.pix.qr_code_base64}`;

    modal.style.display = 'flex';
    
    const btnClose = document.getElementById('btnClosePixModal');
    if(btnClose) {
        btnClose.onclick = () => { 
            modal.style.display = 'none'; 
            if(pollingInterval) clearInterval(pollingInterval);
        };
    }
    
    const btnCopy = document.getElementById('copyPixButton');
    if(btnCopy) {
        btnCopy.onclick = () => {
            textarea.select();
            navigator.clipboard.writeText(textarea.value);
            btnCopy.innerHTML = `<i class="fas fa-check"></i> COPIADO!`;
            setTimeout(() => { btnCopy.innerHTML = `<i class="far fa-copy"></i> Copiar Código`; }, 2000);
        };
    }
}

// --- NAVEGAÇÃO ---
function setupNavigation() {
    document.body.addEventListener('click', (e) => {
        const targetEl = e.target.closest('[data-nav], .nav-item');
        if (targetEl) {
            const targetId = targetEl.dataset.nav || targetEl.dataset.target;
            if (targetId) switchPage(targetId);
        }
    });
    const refreshBtn = document.getElementById('btnRefreshBalance');
    if(refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('fa-spin');
            
            try {
                // Refresh Balance from DB
                const { data } = await supabase
                    .from('wallets')
                    .select('balance')
                    .eq('player_id', userProfile.id)
                    .single();
                
                if(data) {
                    userProfile.balance = parseFloat(data.balance);
                    updateUserUI();
                    showToast('Saldo atualizado.', 'info');
                }
            } catch(e) {}
            
            setTimeout(() => refreshBtn.classList.remove('fa-spin'), 1000);
        });
    }
    const btnCopy = document.getElementById('btnCopyLink');
    if(btnCopy) {
        btnCopy.addEventListener('click', () => {
            const link = document.getElementById('inviteLink');
            if(link) {
                navigator.clipboard.writeText(link.value);
                showToast('Link copiado!', 'success');
            }
        });
    }
}

function setupWithdrawalLogic() {
    const btnWithdraw = document.getElementById('btnRequestWithdraw');
    if(btnWithdraw) {
        btnWithdraw.addEventListener('click', () => {
            showToast('Solicitação enviada para análise.', 'info');
        });
    }
}