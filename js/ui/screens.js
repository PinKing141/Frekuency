const screens = {
  start:   document.querySelector('#screen-start'),
  setup:   document.querySelector('#screen-setup'),
  game:    document.querySelector('#screen-game'),
  lobby:   document.querySelector('#screen-lobby'),
  waiting: document.querySelector('#screen-waiting')
};

export function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}
