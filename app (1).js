const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==================== КОНФИГУРАЦИЯ ====================
const BOT_USERNAME = 'owstroginobot';
const BOT_APP_URL = 'https://t.me/owstroginobot/owstrogino';
const ADMIN_USERNAME = 'stemmmmmystyle';

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
    isVerified: false,
    userId: null
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
    if (!userData.userId) {
        userData.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }
    saveUserData();

    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && !userData.referredBy) {
        userData.referredBy = ref;
        saveUserData();
    }

    setupPhoneMask();

    setTimeout(() => {
        document.getElementById('loading').classList.remove('active');

        if (!userData.name || !userData.isVerified) {
            document.getElementById('register').classList.add('active');
        } else {
            document.getElementById('main').classList.add('active');
            updateProfile();
        }
    }, 1500);

    initTimeSlots();
    setupEventListeners();
    updatePrice();
});

// ==================== МАСКА ТЕЛЕФОНА ====================
function setupPhoneMask() {
    const phoneInput = document.getElementById('regPhone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');

        if (value.startsWith('7') && value.length > 1) value = value.substring(1);
        if (value.startsWith('8') && value.length > 1) value = value.substring(1);

        let formatted = '+7';
        if (value.length > 0) formatted += ' (' + value.substring(0, 3);
        if (value.length >= 3) formatted += ')';
        if (value.length > 3) formatted += ' ' + value.substring(3, 6);
        if (value.length > 6) formatted += '-' + value.substring(6, 8);
        if (value.length > 8) formatted += '-' + value.substring(8, 10);

        e.target.value = formatted;
    });

    phoneInput.addEventListener('focus', () => {
        if (!phoneInput.value) phoneInput.value = '+7 ';
    });
}

// ==================== РЕГИСТРАЦИЯ ====================
let tempPhone = '';
let tempName = '';
let smsCodeGenerated = '';

document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    tempName = document.getElementById('regName').value.trim();
    tempPhone = document.getElementById('regPhone').value.trim();

    if (!tempName || !tempPhone || tempPhone.length < 18) {
        tg.showAlert('Заполните все поля корректно');
        return;
    }

    // Проверяем существующий аккаунт
    const existingUser = findUserByPhone(tempPhone);
    if (existingUser) {
        userData = { ...userData, ...existingUser, isVerified: true };
        saveUserData();

        document.getElementById('register').classList.remove('active');
        document.getElementById('main').classList.add('active');
        updateProfile();
        tg.showAlert('✅ Добро пожаловать обратно, ' + userData.name + '!');
        return;
    }

    smsCodeGenerated = generateSMSCode();

    document.getElementById('register').classList.remove('active');
    document.getElementById('verify').classList.add('active');
    document.getElementById('verifyPhone').textContent = tempPhone;
    document.getElementById('smsCode').value = '';

    console.log('SMS код:', smsCodeGenerated);
    tg.showAlert('Код для теста: ' + smsCodeGenerated);
});

// Подтверждение SMS
document.getElementById('verifyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredCode = document.getElementById('smsCode').value.trim();

    if (enteredCode !== smsCodeGenerated) {
        tg.showAlert('Неверный код!');
        return;
    }

    userData.name = tempName;
    userData.phone = tempPhone;
    userData.isVerified = true;
    saveUserData();
    saveUserToGlobal(tempPhone, userData);

    document.getElementById('verify').classList.remove('active');
    document.getElementById('main').classList.add('active');
    updateProfile();

    sendToBot('🆕 Новая регистрация', {
        Имя: userData.name,
        Телефон: userData.phone,
        UserID: userData.userId
    });

    tg.showAlert('✅ Регистрация завершена!');
});

function resendCode() {
    smsCodeGenerated = generateSMSCode();
    document.getElementById('smsCode').value = '';
    tg.showAlert('Новый код: ' + smsCodeGenerated);
}

function generateSMSCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ==================== ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ====================
function saveUserToGlobal(phone, data) {
    const allUsers = JSON.parse(localStorage.getItem('openWatersAllUsers') || '{}');
    allUsers[phone] = {
        userId: data.userId,
        name: data.name,
        phone: data.phone,
        visits: data.visits,
        bonusPoints: data.bonusPoints,
        freeHours: data.freeHours,
        spinsAvailable: data.spinsAvailable,
        totalVisits: data.totalVisits,
        referralCode: data.referralCode,
        referredBy: data.referredBy,
        pendingBonuses: data.pendingBonuses,
        isVerified: true
    };
    localStorage.setItem('openWatersAllUsers', JSON.stringify(allUsers));
}

function findUserByPhone(phone) {
    const allUsers = JSON.parse(localStorage.getItem('openWatersAllUsers') || '{}');
    return allUsers[phone] || null;
}

// ==================== ВЫХОД ====================
function logout() {
    tg.showConfirm('Выйти из аккаунта?', (confirmed) => {
        if (confirmed) {
            if (userData.phone) saveUserToGlobal(userData.phone, userData);

            userData = {
                name: '', phone: '', visits: [], bonusPoints: 0,
                freeHours: 0, spinsAvailable: 0, totalVisits: 0,
                referralCode: '', referredBy: null, pendingBonuses: [],
                isVerified: false, userId: null
            };
            localStorage.removeItem('openWatersUser');

            document.getElementById('regName').value = '';
            document.getElementById('regPhone').value = '';
            document.getElementById('smsCode').value = '';

            document.getElementById('main').classList.remove('active');
            document.getElementById('register').classList.add('active');
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

    ['bookDate', 'bookTime', 'bookDuration', 'extraInstructor', 'extraRescue', 'useBonuses'].forEach(id => {
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
    document.getElementById('refLink').value = `https://t.me/${BOT_USERNAME}?start=${userData.referralCode}`;

    // Обновление блока бонусов в бронировании
    const bonusLabel = document.getElementById('bonusLabel');
    const useBonusesCheckbox = document.getElementById('useBonuses');

    document.getElementById('availableBonus').textContent = userData.bonusPoints;
    document.getElementById('bonusRub').textContent = userData.bonusPoints;
    document.getElementById('bonusBalance').textContent = userData.bonusPoints + ' ₽';

    if (userData.bonusPoints <= 0) {
        bonusLabel.classList.add('disabled');
        useBonusesCheckbox.disabled = true;
        useBonusesCheckbox.checked = false;
    } else {
        bonusLabel.classList.remove('disabled');
        useBonusesCheckbox.disabled = false;
    }

    // Прогресс
    const visitsMod = userData.totalVisits % 6;
    const progress = visitsMod === 0 && userData.totalVisits > 0 ? 100 : (visitsMod / 5) * 100;
    document.getElementById('progressFill').style.width = Math.min(progress, 100) + '%';

    document.querySelectorAll('.step').forEach((step, i) => {
        if (visitsMod === 0 && userData.totalVisits > 0) {
            step.classList.toggle('active', i === 5);
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

// ==================== КОЛЕСО УДАЧИ (БАЛЛЫ СРАЗУ) ====================
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

    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const segmentOffset = 5 + Math.random() * 35;
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
            // СРАЗУ начисляем на баланс
            userData.bonusPoints += prize.value;
            msg = `🎉 ${prize.name}! +${prize.value} баллов начислено на баланс`;
            break;

        case 'discount':
            userData.pendingBonuses.push({
                type: 'discount', value: prize.value,
                date: new Date().toISOString(), status: 'active'
            });
            msg = `🎉 Скидка ${prize.value}%! Применится автоматически при бронировании`;
            break;

        case 'freeHour':
            // СРАЗУ начисляем бесплатный час
            userData.freeHours += prize.value;
            msg = `🎉 Бесплатный час добавлен! Всего: ${userData.freeHours} ч`;
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
    saveUserToGlobal(userData.phone, userData);
    updateProfile();

    sendToBot('🎰 Колесо удачи', {
        Пользователь: userData.name,
        Телефон: userData.phone,
        Выигрыш: prize.name
    });
}

// ==================== СЧЁТЧИК SUP ====================
function changeCount(delta) {
    let count = parseInt(document.getElementById('supCount').textContent) + delta;
    count = Math.max(1, Math.min(20, count));
    document.getElementById('supCount').textContent = count;
    updatePrice();
}

// ==================== ВРЕМЯ (интервал 1 час) ====================
function initTimeSlots() {
    const select = document.getElementById('bookTime');
    for (let h = 10; h <= 20; h++) {
        select.add(new Option(`${h}:00`, `${h}:00`));
    }
    document.getElementById('bookDate').min = new Date().toISOString().split('T')[0];
}

// ==================== РАСЧЁТ ЦЕНЫ ====================
function updatePrice() {
    const date = document.getElementById('bookDate').value;
    const duration = parseInt(document.getElementById('bookDuration').value) || 1;
    const count = parseInt(document.getElementById('supCount').textContent) || 1;
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;
    const useBonuses = document.getElementById('useBonuses')?.checked || false;

    if (!date) {
        ['priceSup', 'priceExtras', 'priceTotal'].forEach(id => {
            document.getElementById(id).textContent = '0 ₽';
        });
        document.getElementById('freeHourRow').style.display = 'none';
        document.getElementById('bonusRow').style.display = 'none';
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

    // Списание бонусов
    let bonusDiscount = 0;
    if (useBonuses && userData.bonusPoints > 0) {
        const subtotal = supPrice + extrasPrice - freeHourDiscount;
        bonusDiscount = Math.min(userData.bonusPoints, subtotal);
        document.getElementById('bonusRow').style.display = 'flex';
        document.getElementById('bonusDiscount').textContent = '-' + bonusDiscount.toLocaleString() + ' ₽';
    } else {
        document.getElementById('bonusRow').style.display = 'none';
    }

    const total = Math.max(0, supPrice + extrasPrice - freeHourDiscount - bonusDiscount);

    document.getElementById('priceSup').textContent = supPrice.toLocaleString() + ' ₽';
    document.getElementById('priceExtras').textContent = extrasPrice.toLocaleString() + ' ₽';
    document.getElementById('priceTotal').textContent = total.toLocaleString() + ' ₽';
}

// ==================== БРОНИРОВАНИЕ ====================
let currentBooking = null;

function handleBooking(e) {
    e.preventDefault();

    const date = document.getElementById('bookDate').value;
    const time = document.getElementById('bookTime').value;
    const duration = parseInt(document.getElementById('bookDuration').value);
    const count = parseInt(document.getElementById('supCount').textContent);
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;
    const notes = document.getElementById('bookNotes').value;
    const useBonuses = document.getElementById('useBonuses')?.checked || false;

    if (!date || !time) {
        tg.showAlert('Выберите дату и время');
        return;
    }

    const isWeekend = [0, 6].includes(new Date(date).getDay());
    const isSixthVisit = (userData.totalVisits + 1) % 6 === 0;

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

    let bonusDiscount = 0;
    let bonusUsed = 0;
    if (useBonuses && userData.bonusPoints > 0) {
        const subtotal = supPrice + extrasPrice - freeHourDiscount;
        bonusDiscount = Math.min(userData.bonusPoints, subtotal);
        bonusUsed = bonusDiscount;
    }

    const total = Math.max(0, supPrice + extrasPrice - freeHourDiscount - bonusDiscount);

    currentBooking = {
        date: `${date} ${time}`,
        duration: duration,
        supCount: count,
        instructor: instructor,
        rescue: rescue,
        notes: notes,
        price: total,
        originalPrice: supPrice + extrasPrice,
        isFree: isSixthVisit,
        freeHourDiscount: freeHourDiscount,
        bonusUsed: bonusUsed,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    showPaymentModal(total, `${date} ${time}, ${duration}ч, ${count} SUP`);
}

// ==================== ОПЛАТА ====================
function showPaymentModal(amount, description) {
    document.getElementById('paymentAmount').textContent = amount.toLocaleString() + ' ₽';
    document.getElementById('paymentDesc').textContent = description;
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function processPayment(method) {
    closePaymentModal();

    if (!currentBooking) return;

    if (method === 'cash') {
        finalizeBooking('cash');
        tg.showAlert('✅ Заявка создана! Оплатите на месте.');
    } else {
        // Имитация онлайн-оплаты
        tg.showConfirm(`Оплатить ${currentBooking.price.toLocaleString()} ₽?`, (confirmed) => {
            if (confirmed) {
                finalizeBooking(method);
                tg.showAlert('✅ Оплата прошла успешно!');
            }
        });
    }
}

function finalizeBooking(paymentMethod) {
    if (!currentBooking) return;

    // Списываем бонусы
    if (currentBooking.bonusUsed > 0) {
        userData.bonusPoints -= currentBooking.bonusUsed;
    }

    userData.visits.push(currentBooking);
    userData.spinsAvailable++;

    saveUserData();
    saveUserToGlobal(userData.phone, userData);
    updateProfile();

    // ОТПРАВКА УВЕДОМЛЕНИЯ АДМИНУ
    sendAdminNotification(currentBooking, paymentMethod);

    // Отправка в бот
    sendToBot('📅 НОВАЯ ЗАЯВКА', {
        '👤 Имя': userData.name,
        '📱 Телефон': userData.phone,
        '📅 Дата': currentBooking.date,
        '⏱ Длительность': `${currentBooking.duration} час(а)`,
        '🏄 SUP': `${currentBooking.supCount} шт.`,
        '🎯 Инструктор': currentBooking.instructor ? 'Да' : 'Нет',
        '🛟 Спасатели': currentBooking.rescue ? 'Да' : 'Нет',
        '📝 Пожелания': currentBooking.notes || 'Нет',
        '💰 Сумма': `${currentBooking.price.toLocaleString()} ₽`,
        '💳 Оплата': paymentMethod === 'cash' ? 'На месте' : 'Онлайн',
        '🎁 Бонус': currentBooking.isFree ? `1 час бесплатно` : 'Нет',
        '💎 Бонусы списано': currentBooking.bonusUsed > 0 ? `${currentBooking.bonusUsed} баллов` : 'Нет',
        '⏳ Статус': 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ'
    });

    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
    currentBooking = null;
}

// ==================== УВЕДОМЛЕНИЕ АДМИНУ ====================
function sendAdminNotification(booking, paymentMethod) {
    // Способ 1: Открываем ссылку на Telegram с предзаполненным сообщением
    const message = `📅 НОВАЯ ЗАЯВКА Open Waters%0A%0A` +
        `👤 Клиент: ${userData.name}%0A` +
        `📱 Телефон: ${userData.phone}%0A` +
        `📅 Дата: ${booking.date}%0A` +
        `⏱ Длительность: ${booking.duration}ч%0A` +
        `🏄 SUP: ${booking.supCount} шт.%0A` +
        `💰 Сумма: ${booking.price.toLocaleString()} ₽%0A` +
        `💳 Оплата: ${paymentMethod === 'cash' ? 'На месте' : 'Онлайн'}%0A` +
        `⏳ Статус: ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ`;

    // Отправляем через Telegram API (если бот настроен)
    // Или открываем чат с админом
    const adminLink = `https://t.me/${ADMIN_USERNAME}?text=${message}`;

    // Для теста — просто лог
    console.log('Уведомление админу:', adminLink);

    // В продакшене: отправка через бота
    // tg.openTelegramLink(adminLink);
}

// ==================== ПОДТВЕРЖДЕНИЕ АДМИНОМ ====================
function adminConfirmVisit(visitIndex) {
    const visit = userData.visits[visitIndex];
    if (!visit || visit.status !== 'pending') return false;

    visit.status = 'confirmed';
    userData.totalVisits++;

    if (visit.isFree) {
        userData.freeHours++;
    }

    // 5% бонусов от суммы
    if (!visit.isFree && visit.originalPrice > 0) {
        const bonus = Math.floor(visit.originalPrice * 0.05);
        userData.bonusPoints += bonus;
    }

    saveUserData();
    saveUserToGlobal(userData.phone, userData);
    updateProfile();

    return true;
}

// ==================== РЕФЕРАЛКА (+300) ====================
function copyRefLink() {
    const input = document.getElementById('refLink');
    input.select();
    document.execCommand('copy');
    tg.showAlert('📋 Ссылка скопирована!');
}

function shareRef() {
    const link = document.getElementById('refLink').value;
    const text = `🏄 Катайся на SUP в Строгино! Open Waters 🌊\nПриходи по моей ссылке и получи +300 бонусов!`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

// ==================== МОДАЛКИ ====================
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
            userId: userData.userId,
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
