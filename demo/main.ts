import { demoMethod } from 'gamepad_standardizer';

const out = document.getElementById('out')!;

setInterval(() => {
  out.textContent = JSON.stringify(demoMethod(), null, 2);
}, 500);
