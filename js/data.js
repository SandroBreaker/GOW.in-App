
// Carrega dados iniciais ou usa padrão
// Atualizado para marca GOW.in
const savedProfile = localStorage.getItem('gowin_profile');
const savedTasks = localStorage.getItem('gowin_tasks');

const defaultProfile = {
    id: "290111437",
    username: "tskq6476",
    balance: 0.00, // Saldo inicial zerado
    vipLevel: 0
};

const defaultTasks = [
    { title: "Bônus de Boas Vindas", reward: 5.00, status: "Receber" },
    { title: "Verificar E-mail", reward: 2.00, status: "Receber" },
    { title: "Primeiro Depósito", reward: 10.00, status: "Receber" }
];

export let userProfile = savedProfile ? JSON.parse(savedProfile) : defaultProfile;
export let tasks = savedTasks ? JSON.parse(savedTasks) : defaultTasks;

export function saveProfileData() {
    localStorage.setItem('gowin_profile', JSON.stringify(userProfile));
}

export function saveTasksData() {
    localStorage.setItem('gowin_tasks', JSON.stringify(tasks));
}

export const gamesList = [
    // --- JOGOS LOCAIS (gameList) ---
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
        img: "https://images.hdqwalls.com/wallpapers/elden-ring-4k-2022-5k.jpg", 
        provider: "EXCLUSIVO", 
        url: "gameList/elden ring/index.html" 
    },
    // ------------------------------

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
