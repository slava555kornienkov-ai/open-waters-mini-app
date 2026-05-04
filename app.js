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
    pendingBonuses: [],
    isVerified: false
};

const PRICES = {
    weekend: { 1: 2000, 2: 3200, 3: 4200, 4: 5000, extra: 700 },
    weekday: { 1: 1700, 2: 2800, 3: 3800, 4: 4700, extra: 600 }
};

const EXTRAS = { instructor: 2000, rescue: 2500 };

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();

    // Генерация реферального кода при первом запуске
    if (!userData.referralCode) {
        userData.referralCode = 'OW' + Math.random().toString(36).substr(2, 6).toUpperCase();
        saveUserData();
    }

    // Проверка реферала из URL
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && !userData.referredBy) {
        userData.referredBy = ref;
        saveUserData();
    }

    // Показываем загрузку на 1.5 секунды, затем нужный экран
    setTimeout(() => {
        document.getElementById('loading').classList.remove('active');

        if (!userData.name || !userData.isVerified) {
            // Не зарегистрирован или не подтверждён — показываем регистрацию
            document.getElementById('register').classList.add('active');
        } else {
            // Уже зарегистрирован — показываем главный экран
            document.getElementById('main').classList.add('active');
            updateProfile();
        }
    }, 1500);

    initTimeSlots();
    setupEventListeners();
    updatePrice();
});

// ==================== РЕГИСТРАЦИЯ И SMS ====================
let tempPhone = '';
let tempName = '';
let smsCodeGenerated = '';

document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    tempName = document.getElementById('regName').value.trim();
    tempPhone = document.getElementById('regPhone').value.trim();

    if (!tempName || !tempPhone) {
        tg.showAlert('Заполните все поля');
        return;
    }

    // Генерируем код (в реальности — отправляем через SMS-шлюз)
    smsCodeGenerated = generateSMSCode();

    // Показываем экран подтверждения
    document.getElementById('register').classList.remove('active');
    document.getElementById('verify').classList.add('active');
    document.getElementById('verifyPhone').textContent = tempPhone;

    // Для теста — показываем код в alert (в продакшене — отправляем SMS)
    console.log('SMS код:', smsCodeGenerated);

    // Отправляем код в Telegram бот для тестирования
    sendToBot('📱 Код подтверждения SMS', {
        Телефон: tempPhone,
        Код: smsCodeGenerated,
        Примечание: 'В продакшене код отправляется через SMS-шлюз'
    });

    tg.showAlert('Код отправлен! Для теста код: ' + smsCodeGenerated);
});

// Подтверждение SMS-кода
document.getElementById('verifyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredCode = document.getElementById('smsCode').value.trim();

    if (enteredCode !== smsCodeGenerated) {
        tg.showAlert('Неверный код! Попробуйте ещё раз.');
        return;
    }

    // Успешная верификация
    userData.name = tempName;
    userData.phone = tempPhone;
    userData.isVerified = true;
    saveUserData();

    document.getElementById('verify').classList.remove('active');
    document.getElementById('main').classList.add('active');
    updateProfile();

    sendToBot('🆕 Новая регистрация', {
        Имя: userData.name,
        Телефон: userData.phone,
        Telegram: tg.initDataUnsafe?.user?.username || 'Не указан'
    });

    tg.showAlert('✅ Регистрация завершена!');
});

function resendCode() {
    smsCodeGenerated = generateSMSCode();
    console.log('Новый SMS код:', smsCodeGenerated);
    tg.showAlert('Новый код: ' + smsCodeGenerated);
}

function generateSMSCode() {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 4 цифры
}

// ==================== ВЫХОД ====================
function logout() {
    tg.showConfirm('Выйти из аккаунта?', (confirmed) => {
        if (confirmed) {
            // Очищаем данные
            userData = {
                name: '', phone: '', visits: [], bonusPoints: 0,
                freeHours: 0, spinsAvailable: 0, totalVisits: 0,
                referralCode: '', referredBy: null, pendingBonuses: [], isVerified: false
            };
            localStorage.removeItem('openWatersUser');

            document.getElementById('main').classList.remove('active');
            document.getElementById('register').classList.add('active');
            document.getElementById('registerForm').reset();
        }
    });
}

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

    // Прогресс 5+1
    const visitsMod = userData.totalVisits % 6;
    const progress = visitsMod === 0 && userData.totalVisits > 0 ? 100 : (visitsMod / 5) * 100;
    document.getElementById('progressFill').style.width = Math.min(progress, 100) + '%';

    document.querySelectorAll('.step').forEach((step, i) => {
        if (visitsMod === 0 && userData.totalVisits > 0) {
            step.classList.toggle('active', i === 5); // Все 5 сделаны, подарок активен
        } else {
            step.classList.toggle('active', i < visitsMod);
        }
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
        let badge = '';
        if (v.status === 'pending') {
            badge = '<span class="badge badge-pending">⏳ На подтверждении</span>';
        } else if (v.isFree) {
            badge = '<span class="badge badge-free">🎁 1ч бесплатно</span>';
        } else {
            badge = '<span class="badge badge-paid">' + v.price.toLocaleString() + ' ₽</span>';
        }

        return `
            <div class="history-item">
                <div>
                    <div class="date">${v.date.split(' ')[0]}</div>
                    <div class="info">${v.duration}ч · ${v.supCount} SUP</div>
                </div>
                ${badge}
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

// ==================== КОЛЕСО УДАЧИ (ИСПРАВЛЕННОЕ) ====================
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

    // Призы: индекс = позиция в массиве, соответствует CSS-сегменту
    const prizes = [
        { name: '50 баллов', value: 50, type: 'points' },      // 0 — верхний сегмент (0-45°)
        { name: 'Скидка 10%', value: 10, type: 'discount' },   // 1 — 45-90°
        { name: '100 баллов', value: 100, type: 'points' },    // 2 — 90-135°
        { name: 'Бесплатный час!', value: 1, type: 'freeHour' }, // 3 — 135-180°
        { name: 'Скидка 20%', value: 20, type: 'discount' },  // 4 — 180-225°
        { name: '200 баллов', value: 200, type: 'points' },   // 5 — 225-270°
        { name: 'Мерч 🧢', value: 1, type: 'merch' },         // 6 — 270-315°
        { name: 'Попробуй ещё', value: 0, type: 'none' }      // 7 — 315-360°
    ];

    // Случайный выбор
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const prize = prizes[prizeIndex];

    // Расчёт угла вращения
    // Указатель вверху (0°). Колесо крутится ПРОТИВ часовой стрелки (отрицательный угол)
    // Чтобы сегмент с индексом prizeIndex оказался сверху:
    // Нужно повернуть так, чтобы начало сегмента (prizeIndex * 45°) оказалось на 0°
    // Угол = -(360 - prizeIndex * 45) = -(360 - prizeIndex * 45)
    // Добавляем полные обороты (5-7) и случайное смещение внутри сегмента (5-40°)

    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 оборотов
    const segmentOffset = 5 + Math.random() * 35; // Смещение внутри сегмента (5°-40° от начала)
    const targetAngle = (fullSpins * 360) + (prizeIndex * 45) + segmentOffset;

    currentRotation = targetAngle;
    wheel.style.transform = `rotate(-${targetAngle}deg)`;

    setTimeout(() => {
        isSpinning = false;
        handlePrize(prize);
    }, 5200);
}

function handlePrize(prize) {
    const resultEl = document.getElementById('wheelResult');
    let msg = '';
    let bgColor = '#E8F5E9';

    switch(prize.type) {
        case 'points':
            userData.pendingBonuses.push({
                type: 'points', value: prize.value,
                date: new Date().toISOString(), status: 'pending'
            });
            msg = `🎉 ${prize.name}! Ожидают подтверждения: +${prize.value} баллов`;
            break;

        case 'discount':
            userData.pendingBonuses.push({
                type: 'discount', value: prize.value,
                date: new Date().toISOString(), status: 'pending'
            });
            msg = `🎉 Скидка ${prize.value}%! Активируется администратором`;
            break;

        case 'freeHour':
            userData.pendingBonuses.push({
                type: 'freeHour', value: 1,
                date: new Date().toISOString(), status: 'pending'
            });
            msg = `🎉 Бесплатный час! Активируется при следующем визите`;
            break;

        case 'merch':
            msg = `🎉 Мерч Open Waters! Покажите это окно на точке 🧢`;
            bgColor = '#FFF3E0';
            break;

        case 'none':
            msg = `😅 Попробуйте в следующий раз!`;
            bgColor = '#FFEBEE';
            break;
    }

    resultEl.textContent = msg;
    resultEl.style.background = bgColor;
    saveUserData();

    sendToBot('🎰 Колесо удачи', {
        Пользователь: userData.name,
        Телефон: userData.phone,
        Выигрыш: prize.name,
        Тип: prize.type
    });
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

    // 6-е посещение = 1 час бесплатно
    const isSixthVisit = (userData.totalVisits + 1) % 6 === 0;
    let freeHourDiscount = 0;

    if (isSixthVisit && duration >= 1) {
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

// ==================== БРОНИРОВАНИЕ (ИСПРАВЛЕННОЕ) ====================
function handleBooking(e) {
    e.preventDefault();

    const date = document.getElementById('bookDate').value;
    const time = document.getElementById('bookTime').value;
    const duration = parseInt(document.getElementById('bookDuration').value);
    const count = parseInt(document.getElementById('supCount').textContent);
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;
    const notes = document.getElementById('bookNotes').value;

    if (!date || !time) {
        tg.showAlert('Выберите дату и время');
        return;
    }

    const isWeekend = [0, 6].includes(new Date(date).getDay());
    const isSixthVisit = (userData.totalVisits + 1) % 6 === 0;

    // Расчёт цены
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

    let freeHourDiscount = 0;
    if (isSixthVisit && duration >= 1) {
        const hourPrice = isWeekend ? PRICES.weekend[1] : PRICES.weekday[1];
        freeHourDiscount = hourPrice * count;
    }

    const total = Math.max(0, supPrice + extrasPrice - freeHourDiscount);

    // Создаём объект бронирования
    const booking = {
        date: `${date} ${time}`,
        duration: duration,
        supCount: count,
        instructor: instructor,
        rescue: rescue,
        notes: notes,
        price: total,
        isFree: isSixthVisit,
        freeHourDiscount: freeHourDiscount,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    // Добавляем в историю (НЕ увеличиваем totalVisits — это делает админ при подтверждении)
    userData.visits.push(booking);

    // +1 прокрутка колеса (даётся за создание заявки)
    userData.spinsAvailable++;

    saveUserData();
    updateProfile();

    // Отправка в бот
    sendToBot('📅 НОВАЯ ЗАЯВКА', {
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
        '⏳ Статус': 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ АДМИНОМ'
    });

    // Показываем alert
    tg.showAlert(
        isSixthVisit 
            ? '🎉 Заявка отправлена! У вас 1 час бесплатно! Администратор подтвердит бронирование.'
            : '✅ Заявка отправлена! Администратор подтвердит бронирование.'
    );

    // Сброс формы
    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
}

// ==================== ПОДТВЕРЖДЕНИЕ АДМИНОМ ====================
// Эту функцию вызывает админ через бота
function adminConfirmVisit(visitIndex) {
    const visit = userData.visits[visitIndex];
    if (!visit || visit.status !== 'pending') return false;

    visit.status = 'confirmed';
    userData.totalVisits++; // Увеличиваем счётчик только при подтверждении

    if (visit.isFree) {
        userData.freeHours++;
    }

    // Начисляем бонусы за бронирование (10% от суммы)
    if (!visit.isFree && visit.price > 0) {
        const bonus = Math.floor(visit.price * 0.1);
        userData.bonusPoints += bonus;
    }

    // Начисляем ожидающие бонусы из колеса
    const pendingPoints = userData.pendingBonuses.filter(
        b => b.status === 'pending' && b.type === 'points'
    );
    pendingPoints.forEach(b => {
        b.status = 'confirmed';
        userData.bonusPoints += b.value;
    });

    // Начисляем ожидающие бесплатные часы
    const pendingHours = userData.pendingBonuses.filter(
        b => b.status === 'pending' && b.type === 'freeHour'
    );
    pendingHours.forEach(b => {
        b.status = 'confirmed';
        userData.freeHours += b.value;
    });

    saveUserData();
    updateProfile();

    return true;
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
        try {
            const parsed = JSON.parse(saved);
            userData = { ...userData, ...parsed };
            // Миграция старых данных
            if (userData.freeSupCount && !userData.freeHours) {
                userData.freeHours = userData.freeSupCount;
            }
        } catch(e) {
            console.error('Error loading data', e);
        }
    }
}

function sendToBot(title, data) {
    const payload = {
        type: 'booking',
        title: title,
        data: data,
        user: {
            name: userData.name,
            phone: userData.phone,
            telegramId: tg.initDataUnsafe?.user?.id
        },
        timestamp: new Date().toISOString()
    };

    try {
        tg.sendData(JSON.stringify(payload));
    } catch(e) {
        console.log('Telegram WebApp not available for sendData');
    }
}
