
import { renderGames, renderDeposit, renderTasks, updateUserUI, switchPage, showToast, animateBalanceUI, openGameLauncher, closeGameLauncher } from './ui.js';
import { userProfile, tasks, gamesList, saveProfileData, saveTasksData } from './data.js';

// --- CONFIGURAÇÃO INVICTUS ---
const API_INVICTUS_TOKEN = "wsxiP0Dydmf2TWqjOn1iZk9CfqwxdZBg8w5eQVaTLDWHnTjyvuGAqPBkAiGU";
const API_INVICTUS_ENDPOINT = "https://api.invictuspay.app.br/api";
const OFFER_HASH_DEFAULT = "png8aj6v6p"; 

// Variável global para controlar o intervalo de verificação
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    renderGames('gameGrid');
    renderDeposit('depositAmounts');
    renderTasks('taskList');
    updateUserUI();

    setupNavigation();
    setupDepositInteraction(); // Agora contém lógica Invictus + Polling
    setupWithdrawalLogic();
    setupGameInteraction();
    setupInputMasks();
    setupTaskInteraction();
    setupCategoryFilter();
    setupLogout();
});

// --- HELPER MASKS (Compartilhado) ---
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
    },
    cep: (v) => {
        v = v.replace(/\D/g, "");
        if (v.length > 8) v = v.substring(0, 8);
        v = v.replace(/^(\d{5})(\d)/, "$1-$2");
        return v;
    }
};

// --- CATEGORIAS ---
function setupCategoryFilter() {
    const catItems = document.querySelectorAll('.cat-item');
    const titleEl = document.getElementById('homeSectionTitle');
    const gridEl = document.getElementById('gameGrid');

    catItems.forEach(item => {
        item.addEventListener('click', () => {
            catItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const cat = item.dataset.cat;
            const catName = item.textContent.trim();
            gridEl.style.opacity = '0.5';
            setTimeout(() => {
                gridEl.style.opacity = '1';
                titleEl.innerHTML = `<i class="${item.querySelector('i').className}"></i> ${catName}`;
            }, 300);
        });
    });
}

// --- LOGOUT ---
function setupLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            if(confirm('Tem certeza que deseja sair?')) {
                showToast('Saindo...', 'info');
                setTimeout(() => { location.reload(); }, 1000);
            }
        });
    }
}

// --- JOGOS ---
function setupGameInteraction() {
    document.getElementById('gameGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        if(card) {
            const gameName = card.dataset.game;
            const gameData = gamesList.find(g => g.name === gameName);
            const gameUrl = gameData ? gameData.url : null;
            openGameLauncher(gameName, gameUrl);
        }
    });

    const closeBtn = document.getElementById('btnCloseModal');
    if(closeBtn) closeBtn.addEventListener('click', closeGameLauncher);
}

// --- TAREFAS ---
function setupTaskInteraction() {
    const list = document.getElementById('taskList');
    if(list) {
        list.addEventListener('click', (e) => {
            if(e.target.classList.contains('btn-claim-task')) {
                const index = e.target.dataset.index;
                const task = tasks[index];
                if(task.status === "Receber") {
                    userProfile.balance += task.reward;
                    task.status = "Resgatado";
                    saveProfileData();
                    saveTasksData();
                    animateBalanceUI(userProfile.balance);
                    showToast(`Bônus de R$ ${task.reward.toFixed(2)} recebido!`, 'success');
                    renderTasks('taskList');
                }
            }
        });
    }
}

// --- MÁSCARAS GERAIS ---
function setupInputMasks() {
    const apply = (id, fn) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => e.target.value = fn(e.target.value));
    };
    apply('inputCpf', Masker.cpf);
    apply('inputTel', Masker.phone);
    apply('inputCep', Masker.cep);
    // Mascaras do Depósito
    apply('depCpf', Masker.cpf);
    apply('depPhone', Masker.phone);
    apply('depCep', Masker.cep);
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
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('fa-spin');
            setTimeout(() => refreshBtn.classList.remove('fa-spin'), 1000);
            updateUserUI();
            showToast('Saldo atualizado!', 'info');
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

// =========================================================
// 💸 DEPÓSITO - LÓGICA INVICTUS + POLLING
// =========================================================
function setupDepositInteraction() {
    const manualInput = document.getElementById('manualDepositInput');
    const actionBtn = document.getElementById('btnDepositAction');
    const container = document.getElementById('depositAmounts');
    const msgEl = document.getElementById('depositMsg');

    // Elementos do Form
    const inputs = {
        name: document.getElementById('depName'),
        cpf: document.getElementById('depCpf'),
        phone: document.getElementById('depPhone'),
        email: document.getElementById('depEmail'),
        cep: document.getElementById('depCep'),
        number: document.getElementById('depNumber'),
        street: document.getElementById('depStreet'),
        district: document.getElementById('depDistrict'),
        city: document.getElementById('depCity'),
        state: document.getElementById('depState'),
        preview: document.getElementById('depAddressPreview'),
        loader: document.getElementById('depCepLoader')
    };

    // 1. Busca CEP Automática (ViaCEP)
    if(inputs.cep) {
        inputs.cep.addEventListener('blur', async () => {
            const cep = inputs.cep.value.replace(/\D/g, '');
            if(cep.length === 8) {
                inputs.loader.style.display = 'block';
                try {
                    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await r.json();
                    if(!data.erro) {
                        inputs.street.value = data.logradouro;
                        inputs.district.value = data.bairro;
                        inputs.city.value = data.localidade;
                        inputs.state.value = data.uf;
                        inputs.preview.style.display = 'block';
                        inputs.preview.innerHTML = `📍 ${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`;
                        inputs.number.focus();
                    }
                } catch(e) { console.error(e); } 
                finally { inputs.loader.style.display = 'none'; }
            }
        });
    }

    // 2. Seleção de Valor
    const validate = (val) => {
        const num = parseFloat(val);
        if(!num || num < 15) {
            actionBtn.disabled = true;
            actionBtn.textContent = 'Mínimo R$ 15,00';
            actionBtn.style.background = '#555';
        } else {
            actionBtn.disabled = false;
            actionBtn.textContent = `Gerar PIX R$ ${num.toFixed(2)}`;
            actionBtn.style.background = 'var(--accent)';
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

    // 3. AÇÃO DE PAGAMENTO (Call API)
    if(actionBtn) {
        actionBtn.addEventListener('click', async () => {
            // Validações Básicas
            if(!inputs.name.value || inputs.cpf.value.length < 14 || inputs.phone.value.length < 14 || !inputs.email.value || !inputs.cep.value || !inputs.number.value) {
                showToast('Preencha todos os dados corretamente!', 'error');
                // Scroll suave para o form
                document.querySelector('.checkout-form-container').scrollIntoView({ behavior: 'smooth' });
                return;
            }

            const amount = parseFloat(manualInput.value);
            const amountCents = Math.round(amount * 100);

            // UI Loading
            actionBtn.disabled = true;
            actionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            msgEl.textContent = "Conectando gateway seguro...";

            // Payload Invictus
            const customer = {
                name: inputs.name.value,
                email: inputs.email.value,
                document: inputs.cpf.value,
                phone_number: inputs.phone.value,
                street_name: inputs.street.value || "Rua Geral",
                street_number: inputs.number.value,
                neighborhood: inputs.district.value || "Centro",
                zip_code: inputs.cep.value,
                city: inputs.city.value || "Cidade",
                state: inputs.state.value || "UF"
            };

            const payload = {
                "amount": amountCents, 
                "offer_hash": OFFER_HASH_DEFAULT, 
                "payment_method": "pix", 
                "customer": customer,
                "cart": [{
                    "product_hash": OFFER_HASH_DEFAULT,
                    "title": `Recarga GOW.in - ${amount}`,
                    "price": amountCents,
                    "quantity": 1,
                    "operation_type": 1, 
                    "tangible": false
                }],
                "installments": 1,
                "transaction_origin": "api"
            };

            try {
                const response = await fetch(`${API_INVICTUS_ENDPOINT}/public/v1/transactions?api_token=${API_INVICTUS_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();

                if(response.ok && data.payment_method === 'pix' && data.pix) {
                    msgEl.textContent = "";
                    
                    // Exibe Modal
                    showPixModal(data, amount);
                    
                    // Inicia Monitoramento (Polling)
                    monitorPayment(data.hash, amount);
                    
                } else {
                    const err = data.errors ? Object.values(data.errors).flat().join(', ') : (data.message || 'Erro desconhecido');
                    showToast('Erro: ' + err, 'error');
                    msgEl.textContent = "Falha na geração.";
                }

            } catch(e) {
                console.error(e);
                showToast('Erro de conexão com servidor', 'error');
            } finally {
                actionBtn.disabled = false;
                actionBtn.textContent = `Gerar PIX R$ ${amount.toFixed(2)}`;
            }
        });
    }
}

// 4. LÓGICA DE MONITORAMENTO (POLLING)
function monitorPayment(transactionHash, amount) {
    if(pollingInterval) clearInterval(pollingInterval);
    
    const startTime = Date.now();
    const timeout = 20 * 60 * 1000; // 20 minutos em ms

    // Verifica a cada 5 segundos
    pollingInterval = setInterval(async () => {
        
        // Verifica Timeout
        if (Date.now() - startTime > timeout) {
            clearInterval(pollingInterval);
            return;
        }

        try {
            const response = await fetch(`${API_INVICTUS_ENDPOINT}/public/v1/transactions/${transactionHash}?api_token=${API_INVICTUS_TOKEN}`);
            const data = await response.json();

            // Status aceitos como pagos
            if (['PAID', 'paid', 'COMPLETED', 'completed'].includes(data.status)) {
                clearInterval(pollingInterval); // Para o loop
                
                // Credita Saldo
                userProfile.balance += amount;
                saveProfileData();
                animateBalanceUI(userProfile.balance);
                
                // Fecha Modal e Mostra Sucesso
                const modal = document.getElementById('pixModal');
                if(modal) modal.style.display = 'none';
                
                showToast(`Pagamento de R$ ${amount.toFixed(2)} CONFIRMADO!`, 'success');
                switchPage('home');
            }
        } catch (error) {
            console.error("Erro ao verificar status do pagamento", error);
            // Não para o loop em caso de erro de rede temporário, tenta de novo em 5s
        }
    }, 5000);
}


// 5. Modal de PIX (Renderização)
function showPixModal(data, amount) {
    const modal = document.getElementById('pixModal');
    const amountEl = document.getElementById('modalAmount');
    const hashEl = document.getElementById('modalHash');
    const textarea = document.getElementById('pixCodeTextarea');
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrImage = document.getElementById('qrCodeImage');
    const btnCopy = document.getElementById('copyPixButton');
    const btnClose = document.getElementById('btnClosePixModal');

    amountEl.textContent = `R$ ${amount.toFixed(2)}`;
    hashEl.textContent = `ID Transação: ${data.hash}`;
    textarea.value = data.pix.pix_qr_code;

    if (data.pix.qr_code_base64) {
        qrImage.src = `data:image/png;base64,${data.pix.qr_code_base64}`;
        qrContainer.style.display = 'block';
    } else {
        qrContainer.style.display = 'none';
    }

    modal.style.display = 'flex';

    // Eventos do Modal
    const closeModal = () => { 
        modal.style.display = 'none'; 
        // IMPORTANTE: Para o polling se o usuário fechar o modal
        if(pollingInterval) clearInterval(pollingInterval);
    };
    
    btnClose.onclick = closeModal;
    
    btnCopy.onclick = () => {
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(textarea.value);
        
        const originalText = btnCopy.innerHTML;
        btnCopy.innerHTML = `<i class="fas fa-check"></i> Copiado!`;
        btnCopy.style.background = "#00c853";
        setTimeout(() => {
            btnCopy.innerHTML = originalText;
            btnCopy.style.background = ""; 
        }, 2000);
    };
}

// --- SAQUE ---
function setupWithdrawalLogic() {
    const btnCep = document.getElementById('btnBuscarCep');
    const inpCep = document.getElementById('inputCep');
    const inpEnd = document.getElementById('inputEndereco');

    if(btnCep) {
        btnCep.addEventListener('click', async () => {
            const cep = inpCep.value.replace(/\D/g, '');
            if(cep.length !== 8) return showToast('CEP Inválido', 'error');
            
            btnCep.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const req = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await req.json();
                if(data.erro) throw new Error();
                inpEnd.value = `${data.logradouro}, ${data.bairro}`;
                showToast('Endereço encontrado!', 'success');
            } catch(e) {
                showToast('CEP não encontrado', 'error');
            } finally {
                btnCep.innerHTML = '<i class="fas fa-search"></i>';
            }
        });
    }

    const btnWithdraw = document.getElementById('btnRequestWithdraw');
    if(btnWithdraw) {
        btnWithdraw.addEventListener('click', () => {
            const withdrawAmount = 10.00;
            if(userProfile.balance < withdrawAmount) {
                showToast('Saldo insuficiente!', 'error');
                return;
            }
            btnWithdraw.disabled = true;
            btnWithdraw.textContent = 'Processando...';
            setTimeout(() => {
                userProfile.balance -= withdrawAmount;
                saveProfileData();
                animateBalanceUI(userProfile.balance);
                showToast('Saque de R$ 10,00 solicitado!', 'success');
                btnWithdraw.textContent = 'Solicitar Saque';
                btnWithdraw.disabled = false;
            }, 2000);
        });
    }
}
