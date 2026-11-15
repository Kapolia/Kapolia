import { C } from '@/lib/colors'

export const AUTH_STYLES: string = `
  /* ── Keyframes ─────────────────────────────────────────────────── */

  @keyframes kapolia-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes auth-needle-entry {
    0%   { transform: rotate(-55deg); }
    45%  { transform: rotate(16deg); }
    70%  { transform: rotate(-6deg); }
    88%  { transform: rotate(2deg); }
    100% { transform: rotate(0deg); }
  }

  @keyframes auth-stagger-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes auth-field-shake {
    0%   { transform: translateX(0); }
    15%  { transform: translateX(-4px); }
    35%  { transform: translateX(4px); }
    55%  { transform: translateX(-3px); }
    75%  { transform: translateX(2px); }
    100% { transform: translateX(0); }
  }

  /* ── Aiguille du logo ───────────────────────────────────────────── */

  .auth-needle {
    animation: auth-needle-entry 1150ms cubic-bezier(.35,0,.25,1) 100ms both;
  }

  /* ── Mise en page responsive ────────────────────────────────────── */

  .auth-page {
    padding: 56px 20px 32px;
  }
  .auth-card {
    padding: 36px 36px 32px;
  }
  @media (max-width: 499px) {
    .auth-page { padding: 32px 16px; }
    .auth-card { padding: 28px 20px 24px; }
  }

  /* ── Entrée échelonnée ──────────────────────────────────────────── */

  .auth-stagger > * {
    animation: auth-stagger-in 380ms cubic-bezier(.2,.7,.2,1) both;
  }
  .auth-stagger > *:nth-child(1)  { animation-delay:  80ms; }
  .auth-stagger > *:nth-child(2)  { animation-delay: 135ms; }
  .auth-stagger > *:nth-child(3)  { animation-delay: 190ms; }
  .auth-stagger > *:nth-child(4)  { animation-delay: 245ms; }
  .auth-stagger > *:nth-child(5)  { animation-delay: 300ms; }
  .auth-stagger > *:nth-child(6)  { animation-delay: 355ms; }
  .auth-stagger > *:nth-child(7)  { animation-delay: 410ms; }
  .auth-stagger > *:nth-child(8)  { animation-delay: 465ms; }
  .auth-stagger > *:nth-child(9)  { animation-delay: 520ms; }
  .auth-stagger > *:nth-child(10) { animation-delay: 575ms; }
  .auth-stagger > *:nth-child(11) { animation-delay: 630ms; }
  .auth-stagger > *:nth-child(12) { animation-delay: 685ms; }

  /* ── Champ texte ─────────────────────────────────────────────────── */

  .auth-input {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    font-size: 15px;
    border-radius: 12px;
    border: 1.5px solid #D3D9D5;
    background: ${C.white};
    color: ${C.dark};
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 150ms, box-shadow 200ms;
  }
  .auth-input::placeholder {
    color: #9AA29D;
  }
  .auth-input:focus {
    border-color: ${C.orange};
    box-shadow: 0 0 0 3px rgba(194,97,31,.14);
  }
  .auth-input--error {
    border-color: ${C.erreur};
  }
  .auth-input--pw {
    padding-right: 44px;
  }

  /* ── Wrapper du champ (secousse) ────────────────────────────────── */

  .auth-input-wrap {
    position: relative;
  }
  .auth-input-wrap--shake {
    animation: auth-field-shake 320ms ease both;
  }

  /* ── Bouton œil ──────────────────────────────────────────────────── */

  .auth-eye-btn {
    position: absolute;
    right: 0;
    top: 0;
    width: 44px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .auth-eye-icon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 150ms, transform 200ms;
  }
  .auth-eye-icon--hidden {
    opacity: 0;
    transform: scale(.8);
    pointer-events: none;
  }

  /* ── Bouton principal ────────────────────────────────────────────── */

  .auth-btn-primary {
    width: 100%;
    height: 48px;
    border-radius: 12px;
    border: none;
    background: ${C.orange};
    color: ${C.white};
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    transition: background-color 150ms, transform 120ms;
  }
  .auth-btn-primary:hover:not(:disabled) {
    background: #AF5719;
  }
  .auth-btn-primary:active:not(:disabled) {
    transform: scale(.985);
  }
  .auth-btn-primary:disabled {
    background: ${C.sable};
    color: ${C.grey};
    cursor: default;
  }

  /* ── Bouton Google ───────────────────────────────────────────────── */

  .auth-btn-google {
    width: 100%;
    height: 48px;
    border-radius: 12px;
    border: 1.5px solid #DADCE0;
    background: ${C.white};
    color: ${C.dark};
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: inherit;
    transition: background-color 150ms;
  }
  .auth-btn-google:hover:not(:disabled) {
    background: #F8F9F8;
  }
  .auth-btn-google:disabled {
    color: #9AA29D;
    border-color: ${C.sable};
    cursor: default;
  }

  /* ── Spinner ─────────────────────────────────────────────────────── */

  .auth-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    animation: kapolia-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .auth-btn-primary .auth-spinner {
    border: 2px solid rgba(255,255,255,.35);
    border-top-color: #fff;
  }
  .auth-btn-google .auth-spinner {
    border: 2px solid #D3D9D5;
    border-top-color: ${C.grey};
  }

  /* ── Bloc d'erreur dépliable ─────────────────────────────────────── */

  .auth-err-wrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 240ms cubic-bezier(.2,.7,.2,1);
  }
  .auth-err-wrap--open {
    grid-template-rows: 1fr;
  }
  .auth-err-inner {
    overflow: hidden;
  }
  .auth-err-content {
    background: #FBF1F0;
    border: 1px solid rgba(192,57,43,.2);
    color: ${C.erreur};
    font-size: 14px;
    border-radius: 10px;
    padding: 11px 14px;
    line-height: 1.5;
  }

  /* ── Entrée échelonnée retardée (état envoyé) ───────────────────── */

  .auth-stagger-delayed > * {
    animation: auth-stagger-in 380ms cubic-bezier(.2,.7,.2,1) both;
  }
  .auth-stagger-delayed > *:nth-child(1) { animation-delay: 300ms; }
  .auth-stagger-delayed > *:nth-child(2) { animation-delay: 355ms; }
  .auth-stagger-delayed > *:nth-child(3) { animation-delay: 410ms; }
  .auth-stagger-delayed > *:nth-child(4) { animation-delay: 465ms; }
  .auth-stagger-delayed > *:nth-child(5) { animation-delay: 520ms; }
  .auth-stagger-delayed > *:nth-child(6) { animation-delay: 575ms; }

  /* ── SVG confirmation e-mail ─────────────────────────────────────── */

  @keyframes mdp-circle-draw {
    from { stroke-dashoffset: 138; }
    to   { stroke-dashoffset: 0; }
  }

  @keyframes mdp-check-draw {
    from { stroke-dashoffset: 35; }
    to   { stroke-dashoffset: 0; }
  }

  .mdp-circle {
    stroke-dasharray: 138;
    stroke-dashoffset: 0;
    animation: mdp-circle-draw 500ms cubic-bezier(.4,0,.2,1) both;
  }

  .mdp-check {
    stroke-dasharray: 35;
    stroke-dashoffset: 0;
    animation: mdp-check-draw 300ms cubic-bezier(.4,0,.2,1) 400ms both;
  }

  /* ── prefers-reduced-motion ──────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .auth-needle                { animation: none; }
    .auth-stagger > *           { animation: none; opacity: 1; transform: none; }
    .auth-stagger-delayed > *   { animation: none; opacity: 1; transform: none; }
    .auth-input-wrap--shake     { animation: none; }
    .auth-input                 { transition: none; }
    .auth-eye-icon              { transition: none; }
    .auth-btn-primary           { transition: none; }
    .auth-btn-google            { transition: none; }
    .auth-err-wrap,
    .auth-err-wrap--open        { transition: none; }
    .auth-spinner               { animation: none; }
    .mdp-circle                 { animation: none; stroke-dashoffset: 0; }
    .mdp-check                  { animation: none; stroke-dashoffset: 0; }
  }
`
