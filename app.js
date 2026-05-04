const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==================== ДАННЫЕ ====================
let userData = {
    name: '',
    phone: '',
    visits: [],
    bonusPoints: 0,
    freeHours: 0,
    spinsAvailable: 0,
    totalVisits: 0,
    referralCode: '',
    referredBy: null,
    pendingBonuses: [] // Бонусы, ожидающие подтверждения
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
    if (ref && !userData.referredBy) {
        userData.referredBy = ref;
    }

    // УБРАНА ВЕЧНАЯ ЗАГРУЗКА — сразу показываем экран
    document.getElementById('splash')?.classList.remove('active');

    if (!userData.name) {
        document.getElementById('register').classList.add('active');
    } else {
        document.getElementById('main').classList.add('active');
        updateProfile();
    }

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

    sendToBot('🆕 Регистрация', {
        Имя: userData.name,
        Телефон: userData.phone,
        Telegram: tg.initDataUnsafe?.user?.username || 'Не указан'
    });
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

    ['bookDate', 'bookTime', 'bookDuration', 'extraInstructor', 'extraRescue'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updatePrice);
    });

    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
}

// ==================== ПРОФИЛЬ ====================
function updateProfile() {
    document.getElementById('userAvatar').textContent = userData.name ? userData.name[0].toUpperCase() : '👤';
    document.getElementById('bonusPoints').textContent = userData.bonusPoints;
    document.getElementById('visitCount').textContent = userData.totalVisits;
    document.getElementById('freeHours').textContent = userData.freeHours;
    document.getElementById('refLink').value = `https://t.me/openwaters_sup_bot?start=${userData.referralCode}`;

    // Прогресс 5+1 (1 бесплатный час)
    const visitsForProgress = userData.totalVisits % 6;
    const progress = visitsForProgress === 0 && userData.totalVisits > 0 ? 100 : (visitsForProgress / 5) * 100;
    document.getElementById('progressFill').style.width = Math.min(progress, 100) + '%';

    document.querySelectorAll('.step').forEach((step, i) => {
        step.classList.toggle('active', i < visitsForProgress || (visitsForProgress === 0 && userData.totalVisits > 0 && i === 5));
    });

    updateHistory();
    updateWheelState();
}

function updateHistory() {
    const el = document.getElementById('visitHistory');
    if (!userData.visits.length) {
        el.innerHTML = '<p class="empty">Пока нет посещений</p>';
        return;
    }

    el.innerHTML = userData.visits.slice().reverse().map(v => {
        const statusBadge = v.status === 'pending' 
            ? '<span class="badge badge-pending">⏳ На подтверждении</span>'
            : v.isFree 
                ? '<span class="badge badge-free">🎁 1ч бесплатно</span>'
                : '<span class="badge badge-paid">' + v.price.toLocaleString() + ' ₽</span>';

        return `
            <div class="history-item">
                <div>
                    <div class="date">${v.date.split(' ')[0]}</div>
                    <div class="info">${v.duration}ч · ${v.supCount} SUP</div>
                </div>
                ${statusBadge}
            </div>
        `;
    }).join('');
}

function updateWheelState() {
    document.getElementById('spinsLeft').textContent = `Осталось прокруток: ${userData.spinsAvailable}`;
    const btn = document.getElementById('spinBtn');
    btn.disabled = userData.spinsAvailable <= 0;
    btn.style.opacity = userData.spinsAvailable <= 0 ? '0.5' : '1';
}

// ==================== КОЛЕСО УДАЧИ (ИСПРАВЛЕНО) ====================
let isSpinning = false;
let currentRotation = 0;

function spinWheel() {
    if (isSpinning || userData.spinsAvailable <= 0) return;

    isSpinning = true;
    userData.spinsAvailable--;
    saveUserData();
    updateWheelState();

    const wheel = document.getElementById('wheel');
    const resultEl = document.getElementById('wheelResult');
    resultEl.textContent = '';
    resultEl.style.background = 'rgba(255,255,255,0.9)';

    // Призы с правильными индексами (0-7, по часовой стрелке сверху)
    const prizes = [
        { name: '50 баллов', value: 50, type: 'points', index: 0 },      // 0° — верхний сегмент
        { name: 'Скидка 10%', value: 10, type: 'discount', index: 1 },   // 45°
        { name: '100 баллов', value: 100, type: 'points', index: 2 },     // 90°
        { name: 'Бесплатный час!', value: 1, type: 'freeHour', index: 3 }, // 135°
        { name: 'Скидка 20%', value: 20, type: 'discount', index: 4 },   // 180°
        { name: '200 баллов', value: 200, type: 'points', index: 5 },    // 225°
        { name: 'Мерч 🧢', value: 1, type: 'merch', index: 6 },          // 270°
        { name: 'Попробуй ещё', value: 0, type: 'none', index: 7 }      // 315°
    ];

    // Случайный выбор приза
    const selectedPrize = prizes[Math.floor(Math.random() * prizes.length)];

    // Вычисляем угол для приземления на выбранный сегмент
    // Указатель вверху (0°), колесо крутится ПРОТИВ часовой стрелки
    // Чтобы сегмент оказался сверху, нужно повернуть колесо на: 360 - (index * 45) + случайное смещение внутри сегмента
    const baseAngle = 360 - (selectedPrize.index * 45);
    const randomOffset = 10 + Math.random() * 25; // случайное смещение внутри сегмента (10°-35° от края)
    const fullRotations = 5 + Math.floor(Math.random() * 3); // 5-7 полных оборотов

    const targetAngle = (fullRotations * 360) + baseAngle + randomOffset;
    currentRotation = targetAngle;

    wheel.style.transform = `rotate(-${targetAngle}deg)`;

    setTimeout(() => {
        isSpinning = false;

        // Начисление приза
        let msg = '';
        let bgColor = '#E8F5E9';

        switch(selectedPrize.type) {
            case 'points':
                // Баллы добавляются в pending (ждут подтверждения админом)
                userData.pendingBonuses.push({
                    type: 'points',
                    value: selectedPrize.value,
                    date: new Date().toISOString(),
                    status: 'pending'
                });
                msg = `🎉 ${selectedPrize.name}! Ожидают подтверждения: +${selectedPrize.value} баллов`;
                break;

            case 'discount':
                userData.pendingBonuses.push({
                    type: 'discount',
                    value: selectedPrize.value,
                    date: new Date().toISOString(),
                    status: 'pending'
                });
                msg = `🎉 Скидка ${selectedPrize.value}%! Активируется администратором`;
                break;

            case 'freeHour':
                userData.pendingBonuses.push({
                    type: 'freeHour',
                    value: 1,
                    date: new Date().toISOString(),
                    status: 'pending'
                });
                msg = `🎉 Бесплатный час! Администратор активирует при следующем визите`;
                break;

            case 'merch':
                msg = `🎉 Мерч Open Waters! Покажите это окно на точке 🧢`;
                bgColor = '#FFF3E0';
                break;

            case 'none':
                msg = `😅 Попробуйте в следующий раз! Удача близко`;
                bgColor = '#FFEBEE';
                break;
        }

        resultEl.textContent = msg;
        resultEl.style.background = bgColor;

        saveUserData();
        updateProfile();

        sendToBot('🎰 Колесо удачи', {
            Пользователь: userData.name,
            Телефон: userData.phone,
            Выигрыш: selectedPrize.name,
            Тип: selectedPrize.type,
            Статус: 'Ожидает подтверждения'
        });

    }, 5200); // 5.2 секунды = время анимации + небольшой запас
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
        ['priceSup', 'priceExtras', 'priceTotal'].forEach(id => {
            document.getElementById(id).textContent = '0 ₽';
        });
        document.getElementById('freeHourRow').style.display = 'none';
        return;
    }

    const isWeekend = [0, 6].includes(new Date(date).getDay());
    const p = isWeekend ? PRICES.weekend : PRICES.weekday;

    let supPrice = 0;
    if (duration <= 4) {
        supPrice = p[duration] * count;
    } else {
        supPrice = (p[4] + (duration - 4) * p.extra) * count;
    }

    let extrasPrice = 0;
    if (instructor) extrasPrice += EXTRAS.instructor * duration;
    if (rescue) extrasPrice += EXTRAS.rescue * duration;

    // Проверка бесплатного часа (6-е посещение = 1 час бесплатно)
    const isSixthVisit = (userData.totalVisits + 1) % 6 === 0;
    let freeHourDiscount = 0;

    if (isSixthVisit && duration >= 1) {
        // Стоимость 1 часа для 1 SUP
        const hourPrice = isWeekend ? PRICES.weekend[1] : PRICES.weekday[1];
        freeHourDiscount = hourPrice * count;

        document.getElementById('freeHourRow').style.display = 'flex';
        document.getElementById('freeHourDiscount').textContent = '-' + freeHourDiscount.toLocaleString() + ' ₽';
    } else {
        document.getElementById('freeHourRow').style.display = 'none';
    }

    const total = Math.max(0, supPrice + extrasPrice - freeHourDiscount);

    document.getElementById('priceSup').textContent = supPrice.toLocaleString() + ' ₽';
    document.getElementById('priceExtras').textContent = extrasPrice.toLocaleString() + ' ₽';
    document.getElementById('priceTotal').textContent = total.toLocaleString() + ' ₽';
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

    const totalText = document.getElementById('priceTotal').textContent;
    const total = parseInt(totalText.replace(/\s/g, '').replace('₽', ''));

    const isWeekend = [0, 6].includes(new Date(date).getDay());
    const isSixthVisit = (userData.totalVisits + 1) % 6 === 0;

    // Расчёт скидки за бесплатный час
    let freeHourDiscount = 0;
    if (isSixthVisit && duration >= 1) {
        const hourPrice = isWeekend ? PRICES.weekend[1] : PRICES.weekday[1];
        freeHourDiscount = hourPrice * count;
    }

    const bookingData = {
        date: `${date} ${time}`,
        duration,
        supCount: count,
        instructor,
        rescue,
        notes,
        price: total,
        isFree: isSixthVisit,
        freeHourDiscount,
        status: 'pending', // Ожидает подтверждения администратором
        userName: userData.name,
        userPhone: userData.phone,
        telegramId: tg.initDataUnsafe?.user?.id || 'unknown'
    };

    // Добавляем в историю как "ожидает подтверждения"
    userData.visits.push(bookingData);
    userData.totalVisits++;

    if (isSixthVisit) {
        userData.freeHours++;
    }

    // +1 прокрутка колеса (даётся сразу, но баллы из колеса — только после подтверждения)
    userData.spinsAvailable++;

    // Бонусы за бронирование НЕ начисляются автоматически — только после подтверждения
    // Они добавляются в pendingBonuses
    const pendingBonus = Math.floor(total * 0.1);
    if (pendingBonus > 0) {
        userData.pendingBonuses.push({
            type: 'booking',
            value: pendingBonus,
            date: new Date().toISOString(),
            status: 'pending',
            bookingDate: bookingData.date
        });
    }

    saveUserData();
    updateProfile();

    // Отправка в бот
    sendToBot('📅 НОВАЯ ЗАЯВКА (требует подтверждения)', {
        '👤 Имя': userData.name,
        '📱 Телефон': userData.phone,
        '📅 Дата': `${date} в ${time}`,
        '⏱ Длительность': `${duration} час(а)`,
        '🏄 SUP': `${count} шт.`,
        '🎯 Инструктор': instructor ? 'Да' : 'Нет',
        '🛟 Спасатели': rescue ? 'Да' : 'Нет',
        '📝 Пожелания': notes || 'Нет',
        '💰 Сумма': `${total.toLocaleString()} ₽`,
        '🎁 Бонус': isSixthVisit ? `1 час бесплатно (-${freeHourDiscount.toLocaleString()} ₽)` : 'Нет',
        '⏳ Статус': 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ'
    });

    tg.showAlert(
        isSixthVisit 
            ? '🎉 Заявка отправлена! У вас 1 час бесплатно! Администратор подтвердит бронирование.'
            : '✅ Заявка отправлена! Администратор подтвердит бронирование и начислит бонусы.'
    );

    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
}

// ==================== ПОДТВЕРЖДЕНИЕ БОНУСОВ (для администратора) ====================
// Эта функция вызывается, когда админ подтверждает посещение через бота
function confirmVisit(visitIndex) {
    const visit = userData.visits[visitIndex];
    if (!visit || visit.status !== 'pending') return;

    visit.status = 'confirmed';

    // Начисляем бонусы, которые были в ожидании
    const relatedBonuses = userData.pendingBonuses.filter(
        b => b.status === 'pending' && 
        (b.bookingDate === visit.date || !b.bookingDate)
    );

    relatedBonuses.forEach(bonus => {
        bonus.status = 'confirmed';
        if (bonus.type === 'points') {
            userData.bonusPoints += bonus.value;
        } else if (bonus.type === 'freeHour') {
            userData.freeHours += bonus.value;
        }
        // discount и merch обрабатываются отдельно
    });

    saveUserData();
    updateProfile();

    tg.showAlert('✅ Посещение подтверждено! Бонусы начислены.');
}

// ==================== РЕФЕРАЛКА ====================
function copyRefLink() {
    const input = document.getElementById('refLink');
    input.select();
    document.execCommand('copy');
    tg.showAlert('📋 Ссылка скопирована!');
}

function shareRef() {
    const link = document.getElementById('refLink').value;
    const text = `🏄 Катайся на SUP в Строгино! Open Waters 🌊\nПриходи по моей ссылке и получи бонусы!`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

// ==================== МОДАЛКА ====================
function showCorporate() { 
    document.getElementById('corporateModal').classList.add('active'); 
}

function closeModal() { 
    document.getElementById('corporateModal').classList.remove('active'); 
}

// ==================== УТИЛИТЫ ====================
function saveUserData() { 
    localStorage.setItem('openWatersUser', JSON.stringify(userData)); 
}

function loadUserData() {
    const saved = localStorage.getItem('openWatersUser');
    if (saved) {
        const parsed = JSON.parse(saved);
        userData = { ...userData, ...parsed };
        // Миграция старых данных
        if (!userData.pendingBonuses) userData.pendingBonuses = [];
        if (!userData.freeHours) userData.freeHours = userData.freeSupCount || 0;
    }
}

function sendToBot(title, data) {
    const payload = {
        type: 'booking',
        title,
        data,
        user: {
            name: userData.name,
            phone: userData.phone,
            telegramId: tg.initDataUnsafe?.user?.id
        },
        timestamp: new Date().toISOString()
    };

    tg.sendData(JSON.stringify(payload));
}

// ==================== ДЛЯ АДМИНА: обработка подтверждения из бота ====================
// Когда админ нажимает "Подтвердить" в Telegram, бот отправляет callback
// Это можно обработать через tg.onEvent('mainButtonClicked') или через web_app_data

// Обработка данных от бота (если админ отправляет команду подтверждения)
if (tg.initDataUnsafe?.start_param?.startsWith('confirm_')) {
    const visitId = tg.initDataUnsafe.start_param.replace('confirm_', '');
    // Найти и подтвердить визит
    const visitIndex = userData.visits.findIndex(v => v.date === visitId);
    if (visitIndex !== -1) {
        confirmVisit(visitIndex);
    }
}
