const tg = window.Telegram.WebApp;

if(tg){
  tg.ready();
  tg.expand();
}

const BOT_USERNAME = 'owstroginobot';

let user = {
  name:'Гость',
  username:'',
  bonus:0,
  visits:0,
  spins:1,
  history:[]
};

let supCount = 1;
let spinning = false;
let rotation = 0;

function init(){

  loadUser();
  setupTabs();
  generateTimes();
  setupEvents();
  updateUI();

}

function loadUser(){

  const tgUser = tg?.initDataUnsafe?.user;

  if(tgUser){
    user.name = tgUser.first_name || 'Гость';
    user.username = tgUser.username || '';
    user.id = tgUser.id;
  }

  const saved = localStorage.getItem('ow_user');

  if(saved){
    user = {...user,...JSON.parse(saved)};
  }

  saveUser();

}

function saveUser(){
  localStorage.setItem('ow_user',JSON.stringify(user));
}

function setupTabs(){

  document.querySelectorAll('.tab').forEach(tab=>{

    tab.addEventListener('click',()=>{

      document.querySelectorAll('.tab').forEach(t=>{
        t.classList.remove('active');
      });

      document.querySelectorAll('.tab-content').forEach(c=>{
        c.classList.remove('active');
      });

      tab.classList.add('active');

      document
        .getElementById(tab.dataset.tab + '-tab')
        .classList.add('active');

    });

  });

}

function generateTimes(){

  const select = document.getElementById('time');

  for(let i=10;i<=21;i++){

    const option = document.createElement('option');

    option.value = `${i}:00`;
    option.textContent = `${i}:00`;

    select.appendChild(option);

  }

}

function setupEvents(){

  ['date','duration','useBonus'].forEach(id=>{

    document
      .getElementById(id)
      .addEventListener('change',updatePrice);

  });

}

function updateUI(){

  document.getElementById('bonusBalance').textContent = user.bonus;
  document.getElementById('bonusBalance2').textContent = user.bonus;

  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileBonus').textContent = user.bonus;
  document.getElementById('profileVisits').textContent = user.visits;

  document.getElementById('refLink').value =
    `https://t.me/${BOT_USERNAME}?start=${user.id}`;

  renderHistory();
  updatePrice();

}

function changeSup(value){

  supCount += value;

  if(supCount < 1){
    supCount = 1;
  }

  if(supCount > 10){
    supCount = 10;
  }

  document.getElementById('supCount').textContent = supCount;

  updatePrice();

}

function updatePrice(){

  const duration = Number(
    document.getElementById('duration').value
  );

  let total = duration * supCount * 1500;

  const useBonus =
    document.getElementById('useBonus').checked;

  if(useBonus && user.bonus > 0){

    total -= user.bonus;

    if(total < 0){
      total = 0;
    }

  }

  document.getElementById('price').textContent =
    `${duration * supCount * 1500} ₽`;

  document.getElementById('total').textContent =
    `${total} ₽`;

}

function createBooking(){

  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;

  if(!date){

    alert('Выберите дату');
    return;

  }

  const duration = Number(
    document.getElementById('duration').value
  );

  const total = parseInt(
    document.getElementById('total')
      .textContent
      .replace(/\D/g,'')
  );

  const useBonus =
    document.getElementById('useBonus').checked;

  if(useBonus){

    user.bonus = 0;

  }

  user.bonus += Math.floor(total * 0.05);

  user.visits += 1;
  user.spins += 1;

  user.history.push({
    date:`${date} ${time}`,
    price:total,
    duration,
    sup:supCount
  });

  saveUser();
  updateUI();

  alert('Заявка отправлена ✅');

}

function renderHistory(){

  const history = document.getElementById('history');

  if(user.history.length === 0){

    history.innerHTML = '<p>История пуста</p>';
    return;

  }

  history.innerHTML = user.history
    .slice()
    .reverse()
    .map(item=>`

      <div class="history-item">
        <strong>${item.date}</strong>
        <br><br>
        ${item.sup} SUP • ${item.duration} ч
        <br><br>
        <strong>${item.price} ₽</strong>
      </div>

    `)
    .join('');

}

function spinWheel(){

  if(spinning){
    return;
  }

  if(user.spins <= 0){

    alert('Нет прокруток');
    return;

  }

  spinning = true;

  user.spins -= 1;

  const wheel = document.getElementById('wheel');

  const prizes = [
    50,
    100,
    150,
    200,
    0,
    300,
    20,
    500
  ];

  const randomIndex =
    Math.floor(Math.random() * prizes.length);

  const prize = prizes[randomIndex];

  rotation += 360 * 5 + (randomIndex * 45);

  wheel.style.transform = `rotate(${rotation}deg)`;

  setTimeout(()=>{

    user.bonus += prize;

    document.getElementById('wheelResult').textContent =
      prize === 0
        ? '😅 Повезет позже'
        : `💎 +${prize} бонусов`;

    saveUser();
    updateUI();

    spinning = false;

  },5000);

}

function copyRef(){

  const value = document.getElementById('refLink').value;

  navigator.clipboard.writeText(value);

  alert('Ссылка скопирована');

}

init();
