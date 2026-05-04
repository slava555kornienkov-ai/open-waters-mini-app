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
    isVerified: false,
    userId: null  // Уникальный ID для восстановления аккаунта
};

const PRICES = {
    weekend: { 1: 2000, 2: 3200, 3: 4200, 4: 5000, extra: 700 },
    weekday: { 1: 1700, 2: 2800, 3: 3800, 4: 4700, extra: 600 }
};

const EXTRAS = { instructor: 2000, rescue: 2500 };

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();

    // Маска телефона
    setupPhoneMask();

    // Генерация реферального кода и userId при первом запуске
    if (!userData.referralCode) {
        userData.referralCode = 'OW' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    if (!userData.userId) {
        userData.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }
    saveUserData();

    // Проверка реферала из URL
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && !userData.referredBy) {
        userData.referredBy = ref;
        saveUserData();
    }

    // Показываем загрузку, затем нужный экран
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

// ==================== МАСКА ТЕЛЕФОНА +7 (999) 999-99-99 ====================
function setupPhoneMask() {
    const phoneInput = document.getElementById('regPhone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');

        // Убираем лишнюю 7 в начале если пользователь ввёл +7
        if (value.startsWith('7') && value.length > 1) {
            value = value.substring(1);
        }
        if (value.startsWith('8') && value.length > 1) {
            value = value.substring(1);
        }

        let formatted = '+7';

        if (value.length > 0) {
            formatted += ' (' + value.substring(0, 3);
        }
        if (value.length >= 3) {
            formatted += ')';
        }
        if (value.length > 3) {
            formatted += ' ' + value.substring(3, 6);
        }
        if (value.length > 6) {
            formatted += '-' + value.substring(6, 8);
        }
        if (value.length > 8) {
            formatted += '-' + value.substring(8, 10);
        }

        e.target.value = formatted;
    });

    // При фокусе ставим курсор в конец
    phoneInput.addEventListener('focus', () => {
        if (!phoneInput.value) {
            phoneInput.value = '+7 ';
        }
    });
}

// ==================== РЕГИСТРАЦИЯ И SMS ====================
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

    // Проверяем, есть ли уже аккаунт с таким номером
    const existingUser = findUserByPhone(tempPhone);
    if (existingUser) {
        // Восстанавливаем аккаунт
        userData = { ...userData, ...existingUser, isVerified: true };
        saveUserData();

        document.getElementById('register').classList.remove('active');
        document.getElementById('main').classList.add('active');
        updateProfile();
        tg.showAlert('✅ Добро пожаловать обратно!');
        return;
    }

    // Новый пользователь — отправляем SMS
    smsCodeGenerated = generateSMSCode();

    document.getElementById('register').classList.remove('active');
    document.getElementById('verify').classList.add('active');
    document.getElementById('verifyPhone').textContent = tempPhone;
    document.getElementById('smsCode').value = ''; // Очищаем поле кода

    console.log('SMS код:', smsCodeGenerated);

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

    // Сохраняем в глобальное хранилище (для восстановления)
    saveUserToGlobal(tempPhone, userData);

    document.getElementById('verify').classList.remove('active');
    document.getElementById('main').classList.add('active');
    updateProfile();

    sendToBot('🆕 Новая регистрация', {
        Имя: userData.name,
        Телефон: userData.phone,
        UserID: userData.userId,
        Telegram: tg.initDataUnsafe?.user?.username || 'Не указан'
    });

    tg.showAlert('✅ Регистрация завершена!');
});

function resendCode() {
    smsCodeGenerated = generateSMSCode();
    document.getElementById('smsCode').value = ''; // Очищаем поле
    console.log('Новый SMS код:', smsCodeGenerated);
    tg.showAlert('Новый код: ' + smsCodeGenerated);
}

function generateSMSCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ==================== ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ ПОЛЬЗОВАТЕЛЕЙ ====================
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
        pendingBonuses: data.pendingBonuses
    };
    localStorage.setItem('openWatersAllUsers', JSON.stringify(allUsers));
}

function findUserByPhone(phone) {
    const allUsers = JSON.parse(localStorage.getItem('openWatersAllUsers') || '{}');
    return allUsers[phone] || null;
}

function restoreUserFromGlobal(phone) {
    const user = findUserByPhone(phone);
    if (user) {
        userData = { ...userData, ...user, isVerified: true };
        saveUserData();
        return true;
    }
    return false;
}

// ==================== ВЫХОД ====================
function logout() {
    tg.showConfirm('Выйти из аккаунта?', (confirmed) => {
        if (confirmed) {
            // Сохраняем данные в глобальное хранилище перед выходом
            if (userData.phone) {
                saveUserToGlobal(userData.phone, userData);
            }

            // Очищаем текущую сессию
            userData = {
                name: '', phone: '', visits: [], bonusPoints: 0,
                freeHours: 0, spinsAvailable: 0, totalVisits: 0,
                referralCode: '', referredBy: null, pendingBonuses: [],
                isVerified: false, userId: null
            };
            localStorage.removeItem('openWatersUser');

            // Очищаем поля форм
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
    document.getElementById('refLink').value = `https://t.me/openwaters_sup_bot?start=${userData.referralCode}`;

    // Обновление блока бонусов в бронировании
    const bonusSection = document.getElementById('bonusSection');
    if (userData.bonusPoints > 0) {
        bonusSection.style.display = 'block';
        document.getElementById('availableBonus').textContent = userData.bonusPoints;
        document.getElementById('bonusRub').textContent = userData.bonusPoints; // 1 балл = 1 рубль
        document.getElementById('bonusBalance').textContent = userData.bonusPoints + ' ₽';
    } else {
        bonusSection.style.display = 'none';
    }

    // Прогресс 5+1
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

// ==================== КОЛЕСО УДАЧИ ====================
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

    // Показываем модалку оплаты
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
        // Оплата на месте — заявка в ожидании
        finalizeBooking('cash');
        tg.showAlert('✅ Заявка создана! Оплатите на месте при arrival.');
    } else {
        // Имитация онлайн-оплаты
        tg.showConfirm(`Оплатить ${currentBooking.price.toLocaleString()} ₽?`, (confirmed) => {
            if (confirmed) {
                finalizeBooking(method);
                tg.showAlert('✅ Оплата прошла успешно! Бронирование подтверждено.');
            }
        });
    }
}

function finalizeBooking(paymentMethod) {
    if (!currentBooking) return;

    // Списываем бонусы если использовались
    if (currentBooking.bonusUsed > 0) {
        userData.bonusPoints -= currentBooking.bonusUsed;
    }

    // Добавляем в историю
    userData.visits.push(currentBooking);

    // +1 прокрутка колеса
    userData.spinsAvailable++;

    saveUserData();
    saveUserToGlobal(userData.phone, userData);
    updateProfile();

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
        '🎁 Бонус': currentBooking.isFree ? `1 час бесплатно (-${currentBooking.freeHourDiscount.toLocaleString()} ₽)` : 'Нет',
        '💎 Бонусы списано': currentBooking.bonusUsed > 0 ? `${currentBooking.bonusUsed} баллов` : 'Нет',
        '⏳ Статус': 'ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ АДМИНОМ'
    });

    // Сброс формы
    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
    currentBooking = null;
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

    // 5% бонусов от суммы бронирования
    if (!visit.isFree && visit.price > 0) {
        const bonus = Math.floor(visit.originalPrice * 0.05);
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

    const pendingHours = userData.pendingBonuses.filter(
        b => b.status === 'pending' && b.type === 'freeHour'
    );
    pendingHours.forEach(b => {
        b.status = 'confirmed';
        userData.freeHours += b.value;
    });

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
