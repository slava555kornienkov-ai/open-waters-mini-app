const tg = window.Telegram.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

const BOT_USERNAME = 'owstroginobot';
const APP_LINK = 'https://t.me/owstroginobot/owstrogino';
const ADMIN_USERNAME = 'stemmmmmystyle';

const PRICES = {
    weekday: {
        1: 1700,
        2: 2800,
        3: 3800,
        4: 4700,
        extra: 600
    },
    weekend: {
        1: 2000,
        2: 3200,
        3: 4200,
        4: 5000,
        extra: 700
    }
};

const EXTRA_PRICES = {
    instructor: 2000,
    rescue: 2500
};

let user = {
    id: null,
    name: 'Гость',
    username: '',
    bonus: 0,
    visits: 0,
    freeHours: 0,
    spins: 1,
    referrals: 0,
    history: []
};

let currentBoards = 1;
let spinning = false;
let currentRotation = 0;

function init() {

    loadUser();
    setupTabs();
    generateTimeSlots();
    setupEvents();
    updateUI();

}

function loadUser() {

    const tgUser = tg?.initDataUnsafe?.user;

    if (tgUser) {

        user.id = tgUser.id;
        user.name = tgUser.first_name || 'Гость';
        user.username = tgUser.username || '';

    }

    const savedUser = localStorage.getItem('ow_user');

    if (savedUser) {

        user = {
            ...user,
            ...JSON.parse(savedUser)
        };

    }

    saveUser();

}

function saveUser() {

    localStorage.setItem('ow_user', JSON.stringify(user));

}

function setupTabs() {

    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {

        tab.addEventListener('click', () => {

            document.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('active');
            });

            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
            });

            tab.classList.add('active');

            const target = tab.dataset.tab;

            document
                .getElementById(`${target}-tab`)
                .classList.add('active');

        });

    });

}

function generateTimeSlots() {

    const select = document.getElementById('bookingTime');

    if (!select) return;

    select.innerHTML = '';

    for (let hour = 10; hour <= 21; hour++) {

        const option = document.createElement('option');

        option.value = `${hour}:00`;
        option.textContent = `${hour}:00`;

        select.appendChild(option);

    }

}

function setupEvents() {

    const ids = [
        'bookingDate',
        'bookingDuration',
        'instructor',
        'rescue',
        'useBonuses'
    ];

    ids.forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.addEventListener('change', updatePrice);
        }

    });

}

function updateUI() {

    setText('welcomeText', `Привет, ${user.name}`);
    setText('bonusBalance', user.bonus);
    setText('bonusBalance2', user.bonus);

    setText('visitsCount', user.visits);
    setText('freeHours', user.freeHours);
    setText('spinsCount', user.spins);

    setText('profileName', user.name);
    setText(
        'profileTelegram',
        '@' + (user.username || 'unknown')
    );

    setText('profileRefs', user.referrals);

    const avatar = document.getElementById('avatar');

    if (avatar) {
        avatar.textContent = user.name[0];
    }

    const refLink = document.getElementById('refLink');

    if (refLink) {
        refLink.value =
            `https://t.me/${BOT_USERNAME}?start=${user.id}`;
    }

    updateRank();
    updateProgress();
    renderHistory();
    updatePrice();

}

function updateRank() {

    let rank = '🌊 Новичок';

    if (user.visits >= 5) {
        rank = '🏄 Райдер';
    }

    if (user.visits >= 15) {
        rank = '🔥 Wave Master';
    }

    if (user.visits >= 30) {
        rank = '👑 Legend';
    }

    setText('userRank', rank);

}

function updateProgress() {

    const progressFill =
        document.getElementById('progressFill');

    const nextReward =
        document.getElementById('nextReward');

    if (!progressFill || !nextReward) return;

    const progress = (user.visits % 5) * 20;

    progressFill.style.width = `${progress}%`;

    const remaining =
        5 - (user.visits % 5 || 5);

    nextReward.textContent =
        `До награды: ${remaining}`;

}

function renderHistory() {

    const history =
        document.getElementById('history');

    if (!history) return;

    if (!user.history.length) {

        history.innerHTML =
            '<p class="muted">Пока нет бронирований</p>';

        return;

    }

    history.innerHTML =
        user.history
            .slice()
            .reverse()
            .map(item => `

                <div class="history-item">
                    <strong>${item.date}</strong>
                    <br><br>

                    <small>
                        ${item.count} SUP •
                        ${item.duration} ч
                    </small>

                    <br><br>

                    <strong>${item.price} ₽</strong>
                </div>

            `)
            .join('');

}

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}

function changeBoards(value) {

    currentBoards += value;

    if (currentBoards < 1) {
        currentBoards = 1;
    }

    if (currentBoards > 15) {
        currentBoards = 15;
    }

    setText('boardsCount', currentBoards);

    updatePrice();

}

function updatePrice() {

    const date =
        document.getElementById('bookingDate')?.value;

    if (!date) return;

    const duration =
        Number(
            document.getElementById(
                'bookingDuration'
            )?.value
        ) || 1;

    const weekend =
        [0, 6].includes(
            new Date(date).getDay()
        );

    const pricing =
        weekend
            ? PRICES.weekend
            : PRICES.weekday;

    let supPrice = 0;

    if (duration <= 4) {

        supPrice =
            pricing[duration] * currentBoards;

    } else {

        supPrice =
            (
                pricing[4] +
                ((duration - 4) * pricing.extra)
            ) * currentBoards;

    }

    let extrasPrice = 0;

    if (
        document.getElementById('instructor')?.checked
    ) {

        extrasPrice +=
            EXTRA_PRICES.instructor * duration;

    }

    if (
        document.getElementById('rescue')?.checked
    ) {

        extrasPrice +=
            EXTRA_PRICES.rescue * duration;

    }

    let total =
        supPrice + extrasPrice;

    let bonusDiscount = 0;

    const useBonus =
        document.getElementById('useBonuses')
            ?.checked;

    if (useBonus && user.bonus > 0) {

        bonusDiscount =
            Math.min(user.bonus, total);

        total -= bonusDiscount;

    }

    setText('supPrice', `${supPrice} ₽`);
    setText('extrasPrice', `${extrasPrice} ₽`);
    setText(
        'bonusDiscount',
        `−${bonusDiscount} ₽`
    );

    setText('totalPrice', `${total} ₽`);

}

function createBooking() {

    const date =
        document.getElementById('bookingDate')
            ?.value;

    const time =
        document.getElementById('bookingTime')
            ?.value;

    if (!date || !time) {

        tg.showAlert(
            'Выберите дату и время'
        );

        return;

    }

    const duration =
        Number(
            document.getElementById(
                'bookingDuration'
            ).value
        );

    const totalText =
        document.getElementById('totalPrice')
            .textContent;

    const total =
        parseInt(
            totalText.replace(/\D/g, '')
        );

    user.history.push({
        date: `${date} ${time}`,
        duration,
        count: currentBoards,
        price: total
    });

    user.visits += 1;
    user.spins += 1;

    const reward =
        Math.floor(total * 0.05);

    user.bonus += reward;

    const useBonuses =
        document.getElementById('useBonuses')
            ?.checked;

    if (useBonuses) {

        const discount =
            parseInt(
                document
                    .getElementById(
                        'bonusDiscount'
                    )
                    .textContent
                    .replace(/\D/g, '')
            ) || 0;

        user.bonus -= discount;

        if (user.bonus < 0) {
            user.bonus = 0;
        }

    }

    if (user.visits % 5 === 0) {

        user.freeHours += 1;

        tg.showAlert(
            '🎁 Вы получили бесплатный час!'
        );

    }

    saveUser();
    updateUI();

    sendAdminNotification({
        date,
        time,
        duration,
        total
    });

    tg.showAlert(
        '✅ Заявка отправлена!'
    );

}

function sendAdminNotification(data) {

    const text = encodeURIComponent(

`🌊 Новая заявка Open Waters

👤 ${user.name}
📅 ${data.date} ${data.time}
🏄 ${currentBoards} SUP
⏱ ${data.duration} ч
💰 ${data.total} ₽

${APP_LINK}`

    );

    tg.openTelegramLink(
        `https://t.me/${ADMIN_USERNAME}?text=${text}`
    );

}

function spinWheel() {

    if (spinning) return;

    if (user.spins <= 0) {

        tg.showAlert(
            'Нет доступных прокруток'
        );

        return;

    }

    spinning = true;

    user.spins -= 1;

    const prizes = [

        {
            type: 'bonus',
            value: 50,
            text: '💎 +50 бонусов'
        },

        {
            type: 'bonus',
            value: 100,
            text: '💎 +100 бонусов'
        },

        {
            type: 'free',
            value: 1,
            text: '🎁 Бесплатный час'
        },

        {
            type: 'bonus',
            value: 200,
            text: '💎 +200 бонусов'
        },

        {
            type: 'discount',
            value: 10,
            text: '🏷 Скидка 10%'
        },

        {
            type: 'none',
            value: 0,
            text: '😅 Повезет позже'
        },

        {
            type: 'discount',
            value: 20,
            text: '🏷 Скидка 20%'
        },

        {
            type: 'merch',
            value: 0,
            text: '🧢 Мерч Open Waters'
        }

    ];

    const index =
        Math.floor(
            Math.random() * prizes.length
        );

    const prize = prizes[index];

    const wheel =
        document.getElementById('wheel');

    const result =
        document.getElementById('wheelResult');

    currentRotation +=
        360 * 6 + (index * 45);

    wheel.style.transform =
        `rotate(-${currentRotation}deg)`;

    setTimeout(() => {

        if (prize.type === 'bonus') {
            user.bonus += prize.value;
        }

        if (prize.type === 'free') {
            user.freeHours += 1;
        }

        result.textContent = prize.text;

        saveUser();
        updateUI();

        spinning = false;

    }, 5200);

}

function copyRef() {

    const value =
        document.getElementById('refLink').value;

    navigator.clipboard.writeText(value);

    tg.showAlert(
        'Ссылка скопирована'
    );

}

function shareRef() {

    const text = encodeURIComponent(

`🌊 Погнали кататься на SUP!

🎁 Получи бонусы:
https://t.me/${BOT_USERNAME}?start=${user.id}`

    );

    tg.openTelegramLink(
        `https://t.me/share/url?url=&text=${text}`
    );

}

function openWheelTab() {

    document
        .querySelector('[data-tab="wheel"]')
        .click();

}

init();
