
import { renderGames, renderDeposit, renderTasks, updateUserUI, switchPage, showToast, animateBalanceUI, openGameLauncher, closeGameLauncher } from './ui.js';
import { userProfile, tasks, gamesList, resetTasksLocal } from './data.js';
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
    // Inicializa lógica de formulários (Login/Registro)
    setupLoginInteraction(); 
    checkLoginState();
    setupGameBridge(); 
});

function initApp() {
    if(document.getElementById('gameGrid')) renderGames('gameGrid');
    if(document.getElementById('depositAmounts')) renderDeposit('depositAmounts');
    
    loadTasksState().then(() => {
        if(document.getElementById('taskList')) renderTasks('taskList');
    });
    
    updateUserUI();

    setupNavigation();
    setupDepositInteraction();
    setupWithdrawalLogic();
    setupGameInteraction();
    setupTaskInteraction();
    setupCategoryFilter();
    setupLogout();
}

// --- GAME BRIDGE (Communication Layer) ---
function setupGameBridge() {
    window.addEventListener('message', async (event) => {
        const { type, payload } = event.data;

        if (type === 'GAME_UPDATE') {
            userProfile.balance = parseFloat(payload.newBalance);
            updateUserUI(); // Atualiza UI imediatamente para responsividade
            
            // Persiste no Supabase sem bloquear a thread principal
            try {
                await supabase
                    .from('wallets')
                    .update({ balance: userProfile.balance })
                    .eq('player_id', userProfile.id);
                
            } catch (err) {
                console.error("Sync Error:", err);
            }
        }
    });
}

// --- QUESTS LOGIC ---
async function loadTasksState() {
    if(!userProfile.id) return;

    try {
        const { data: claimedTasks } = await supabase
            .from('player_tasks')
            .select('task_id')
            .eq('player_id', userProfile.id);

        const claimedIds = claimedTasks ? claimedTasks.map(t => t.task_id) : [];

        const { data: deposits } = await supabase
            .from('transactions')
            .select('id')
            .eq('player_id', userProfile.id)
            .eq('type', 'DEPOSIT')
            .eq('status', 'completed')
            .limit(1);
        
        const hasDeposit = deposits && deposits.length > 0;

        tasks.forEach(task => {
            if (claimedIds.includes(task.id)) {
                task.status = "Resgatado";
            } else {
                if (task.type === 'check_deposit') {
                    task.status = hasDeposit ? "Receber" : "Bloqueado";
                } else {
                    task.status = "Receber"; 
                }
            }
        });

    } catch(err) {
        console.error("Task Error:", err);
    }
}

function setupTaskInteraction() {
    const list = document.getElementById('taskList');
    if(list) {
        list.addEventListener('click', async (e) => {
            if(e.target.classList.contains('task-btn') && e.target.classList.contains('claimable')) {
                if(e.target.disabled) return;

                const index = e.target.dataset.index;
                const task = tasks[index];

                if (task.type === 'verify_email') {
                    const code = prompt(`Enviamos um código para ${userProfile.fullData.email || 'seu e-mail'}.\n(Simulação: Digite 1234)`);
                    if (code !== '1234') {
                        showToast('Código inválido.', 'error');
                        return;
                    }
                }

                e.target.disabled = true;
                e.target.textContent = 'Processando...';

                const { data: newBalance, error: balError } = await supabase
                    .rpc('add_balance', { p_id: userProfile.id, amount: task.reward });

                if (!balError) {
                    const { error: taskError } = await supabase
                        .from('player_tasks')
                        .insert([{ player_id: userProfile.id, task_id: task.id }]);

                    if(!taskError) {
                        userProfile.balance = newBalance;
                        task.status = "Resgatado";
                        animateBalanceUI(newBalance);
                        showToast(`Bônus de R$ ${task.reward.toFixed(2)} resgatado!`, 'success');
                        renderTasks('taskList');
                    } else {
                         e.target.disabled = false;
                         showToast('Erro ao salvar tarefa.', 'error');
                    }
                } else {
                    showToast('Erro ao creditar bônus.', 'error');
                    e.target.disabled = false;
                }
            }
        });
    }
}

// --- AUTH SYSTEM (SUPABASE) ---
async function checkLoginState() {
    const localId = localStorage.getItem('gowin_player_id');
    
    if (localId) {
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
                localStorage.removeItem('gowin_player_id');
                showLogin();
                return;
            }

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
    const loginView = document.getElementById('login-view');
    if(loginView) {
        loginView.style.display = 'flex';
        // Garante estado inicial correto dos formulários
        const footerSpan = document.querySelector('.login-footer span');
        if(footerSpan && footerSpan.textContent === "Entrar") {
             // Já está no modo registro, ok
        } else {
             // Força reset visual se necessário
        }
    }
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
    if(!form) return;

    const btnLogin = document.querySelector('.btn-login');
    const cpfInput = document.getElementById('regCpf');
    const phoneInput = document.getElementById('regPhone');
    const nameInput = document.getElementById('regName');
    const termsCheck = document.getElementById('termsCheck');
    const emailInput = document.getElementById('regEmail');

    if(cpfInput) cpfInput.addEventListener('input', (e) => e.target.value = Masker.cpf(e.target.value));
    if(phoneInput) phoneInput.addEventListener('input', (e) => e.target.value = Masker.phone(e.target.value));

    const footerSpan = document.querySelector('.login-footer span');
    let isLoginMode = false;

    // Toggle Mode Logic
    if(footerSpan) {
        footerSpan.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            const subtitle = document.querySelector('.login-subtitle');
            const terms = document.querySelector('.terms');
            
            // Campos de registro
            const regFields = [nameInput, cpfInput, phoneInput];

            if(isLoginMode) {
                // MODO LOGIN (Esconder Registro)
                if(subtitle) subtitle.textContent = "Bem-vindo de volta!";
                
                regFields.forEach(el => {
                    if(el) {
                        el.parentElement.style.display = 'none';
                        el.removeAttribute('required'); // CRÍTICO: Remove required para permitir submit
                    }
                });
                
                if(terms) {
                    terms.style.display = 'none';
                    termsCheck.removeAttribute('required');
                }

                if(btnLogin) btnLogin.textContent = "ENTRAR";
                footerSpan.textContent = "Criar Conta";

            } else {
                // MODO REGISTRO (Mostrar tudo)
                if(subtitle) subtitle.textContent = "Jogue. Conquiste. Lucre.";
                
                regFields.forEach(el => {
                    if(el) {
                        el.parentElement.style.display = 'block';
                        el.setAttribute('required', 'true'); // CRÍTICO: Restaura required
                    }
                });
                
                if(terms) {
                    terms.style.display = 'flex';
                    termsCheck.setAttribute('required', 'true');
                }

                if(btnLogin) btnLogin.textContent = "CRIAR CONTA GRÁTIS";
                footerSpan.textContent = "Entrar";
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput ? emailInput.value : '';
        
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
                showToast('E-mail não encontrado.', 'error');
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
            const name = nameInput.value;
            const cpf = cpfInput.value;
            const phone = phoneInput.value;

            // Validação Client-Side
            if(cpf.length < 14) {
                showToast('CPF incompleto.', 'error');
                if(btnLogin) btnLogin.disabled = false;
                return;
            }

            const { data, error } = await supabase
                .from('players')
                .insert([{ username: name, email, cpf, phone }])
                .select()
                .single();

            if (error) {
                if(error.code === '23505') {
                    showToast('E-mail ou CPF já cadastrados.', 'error');
                } else {
                    showToast('Erro ao criar conta.', 'error');
                }
                if(btnLogin) btnLogin.disabled = false;
            } else {
                localStorage.setItem('gowin_player_id', data.id);
                resetTasksLocal();
                showToast('Conta criada com sucesso!', 'success');
                setTimeout(() => location.reload(), 1500);
            }
        }
    });
}

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

// --- SAQUE (WITHDRAWAL) ---
function setupWithdrawalLogic() {
    const btnWithdraw = document.getElementById('btnRequestWithdraw');
    const inputVal = document.querySelector('#saque input.dark-input'); // Assumindo novo layout
    const pageSaque = document.getElementById('saque');

    // Injeta novo HTML para o saque se necessário (Fallback para garantir UI atualizada)
    if(pageSaque) {
        const withdrawAvail = document.getElementById('withdraw-available');
        if(withdrawAvail) {
            const parent = withdrawAvail.parentElement.parentElement;
            // Atualiza o container para ter inputs corretos
            const manualBox = parent.querySelector('.manual-deposit-box');
            if(manualBox) {
                manualBox.innerHTML = `
                    <label>Valor do Saque (Min. R$ 10,00)</label>
                    <input type="number" id="withdrawAmount" class="dark-input" placeholder="0.00" style="margin-bottom:10px;">
                    
                    <label>CPF do Titular (Destino)</label>
                    <input type="text" id="withdrawCpf" class="dark-input" value="${userProfile.fullData.cpf || '...'}" readonly style="margin-bottom:10px; opacity:0.7;">
                    
                    <label>Chave PIX</label>
                    <input type="text" id="withdrawKey" class="dark-input" placeholder="CPF, Email ou Aleatória">
                `;
            }
        }
    }

    if(btnWithdraw) {
        // Remove listeners antigos
        const newBtn = btnWithdraw.cloneNode(true);
        btnWithdraw.parentNode.replaceChild(newBtn, btnWithdraw);
        
        newBtn.addEventListener('click', async () => {
            const amountInput = document.getElementById('withdrawAmount');
            const keyInput = document.getElementById('withdrawKey');
            
            if(!amountInput || !keyInput) return;

            const amount = parseFloat(amountInput.value);
            const key = keyInput.value;

            if(!amount || amount < 10) {
                showToast('Valor mínimo de saque: R$ 10,00', 'error');
                return;
            }

            if(amount > userProfile.balance) {
                showToast('Saldo insuficiente.', 'error');
                return;
            }

            if(key.length < 5) {
                showToast('Digite uma chave PIX válida.', 'error');
                return;
            }

            newBtn.disabled = true;
            newBtn.textContent = 'Processando...';

            // 1. Débito Seguro via RPC (Usa lógica de aposta para debitar)
            // Se 'place_bet' não existir, usa 'add_balance' com valor negativo
            // Vamos usar o RPC 'place_bet' que já tem check de saldo
            const { data: newBalance, error } = await supabase
                .rpc('place_bet', { p_id: userProfile.id, amount: amount });

            if (error) {
                showToast('Erro ao processar saque (Saldo insuficiente?).', 'error');
                newBtn.disabled = false;
                newBtn.textContent = 'Solicitar Saque';
                return;
            }

            // 2. Registra Transação
            await supabase.from('transactions').insert({
                player_id: userProfile.id,
                type: 'WITHDRAW',
                amount: amount,
                status: 'pending',
                external_id: key // Salva a chave pix aqui
            });

            // 3. Atualiza UI
            userProfile.balance = newBalance;
            updateUserUI();
            amountInput.value = '';
            
            showToast('Saque solicitado com sucesso!', 'success');
            newBtn.disabled = false;
            newBtn.textContent = 'Solicitar Saque';
        });
    }
}

// --- DEPÓSITO ---
function setupDepositInteraction() {
    const manualInput = document.getElementById('manualDepositInput');
    const actionBtn = document.getElementById('btnDepositAction');
    const container = document.getElementById('depositAmounts');

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
                showToast('Erro interno.', 'error');
                actionBtn.disabled = false;
                actionBtn.textContent = "TENTAR NOVAMENTE";
                return;
            }

            const cleanCpf = userData.cpf ? userData.cpf.replace(/\D/g, '') : "00000000000";
            const cleanPhone = userData.phone ? userData.phone.replace(/\D/g, '') : "00000000000";
            
            const payload = {
                "amount": amountCents, 
                "offer_hash": OFFER_HASH_DEFAULT, 
                "payment_method": "pix",
                "installments": 1, 
                "customer": {
                    name: userData.name || "Cliente GOW",
                    email: userData.email || "email@temp.com",
                    document: cleanCpf,
                    phone_number: cleanPhone,
                    street_name: "Rua Digital", 
                    street_number: "100", 
                    neighborhood: "Centro", 
                    zip_code: "01001000", 
                    city: "Sao Paulo", 
                    state: "SP"
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
                    await supabase.from('transactions')
                        .update({ external_id: apiData.hash })
                        .eq('id', txn.id);

                    showPixModal(apiData, amount);
                    monitorPayment(apiData.hash, amount, txn.id);
                } else {
                    const msg = apiData.errors ? Object.values(apiData.errors).flat().join(' ') : (apiData.message || 'Verifique seus dados.');
                    showToast(`Erro no PIX: ${msg}`, 'error');
                }

            } catch(e) {
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
        if (Date.now() - startTime > 1200000) { 
            clearInterval(pollingInterval);
            return;
        }
        try {
            const response = await fetch(`${API_INVICTUS_ENDPOINT}/public/v1/transactions/${externalHash}?api_token=${API_INVICTUS_TOKEN}`);
            const data = await response.json();

            if (['PAID', 'paid', 'COMPLETED'].includes(data.status)) {
                clearInterval(pollingInterval);
                
                const { data: newBal } = await supabase.rpc('add_balance', { p_id: userProfile.id, amount: amount });
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
