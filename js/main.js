
import { renderGames, renderDeposit, renderTasks, updateUserUI, switchPage, showToast, animateBalanceUI, openGameLauncher, closeGameLauncher } from './ui.js';
import { userProfile, tasks, gamesList, saveTasksData } from './data.js';
import { supabase } from './supabaseClient.js';

// --- CONFIGURAÇÃO INVICTUS ---
const API_INVICTUS_TOKEN = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
const API_INVICTUS_ENDPOINT = "https://api.invictuspay.app.br/api";
const OFFER_HASH_DEFAULT = "png8aj6v6p"; 

let pollingInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
});

function initApp() {
    renderGames('gameGrid');
    renderDeposit('depositAmounts');
    renderTasks('taskList');
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
                localStorage.removeItem('gowin_player_id');
                showLogin();
                return;
            }

            // Popula Store Global
            userProfile.id = player.id;
            userProfile.username = player.username;
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
    document.getElementById('login-view').style.display = 'flex';
    setupLoginInteraction();
}

function showApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('mainNav').style.display = 'flex';
    initApp();
}

function setupLoginInteraction() {
    const form = document.getElementById('registerForm');
    const btnLogin = document.querySelector('.btn-login');

    // Máscaras básicas
    document.getElementById('regCpf').addEventListener('input', (e) => e.target.value = Masker.cpf(e.target.value));
    document.getElementById('regPhone').addEventListener('input', (e) => e.target.value = Masker.phone(e.target.value));

    // Mudar para modo "Entrar" se clicar no link
    const footerSpan = document.querySelector('.login-footer span');
    let isLoginMode = false;
    
    footerSpan.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        if(isLoginMode) {
            document.querySelector('.login-subtitle').textContent = "Bem-vindo de volta!";
            document.getElementById('regName').parentElement.style.display = 'none';
            document.getElementById('regCpf').parentElement.style.display = 'none';
            document.getElementById('regPhone').parentElement.style.display = 'none';
            document.querySelector('.terms').style.display = 'none';
            btnLogin.textContent = "ENTRAR";
            footerSpan.textContent = "Criar Conta";
        } else {
            document.querySelector('.login-subtitle').textContent = "Jogue. Conquiste. Lucre.";
            document.getElementById('regName').parentElement.style.display = 'block';
            document.getElementById('regCpf').parentElement.style.display = 'block';
            document.getElementById('regPhone').parentElement.style.display = 'block';
            document.querySelector('.terms').style.display = 'flex';
            btnLogin.textContent = "CRIAR CONTA GRÁTIS";
            footerSpan.textContent = "Entrar";
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('regEmail').value;
        
        btnLogin.disabled = true;
        btnLogin.textContent = "Processando...";

        if(isLoginMode) {
            // LOGIN (Simplificado por Email para demo - Ideal seria Auth.signIn)
            const { data, error } = await supabase
                .from('players')
                .select('id')
                .eq('email', email)
                .single();

            if(error || !data) {
                showToast('Usuário não encontrado.', 'error');
                btnLogin.disabled = false;
                btnLogin.textContent = "ENTRAR";
                return;
            }
            
            localStorage.setItem('gowin_player_id', data.id);
            location.reload(); // Recarrega para puxar dados frescos
            
        } else {
            // REGISTRO
            const name = document.getElementById('regName').value;
            const cpf = document.getElementById('regCpf').value;
            const phone = document.getElementById('regPhone').value;

            if(name.length < 3 || cpf.length < 14) {
                showToast('Dados inválidos.', 'error');
                btnLogin.disabled = false;
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
                btnLogin.disabled = false;
                btnLogin.textContent = "CRIAR CONTA GRÁTIS";
            } else {
                localStorage.setItem('gowin_player_id', data.id);
                // Trigger do banco já criou a wallet
                showToast('Conta criada com sucesso!', 'success');
                setTimeout(() => location.reload(), 1000);
            }
        }
    });
}

// --- HELPER MASKS ---
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

    catItems.forEach(item => {
        item.addEventListener('click', () => {
            catItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const cat = item.dataset.cat;
            
            gridEl.style.opacity = '0.5';
            setTimeout(() => {
                renderGames('gameGrid', cat);
                gridEl.style.opacity = '1';
                titleEl.innerHTML = `<i class="${item.querySelector('i').className}"></i> ${item.querySelector('span').textContent}`;
            }, 200);
        });
    });
}

function setupGameInteraction() {
    document.getElementById('gameGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        if(card) {
            const gameName = card.dataset.game;
            const gameData = gamesList.find(g => g.name === gameName);
            openGameLauncher(gameName, gameData ? gameData.url : null);
        }
    });
    const closeBtn = document.getElementById('btnCloseModal');
    if(closeBtn) closeBtn.addEventListener('click', closeGameLauncher);
}

// --- TAREFAS (COM UPDATE DB) ---
function setupTaskInteraction() {
    const list = document.getElementById('taskList');
    if(list) {
        list.addEventListener('click', async (e) => {
            if(e.target.classList.contains('task-btn') && !e.target.disabled) {
                const index = e.target.dataset.index;
                const task = tasks[index];

                // Chama função do DB para adicionar saldo atômico
                const { data: newBalance, error } = await supabase
                    .rpc('add_balance', { p_id: userProfile.id, amount: task.reward });

                if (!error) {
                    userProfile.balance = newBalance;
                    task.status = "Resgatado";
                    saveTasksData(); // Tasks ainda locais por enquanto
                    animateBalanceUI(newBalance);
                    showToast(`Bônus de R$ ${task.reward.toFixed(2)} resgatado!`, 'success');
                    renderTasks('taskList');
                } else {
                    showToast('Erro ao resgatar bônus', 'error');
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

    // Preencher UI
    const userData = userProfile.fullData || {};
    document.getElementById('confirmName').textContent = userData.name || "...";
    document.getElementById('confirmCpf').textContent = userData.cpf || "...";

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

            // Cria transação PENDING no Supabase
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
                showToast('Erro ao iniciar transação.', 'error');
                actionBtn.disabled = false;
                return;
            }

            // Chama Invictus
            const payload = {
                "amount": amountCents, 
                "offer_hash": OFFER_HASH_DEFAULT, 
                "payment_method": "pix", 
                "customer": {
                    name: userData.name,
                    email: userData.email,
                    document: userData.cpf,
                    phone_number: userData.phone,
                    // Dados dummy de endereço obrigatórios
                    street_name: "Rua Digital", street_number: "100", neighborhood: "Centro", 
                    zip_code: "01001000", city: "Sao Paulo", state: "SP"
                },
                "cart": [{
                    "product_hash": OFFER_HASH_DEFAULT,
                    "title": `Créditos GOW - ${amount}`,
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
                    // Atualiza transação com ID externo
                    await supabase.from('transactions')
                        .update({ external_id: apiData.hash })
                        .eq('id', txn.id);

                    showPixModal(apiData, amount);
                    monitorPayment(apiData.hash, amount, txn.id);
                } else {
                    showToast('Erro na Invictus.', 'error');
                }

            } catch(e) {
                console.error(e);
                showToast('Erro de conexão.', 'error');
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
                
                // 1. Adiciona saldo via RPC (Atômico)
                const { data: newBal } = await supabase.rpc('add_balance', { p_id: userProfile.id, amount: amount });
                
                // 2. Atualiza status da transação
                await supabase.from('transactions').update({ status: 'completed' }).eq('id', txnId);

                // UI Update
                userProfile.balance = newBal;
                animateBalanceUI(newBal);
                document.getElementById('pixModal').style.display = 'none';
                showToast(`Pagamento de R$ ${amount.toFixed(2)} APROVADO!`, 'success');
                switchPage('home');
            }
        } catch (error) {}
    }, 5000);
}

function showPixModal(data, amount) {
    const modal = document.getElementById('pixModal');
    document.getElementById('modalAmount').textContent = `R$ ${amount.toFixed(2)}`;
    document.getElementById('modalHash').textContent = `ID: ${data.hash}`;
    const textarea = document.getElementById('pixCodeTextarea');
    textarea.value = data.pix.pix_qr_code;
    
    const qrImg = document.getElementById('qrCodeImage');
    if (data.pix.qr_code_base64) qrImg.src = `data:image/png;base64,${data.pix.qr_code_base64}`;

    modal.style.display = 'flex';
    document.getElementById('btnClosePixModal').onclick = () => { 
        modal.style.display = 'none'; 
        if(pollingInterval) clearInterval(pollingInterval);
    };
    
    const btnCopy = document.getElementById('copyPixButton');
    btnCopy.onclick = () => {
        textarea.select();
        navigator.clipboard.writeText(textarea.value);
        btnCopy.innerHTML = `<i class="fas fa-check"></i> COPIADO!`;
        setTimeout(() => { btnCopy.innerHTML = `<i class="far fa-copy"></i> Copiar Código`; }, 2000);
    };
}

// --- NAVEGAÇÃO BÁSICA ---
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
            // Refresh DB Balance
            const { data } = await supabase
                .from('wallets')
                .select('balance')
                .eq('player_id', userProfile.id)
                .single();
            
            if(data) {
                userProfile.balance = data.balance;
                updateUserUI();
            }
            setTimeout(() => refreshBtn.classList.remove('fa-spin'), 1000);
        });
    }
    const btnCopy = document.getElementById('btnCopyLink');
    if(btnCopy) {
        btnCopy.addEventListener('click', () => {
            const link = document.getElementById('inviteLink');
            navigator.clipboard.writeText(link.value);
            showToast('Link copiado!', 'success');
        });
    }
}

function setupWithdrawalLogic() {
    const btnWithdraw = document.getElementById('btnRequestWithdraw');
    if(btnWithdraw) {
        btnWithdraw.addEventListener('click', () => {
            showToast('Solicitação enviada para análise.', 'info');
            // Futuramente: Insert into transactions type='WITHDRAW'
        });
    }
}
