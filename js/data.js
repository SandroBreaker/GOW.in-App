
// STORE CENTRALIZADA
// Os dados agora são voláteis na memória e persistidos no Supabase via main.js

export let userProfile = {
    id: null,        // UUID do Supabase
    username: null,
    balance: 0.00,
    vipLevel: 0,
    fullData: {}     // email, cpf, phone
};

export const defaultTasks = [
    { id: 1, title: "Bônus de Boas Vindas", reward: 5.00, status: "Receber", type: 'welcome' },
    { id: 2, title: "Verificar E-mail", reward: 2.00, status: "Receber", type: 'verify_email' },
    { id: 3, title: "Primeiro Depósito", reward: 10.00, status: "Bloqueado", type: 'check_deposit' }
];

// Carrega tasks padrão. O status real será atualizado pelo main.js via Supabase
export let tasks = JSON.parse(JSON.stringify(defaultTasks));

export function saveTasksData() {
    // Mantido apenas para compatibilidade, a persistência real é no Supabase
}

export function resetTasksLocal() {
    tasks = JSON.parse(JSON.stringify(defaultTasks));
}

// Lista de Jogos (Estática)
export const gamesList = [
    { 
        id: 106, 
        name: "Aviator Pro", 
        img: "https://aviator-game.in/wp-content/uploads/2023/01/aviator-game-logo.png", 
        provider: "CRASH", 
        url: "gameList/aviator/index.html" 
    },
    { 
        id: 105, 
        name: "Dragon's Cave", 
        img: "https://img.freepik.com/premium-photo/dragon-protecting-treasure-chest-generative-ai_955884-2638.jpg", 
        provider: "NOVO", 
        url: "gameList/dragon-cave/index.html" 
    },
    { 
        id: 101, 
        name: "Akatsuki Bet", 
        img: "https://wallpaper-house.com/data/out/9/wallpaper2you_327454.jpg", 
        provider: "EXCLUSIVO", 
        url: "gameList/akatsuki/index.html" 
    },
    { 
        id: 102, 
        name: "Kaizoku Slot", 
        img: "https://images2.alphacoders.com/605/605194.jpg", 
        provider: "EXCLUSIVO", 
        url: "gameList/Kaizoku-slot/index.html" 
    },
    { 
        id: 103, 
        name: "God of War Slot", 
        img: "https://i.pinimg.com/736x/2c/f5/c6/2cf5c6a8332a22bf6f06c32f32b5b6f0.jpg", 
        provider: "EXCLUSIVO", 
        url: "gameList/god of war/index.html" 
    },
    { 
        id: 104, 
        name: "Elden Ring", 
        img: "assets/eldenring/capa.jpg", 
        provider: "EXCLUSIVO", 
        url: "gameList/elden ring/index.html" 
    },
    { id: 2, name: "Fortune Tiger", img: "https://placehold.co/100x100/orange/white?text=Tiger", provider: "PG" },
    { id: 3, name: "Fortune Dragon", img: "https://placehold.co/100x100/red/white?text=Dragon", provider: "PG" },
    { id: 4, name: "Fortune Snake", img: "https://placehold.co/100x100/green/white?text=Snake", provider: "PG" },
    { id: 5, name: "Fortune Ox", img: "https://placehold.co/100x100/gold/white?text=Ox", provider: "PG" },
    { id: 6, name: "Fortune Mouse", img: "https://placehold.co/100x100/blue/white?text=Mouse", provider: "PG" },
    { id: 7, name: "Gates of Olympus", img: "https://placehold.co/100x100/yellow/white?text=Olympus", provider: "PP" },
    { id: 8, name: "Sweet Bonanza", img: "https://placehold.co/100x100/pink/white?text=Bonanza", provider: "PP" },
    { id: 9, name: "Mines", img: "https://placehold.co/100x100/blue/white?text=Mines", provider: "SPRIBE" }
];

export const depositOptions = [
    { value: 15, bonus: 1.38 }, { value: 35, bonus: 1.58 }, { value: 55, bonus: 1.58 },
    { value: 155, bonus: 1.88 }, { value: 555, bonus: 5.88 }, { value: 1555, bonus: 15.88 }
];
