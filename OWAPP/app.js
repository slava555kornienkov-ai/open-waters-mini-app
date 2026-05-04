const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==================== ДАННЫЕ ====================
let userData = {
    name: '', phone: '', visits: [], bonusPoints: 0,
    freeSupCount: 0, spinsAvailable: 0, totalVisits: 0,
    referralCode: '', referredBy: null
};

const PRICES = {
    weekend: { 1: 2000, 2: 3200, 3: 4200, 4: 5000, extra: 700 },
    weekday: { 1: 1700, 2: 2800, 3: 3800, 4: 4700, extra: 600 }
};

const EXTRAS = { instructor: 2000, rescue: 2500 };

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    if (!userData.referralCode) {
        userData.referralCode = 'OW' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && !userData.referredBy) userData.referredBy = ref;

    setTimeout(() => {
        document.getElementById('splash').classList.remove('active');
        if (!userData.name) {
            document.getElementById('register').classList.add('active');
        } else {
            document.getElementById('main').classList.add('active');
            updateProfile();
        }
    }, 2000);

    initTimeSlots();
    setupEventListeners();
    updatePrice();
});

// ==================== РЕГИСТРАЦИЯ ====================
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    userData.name = document.getElementById('regName').value.trim();
    userData.phone = document.getElementById('regPhone').value.trim();
    saveUserData();
    document.getElementById('register').classList.remove('active');
    document.getElementById('main').classList.add('active');
    updateProfile();
    sendToBot('🆕 Регистрация', { Имя: userData.name, Телефон: userData.phone });
});

// ==================== НАВИГАЦИЯ ====================
function setupEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });
    ['bookDate','bookTime','bookDuration','extraInstructor','extraRescue'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updatePrice);
    });
    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
}

// ==================== ПРОФИЛЬ ====================
function updateProfile() {
    document.getElementById('userAvatar').textContent = userData.name ? userData.name[0].toUpperCase() : '👤';
    document.getElementById('bonusPoints').textContent = userData.bonusPoints;
    document.getElementById('visitCount').textContent = userData.totalVisits;
    document.getElementById('freeSup').textContent = userData.freeSupCount;
    document.getElementById('refLink').value = `https://t.me/openwaters_sup_bot?start=${userData.referralCode}`;

    const progress = Math.min((userData.totalVisits % 6) / 5 * 100, 100);
    document.getElementById('progressFill').style.width = progress + '%';
    document.querySelectorAll('.step').forEach((step, i) => {
        step.classList.toggle('active', i < (userData.totalVisits % 6));
    });

    updateHistory();
    document.getElementById('spinsLeft').textContent = `Осталось прокруток: ${userData.spinsAvailable}`;
    document.getElementById('spinBtn').disabled = userData.spinsAvailable <= 0;
    document.getElementById('spinBtn').style.opacity = userData.spinsAvailable <= 0 ? '0.5' : '1';
}

function updateHistory() {
    const el = document.getElementById('visitHistory');
    if (!userData.visits.length) {
        el.innerHTML = '<p class="empty">Пока нет посещений</p>';
        return;
    }
    el.innerHTML = userData.visits.slice().reverse().map(v => `
        <div class="history-item">
            <div>
                <div class="date">${v.date.split(' ')[0]}</div>
                <div class="info">${v.duration}ч · ${v.supCount} SUP</div>
            </div>
            <span class="badge ${v.isFree ? 'badge-free' : 'badge-paid'}">${v.isFree ? '🎁 Бесплатно' : v.price + ' ₽'}</span>
        </div>
    `).join('');
}

// ==================== КОЛЕСО УДАЧИ ====================
let isSpinning = false;
function spinWheel() {
    if (isSpinning || userData.spinsAvailable <= 0) return;
    isSpinning = true;
    userData.spinsAvailable--;
    saveUserData();
    updateProfile();

    const prizes = [
        { name: '50 баллов', value: 50, type: 'points' },
        { name: 'Скидка 10%', value: 10, type: 'discount' },
        { name: '100 баллов', value: 100, type: 'points' },
        { name: 'Бесплатный час!', value: 1, type: 'freeHour' },
        { name: 'Скидка 20%', value: 20, type: 'discount' },
        { name: '200 баллов', value: 200, type: 'points' },
        { name: 'Мерч 🧢', value: 1, type: 'merch' },
        { name: 'Попробуй ещё', value: 0, type: 'none' }
    ];
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const prize = prizes[prizeIndex];

    document.getElementById('wheel').style.transform = `rotate(${1800 + prizeIndex * 45 + 22.5}deg)`;

    setTimeout(() => {
        isSpinning = false;
        let msg = `🎉 ${prize.name}!`;
        if (prize.type === 'points') {
            userData.bonusPoints += prize.value;
            msg += ` +${prize.value} баллов`;
        }
        document.getElementById('wheelResult').textContent = msg;
        document.getElementById('wheelResult').style.background = prize.type === 'none' ? '#FFEBEE' : '#E8F5E9';
        saveUserData();
        updateProfile();
        sendToBot('🎰 Колесо удачи', { Пользователь: userData.name, Выигрыш: prize.name });
    }, 4000);
}

// ==================== СЧЁТЧИК SUP ====================
function changeCount(delta) {
    let count = parseInt(document.getElementById('supCount').textContent) + delta;
    count = Math.max(1, Math.min(20, count));
    document.getElementById('supCount').textContent = count;
    updatePrice();
}

// ==================== РАСЧЁТ ЦЕНЫ ====================
function updatePrice() {
    const date = document.getElementById('bookDate').value;
    const duration = parseInt(document.getElementById('bookDuration').value) || 1;
    const count = parseInt(document.getElementById('supCount').textContent) || 1;
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;

    if (!date) {
        ['priceSup','priceExtras','priceTotal'].forEach(id => document.getElementById(id).textContent = '0 ₽');
        return;
    }

    const isWeekend = [0,6].includes(new Date(date).getDay());
    const p = isWeekend ? PRICES.weekend : PRICES.weekday;
    let supPrice = duration <= 4 ? p[duration] * count : (p[4] + (duration-4) * p.extra) * count;
    let extrasPrice = (instructor ? EXTRAS.instructor : 0) * duration + (rescue ? EXTRAS.rescue : 0) * duration;

    document.getElementById('priceSup').textContent = supPrice.toLocaleString() + ' ₽';
    document.getElementById('priceExtras').textContent = extrasPrice.toLocaleString() + ' ₽';
    document.getElementById('priceTotal').textContent = (supPrice + extrasPrice).toLocaleString() + ' ₽';
}

function initTimeSlots() {
    const select = document.getElementById('bookTime');
    for (let h = 10; h <= 20; h++) {
        select.add(new Option(`${h}:00`, `${h}:00`));
        if (h < 20) select.add(new Option(`${h}:30`, `${h}:30`));
    }
    document.getElementById('bookDate').min = new Date().toISOString().split('T')[0];
}

// ==================== БРОНИРОВАНИЕ ====================
function handleBooking(e) {
    e.preventDefault();
    const date = document.getElementById('bookDate').value;
    const time = document.getElementById('bookTime').value;
    const duration = parseInt(document.getElementById('bookDuration').value);
    const count = parseInt(document.getElementById('supCount').textContent);
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;
    const notes = document.getElementById('bookNotes').value;
    const total = parseInt(document.getElementById('priceTotal').textContent.replace(/\s/g, '').replace('₽',''));
    const isFree = (userData.totalVisits + 1) % 6 === 0;

    userData.visits.push({ date: `${date} ${time}`, duration, supCount: count, price: isFree ? 0 : total, isFree });
    userData.totalVisits++;
    if (isFree) userData.freeSupCount++;
    userData.spinsAvailable++;
    if (!isFree) userData.bonusPoints += Math.floor(total * 0.1);

    saveUserData();
    updateProfile();

    sendToBot('📅 Бронирование', {
        Имя: userData.name, Телефон: userData.phone,
        Дата: `${date} ${time}`, Длительность: `${duration}ч`,
        SUP: `${count} шт.`, Инструктор: instructor ? 'Да' : 'Нет',
        Спасатели: rescue ? 'Да' : 'Нет', Пожелания: notes || 'Нет',
        Сумма: isFree ? '🎁 БЕСПЛАТНО' : `${total.toLocaleString()} ₽`
    });

    tg.showAlert(isFree
        ? '🎉 Бесплатное посещение! Ждём вас на воде 🌊'
        : '✅ Заявка отправлена! Мы свяжемся для подтверждения.'
    );

    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
}

// ==================== РЕФЕРАЛКА ====================
function copyRefLink() {
    const input = document.getElementById('refLink');
    input.select();
    document.execCommand('copy');
    tg.showAlert('📋 Ссылка скопирована!');
}

function shareRef() {
    const text = `🏄 Катайся на SUP в Строгино! Open Waters 🌊\n${document.getElementById('refLink').value}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(document.getElementById('refLink').value)}&text=${encodeURIComponent(text)}`);
}

// ==================== МОДАЛКА ====================
function showCorporate() { document.getElementById('corporateModal').classList.add('active'); }
function closeModal() { document.getElementById('corporateModal').classList.remove('active'); }

// ==================== УТИЛИТЫ ====================
function saveUserData() { localStorage.setItem('openWatersUser', JSON.stringify(userData)); }
function loadUserData() {
    const saved = localStorage.getItem('openWatersUser');
    if (saved) userData = { ...userData, ...JSON.parse(saved) };
}
function sendToBot(title, data) {
    tg.sendData(JSON.stringify({ type: 'booking', title, data, user: { name: userData.name, phone: userData.phone } }));
}
