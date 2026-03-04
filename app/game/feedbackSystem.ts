// @ts-ignore
import confetti from 'canvas-confetti';

// --- 1. Audio Requirement ---
// Use the new sound files from Firebase Storage
const successSoundUrl = 'https://firebasestorage.googleapis.com/v0/b/resparke-hub.firebasestorage.app/o/trivia%2Fassets%2Fright-answer.mp3?alt=media';
const wrongSoundUrl = 'https://firebasestorage.googleapis.com/v0/b/resparke-hub.firebasestorage.app/o/trivia%2Fassets%2Fwrong-answer.mp3?alt=media';

const successSound = typeof Audio !== 'undefined' ? new Audio(successSoundUrl) : null;
const wrongSound = typeof Audio !== 'undefined' ? new Audio(wrongSoundUrl) : null;

let isSoundEnabled = true;

if (successSound) {
  successSound.preload = 'auto';
}
if (wrongSound) {
  wrongSound.preload = 'auto';
}

export function setSoundEnabled(enabled: boolean) {
  isSoundEnabled = enabled;
}

export function playSuccessSound() {
  if (successSound && isSoundEnabled) {
    successSound.currentTime = 0;
    successSound.play().catch(e => console.warn("Audio play failed", e));
  }
}

export function playWrongSound() {
  if (wrongSound && isSoundEnabled) {
    wrongSound.currentTime = 0;
    wrongSound.play().catch(e => console.warn("Audio play failed", e));
  }
}

function triggerConfetti(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  // Handle potential import mismatch and ensure zIndex is high enough
  const fire = typeof confetti === 'function' ? confetti : (confetti as any).default;

  fire({
    particleCount: 100,
    spread: 70,
    origin: { x, y },
    zIndex: 2000,
  });
}

export function triggerCorrectFeedback(element: HTMLElement, type: 'flip' | 'confetti' | 'pulse') {
  if (!element) return;

  playSuccessSound();

  switch (type) {
    case 'flip':
    case 'pulse':
      const animationClass = `animation-${type}`;
      const onAnimationEnd = () => {
        element.classList.remove(animationClass);
        element.removeEventListener('animationend', onAnimationEnd);
      };
      element.classList.add(animationClass);
      element.addEventListener('animationend', onAnimationEnd);
      break;

    case 'confetti':
      triggerConfetti(element);
      element.classList.add('feedback-correct');
      setTimeout(() => element.classList.remove('feedback-correct'), 600);
      break;
  }
}

export function triggerWrongFeedback(element: HTMLElement) {
  if (!element) return;

  playWrongSound();

  const animationClass = 'animation-shake';
  const onAnimationEnd = () => {
    element.classList.remove(animationClass);
    element.removeEventListener('animationend', onAnimationEnd);
  };
  element.classList.add(animationClass);
  element.addEventListener('animationend', onAnimationEnd);
}