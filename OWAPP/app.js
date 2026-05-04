// ==================== Telegram WebApp ====================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==================== Данные пользователя ====================
let userData = {
    name: '',
    phone: '',
    visits: [],
    bonusPoints: 0,
    freeSupCount: 0,
    spinsAvailable: 0,
    totalVisits: 0,
    referralCode: '',
    referredBy: null
};

// ==================== Цены ====================
const PRICES = {
    weekend: { 1: 2000, 2: 3200, 3: 4200, 4: 5000, extra: 700 },
    weekday: { 1: 1700, 2: 2800, 3: 3800, 4: 4700, extra: 600 }
};

const EXTRAS = {
    instructor: 2000,
    rescue: 2500
};

// ==================== Инициализация ====================
document.addEventListener('DOMContentLoaded', () => {
    // Загрузка данных
    loadUserData();
    
    // Генерация реферального кода
    if (!userData.referralCode) {
        userData.referralCode = 'OW' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    
    // Проверка реферала из URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && !userData.referredBy) {
        userData.referredBy = ref;
    }
    
    // Показ заставки
    setTimeout(() => {
        document.getElementById('splash').classList.remove('active');
        if (!userData.name) {
            document.getElementById('register').classList.add('active');
        } else {
            document.getElementById('main').classList.add('active');
            updateProfile();
        }
    }, 2000);
    
    // Инициализация времени
    initTimeSlots();
    
    // Обработчики
    setupEventListeners();
    
    // Обновление цены при изменениях
    updatePrice();
});

// ==================== Регистрация ====================
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    userData.name = document.getElementById('regName').value.trim();
    userData.phone = document.getElementById('regPhone').value.trim();
    
    saveUserData();
    
    document.getElementById('register').classList.remove('active');
    document.getElementById('main').classList.add('active');
    updateProfile();
    
    // Отправка данных в Telegram
    sendToBot('🆕 Новая регистрация!', {
        Имя: userData.name,
        Телефон: userData.phone,
        Telegram: tg.initDataUnsafe?.user?.username || 'Не указан'
    });
});

// ==================== Навигация ====================
function setupEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
        });
    });
    
    // Обновление цены
    document.getElementById('bookDate').addEventListener('change', updatePrice);
    document.getElementById('bookTime').addEventListener('change', updatePrice);
    document.getElementById('bookDuration').addEventListener('change', updatePrice);
    document.getElementById('extraInstructor').addEventListener('change', updatePrice);
    document.getElementById('extraRescue').addEventListener('change', updatePrice);
    
    // Бронирование
    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
}

// ==================== Профиль ====================
function updateProfile() {
    document.getElementById('userAvatar').textContent = userData.name ? userData.name[0].toUpperCase() : '👤';
    document.getElementById('bonusPoints').textContent = userData.bonusPoints;
    document.getElementById('visitCount').textContent = userData.totalVisits;
    document.getElementById('freeSupCount').textContent = userData.freeSupCount;
    document.getElementById('refLink').value = `https://t.me/openwaters_bot?start=${userData.referralCode}`;
    
    // Обновление прогресса 5+1
    const progress = (userData.totalVisits % 6) / 5 * 100;
    document.getElementById('progressFill').style.width = Math.min(progress, 100) + '%';
    
    const steps = document.querySelectorAll('.step');
    const currentStep = userData.totalVisits % 6;
    steps.forEach((step, i) => {
        step.classList.toggle('active', i < currentStep);
    });
    
    // Обновление истории
    updateHistory();
    
    // Обновление колеса
    document.getElementById('spinsLeft').textContent = `Осталось прокруток: ${userData.spinsAvailable}`;
    document.getElementById('spinBtn').disabled = userData.spinsAvailable <= 0;
    if (userData.spinsAvailable <= 0) {
        document.getElementById('spinBtn').style.opacity = '0.5';
    }
}

function updateHistory() {
    const historyEl = document.getElementById('visitHistory');
    if (userData.visits.length === 0) {
        historyEl.innerHTML = '<p class="empty">Пока нет посещений</p>';
        return;
    }
    
    historyEl.innerHTML = userData.visits.slice().reverse().map(visit => `
        <div class="history-item">
            <div>
                <div class="date">${formatDate(visit.date)}</div>
                <div class="info">${visit.duration}ч · ${visit.supCount} SUP</div>
            </div>
            <span class="badge ${visit.isFree ? 'badge-free' : 'badge-paid'}">
                ${visit.isFree ? '🎁 Бесплатно' : visit.price + ' ₽'}
            </span>
        </div>
    `).join('');
}

// ==================== Колесо удачи ====================
let isSpinning = false;

function spinWheel() {
    if (isSpinning || userData.spinsAvailable <= 0) return;
    
    isSpinning = true;
    userData.spinsAvailable--;
    saveUserData();
    updateProfile();
    
    const wheel = document.getElementById('wheel');
    const resultEl = document.getElementById('wheelResult');
    
    // Случайный приз
    const prizes = [
        { name: '50 бонусных баллов', value: 50, type: 'points' },
        { name: 'Скидка 10%', value: 10, type: 'discount' },
        { name: '100 бонусных баллов', value: 100, type: 'points' },
        { name: 'Бесплатный час аренды!', value: 1, type: 'freeHour' },
        { name: 'Скидка 20%', value: 20, type: 'discount' },
        { name: '200 бонусных баллов', value: 200, type: 'points' },
        { name: 'Фирменный мерч 🧢', value: 1, type: 'merch' },
        { name: 'Попробуй в следующий раз', value: 0, type: 'none' }
    ];
    
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    const prize = prizes[prizeIndex];
    
    // Вращение (45° на сегмент, + случайное смещение внутри сегмента)
    const rotation = 1800 + (prizeIndex * 45) + Math.random() * 30 + 7.5;
    wheel.style.transform = `rotate(${rotation}deg)`;
    
    setTimeout(() => {
        isSpinning = false;
        
        // Начисление приза
        let message = `🎉 ${prize.name}!`;
        switch(prize.type) {
            case 'points':
                userData.bonusPoints += prize.value;
                message += ` Зачислено ${prize.value} баллов.`;
                break;
            case 'discount':
                message += ` Используйте при бронировании!`;
                break;
            case 'freeHour':
                message += ` Добавлен в ваши бонусы!`;
                break;
            case 'merch':
                message += ` Покажите это окно на точке!`;
                break;
        }
        
        resultEl.textContent = message;
        resultEl.style.background = prize.type === 'none' ? '#FFEBEE' : '#E8F5E9';
        
        saveUserData();
        updateProfile();
        
        // Отправка в Telegram
        sendToBot('🎰 Колесо удачи', {
            Пользователь: userData.name,
            Выигрыш: prize.name
        });
        
    }, 4000);
}

// ==================== Счётчик SUP ====================
function changeCount(delta) {
    const el = document.getElementById('supCount');
    let count = parseInt(el.textContent) + delta;
    if (count < 1) count = 1;
    if (count > 20) count = 20;
    el.textContent = count;
    updatePrice();
}

// ==================== Расчёт цены ====================
function updatePrice() {
    const date = document.getElementById('bookDate').value;
    const duration = parseInt(document.getElementById('bookDuration').value) || 1;
    const count = parseInt(document.getElementById('supCount').textContent) || 1;
    const instructor = document.getElementById('extraInstructor').checked;
    const rescue = document.getElementById('extraRescue').checked;
    
    if (!date) {
        document.getElementById('priceSup').textContent = '0 ₽';
        document.getElementById('priceExtras').textContent = '0 ₽';
        document.getElementById('priceTotal').textContent = '0 ₽';
        return;
    }
    
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const priceList = isWeekend ? PRICES.weekend : PRICES.weekday;
    
    let supPrice = 0;
    if (duration <= 4) {
        supPrice = priceList[duration] * count;
    } else {
        supPrice = (priceList[4] + (duration - 4) * priceList.extra) * count;
    }
    
    let extrasPrice = 0;
    if (instructor) extrasPrice += EXTRAS.instructor * duration;
    if (rescue) extrasPrice += EXTRAS.rescue * duration;
    
    document.getElementById('priceSup').textContent = supPrice.toLocaleString() + ' ₽';
    document.getElementById('priceExtras').textContent = extrasPrice.toLocaleString() + ' ₽';
    document.getElementById('priceTotal').textContent = (supPrice + extrasPrice).toLocaleString() + ' ₽';
}

// ==================== Инициализация времени ====================
function initTimeSlots() {
    const select = document.getElementById('bookTime');
    for (let h = 10; h <= 20; h++) {
        const option = document.createElement('option');
        option.value = `${h}:00`;
        option.textContent = `${h}:00`;
        select.appendChild(option);
        
        if (h < 20) {
            const option2 = document.createElement('option');
            option2.value = `${h}:30`;
            option2.textContent = `${h}:30`;
            select.appendChild(option2);
        }
    }
    
    // Установка минимальной даты — сегодня
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookDate').min = today;
}

// ==================== Бронирование ====================
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
    
    // Проверка на бесплатное посещение (каждое 6-е)
    const isFree = (userData.totalVisits + 1) % 6 === 0;
    
    const bookingData = {
        date,
        time,
        duration,
        supCount: count,
        instructor,
        rescue,
        notes,
        price: isFree ? 0 : total,
        isFree,
        userName: userData.name,
        userPhone: userData.phone,
        telegramId: tg.initDataUnsafe?.user?.id || 'unknown'
    };
    
    // Сохранение посещения
    userData.visits.push({
        date: `${date} ${time}`,
        duration,
        supCount: count,
        price: isFree ? 0 : total,
        isFree
    });
    userData.totalVisits++;
    
    if (isFree) {
        userData.freeSupCount++;
    }
    
    // +1 прокрутка колеса
    userData.spinsAvailable++;
    
    // Бонусы за бронирование (10% от суммы)
    if (!isFree) {
        userData.bonusPoints += Math.floor(total * 0.1);
    }
    
    saveUserData();
    updateProfile();
    
    // Отправка в Telegram бот
    sendToBot('📅 Новое бронирование!', {
        '👤 Имя': userData.name,
        '📱 Телефон': userData.phone,
        '📅 Дата': `${date} в ${time}`,
        '⏱ Длительность': `${duration} час(а)`,
        '🏄 SUP': `${count} шт.`,
        '🎯 Инструктор': instructor ? 'Да' : 'Нет',
        '🛟 Спасатели': rescue ? 'Да' : 'Нет',
        '📝 Пожелания': notes || 'Нет',
        '💰 Сумма': isFree ? '🎁 БЕСПЛАТНО (6-е посещение!)' : `${total.toLocaleString()} ₽`
    });
    
    // Предоплата через Telegram
    if (!isFree && total > 0) {
        tg.showConfirm(`Оплатить ${total.toLocaleString()} ₽ сейчас?`, (confirmed) => {
            if (confirmed) {
                // Открытие инвойса Telegram Payments
                tg.openInvoice({
                    title: `Аренда SUP — ${duration}ч`,
                    description: `${count} SUP · ${date} ${time}`,
                    currency: 'RUB',
                    amount: total * 100, // в копейках
                    payload: JSON.stringify(bookingData)
                }, (status) => {
                    if (status === 'paid') {
                        tg.showAlert('✅ Оплата прошла успешно! Ждём вас на воде 🌊');
                    }
                });
            } else {
                tg.showAlert('✅ Бронирование создано! Оплату можно произвести на месте.');
            }
        });
    } else {
        tg.showAlert('🎉 Поздравляем! Это ваше бесплатное посещение! Ждём вас на воде 🌊');
    }
    
    // Сброс формы
    document.getElementById('bookingForm').reset();
    document.getElementById('supCount').textContent = '1';
    updatePrice();
}

// ==================== Реферальная система ====================
function copyRefLink() {
    const input = document.getElementById('refLink');
    input.select();
    document.execCommand('copy');
    tg.showAlert('📋 Ссылка скопирована!');
}

function shareRef() {
    const text = `🏄 Катайся на SUP в Строгино вместе со мной! \n\nПриходи в Open Waters и получи бонусные баллы 🌊\n\n${document.getElementById('refLink').value}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(document.getElementById('refLink').value)}&text=${encodeURIComponent(text)}`);
}

// ==================== Корпоративы ====================
function showCorporate() {
    document.getElementById('corporateModal').classList.add('active');
}

function closeModal() {
    document.getElementById('corporateModal').classList.remove('active');
}

// ==================== Утилиты ====================
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function saveUserData() {
    localStorage.setItem('openWatersUser', JSON.stringify(userData));
    
    // Синхронизация с Telegram Cloud Storage
    if (tg.CloudStorage) {
        tg.CloudStorage.setItem('userData', JSON.stringify(userData));
    }
}

function loadUserData() {
    const saved = localStorage.getItem('openWatersUser');
    if (saved) {
        userData = { ...userData, ...JSON.parse(saved) };
    }
    
    // Попытка загрузить из Telegram Cloud Storage
    if (tg.CloudStorage) {
        tg.CloudStorage.getItem('userData', (err, value) => {
            if (!err && value) {
                userData = { ...userData, ...JSON.parse(value) };
                updateProfile();
            }
        });
    }
}

function sendToBot(title, data) {
    // Отправка данных в бот через sendData
    const message = `${title}\n\n` + Object.entries(data)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    
    tg.sendData(JSON.stringify({
        type: 'booking',
        title,
        data
    }));
    
    // Также можно отправить через MainButton
    tg.MainButton.setText('✅ Отправлено');
    tg.MainButton.show();
    setTimeout(() => tg.MainButton.hide(), 2000);
}

// ==================== Экспорт данных (для таблицы) ====================
function exportUserData() {
    return {
        telegramId: tg.initDataUnsafe?.user?.id,
        name: userData.name,
        phone: userData.phone,
        totalVisits: userData.totalVisits,
        bonusPoints: userData.bonusPoints,
        freeSupCount: userData.freeSupCount,
        referralCode: userData.referralCode,
        visits: userData.visits
    };
}

// Обработка данных от бота
tg.onEvent('viewportChanged', () => {
    tg.expand();
});