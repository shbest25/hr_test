// 화면 부품: 서랍(오른쪽 패널), 확인창, 토스트, 폼 칸.
import { el } from './dom.js';
import { icon } from './icons.js';

export const chip = (child) => el('span', { class: 'chip' }, child);

export function iconButton(name, title, onClick, disabled = false) {
  return el('button', { type: 'button', class: 'icon-btn', title, 'aria-label': title, disabled, onclick: onClick }, icon(name));
}

export function field(label, control, help = '') {
  return el('label', { class: 'field' },
    el('span', { class: 'f-label' }, label),
    control,
    help ? el('span', { class: 'f-help' }, help) : null);
}

// 서랍은 한 번에 하나만 연다. 새로 열면 먼저 것은 닫힌다.
let current = null;

export function openDrawer({ title, lead = null, body, footer = null, onClose = null }) {
  current?.close();
  const backdrop = el('div', { class: 'backdrop' });
  const panel = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('header', { class: 'd-head' }, lead, el('h3', {}, title), iconButton('close', '닫기', () => close())),
    el('div', { class: 'd-body' }, body),
    footer ? el('footer', { class: 'd-foot' }, footer) : null);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (current !== ctl) return;
    current = null;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    panel.remove();
    onClose?.();
  }
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, panel);
  // 한 번 레이아웃을 읽어 시작 위치를 확정한 뒤 열어야 미끄러져 들어오는 움직임이 난다(rAF 는 숨겨진 탭에서 멈춘다).
  panel.getBoundingClientRect();
  panel.classList.add('open');

  const ctl = { close, panel };
  current = ctl;
  return ctl;
}

// 예/아니오를 묻는다. 결과는 true/false 로 돌아온다.
export function confirmBox({ title, message = '', confirm = '확인', cancel = '취소', danger = false }) {
  return new Promise((resolve) => {
    const done = (ok) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(ok); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    const wrap = el('div', { class: 'confirm', onclick: (e) => { if (e.target === wrap) done(false); } },
      el('div', { class: 'confirm-box', role: 'alertdialog' },
        el('h4', {}, title),
        message ? el('p', {}, message) : null,
        el('div', { class: 'confirm-actions' },
          el('button', { type: 'button', class: 'btn ghost', onclick: () => done(false) }, cancel),
          el('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, confirm))));
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    wrap.querySelector('.btn.ghost').focus();
  });
}

let toastNode = null;
let toastTimer = 0;
export function toast(text) {
  if (!toastNode) {
    toastNode = el('div', { class: 'toast', role: 'status' });
    document.body.append(toastNode);
  }
  toastNode.textContent = text;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2200);
}
